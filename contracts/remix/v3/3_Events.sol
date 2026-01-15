// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMint Ultra V3 - Events
 * @notice Part 3/8 - All event definitions
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 */

abstract contract MemoryMintEvents {
    // ═══════════════════════════════════════════════════════════════════════════
    // ERC-721 EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC-4906 METADATA EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);

    // ═══════════════════════════════════════════════════════════════════════════
    // CORE CONTRACT EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event NFTMinted(
        address indexed minter,
        uint256 indexed tokenId,
        string metadataURI,
        uint256 price,
        uint8 currency
    );
    
    event BatchMinted(
        address indexed minter,
        uint256 startTokenId,
        uint256 count,
        uint256 totalPrice,
        uint8 currency
    );
    
    event PlayerRegistered(address indexed player, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);
    event TokenMetadataFrozen(uint256 indexed tokenId);
    event ThrottleUpdated(uint256 newCooldown);

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event MintLimitUpdated(uint256 newLimit);
    event MintPriceUpdated(uint256 newPriceETH, uint256 newPriceUSDC);
    event CurrencyUpdated(bool ethEnabled, bool usdcEnabled, uint8 activeCurrency);
    event BonusUpdated(uint256 level, uint256 amountETH, uint256 amountUSDC, bool active);
    event BonusDeposited(uint256 amountETH, uint256 amountUSDC);
    event BonusWithdrawn(uint256 amountETH, uint256 amountUSDC);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    event FeeWithdrawn(address indexed to, uint256 amount);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event KillSwitchActivated(address indexed by, uint256 timestamp);
    event KillSwitchDeactivated(address indexed by, uint256 timestamp);
    event ClaimsPausedUpdated(bool paused);
    event MaxPriceCapUpdated(uint256 maxETH, uint256 maxUSDC);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CLAIM EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event BonusClaimed(
        address indexed claimer,
        uint256 amount,
        uint8 currency,
        uint256 level
    );
    
    event ClaimModeUpdated(uint8 newMode);
    event EligibilityUpdated(
        uint256 minMintCount,
        uint256 minHoldDuration,
        uint256 claimCooldown
    );
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ANTI-BOT EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event AntiBotModeUpdated(uint8 newMode);
    event AllowlistUpdated(address indexed wallet, bool status);
    event SignerUpdated(address indexed newSigner);

    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC PRICING EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event DynamicPricingEnabled(bool enabled);
    event DynamicPricingResolutionUpdated(uint8 priority);
    event LevelPriceUpdated(uint8 indexed level, uint256 priceETH, uint256 priceUSDC, bool active);
    event SupplyTierUpdated(
        uint8 indexed tierId,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 priceETH,
        uint256 priceUSDC,
        bool active
    );
    
    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC BONUS EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event DynamicBonusEnabled(bool enabled);
    event DynamicBonusResolutionUpdated(uint8 priority);
    event LevelBonusUpdated(uint8 indexed level, uint256 bonusETH, uint256 bonusUSDC, bool active);
    event SupplyBonusTierUpdated(
        uint8 indexed tierId,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool active
    );
}
