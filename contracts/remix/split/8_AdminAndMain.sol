// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║             MEMORYMINT ULTRA V2 - PART 8: ADMIN & MAIN                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy Order: 8 of 8 (DEPLOY THIS FILE)
 * This is the main contract file with admin functions and constructor.
 * 
 * DEPLOYMENT SETTINGS:
 * • Compiler: 0.8.20
 * • Optimizer: 200 runs
 * • EVM Version: paris
 * • Network: Base Mainnet (chainId 8453)
 * 
 * CONSTRUCTOR ARGS:
 * • name_: "MemoryMint"
 * • symbol_: "MMINT"
 */

import "./7_BonusSystem.sol";

/**
 * @title MemoryMintUltraV2Fixed
 * @author MemoryMint Team
 * @notice Full-featured ERC-721 for MemoryMint game with complete admin panel support
 * @dev All admin features are on-chain enforced - no UI-only logic
 */
contract MemoryMintUltraV2Fixed is MemoryMintBonusSystem {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Deploy the MemoryMint NFT contract
     * @param name_ Collection name (e.g., "MemoryMint")
     * @param symbol_ Collection symbol (e.g., "MMINT")
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _contractOwner = msg.sender;
        _nextTokenId = 1;
        _reentrancyStatus = NOT_ENTERED;
        
        // SAFE DEFAULTS
        paused = false;
        killSwitch = false;
        walletMintLimit = 0; // unlimited
        mintPriceETH = 0; // free
        mintPriceUSDC = 0; // free
        mintCurrency = CURRENCY_ETH;
        throttleEnabled = false;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN: WALLET MINT LIMITS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set wallet mint limit (anti-bot hard mode)
     * @param maxMints Maximum mints per wallet (0 = unlimited)
     */
    function setWalletMintLimit(uint256 maxMints) external onlyOwner {
        walletMintLimit = maxMints;
        emit WalletMintLimitUpdated(maxMints);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                         ADMIN: PRICING
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set mint price in ETH (0 = free mint)
     * @param priceWei Price in wei
     */
    function setMintPriceETH(uint256 priceWei) external onlyOwner {
        mintPriceETH = priceWei;
        emit MintPriceETHUpdated(priceWei);
    }
    
    /**
     * @notice Set mint price in USDC (0 = free mint)
     * @param priceUSDC Price in USDC (6 decimals)
     */
    function setMintPriceUSDC(uint256 priceUSDC) external onlyOwner {
        mintPriceUSDC = priceUSDC;
        emit MintPriceUSDCUpdated(priceUSDC);
    }
    
    /**
     * @notice Set active mint currency
     * @param currency 0 = ETH, 1 = USDC
     */
    function setMintCurrency(uint8 currency) external onlyOwner {
        if (currency > 1) revert InvalidCurrency();
        mintCurrency = currency;
        emit MintCurrencyUpdated(currency);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN: EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Emergency stop - disables ALL minting and bonus claims
     * @param status true = stop everything, false = resume
     */
    function emergencyStop(bool status) external onlyOwner {
        killSwitch = status;
        emit EmergencyStopSet(status);
    }
    
    /**
     * @notice Pause minting
     */
    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused(true);
    }

    /**
     * @notice Unpause minting
     */
    function unpause() external onlyOwner {
        paused = false;
        emit ContractPaused(false);
    }

    /**
     * @notice Enable/disable per-block throttling
     * @param enabled Whether throttling is enabled
     */
    function setThrottle(bool enabled) external onlyOwner {
        throttleEnabled = enabled;
        emit ThrottleUpdated(enabled);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                         ADMIN: METADATA
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set base URI for token metadata
     * @param baseURI_ New base URI
     */
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    /**
     * @notice Update token metadata URI (if not frozen)
     * @param tokenId Token to update
     * @param newTokenURI New URI
     */
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        if (_metadataFrozen[tokenId]) revert MetadataFrozen();
        
        _tokenURIs[tokenId] = newTokenURI;
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @notice Freeze token metadata (one-way, cannot unfreeze)
     * @param tokenId Token to freeze
     */
    function freezeTokenMetadata(uint256 tokenId) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        _metadataFrozen[tokenId] = true;
        emit TokenMetadataFrozen(tokenId);
    }
    
    /**
     * @notice Batch freeze metadata for multiple tokens
     * @param fromTokenId Start token ID
     * @param toTokenId End token ID (inclusive)
     */
    function batchFreezeMetadata(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        for (uint256 i = fromTokenId; i <= toTokenId;) {
            if (_exists(i)) {
                _metadataFrozen[i] = true;
                emit TokenMetadataFrozen(i);
            }
            unchecked { i++; }
        }
    }

    /**
     * @notice Transfer contract ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(_contractOwner, newOwner);
        _contractOwner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get contract owner
     */
    function owner() external view returns (address) {
        return _contractOwner;
    }
    
    /**
     * @notice Get total supply
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Get next token ID
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @notice Get NFT game metadata
     * @param tokenId Token to query
     */
    function getNFTMetadata(uint256 tokenId) external view returns (
        uint8 level,
        uint8 rarity,
        uint16 score,
        uint32 completionTime,
        uint8 comboStreak,
        bool perfectGame
    ) {
        if (!_exists(tokenId)) revert TokenNotExist();
        NFTMetadata storage meta = _nftMetadata[tokenId];
        return (meta.level, meta.rarity, meta.score, meta.completionTime, meta.comboStreak, meta.perfectGame);
    }
    
    /**
     * @notice Check if token metadata is frozen
     * @param tokenId Token to check
     */
    function isMetadataFrozen(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert TokenNotExist();
        return _metadataFrozen[tokenId];
    }
    
    /**
     * @notice Get available mint fees (excludes bonus pools)
     * @return ethFees Available ETH fees
     * @return usdcFees Available USDC fees
     */
    function getAvailableFees() external view returns (uint256 ethFees, uint256 usdcFees) {
        uint256 contractBalance = address(this).balance;
        ethFees = contractBalance > bonusPoolETH ? contractBalance - bonusPoolETH : 0;
        
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        usdcFees = usdcBalance > bonusPoolUSDC ? usdcBalance - bonusPoolUSDC : 0;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                     NO receive() FUNCTION
    // ═══════════════════════════════════════════════════════════════════════
    // 
    // IMPORTANT: receive() has been intentionally REMOVED.
    // Use depositETH() explicitly to fund the bonus pool.
    // Mint fees stay as contract balance and can be withdrawn via withdrawMintFees().
    //
    // ═══════════════════════════════════════════════════════════════════════
}
