// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./7_BonusClaim.sol";

/**
 * @title MemoryMintUltraSafe
 * @notice Ultra-safe, anti-bot, production-grade ERC-721 NFT contract with dual-currency support (ETH/USDC)
 * @dev Optimized for Base Mainnet ONLY, OpenSea, Farcaster, BaseApp, and Coinbase Smart Wallet compatibility
 * @author MemoryMint Team
 * 
 * @dev v4: Security hardening - nonce replay protection, fixed signature expiration
 * 
 * CHANGELOG v4:
 * - FIX #1: Fixed signature expiration validation - signatures must be within [now, now + expirationSeconds] window
 * - FIX #2: Added nonce-based replay protection with per-wallet nonces
 * - FIX #3: Fixed receive() to allow contract integrations with event tracking for unexpected deposits
 * - FIX #4: Added duplicate prevention for activeLevelIds array, removes ALL instances on deactivation
 * - FIX #5: Added zero-amount validations for deposits/withdrawals
 * - FIX #6: Added optional level proof validation to canClaim() view function
 * 
 * BREAKING CHANGES (v4):
 * - mintWithSignature() now requires nonce parameter
 * - mintWithUSDCAndSignature() now requires nonce parameter
 * - Message hash format changed to include nonce
 * - Frontend must call getNonce(wallet) before requesting signatures
 */
