// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./2_ErrorsEnumsStructs.sol";

/**
 * @title MemoryMintUltraSafe_Storage
 * @notice Storage layout for the MemoryMintUltraSafe contract
 * @dev All state variables are defined here to ensure consistent storage layout
 */
abstract contract MemoryMintUltraSafe_Storage {
    
    // ============ CONSTANTS ============
    
    bytes4 internal constant ERC721_RECEIVER_SELECTOR = 0x150b7a02;
    bytes4 internal constant INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 internal constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 internal constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    bytes4 internal constant INTERFACE_ID_ERC4906 = 0x49064906;
    
    // EIP-2 signature malleability bound
    uint256 internal constant MAX_S_VALUE = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;
    
    // Base Mainnet chain ID
    uint256 internal constant BASE_MAINNET_CHAIN_ID = 8453;
    
    // Base USDC contract address (official)
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // Reentrancy constants
    uint256 internal constant NOT_ENTERED = 1;
    uint256 internal constant ENTERED = 2;
    
    // ============ CORE ERC-721 STORAGE ============
    
    string internal _name;
    string internal _symbol;
    string internal _baseTokenURI;
    
    // Ownership & Tokens
    address internal _contractOwner;
    uint256 internal _nextTokenId;
    uint256 internal _totalMinted;
    
    // Mappings
    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) internal _balances;
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(uint256 => string) internal _tokenURIs;
    
    // ============ MINTING CONFIGURATION ============
    
    uint256 public mintPriceETH;          // Mint price in ETH (wei)
    uint256 public mintPriceUSDC;         // Mint price in USDC (6 decimals)
    bool public mintingPaused;
    bool public emergencyMintDisabled;
    
    // Currency Configuration
    CurrencyConfig public currencyConfig;
    
    // ============ ANTI-BOT CONFIGURATION ============
    
    AntiBotMode public antiBotMode;
    uint256 public walletMintLimit;        // 0 = unlimited
    uint256 public mintCooldownBlocks;     // 0 = no cooldown
    bool public allowlistEnabled;
    bool public denylistEnabled;
    bool public signatureRequired;
    uint256 public fcfsMintCap;            // 0 = unlimited
    bool public txOriginCheck;             // Disabled by default for smart wallet compatibility
    
    mapping(address => bool) public allowlist;
    mapping(address => bool) public denylist;
    mapping(address => WalletData) internal _walletData;
    address public signatureSigner;
    
    // v4: Nonce-based replay protection
    mapping(address => uint256) internal _nonces;
    
    // Signature tracking
    uint256 public signatureExpirationSeconds;  // 0 = no expiration
    mapping(bytes32 => uint256) internal _signatureUsedAt;  // messageHash => timestamp used
    
    // ============ CLAIM BONUS SYSTEM ============
    
    ClaimMode public claimMode;
    uint256 public totalClaimCap;          // 0 = unlimited
    uint256 public totalClaimsMade;
    uint256 public bonusPoolBalanceETH;    // ETH bonus pool
    uint256 public bonusPoolBalanceUSDC;   // USDC bonus pool
    EligibilityRules public eligibilityRules;
    
    mapping(uint256 => BonusConfig) public bonusLevels;
    uint256[] public activeLevelIds;
    
    // ============ REENTRANCY GUARD ============
    
    uint256 internal _reentrancyStatus;
}
