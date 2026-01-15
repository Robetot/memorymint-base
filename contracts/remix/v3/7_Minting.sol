// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./6_ERC721Core.sol";

/**
 * @title MemoryMint Ultra V3 - Minting & Dynamic Pricing
 * @notice Part 7/8 - Minting functions with V3 dynamic pricing support
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 */

abstract contract MemoryMintMinting is MemoryMintERC721 {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC PRICE RESOLUTION
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Resolves the effective mint price based on dynamic config
     * @param level The mint level (1-20, 0 if not applicable)
     * @param currency The payment currency
     * @return price The resolved price
     */
    function _resolveDynamicMintPrice(uint8 level, PaymentCurrency currency) internal view returns (uint256 price) {
        if (!dynamicPricingConfig.enabled) {
            return currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
        }
        
        ResolutionPriority priority = dynamicPricingConfig.priority;
        
        if (priority == ResolutionPriority.LEVEL_ONLY) {
            return _resolveLevelPrice(level, currency);
        }
        
        if (priority == ResolutionPriority.SUPPLY_ONLY) {
            return _resolveSupplyPrice(currency);
        }
        
        if (priority == ResolutionPriority.SUPPLY_OVERRIDES) {
            uint256 supplyPrice = _resolveSupplyPrice(currency);
            if (supplyPrice > 0) return supplyPrice;
            return _resolveLevelPrice(level, currency);
        }
        
        // LEVEL_OVERRIDES
        uint256 levelPrice = _resolveLevelPrice(level, currency);
        if (levelPrice > 0) return levelPrice;
        return _resolveSupplyPrice(currency);
    }
    
    /**
     * @dev Resolves price based on level (1-20)
     */
    function _resolveLevelPrice(uint8 level, PaymentCurrency currency) internal view returns (uint256) {
        if (level == 0 || level > MAX_LEVELS) {
            return currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
        }
        
        LevelPrice storage lp = levelPrices[level];
        if (!lp.isActive) {
            return currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
        }
        
        return currency == PaymentCurrency.ETH ? lp.priceETH : lp.priceUSDC;
    }
    
    /**
     * @dev Resolves price based on totalMinted supply thresholds
     */
    function _resolveSupplyPrice(PaymentCurrency currency) internal view returns (uint256) {
        uint256 currentSupply = totalMinted;
        
        for (uint8 i = 0; i < MAX_SUPPLY_TIERS; i++) {
            SupplyTier storage tier = supplyPriceTiers[i];
            if (!tier.isActive) continue;
            
            bool inRange = currentSupply >= tier.minSupply &&
                          (tier.maxSupply == 0 || currentSupply < tier.maxSupply);
            
            if (inRange) {
                return currency == PaymentCurrency.ETH ? tier.priceETH : tier.priceUSDC;
            }
        }
        
        // Fallback to static price
        return currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
    }
    
    /**
     * @notice Public view to get effective mint price
     * @param level The mint level (0 for no level)
     * @param currency The payment currency (0=ETH, 1=USDC)
     */
    function getEffectiveMintPrice(uint8 level, uint8 currency) external view returns (uint256) {
        return _resolveDynamicMintPrice(level, PaymentCurrency(currency));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ETH MINTING
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Mint an NFT with ETH payment
     * @param metadataURI The token metadata URI
     */
    function mintNFT(string calldata metadataURI) external payable 
        whenNotPaused 
        whenNotKilled 
        nonReentrant 
    {
        _checkAntiBot(msg.sender);
        
        if (currencyConfig.activeCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        
        uint256 price = _resolveDynamicMintPrice(0, PaymentCurrency.ETH);
        if (msg.value < price) revert InsufficientPayment();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.ETH);
        
        // Refund excess
        if (msg.value > price) {
            (bool success, ) = msg.sender.call{value: msg.value - price}("");
            if (!success) revert TransferFailed();
        }
    }
    
    /**
     * @notice Mint an NFT with ETH and level-based pricing
     * @param metadataURI The token metadata URI
     * @param level The mint level (1-20)
     */
    function mintNFTWithLevel(string calldata metadataURI, uint8 level) external payable 
        whenNotPaused 
        whenNotKilled 
        nonReentrant 
        validLevel(level)
    {
        _checkAntiBot(msg.sender);
        
        if (currencyConfig.activeCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        
        uint256 price = _resolveDynamicMintPrice(level, PaymentCurrency.ETH);
        if (msg.value < price) revert InsufficientPayment();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.ETH);
        
        if (msg.value > price) {
            (bool success, ) = msg.sender.call{value: msg.value - price}("");
            if (!success) revert TransferFailed();
        }
    }
    
    /**
     * @notice Mint with ETH and signature verification
     * @param metadataURI The token metadata URI
     * @param nonce The signature nonce
     * @param expiration The signature expiration timestamp
     * @param signature The signature bytes
     */
    function mintWithSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external payable whenNotPaused whenNotKilled nonReentrant {
        if (!_verifySignature(msg.sender, nonce, expiration, signature)) {
            revert InvalidSignature();
        }
        
        // Mark signature as used and increment nonce
        bytes32 sigHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(msg.sender, nonce, expiration, address(this)))
            )
        );
        _usedSignatures[sigHash] = true;
        _nonces[msg.sender]++;
        
        if (currencyConfig.activeCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        
        uint256 price = _resolveDynamicMintPrice(0, PaymentCurrency.ETH);
        if (msg.value < price) revert InsufficientPayment();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.ETH);
        
        if (msg.value > price) {
            (bool success, ) = msg.sender.call{value: msg.value - price}("");
            if (!success) revert TransferFailed();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USDC MINTING
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Mint an NFT with USDC payment
     * @param metadataURI The token metadata URI
     */
    function mintWithUSDC(string calldata metadataURI) external 
        whenNotPaused 
        whenNotKilled 
        nonReentrant 
    {
        _checkAntiBot(msg.sender);
        
        if (!currencyConfig.usdcEnabled) revert USDCNotEnabled();
        if (currencyConfig.activeCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        
        address usdcAddress = _getUSDCAddress();
        if (usdcAddress == address(0)) revert CurrencyNotEnabled();
        
        uint256 price = _resolveDynamicMintPrice(0, PaymentCurrency.USDC);
        
        IERC20 usdc = IERC20(usdcAddress);
        if (usdc.allowance(msg.sender, address(this)) < price) revert InsufficientPayment();
        if (!usdc.transferFrom(msg.sender, address(this), price)) revert TransferFailed();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.USDC);
    }
    
    /**
     * @notice Mint an NFT with USDC and level-based pricing
     * @param metadataURI The token metadata URI
     * @param level The mint level (1-20)
     */
    function mintWithUSDCAndLevel(string calldata metadataURI, uint8 level) external 
        whenNotPaused 
        whenNotKilled 
        nonReentrant 
        validLevel(level)
    {
        _checkAntiBot(msg.sender);
        
        if (!currencyConfig.usdcEnabled) revert USDCNotEnabled();
        if (currencyConfig.activeCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        
        address usdcAddress = _getUSDCAddress();
        if (usdcAddress == address(0)) revert CurrencyNotEnabled();
        
        uint256 price = _resolveDynamicMintPrice(level, PaymentCurrency.USDC);
        
        IERC20 usdc = IERC20(usdcAddress);
        if (usdc.allowance(msg.sender, address(this)) < price) revert InsufficientPayment();
        if (!usdc.transferFrom(msg.sender, address(this), price)) revert TransferFailed();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.USDC);
    }
    
    /**
     * @notice Mint with USDC and signature verification
     * @param metadataURI The token metadata URI
     * @param nonce The signature nonce
     * @param expiration The signature expiration timestamp
     * @param signature The signature bytes
     */
    function mintWithUSDCAndSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external whenNotPaused whenNotKilled nonReentrant {
        if (!_verifySignature(msg.sender, nonce, expiration, signature)) {
            revert InvalidSignature();
        }
        
        bytes32 sigHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(msg.sender, nonce, expiration, address(this)))
            )
        );
        _usedSignatures[sigHash] = true;
        _nonces[msg.sender]++;
        
        if (!currencyConfig.usdcEnabled) revert USDCNotEnabled();
        if (currencyConfig.activeCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        
        address usdcAddress = _getUSDCAddress();
        if (usdcAddress == address(0)) revert CurrencyNotEnabled();
        
        uint256 price = _resolveDynamicMintPrice(0, PaymentCurrency.USDC);
        
        IERC20 usdc = IERC20(usdcAddress);
        if (usdc.allowance(msg.sender, address(this)) < price) revert InsufficientPayment();
        if (!usdc.transferFrom(msg.sender, address(this), price)) revert TransferFailed();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.USDC);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BATCH MINTING
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Batch mint multiple NFTs with ETH
     * @param metadataURIs Array of metadata URIs
     */
    function batchMint(string[] calldata metadataURIs) external payable 
        whenNotPaused 
        whenNotKilled 
        nonReentrant 
    {
        uint256 count = metadataURIs.length;
        if (count == 0 || count > MAX_BATCH_SIZE) revert BatchSizeExceeded();
        
        _checkAntiBot(msg.sender);
        
        if (currencyConfig.activeCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        
        uint256 pricePerMint = _resolveDynamicMintPrice(0, PaymentCurrency.ETH);
        uint256 totalPrice = pricePerMint * count;
        if (msg.value < totalPrice) revert InsufficientPayment();
        
        uint256 startTokenId = _currentTokenId + 1;
        
        for (uint256 i = 0; i < count; ) {
            _executeMintInternal(msg.sender, metadataURIs[i]);
            unchecked { i++; }
        }
        
        emit BatchMinted(msg.sender, startTokenId, count, totalPrice, uint8(PaymentCurrency.ETH));
        
        // Refund excess
        if (msg.value > totalPrice) {
            (bool success, ) = msg.sender.call{value: msg.value - totalPrice}("");
            if (!success) revert TransferFailed();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // API COMPATIBILITY WRAPPERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Simple mint wrapper for API compatibility
     */
    function mint(string calldata metadataURI) external payable 
        whenNotPaused 
        whenNotKilled 
        nonReentrant 
    {
        _checkAntiBot(msg.sender);
        
        uint256 price = _resolveDynamicMintPrice(0, PaymentCurrency.ETH);
        if (msg.value < price) revert InsufficientPayment();
        
        _executeMint(msg.sender, metadataURI, price, PaymentCurrency.ETH);
        
        if (msg.value > price) {
            (bool success, ) = msg.sender.call{value: msg.value - price}("");
            if (!success) revert TransferFailed();
        }
    }
    
    /**
     * @notice Mint to specific address (admin only)
     */
    function mintTo(address to, string calldata metadataURI) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        _executeMintInternal(to, metadataURI);
        emit NFTMinted(to, _currentTokenId, metadataURI, 0, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL MINT LOGIC
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Executes the mint with full tracking
     */
    function _executeMint(
        address minter,
        string calldata metadataURI,
        uint256 price,
        PaymentCurrency currency
    ) internal {
        _executeMintInternal(minter, metadataURI);
        
        // Update wallet data
        WalletData storage data = walletData[minter];
        data.mintCount++;
        data.lastMintTime = block.timestamp;
        
        emit NFTMinted(minter, _currentTokenId, metadataURI, price, uint8(currency));
    }
    
    /**
     * @dev Core mint logic without tracking
     */
    function _executeMintInternal(address to, string calldata metadataURI) internal {
        unchecked {
            _currentTokenId++;
            totalMinted++;
        }
        
        _owners[_currentTokenId] = to;
        _balances[to]++;
        _tokenURIs[_currentTokenId] = metadataURI;
        
        emit Transfer(address(0), to, _currentTokenId);
    }
}
