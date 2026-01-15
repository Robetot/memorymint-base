// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./7_Minting.sol";

/**
 * @title MemoryMint Ultra V3 - Final Contract
 * @notice Part 8/8 - Claims, Admin, and Constructor
 * @author MemoryMint Team
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 * 
 * Complete feature set:
 * - Unlimited supply ERC-721
 * - Dynamic pricing (level-based & supply-threshold)
 * - Dynamic claim bonuses
 * - ETH & USDC payments
 * - Anti-bot protection
 * - Signature verification
 * - Kill switch & pause controls
 * - Batch minting
 */

contract MemoryMintUltraV3 is MemoryMintMinting {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Initializes the contract
     * @param name_ The token collection name
     * @param symbol_ The token collection symbol
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        owner = msg.sender;
        _reentrancyStatus = NOT_ENTERED;
        
        // Default configuration
        mintPriceETH = 0.001 ether;
        mintPriceUSDC = 1_000_000; // 1 USDC (6 decimals)
        maxPriceETH = 1 ether;
        maxPriceUSDC = 1000_000_000; // 1000 USDC
        
        currencyConfig = CurrencyConfig({
            ethEnabled: true,
            usdcEnabled: false,
            activeCurrency: PaymentCurrency.ETH
        });
        
        // Dynamic features disabled by default (backward compatible)
        dynamicPricingConfig = DynamicPricingConfig({
            enabled: false,
            priority: ResolutionPriority.LEVEL_ONLY,
            activeLevelCount: 0,
            activeSupplyTierCount: 0
        });
        
        dynamicBonusConfig = DynamicBonusConfig({
            enabled: false,
            priority: ResolutionPriority.LEVEL_ONLY,
            activeLevelCount: 0,
            activeSupplyTierCount: 0
        });
        
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC BONUS RESOLUTION
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Resolves effective bonus based on dynamic config
     */
    function _resolveDynamicBonus(uint8 level, PaymentCurrency currency) internal view returns (uint256) {
        if (!dynamicBonusConfig.enabled) {
            // Use V2 static bonus
            BonusConfig storage bc = bonusLevels[level];
            if (!bc.isActive) return 0;
            return currency == PaymentCurrency.ETH ? bc.bonusAmountETH : bc.bonusAmountUSDC;
        }
        
        ResolutionPriority priority = dynamicBonusConfig.priority;
        
        if (priority == ResolutionPriority.LEVEL_ONLY) {
            return _resolveLevelBonus(level, currency);
        }
        
        if (priority == ResolutionPriority.SUPPLY_ONLY) {
            return _resolveSupplyBonus(currency);
        }
        
        if (priority == ResolutionPriority.SUPPLY_OVERRIDES) {
            uint256 supplyBonus = _resolveSupplyBonus(currency);
            if (supplyBonus > 0) return supplyBonus;
            return _resolveLevelBonus(level, currency);
        }
        
        // LEVEL_OVERRIDES
        uint256 levelBonus = _resolveLevelBonus(level, currency);
        if (levelBonus > 0) return levelBonus;
        return _resolveSupplyBonus(currency);
    }
    
    /**
     * @dev Resolves bonus based on level (1-20)
     */
    function _resolveLevelBonus(uint8 level, PaymentCurrency currency) internal view returns (uint256) {
        if (level == 0 || level > MAX_LEVELS) return 0;
        
        LevelBonus storage lb = levelBonuses[level];
        if (!lb.isActive) return 0;
        
        return currency == PaymentCurrency.ETH ? lb.bonusETH : lb.bonusUSDC;
    }
    
    /**
     * @dev Resolves bonus based on totalMinted thresholds
     */
    function _resolveSupplyBonus(PaymentCurrency currency) internal view returns (uint256) {
        uint256 currentSupply = totalMinted;
        
        for (uint8 i = 0; i < MAX_SUPPLY_TIERS; i++) {
            SupplyBonusTier storage tier = supplyBonusTiers[i];
            if (!tier.isActive) continue;
            
            bool inRange = currentSupply >= tier.minSupply &&
                          (tier.maxSupply == 0 || currentSupply < tier.maxSupply);
            
            if (inRange) {
                return currency == PaymentCurrency.ETH ? tier.bonusETH : tier.bonusUSDC;
            }
        }
        
        return 0;
    }
    
    /**
     * @notice Public view to get effective bonus
     * @param level The bonus level
     * @param currency The currency (0=ETH, 1=USDC)
     */
    function getEffectiveBonus(uint8 level, uint8 currency) external view returns (uint256) {
        return _resolveDynamicBonus(level, PaymentCurrency(currency));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CLAIM BONUS FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Claim bonus rewards
     * @param level The bonus level to claim
     */
    function claimBonus(uint256 level) external 
        whenNotKilled 
        whenClaimsNotPaused 
        nonReentrant 
    {
        if (claimMode == ClaimMode.DISABLED) revert NotEligible();
        
        WalletData storage data = walletData[msg.sender];
        
        // Check eligibility
        if (data.mintCount < eligibilityRules.minMintCount) revert NotEligible();
        if (eligibilityRules.claimCooldown > 0) {
            if (block.timestamp < data.lastClaimTime + eligibilityRules.claimCooldown) {
                revert ClaimCooldownActive();
            }
        }
        if (eligibilityRules.requireAllowlist && !allowlist[msg.sender]) {
            revert NotEligible();
        }
        
        // Resolve bonus amount dynamically
        uint256 bonusAmount;
        PaymentCurrency currency = currencyConfig.activeCurrency;
        
        if (dynamicBonusConfig.enabled) {
            bonusAmount = _resolveDynamicBonus(uint8(level), currency);
        } else {
            // V2 static bonus
            BonusConfig storage bc = bonusLevels[level];
            if (!bc.isActive) revert NoBonusAvailable();
            if (data.mintCount < bc.minMintCount) revert NotEligible();
            bonusAmount = currency == PaymentCurrency.ETH ? bc.bonusAmountETH : bc.bonusAmountUSDC;
        }
        
        if (bonusAmount == 0) revert NoBonusAvailable();
        
        // Check cap
        if (bonusCapPerWallet > 0 && data.totalBonusClaimed + bonusAmount > bonusCapPerWallet) {
            revert BonusCapExceeded();
        }
        
        // Update state before transfer (CEI)
        data.claimCount++;
        data.lastClaimTime = block.timestamp;
        data.totalBonusClaimed += bonusAmount;
        
        // Transfer bonus
        if (currency == PaymentCurrency.ETH) {
            if (bonusPoolETH < bonusAmount) revert InsufficientContractBalance();
            bonusPoolETH -= bonusAmount;
            totalBonusClaimedETH += bonusAmount;
            
            (bool success, ) = msg.sender.call{value: bonusAmount}("");
            if (!success) revert TransferFailed();
        } else {
            if (bonusPoolUSDC < bonusAmount) revert InsufficientContractBalance();
            bonusPoolUSDC -= bonusAmount;
            totalBonusClaimedUSDC += bonusAmount;
            
            address usdcAddress = _getUSDCAddress();
            if (!IERC20(usdcAddress).transfer(msg.sender, bonusAmount)) {
                revert TransferFailed();
            }
        }
        
        emit BonusClaimed(msg.sender, bonusAmount, uint8(currency), level);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC PRICING ADMIN
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Enable or disable dynamic pricing
     */
    function setDynamicPricingEnabled(bool enabled) external onlyOwner {
        dynamicPricingConfig.enabled = enabled;
        emit DynamicPricingEnabled(enabled);
    }
    
    /**
     * @notice Set dynamic pricing resolution priority
     */
    function setDynamicPricingResolution(ResolutionPriority priority) external onlyOwner {
        dynamicPricingConfig.priority = priority;
        emit DynamicPricingResolutionUpdated(uint8(priority));
    }
    
    /**
     * @notice Set level-based price (1-20)
     */
    function setLevelPrice(
        uint8 level,
        uint256 priceETH,
        uint256 priceUSDC,
        bool isActive
    ) external onlyOwner validLevel(level) {
        if (priceETH > maxPriceETH || priceUSDC > maxPriceUSDC) revert PriceExceedsMaximum();
        
        levelPrices[level] = LevelPrice({
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            isActive: isActive
        });
        
        // Update active count
        uint8 count = 0;
        for (uint8 i = 1; i <= MAX_LEVELS; i++) {
            if (levelPrices[i].isActive) count++;
        }
        dynamicPricingConfig.activeLevelCount = count;
        
        emit LevelPriceUpdated(level, priceETH, priceUSDC, isActive);
    }
    
    /**
     * @notice Batch set level prices
     */
    function batchSetLevelPrices(
        uint8[] calldata levels,
        uint256[] calldata pricesETH,
        uint256[] calldata pricesUSDC,
        bool[] calldata activeFlags
    ) external onlyOwner {
        uint256 len = levels.length;
        if (len != pricesETH.length || len != pricesUSDC.length || len != activeFlags.length) {
            revert InvalidAmount();
        }
        
        for (uint256 i = 0; i < len; ) {
            uint8 level = levels[i];
            if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
            if (pricesETH[i] > maxPriceETH || pricesUSDC[i] > maxPriceUSDC) revert PriceExceedsMaximum();
            
            levelPrices[level] = LevelPrice({
                priceETH: pricesETH[i],
                priceUSDC: pricesUSDC[i],
                isActive: activeFlags[i]
            });
            
            emit LevelPriceUpdated(level, pricesETH[i], pricesUSDC[i], activeFlags[i]);
            
            unchecked { i++; }
        }
        
        // Update active count
        uint8 count = 0;
        for (uint8 i = 1; i <= MAX_LEVELS; i++) {
            if (levelPrices[i].isActive) count++;
        }
        dynamicPricingConfig.activeLevelCount = count;
    }
    
    /**
     * @notice Set supply-threshold price tier
     */
    function setSupplyPriceTier(
        uint8 tierId,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 priceETH,
        uint256 priceUSDC,
        bool isActive
    ) external onlyOwner validTier(tierId) {
        if (priceETH > maxPriceETH || priceUSDC > maxPriceUSDC) revert PriceExceedsMaximum();
        if (maxSupply != 0 && maxSupply <= minSupply) revert InvalidAmount();
        
        supplyPriceTiers[tierId] = SupplyTier({
            minSupply: minSupply,
            maxSupply: maxSupply,
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            isActive: isActive
        });
        
        // Update active count
        uint8 count = 0;
        for (uint8 i = 0; i < MAX_SUPPLY_TIERS; i++) {
            if (supplyPriceTiers[i].isActive) count++;
        }
        dynamicPricingConfig.activeSupplyTierCount = count;
        
        emit SupplyTierUpdated(tierId, minSupply, maxSupply, priceETH, priceUSDC, isActive);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC BONUS ADMIN
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Enable or disable dynamic bonuses
     */
    function setDynamicBonusEnabled(bool enabled) external onlyOwner {
        dynamicBonusConfig.enabled = enabled;
        emit DynamicBonusEnabled(enabled);
    }
    
    /**
     * @notice Set dynamic bonus resolution priority
     */
    function setDynamicBonusResolution(ResolutionPriority priority) external onlyOwner {
        dynamicBonusConfig.priority = priority;
        emit DynamicBonusResolutionUpdated(uint8(priority));
    }
    
    /**
     * @notice Set level-based bonus (1-20)
     */
    function setLevelBonus(
        uint8 level,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool isActive
    ) external onlyOwner validLevel(level) {
        levelBonuses[level] = LevelBonus({
            bonusETH: bonusETH,
            bonusUSDC: bonusUSDC,
            isActive: isActive
        });
        
        // Update active count
        uint8 count = 0;
        for (uint8 i = 1; i <= MAX_LEVELS; i++) {
            if (levelBonuses[i].isActive) count++;
        }
        dynamicBonusConfig.activeLevelCount = count;
        
        emit LevelBonusUpdated(level, bonusETH, bonusUSDC, isActive);
    }
    
    /**
     * @notice Batch set level bonuses
     */
    function batchSetLevelBonuses(
        uint8[] calldata levels,
        uint256[] calldata bonusesETH,
        uint256[] calldata bonusesUSDC,
        bool[] calldata activeFlags
    ) external onlyOwner {
        uint256 len = levels.length;
        if (len != bonusesETH.length || len != bonusesUSDC.length || len != activeFlags.length) {
            revert InvalidAmount();
        }
        
        for (uint256 i = 0; i < len; ) {
            uint8 level = levels[i];
            if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
            
            levelBonuses[level] = LevelBonus({
                bonusETH: bonusesETH[i],
                bonusUSDC: bonusesUSDC[i],
                isActive: activeFlags[i]
            });
            
            emit LevelBonusUpdated(level, bonusesETH[i], bonusesUSDC[i], activeFlags[i]);
            
            unchecked { i++; }
        }
        
        // Update active count
        uint8 count = 0;
        for (uint8 i = 1; i <= MAX_LEVELS; i++) {
            if (levelBonuses[i].isActive) count++;
        }
        dynamicBonusConfig.activeLevelCount = count;
    }
    
    /**
     * @notice Set supply-threshold bonus tier
     */
    function setSupplyBonusTier(
        uint8 tierId,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool isActive
    ) external onlyOwner validTier(tierId) {
        if (maxSupply != 0 && maxSupply <= minSupply) revert InvalidAmount();
        
        supplyBonusTiers[tierId] = SupplyBonusTier({
            minSupply: minSupply,
            maxSupply: maxSupply,
            bonusETH: bonusETH,
            bonusUSDC: bonusUSDC,
            isActive: isActive
        });
        
        // Update active count
        uint8 count = 0;
        for (uint8 i = 0; i < MAX_SUPPLY_TIERS; i++) {
            if (supplyBonusTiers[i].isActive) count++;
        }
        dynamicBonusConfig.activeSupplyTierCount = count;
        
        emit SupplyBonusTierUpdated(tierId, minSupply, maxSupply, bonusETH, bonusUSDC, isActive);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // V2 ADMIN FUNCTIONS (PRESERVED)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Transfer contract ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @notice Set mint pause state
     */
    function setMintPaused(bool paused) external onlyOwner {
        mintPaused = paused;
        emit ContractPaused(paused);
    }
    
    /**
     * @notice Activate kill switch (emergency stop)
     */
    function activateKillSwitch() external onlyOwner {
        killSwitch = true;
        emit KillSwitchActivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Deactivate kill switch
     */
    function deactivateKillSwitch() external onlyOwner {
        killSwitch = false;
        emit KillSwitchDeactivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Set claims pause state
     */
    function setClaimsPaused(bool paused) external onlyOwner {
        claimsPaused = paused;
        emit ClaimsPausedUpdated(paused);
    }
    
    /**
     * @notice Set static mint prices
     */
    function setMintPrice(uint256 priceETH, uint256 priceUSDC) external onlyOwner {
        if (priceETH > maxPriceETH || priceUSDC > maxPriceUSDC) revert PriceExceedsMaximum();
        mintPriceETH = priceETH;
        mintPriceUSDC = priceUSDC;
        emit MintPriceUpdated(priceETH, priceUSDC);
    }
    
    /**
     * @notice Set maximum price caps
     */
    function setMaxPriceCap(uint256 maxETH, uint256 maxUSDC) external onlyOwner {
        maxPriceETH = maxETH;
        maxPriceUSDC = maxUSDC;
        emit MaxPriceCapUpdated(maxETH, maxUSDC);
    }
    
    /**
     * @notice Configure currency settings
     */
    function setCurrencyConfig(
        bool ethEnabled,
        bool usdcEnabled,
        PaymentCurrency activeCurrency
    ) external onlyOwner {
        currencyConfig = CurrencyConfig({
            ethEnabled: ethEnabled,
            usdcEnabled: usdcEnabled,
            activeCurrency: activeCurrency
        });
        emit CurrencyUpdated(ethEnabled, usdcEnabled, uint8(activeCurrency));
    }
    
    /**
     * @notice Set anti-bot mode
     */
    function setAntiBotMode(AntiBotMode mode) external onlyOwner {
        antiBotMode = mode;
        emit AntiBotModeUpdated(uint8(mode));
    }
    
    /**
     * @notice Set wallet mint limit
     */
    function setWalletMintLimit(uint256 limit) external onlyOwner {
        walletMintLimit = limit;
        emit MintLimitUpdated(limit);
    }
    
    /**
     * @notice Set mint cooldown
     */
    function setMintCooldown(uint256 cooldown) external onlyOwner {
        mintCooldown = cooldown;
        emit ThrottleUpdated(cooldown);
    }
    
    /**
     * @notice Set signature verifier address
     */
    function setSignatureVerifier(address verifier) external onlyOwner {
        if (verifier == address(0)) revert InvalidAddress();
        signatureVerifier = verifier;
        emit SignerUpdated(verifier);
    }
    
    /**
     * @notice Update allowlist
     */
    function setAllowlist(address wallet, bool status) external onlyOwner {
        allowlist[wallet] = status;
        emit AllowlistUpdated(wallet, status);
    }
    
    /**
     * @notice Batch update allowlist
     */
    function batchSetAllowlist(address[] calldata wallets, bool status) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; ) {
            allowlist[wallets[i]] = status;
            emit AllowlistUpdated(wallets[i], status);
            unchecked { i++; }
        }
    }
    
    /**
     * @notice Set claim mode
     */
    function setClaimMode(ClaimMode mode) external onlyOwner {
        claimMode = mode;
        emit ClaimModeUpdated(uint8(mode));
    }
    
    /**
     * @notice Set eligibility rules
     */
    function setEligibilityRules(
        uint256 minMintCount,
        uint256 minHoldDuration,
        uint256 claimCooldown,
        bool requireAllowlist,
        bool requireSignature
    ) external onlyOwner {
        eligibilityRules = EligibilityRules({
            minMintCount: minMintCount,
            minHoldDuration: minHoldDuration,
            claimCooldown: claimCooldown,
            requireAllowlist: requireAllowlist,
            requireSignature: requireSignature
        });
        emit EligibilityUpdated(minMintCount, minHoldDuration, claimCooldown);
    }
    
    /**
     * @notice Set bonus cap per wallet
     */
    function setBonusCapPerWallet(uint256 cap) external onlyOwner {
        bonusCapPerWallet = cap;
    }
    
    /**
     * @notice Set V2 static bonus level
     */
    function setBonusLevel(
        uint256 level,
        uint256 amountETH,
        uint256 amountUSDC,
        uint256 minMintCount,
        uint256 minHoldDuration,
        bool isActive
    ) external onlyOwner {
        bonusLevels[level] = BonusConfig({
            bonusAmountETH: amountETH,
            bonusAmountUSDC: amountUSDC,
            minMintCount: minMintCount,
            minHoldDuration: minHoldDuration,
            isActive: isActive
        });
        emit BonusUpdated(level, amountETH, amountUSDC, isActive);
    }
    
    /**
     * @notice Deposit to bonus pool
     */
    function depositBonusPool() external payable onlyOwner {
        bonusPoolETH += msg.value;
        emit BonusDeposited(msg.value, 0);
    }
    
    /**
     * @notice Deposit USDC to bonus pool
     */
    function depositBonusPoolUSDC(uint256 amount) external onlyOwner {
        address usdcAddress = _getUSDCAddress();
        if (usdcAddress == address(0)) revert CurrencyNotEnabled();
        
        if (!IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        bonusPoolUSDC += amount;
        emit BonusDeposited(0, amount);
    }
    
    /**
     * @notice Withdraw from bonus pool
     */
    function withdrawBonusPool(uint256 amountETH, uint256 amountUSDC) external onlyOwner nonReentrant {
        if (amountETH > bonusPoolETH) revert InsufficientContractBalance();
        if (amountUSDC > bonusPoolUSDC) revert InsufficientContractBalance();
        
        if (amountETH > 0) {
            bonusPoolETH -= amountETH;
            (bool success, ) = msg.sender.call{value: amountETH}("");
            if (!success) revert TransferFailed();
        }
        
        if (amountUSDC > 0) {
            bonusPoolUSDC -= amountUSDC;
            address usdcAddress = _getUSDCAddress();
            if (!IERC20(usdcAddress).transfer(msg.sender, amountUSDC)) {
                revert TransferFailed();
            }
        }
        
        emit BonusWithdrawn(amountETH, amountUSDC);
    }
    
    /**
     * @notice Withdraw mint fees (excludes bonus pool)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 contractBalance = address(this).balance;
        uint256 withdrawable = contractBalance > bonusPoolETH ? contractBalance - bonusPoolETH : 0;
        
        if (withdrawable == 0) revert InsufficientContractBalance();
        
        (bool success, ) = msg.sender.call{value: withdrawable}("");
        if (!success) revert TransferFailed();
        
        emit FeeWithdrawn(msg.sender, withdrawable);
    }
    
    /**
     * @notice Emergency withdrawal (owner only)
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientContractBalance();
        
        bonusPoolETH = 0;
        
        (bool success, ) = msg.sender.call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit EmergencyWithdrawal(msg.sender, balance);
    }
    
    /**
     * @notice Set base URI for token metadata
     */
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseURI = baseURI;
        emit BatchMetadataUpdate(1, _currentTokenId);
    }
    
    /**
     * @notice Set token URI for specific token
     */
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        _requireMinted(tokenId);
        if (_frozenTokens[tokenId]) revert TokenNotFound();
        _tokenURIs[tokenId] = uri;
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @notice Freeze token metadata permanently
     */
    function freezeTokenMetadata(uint256 tokenId) external onlyOwner {
        _requireMinted(tokenId);
        _frozenTokens[tokenId] = true;
        emit TokenMetadataFrozen(tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get dynamic pricing configuration
     */
    function getDynamicPricingConfig() external view returns (DynamicPricingConfig memory) {
        return dynamicPricingConfig;
    }
    
    /**
     * @notice Get dynamic bonus configuration
     */
    function getDynamicBonusConfig() external view returns (DynamicBonusConfig memory) {
        return dynamicBonusConfig;
    }
    
    /**
     * @notice Get level price
     */
    function getLevelPrice(uint8 level) external view returns (LevelPrice memory) {
        return levelPrices[level];
    }
    
    /**
     * @notice Get level bonus
     */
    function getLevelBonusConfig(uint8 level) external view returns (LevelBonus memory) {
        return levelBonuses[level];
    }
    
    /**
     * @notice Get supply price tier
     */
    function getSupplyPriceTier(uint8 tierId) external view returns (SupplyTier memory) {
        return supplyPriceTiers[tierId];
    }
    
    /**
     * @notice Get supply bonus tier
     */
    function getSupplyBonusTier(uint8 tierId) external view returns (SupplyBonusTier memory) {
        return supplyBonusTiers[tierId];
    }
    
    /**
     * @notice Get all active level prices
     */
    function getAllLevelPrices() external view returns (LevelPrice[] memory) {
        LevelPrice[] memory prices = new LevelPrice[](MAX_LEVELS);
        for (uint8 i = 1; i <= MAX_LEVELS; i++) {
            prices[i - 1] = levelPrices[i];
        }
        return prices;
    }
    
    /**
     * @notice Get all supply price tiers
     */
    function getAllSupplyPriceTiers() external view returns (SupplyTier[] memory) {
        SupplyTier[] memory tiers = new SupplyTier[](MAX_SUPPLY_TIERS);
        for (uint8 i = 0; i < MAX_SUPPLY_TIERS; i++) {
            tiers[i] = supplyPriceTiers[i];
        }
        return tiers;
    }
    
    /**
     * @notice Get nonce for a wallet
     */
    function getNonce(address wallet) external view returns (uint256) {
        return _nonces[wallet];
    }
    
    /**
     * @notice Get current token ID
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _currentTokenId;
    }
    
    /**
     * @notice Check if token metadata is frozen
     */
    function isTokenFrozen(uint256 tokenId) external view returns (bool) {
        return _frozenTokens[tokenId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RECEIVE ETH
    // ═══════════════════════════════════════════════════════════════════════════
    
    receive() external payable {}
}
