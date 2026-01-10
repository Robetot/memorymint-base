// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./5_FeatureCore.sol";

/**
 * @title MemoryMintUltraSafe_Minting
 * @notice Minting functions for ETH and USDC payments
 */
abstract contract MemoryMintUltraSafe_Minting is MemoryMintUltraSafe_FeatureCore {
    
    // ============ MINTING - ETH ============
    
    function mintNFT(string calldata metadataURI) 
        external payable nonReentrant whenNotKilled whenNotPaused onlyBaseMainnet returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Mint with ETH and signature verification
     * @dev v4: BREAKING CHANGE - Now requires nonce parameter for replay protection
     * @param metadataURI Token metadata URI
     * @param nonce Current nonce for wallet (get via getNonce())
     * @param expiration Signature expiration timestamp
     * @param signature Admin signature
     */
    function mintWithSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external payable nonReentrant whenNotKilled whenNotPaused onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    // ============ MINTING - USDC ============
    
    function mintWithUSDC(string calldata metadataURI) 
        external nonReentrant whenNotKilled whenNotPaused onlyBaseMainnet returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Mint with USDC and signature verification
     * @dev v4: BREAKING CHANGE - Now requires nonce parameter for replay protection
     */
    function mintWithUSDCAndSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external nonReentrant whenNotKilled whenNotPaused onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    // ============ INTERNAL ============
    
    function _executeMint(address minter, string calldata metadataURI) internal returns (uint256) {
        uint256 totalMinted = _totalMinted;
        if (fcfsMintCap > 0 && totalMinted >= fcfsMintCap) revert FCFSCapReached(fcfsMintCap);
        
        uint256 tokenId = _nextTokenId;
        
        unchecked {
            _nextTokenId = tokenId + 1;
            _totalMinted = totalMinted + 1;
        }
        
        WalletData storage walletData = _walletData[minter];
        unchecked { walletData.mintCount++; }
        walletData.lastMintBlock = block.number;
        
        _mint(minter, tokenId);
        
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
            emit MetadataUpdate(tokenId);
        }
        
        return tokenId;
    }
}
