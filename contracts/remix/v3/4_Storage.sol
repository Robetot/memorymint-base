// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./2_Enums.sol";

/**
 * @title MemoryMint Ultra V3 - Storage Layout
 * @notice Part 4/8 - All state variables and constants
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 * @dev CRITICAL: Storage layout must never change for upgrades
 */

abstract contract MemoryMintStorage {
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @dev ERC-165 interface IDs
    bytes4 internal constant IERC165_ID = 0x01ffc9a7;
    bytes4 internal constant IERC721_ID = 0x80ac58cd;
    bytes4 internal constant IERC721_METADATA_ID = 0x5b5e139f;
    bytes4 internal constant ERC4906_ID = 0x49064906;
    
    /// @dev Chain IDs
    uint256 internal constant BASE_MAINNET = 8453;
    uint256 internal constant BASE_SEPOLIA = 84532;
    
    /// @dev USDC addresses
    address internal constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    /// @dev Reentrancy states
    uint256 internal constant NOT_ENTERED = 1;
    uint256 internal constant ENTERED = 2;
    
    /// @dev Security constants
    uint256 internal constant MIN_SIGNATURE_EXPIRATION = 300; // 5 minutes
    uint256 internal constant MAX_BATCH_SIZE = 50;
    uint8 internal constant MAX_LEVELS = 20;
    uint8 internal constant MAX_SUPPLY_TIERS = 10;

    // ═══════════════════════════════════════════════════════════════════════════
    // CORE ERC-721 STORAGE
    // ═══════════════════════════════════════════════════════════════════════════
    
    string internal _name;
    string internal _symbol;
    string internal _baseURI;
    
    address public owner;
    uint256 internal _currentTokenId;
    uint256 public totalMinted;
    
    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) internal _balances;
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(uint256 => string) internal _tokenURIs;
    mapping(uint256 => bool) internal _frozenTokens;

    // ═══════════════════════════════════════════════════════════════════════════
    // MINTING CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    
    uint256 public mintPriceETH;
    uint256 public mintPriceUSDC;
    uint256 public maxPriceETH;
    uint256 public maxPriceUSDC;
    bool public mintPaused;
    CurrencyConfig public currencyConfig;

    // ═══════════════════════════════════════════════════════════════════════════
    // ANTI-BOT CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    
    AntiBotMode public antiBotMode;
    uint256 public walletMintLimit;
    uint256 public mintCooldown;
    address public signatureVerifier;
    
    mapping(address => WalletData) public walletData;
    mapping(address => bool) public allowlist;
    mapping(bytes32 => bool) internal _usedSignatures;
    mapping(address => uint256) internal _nonces;

    // ═══════════════════════════════════════════════════════════════════════════
    // CLAIM BONUS SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════
    
    ClaimMode public claimMode;
    uint256 public bonusPoolETH;
    uint256 public bonusPoolUSDC;
    uint256 public totalBonusClaimedETH;
    uint256 public totalBonusClaimedUSDC;
    uint256 public bonusCapPerWallet;
    EligibilityRules public eligibilityRules;
    
    mapping(uint256 => BonusConfig) public bonusLevels;

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY STATE
    // ═══════════════════════════════════════════════════════════════════════════
    
    uint256 internal _reentrancyStatus;
    bool public killSwitch;
    bool public claimsPaused;

    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC PRICING STORAGE
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @dev Dynamic pricing configuration
    DynamicPricingConfig public dynamicPricingConfig;
    
    /// @dev Level-based prices (1-20)
    mapping(uint8 => LevelPrice) public levelPrices;
    
    /// @dev Supply-threshold pricing tiers
    mapping(uint8 => SupplyTier) public supplyPriceTiers;

    // ═══════════════════════════════════════════════════════════════════════════
    // V3 DYNAMIC BONUS STORAGE
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @dev Dynamic bonus configuration
    DynamicBonusConfig public dynamicBonusConfig;
    
    /// @dev Level-based bonuses (1-20)
    mapping(uint8 => LevelBonus) public levelBonuses;
    
    /// @dev Supply-threshold bonus tiers
    mapping(uint8 => SupplyBonusTier) public supplyBonusTiers;
}