contract MemoryMintUltraSafe is MemoryMintUltraSafe_Claim {
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_
    ) {
        _name = name_;
        _symbol = symbol_;
        _baseTokenURI = baseURI_;
        _contractOwner = msg.sender;
        _nextTokenId = 1;
        _reentrancyStatus = NOT_ENTERED;
        
        // Production-safe defaults
        antiBotMode = AntiBotMode.MODERATE;
        walletMintLimit = 10;
        mintCooldownBlocks = 2;
        txOriginCheck = false;
        denylistEnabled = true;
        signatureRequired = true;
        signatureExpirationSeconds = 3600; // 1 hour
        
        claimMode = ClaimMode.DISABLED;
        signatureSigner = msg.sender;
        
        currencyConfig = CurrencyConfig({
            ethEnabled: true,
            usdcEnabled: false,
            activeMintCurrency: PaymentCurrency.ETH,
            activeBonusCurrency: PaymentCurrency.ETH
        });
        
        mintPriceETH = 0;
        mintPriceUSDC = 0;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // ============ ADMIN: CURRENCY ============
    
    function setETHEnabled(bool enabled) external onlyOwner {
        currencyConfig.ethEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.ETH, enabled);
    }
    
    function setUSDCEnabled(bool enabled) external onlyOwner {
        currencyConfig.usdcEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.USDC, enabled);
    }
    
    function setActiveMintCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        currencyConfig.activeMintCurrency = currency;
        emit ActiveMintCurrencyUpdated(currency);
    }
    
    function setActiveBonusCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        currencyConfig.activeBonusCurrency = currency;
        emit ActiveBonusCurrencyUpdated(currency);
    }
    
    // ============ ADMIN: MINTING ============
    
    function setMintPriceETH(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPriceETH;
        mintPriceETH = newPrice;
        emit MintPriceUpdated(PaymentCurrency.ETH, oldPrice, newPrice);
    }
    
    function setMintPriceUSDC(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPriceUSDC;
        mintPriceUSDC = newPrice;
        emit MintPriceUpdated(PaymentCurrency.USDC, oldPrice, newPrice);
    }
    
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
        if (_totalMinted > 0) emit BatchMetadataUpdate(1, _nextTokenId - 1);
    }
    
    function pauseMinting(bool paused) external onlyOwner {
        mintingPaused = paused;
        emit MintingPausedUpdated(paused);
    }
    
    function setEmergencyMintDisabled(bool disabled) external onlyOwner {
        emergencyMintDisabled = disabled;
        emit EmergencyMintDisabledUpdated(disabled);
    }
    
    // ============ ADMIN: ANTI-BOT ============
    
    function setAntiBotMode(AntiBotMode mode) external onlyOwner {
        antiBotMode = mode;
        if (mode == AntiBotMode.STRICT) txOriginCheck = true;
        else if (mode == AntiBotMode.MODERATE || mode == AntiBotMode.SOFT) txOriginCheck = false;
        emit AntiBotModeUpdated(mode, txOriginCheck);
    }
    
    function setTxOriginCheck(bool enabled) external onlyOwner {
        txOriginCheck = enabled;
        emit AntiBotModeUpdated(antiBotMode, enabled);
    }
    
    function setWalletMintLimit(uint256 limit) external onlyOwner {
        walletMintLimit = limit;
        emit WalletMintLimitUpdated(limit);
    }
    
    function setMintCooldown(uint256 blocks) external onlyOwner {
        mintCooldownBlocks = blocks;
        emit MintCooldownUpdated(blocks);
    }
    
    function setFCFSMintCap(uint256 cap) external onlyOwner {
        fcfsMintCap = cap;
        emit FCFSMintCapUpdated(cap);
    }
    
    function setAllowlistEnabled(bool enabled) external onlyOwner { allowlistEnabled = enabled; }
    function setDenylistEnabled(bool enabled) external onlyOwner { denylistEnabled = enabled; }
    
    function updateAllowlist(address[] calldata wallets, bool status) external onlyOwner {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; ) {
            if (wallets[i] != address(0)) {
                allowlist[wallets[i]] = status;
                emit AllowlistUpdated(wallets[i], status);
            }
            unchecked { i++; }
        }
    }
    
    function updateDenylist(address[] calldata wallets, bool status) external onlyOwner {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; ) {
            if (wallets[i] != address(0)) {
                denylist[wallets[i]] = status;
                emit DenylistUpdated(wallets[i], status);
            }
            unchecked { i++; }
        }
    }
    
    function setSignatureRequired(bool required) external onlyOwner { signatureRequired = required; }
    
    function setSignatureSigner(address signer) external onlyOwner {
        signatureSigner = signer;
        emit SignatureSignerUpdated(signer);
    }
    
    function setSignatureExpiration(uint256 seconds_) external onlyOwner {
        signatureExpirationSeconds = seconds_;
        emit SignatureExpirationUpdated(seconds_);
    }
    
    // ============ ADMIN: KILL SWITCH ============
    
    /**
     * @notice Enable/disable kill switch - completely stops all minting and claiming
     * @dev v5: Added kill switch for emergency situations
     */
    function setKillSwitch(bool enabled) external onlyOwner {
        killSwitch = enabled;
        emit KillSwitchUpdated(enabled);
    }
    
    // ============ ADMIN: CLAIM BONUS ============
    
    function setClaimMode(ClaimMode mode) external onlyOwner {
        claimMode = mode;
        emit ClaimModeUpdated(mode);
    }
    
    function setTotalClaimCap(uint256 cap) external onlyOwner {
        totalClaimCap = cap;
        emit ClaimCapUpdated(cap);
    }
    
    /**
     * @notice Configure a bonus level
     * @dev v4 FIX #4: Prevents duplicate entries in activeLevelIds
     */
    function configureBonusLevel(
        uint256 level, uint256 amountETH, uint256 amountUSDC, bool active,
        uint256 claimsRemaining, uint256 minScore, bool requiresNFT
    ) external onlyOwner {
        BonusConfig storage config = bonusLevels[level];
        bool wasActive = config.active;
        
        config.amountETH = amountETH;
        config.amountUSDC = amountUSDC;
        config.active = active;
        config.claimsRemaining = claimsRemaining;
        config.minScore = minScore;
        config.requiresNFT = requiresNFT;
        
        if (active && !wasActive) {
            // FIX #4: Check for duplicates before adding
            if (!_isLevelInActiveArray(level)) {
                activeLevelIds.push(level);
            }
        } else if (!active && wasActive) {
            // FIX #4: Remove ALL instances
            _removeAllFromActiveLevels(level);
        }
        
        emit BonusLevelConfigured(level, amountETH, amountUSDC, claimsRemaining);
    }
    
    function deactivateBonusLevel(uint256 level) external onlyOwner {
        bonusLevels[level].active = false;
        _removeAllFromActiveLevels(level);
        emit BonusLevelDeactivated(level);
    }
    
    function setEligibilityRules(bool checkLevel, bool checkScore, bool checkNFTOwnership, bool useAndLogic) external onlyOwner {
        eligibilityRules = EligibilityRules(checkLevel, checkScore, checkNFTOwnership, useAndLogic);
        emit EligibilityRulesUpdated();
    }
    
    /**
     * @notice Deposit ETH to bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function depositBonusFundsETH() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Deposit USDC to bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function depositBonusFundsUSDC(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < amount) revert InsufficientUSDCAllowance(amount, allowed);
        
        (bool success, bytes memory data) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, msg.sender, address(this), amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) revert USDCTransferFailed();
        
        bonusPoolBalanceUSDC += amount;
        emit BonusFundsDeposited(amount, PaymentCurrency.USDC);
    }
    
    /**
     * @notice Withdraw ETH from bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function withdrawBonusFundsETH(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > bonusPoolBalanceETH) revert InsufficientBonusBalance();
        
        unchecked { bonusPoolBalanceETH -= amount; }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit BonusFundsWithdrawn(amount, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Withdraw USDC from bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function withdrawBonusFundsUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > bonusPoolBalanceUSDC) revert InsufficientBonusBalance();
        
        unchecked { bonusPoolBalanceUSDC -= amount; }
        emit BonusFundsWithdrawn(amount, PaymentCurrency.USDC);
        _safeUSDCTransfer(_contractOwner, amount);
    }
    
    // ============ ADMIN: OWNERSHIP & FUNDS ============
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(_contractOwner, newOwner);
        _contractOwner = newOwner;
    }
    
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 withdrawable = address(this).balance - bonusPoolBalanceETH;
        if (withdrawable == 0) revert WithdrawFailed();
        
        (bool success, ) = payable(_contractOwner).call{value: withdrawable}("");
        if (!success) revert WithdrawFailed();
    }
    
    function withdrawUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 withdrawable = usdc.balanceOf(address(this)) - bonusPoolBalanceUSDC;
        if (withdrawable == 0) revert WithdrawFailed();
        _safeUSDCTransfer(_contractOwner, withdrawable);
    }
    
    function emergencyWithdrawAllETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        bonusPoolBalanceETH = 0;
        (bool success, ) = payable(_contractOwner).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }
    
    function emergencyWithdrawAllUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert WithdrawFailed();
        bonusPoolBalanceUSDC = 0;
        _safeUSDCTransfer(_contractOwner, balance);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function totalSupply() external view returns (uint256) { return _totalMinted; }
    function nextTokenId() external view returns (uint256) { return _nextTokenId; }
    function exists(uint256 tokenId) external view returns (bool) { return _owners[tokenId] != address(0); }
    function owner() external view returns (address) { return _contractOwner; }
    function baseURI() external view returns (string memory) { return _baseTokenURI; }
    
    /**
     * @notice Get current nonce for wallet
     * @dev v4: Frontend must call this before requesting signatures
     */
    function getNonce(address wallet) external view returns (uint256) {
        return _nonces[wallet];
    }
    
    function getWalletMintCount(address wallet) external view returns (uint256) { return _walletData[wallet].mintCount; }
    function getWalletLastMintBlock(address wallet) external view returns (uint256) { return _walletData[wallet].lastMintBlock; }
    function hasClaimedLevel(address wallet, uint256 level) external view returns (bool) { return _walletData[wallet].claimedLevels[level]; }
    function getTotalClaimedETH(address wallet) external view returns (uint256) { return _walletData[wallet].totalClaimedETH; }
    function getTotalClaimedUSDC(address wallet) external view returns (uint256) { return _walletData[wallet].totalClaimedUSDC; }
    function getActiveLevelIds() external view returns (uint256[] memory) { return activeLevelIds; }
    
    function getCurrentMintPrice() external view returns (uint256 price, PaymentCurrency currency) {
        currency = currencyConfig.activeMintCurrency;
        price = currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
    }
    
    function getBonusLevelConfig(uint256 level) external view returns (
        uint256 amountETH, uint256 amountUSDC, bool active, uint256 claimsRemaining, uint256 minScore, bool requiresNFT
    ) {
        BonusConfig storage config = bonusLevels[level];
        return (config.amountETH, config.amountUSDC, config.active, config.claimsRemaining, config.minScore, config.requiresNFT);
    }
    
    function getUSDCAddress() external pure returns (address) { return BASE_USDC; }
    function isBaseMainnet() external view returns (bool) { return block.chainid == BASE_MAINNET_CHAIN_ID; }
    
    function canMint(address wallet) external view returns (bool canMintResult, string memory reason) {
        if (block.chainid != BASE_MAINNET_CHAIN_ID) return (false, "Wrong chain");
        if (killSwitch) return (false, "Kill switch active");
        if (mintingPaused) return (false, "Paused");
        if (emergencyMintDisabled) return (false, "Emergency disabled");
        if (denylistEnabled && denylist[wallet]) return (false, "Denylisted");
        if (allowlistEnabled && !allowlist[wallet]) return (false, "Not allowlisted");
        
        PaymentCurrency currency = currencyConfig.activeMintCurrency;
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) return (false, "ETH disabled");
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) return (false, "USDC disabled");
        
        WalletData storage walletData = _walletData[wallet];
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) return (false, "Wallet limit");
        if (mintCooldownBlocks > 0 && walletData.lastMintBlock > 0 && block.number - walletData.lastMintBlock < mintCooldownBlocks) {
            return (false, "Cooldown");
        }
        if (fcfsMintCap > 0 && _totalMinted >= fcfsMintCap) return (false, "Cap reached");
        
        return (true, "Eligible");
    }
    
    /**
     * @notice Check if wallet can claim bonus
     * @dev v4 FIX #6: Added optional levelProof parameter for validation
     * @param wallet Address to check
     * @param level Bonus level
     * @param userScore User's score
     * @param levelProof Optional level proof (pass empty bytes if not available)
     */
    function canClaim(address wallet, uint256 level, uint256 userScore, bytes calldata levelProof) 
        external view returns (bool canClaimResult, string memory reason) 
    {
        if (block.chainid != BASE_MAINNET_CHAIN_ID) return (false, "Wrong chain");
        if (killSwitch) return (false, "Kill switch active");
        if (claimMode == ClaimMode.DISABLED) return (false, "Claims disabled");
        
        PaymentCurrency payoutCurrency = currencyConfig.activeBonusCurrency;
        if (payoutCurrency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) return (false, "ETH disabled");
        if (payoutCurrency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) return (false, "USDC disabled");
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) return (false, "Invalid level");
        
        uint256 bonusAmount = payoutCurrency == PaymentCurrency.ETH ? config.amountETH : config.amountUSDC;
        if (bonusAmount == 0) return (false, "No bonus configured");
        
        uint256 poolBalance = payoutCurrency == PaymentCurrency.ETH ? bonusPoolBalanceETH : bonusPoolBalanceUSDC;
        if (bonusAmount > poolBalance) return (false, "Insufficient pool");
        
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) return (false, "Claim cap reached");
        if (claimMode == ClaimMode.FCFS && config.claimsRemaining == 0) return (false, "Level cap reached");
        
        if ((claimMode == ClaimMode.ONE_TIME || claimMode == ClaimMode.FCFS) && _walletData[wallet].claimedLevels[level]) {
            return (false, "Already claimed");
        }
        
        EligibilityRules memory rules = eligibilityRules;
        
        // FIX #6: Validate level proof if provided and required
        if (rules.checkLevel) {
            if (levelProof.length == 0) {
                return (true, "Level proof required");
            }
            
            // Validate the proof
            bytes32 levelHash = keccak256(abi.encodePacked(wallet, level, level, address(this), block.chainid));
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", levelHash));
            address recovered = _recoverSigner(ethSignedHash, levelProof);
            
            if (recovered != signatureSigner || recovered == address(0)) {
                return (false, "Invalid level proof");
            }
        }
        
        if (rules.checkScore && config.minScore > 0 && userScore < config.minScore) {
            return (false, "Score too low");
        }
        if (rules.checkNFTOwnership && config.requiresNFT && _balances[wallet] == 0) {
            return (false, "NFT required");
        }
        
        return (true, "Eligible");
    }
    
    // Legacy canClaim for backward compatibility
    function canClaim(address wallet, uint256 level, uint256 userScore) external view returns (bool, string memory) {
        return this.canClaim(wallet, level, userScore, "");
    }
    
    // ============ RECEIVE ETH ============
    
    /**
     * @notice Receive ETH - all deposits go to bonus pool with tracking
     * @dev v4 FIX #3: Removed owner restriction, tracks unexpected deposits via event
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
        
        // Track non-owner deposits for auditing
        if (msg.sender != _contractOwner) {
            emit UnexpectedETHDeposit(msg.sender, msg.value);
        }
    }
    
    fallback() external payable {
        revert(); // Reject unrecognized calls
    }
}
