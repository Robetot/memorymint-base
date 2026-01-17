// ============================================================
// MemoryMintUltraV3 Contract Integration
// Deployed: 0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E
// Network: Base Mainnet (Chain ID: 8453)
// Features: Dynamic Pricing, Multi-tier Bonuses, USDC Support,
//           Wallet Limits, Anti-Bot, Kill Switch
// ============================================================

import { parseAbi } from 'viem';

// ============ CONTRACT ADDRESS ============
export const NFT_CONTRACT_ADDRESS = '0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E' as const;

// ============ NETWORK CONSTANTS ============
export const BASE_CHAIN_ID = '0x2105'; // 8453 in hex
export const BASE_CHAIN_ID_NUM = 8453;
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const USDC_DECIMALS = 6;

// ============ RPC ENDPOINTS (Prioritized for reliability) ============
export const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.meowrpc.com',
  'https://base.drpc.org',
  'https://rpc.ankr.com/base',
] as const;

// ============ CHAIN CONFIG ============
export const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
} as const;

// ============ PAYMENT TYPES ============
export type PaymentCurrency = 'ETH' | 'USDC';
export const PaymentCurrencyEnum = { ETH: 0, USDC: 1 } as const;

// ============ CLAIM MODES ============
export type ClaimMode = 'DISABLED' | 'FCFS' | 'UNLIMITED' | 'ONE_TIME' | 'CUSTOM';
export const ClaimModeEnum = {
  DISABLED: 0,
  FCFS: 1,
  UNLIMITED: 2,
  ONE_TIME: 3,
  CUSTOM: 4,
} as const;

// ============ ANTI-BOT MODES ============
// 0 = Disabled, 1 = Signature, 2 = Allowlist, 3 = Hybrid
export type AntiBotMode = 'DISABLED' | 'SIGNATURE' | 'ALLOWLIST' | 'HYBRID';
export const AntiBotModeEnum = {
  DISABLED: 0,
  SIGNATURE: 1,
  ALLOWLIST: 2,
  HYBRID: 3,
} as const;

// ============ FULL V3 ABI (VERIFIED FROM BASESCAN) ============
export const CONTRACT_ABI = parseAbi([
  // ===== ERC-721 Standard =====
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',

  // ===== Core View Functions (V3) =====
  'function owner() view returns (address)',
  'function totalMinted() view returns (uint256)',
  'function getCurrentTokenId() view returns (uint256)',
  
  // ===== Pause / Kill Switch =====
  'function mintPaused() view returns (bool)',
  'function killSwitch() view returns (bool)',
  'function setMintPaused(bool paused)',
  'function activateKillSwitch()',
  'function deactivateKillSwitch()',
  
  // ===== Dynamic Pricing - Read Functions =====
  'function mintPriceETH() view returns (uint256)',
  'function mintPriceUSDC() view returns (uint256)',
  'function getMintPriceETH() view returns (uint256)',
  'function getMintPriceUSDC() view returns (uint256)',
  'function getBatchMintPriceETH(uint256 quantity) view returns (uint256)',
  'function getBatchMintPriceUSDC(uint256 quantity) view returns (uint256)',
  'function currentSupplyTier() view returns (uint8)',
  'function getSupplyTier(uint8 tier) view returns (uint256 threshold, uint256 priceETH, uint256 priceUSDC)',
  'function supplyTierCount() view returns (uint8)',
  
  // ===== Pricing Admin - COMBINED SETTER =====
  // Updates BOTH ETH and USDC prices in one call
  'function setMintPrice(uint256 priceETH, uint256 priceUSDC)',
  
  // ===== Wallet Mint Limits =====
  'function walletMintLimit() view returns (uint256)',
  'function setWalletMintLimit(uint256 limit)',
  'function walletMintCount(address wallet) view returns (uint256)',

  // ===== Anti-Bot Mode =====
  // 0 = Disabled, 1 = Signature, 2 = Allowlist, 3 = Hybrid
  'function antiBotMode() view returns (uint8)',
  'function setAntiBotMode(uint8 mode)',

  // ===== Minting Functions (ETH) =====
  'function mint(string tokenURI) payable returns (uint256)',
  'function mintNFT(string tokenURI_) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  'function mintGameNFT(string tokenURI_, uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame, string playerName, uint64 farcasterFid) payable returns (uint256)',

  // ===== Minting Functions (USDC) =====
  'function mintWithUSDC(string tokenURI) returns (uint256)',
  'function batchMintWithUSDC(uint256 quantity) returns (uint256)',

  // ===== Bonus System - View Functions =====
  'function getBonusAmountETH(uint256 levelId) view returns (uint256)',
  'function getBonusAmountUSDC(uint256 levelId) view returns (uint256)',
  'function canClaimBonus(address user, uint256 levelId) view returns (bool eligible, string reason)',
  'function getEffectiveBonus(uint8 level, uint8 currency) view returns (uint256)',
  'function getBonusLevel(uint256 levelId) view returns (uint256 minMints, bool active, uint256 baseAmountETH, uint256 baseAmountUSDC, bool allowlistOnly)',
  'function userBonusClaimed(address user, uint256 levelId) view returns (bool)',
  'function userLastClaimTime(address user, uint256 levelId) view returns (uint256)',
  'function userTotalClaims(address user) view returns (uint256)',
  'function bonusPoolETH() view returns (uint256)',
  'function bonusPoolUSDC() view returns (uint256)',
  'function currentBonusTier() view returns (uint8)',
  'function getBonusTier(uint8 tier) view returns (uint256 threshold, uint256 multiplierBps)',

  // ===== Bonus Claiming =====
  'function claimBonus(uint256 levelId) returns (uint256)',
  'function claimBonusAsUSDC(uint256 levelId) returns (uint256)',
  
  // ===== Claim Mode Configuration =====
  'function claimMode() view returns (uint8)',
  'function setClaimMode(uint8 mode)',
  'function setEligibilityRules(uint256 minMints, uint256 cooldown, uint256 maxClaims)',

  // ===== Player Data =====
  'function getPlayer(address player) view returns (string playerName, uint64 farcasterFid, uint32 totalMints, uint32 firstMintTime, bool nameSet)',
  'function isAllowlisted(address user) view returns (bool)',

  // ===== NFT Metadata =====
  'function getNFTMetadata(uint256 tokenId) view returns (uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame)',
  'function isMetadataFrozen(uint256 tokenId) view returns (bool)',

  // ===== Admin Functions - Ownership =====
  'function transferOwnership(address newOwner)',
  'function setBaseURI(string baseURI_)',
  'function updateTokenURI(uint256 tokenId, string newTokenURI)',
  'function freezeTokenMetadata(uint256 tokenId)',
  'function batchFreezeMetadata(uint256 fromTokenId, uint256 toTokenId)',
  'function mintTo(address to, string tokenURI) returns (uint256)',

  // ===== Admin: Treasury & Pools =====
  'function depositBonusPoolETH() payable',
  'function depositBonusPoolUSDC(uint256 amount)',
  'function withdrawBonusPoolETH(uint256 amount)',
  'function withdrawBonusPoolUSDC(uint256 amount)',
  'function withdrawFees()',
  'function withdrawFeesUSDC()',
  'function totalFeesCollectedETH() view returns (uint256)',
  'function totalFeesCollectedUSDC() view returns (uint256)',

  // ===== Admin: Tier Configuration =====
  'function setSupplyTier(uint8 tier, uint256 threshold, uint256 priceETH, uint256 priceUSDC)',
  'function setBonusLevel(uint256 levelId, uint256 minMints, bool active, uint256 baseAmountETH, uint256 baseAmountUSDC, bool allowlistOnly, uint256 cooldown, uint256 maxClaims)',
  'function setBonusTier(uint8 tier, uint256 threshold, uint256 multiplierBps)',
  
  // ===== Admin: Allowlist Management =====
  'function addToAllowlist(address[] users)',
  'function removeFromAllowlist(address[] users)',
]);

// ============ ERC20 ABI (for USDC) ============
export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
]);

// ============ EVENTS ============
export const CONTRACT_EVENTS = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
  'event MetadataUpdate(uint256 indexed tokenId)',
  'event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
  'event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity)',
  'event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity)',
  'event PlayerRegistered(address indexed player, string name, uint64 farcasterFid)',
  'event ContractPaused(bool paused)',
  'event TokenMetadataFrozen(uint256 indexed tokenId)',
  'event BonusClaimed(address indexed user, uint256 indexed levelId, uint256 amount, uint8 currency)',
  'event KillSwitchActivated()',
  'event KillSwitchDeactivated()',
]);

// ============ CUSTOM ERRORS ============
export const CONTRACT_ERRORS = parseAbi([
  'error NotOwner()',
  'error ZeroAddress()',
  'error TokenNotExist()',
  'error NotApproved()',
  'error NotAuthorized()',
  'error InvalidQuantity()',
  'error MaxBatchExceeded()',
  'error TransferToNonReceiver()',
  'error Paused()',
  'error ReentrancyGuard()',
  'error NameAlreadySet()',
  'error EmptyName()',
  'error MetadataFrozen()',
  'error AlreadyMinted()',
  'error WalletMintLimitExceeded()',
  'error KillSwitchActive()',
]);

// ============ TRANSFER EVENT SIGNATURE ============
export const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// ============ GAS OPTIMIZATION CONSTANTS (BASE-OPTIMIZED) ============
export const GAS_BUFFER_PERCENT = 7;
export const EIP1559_BASE_MAX_PRIORITY_FEE = 1000000n; // 0.001 gwei
export const RECEIPT_POLL_INTERVAL = 2000; // 2 seconds
export const RECEIPT_MAX_POLLS = 60; // 2 minutes max wait

// Expected gas baselines for validation
export const GAS_BASELINES: Record<string, bigint> = {
  mintNFT: 85000n,
  mintGameNFT: 120000n,
  batchMint: 200000n,
  setMintPrice: 35000n,
  setWalletMintLimit: 30000n,
  setAntiBotMode: 30000n,
  activateKillSwitch: 35000n,
  deactivateKillSwitch: 35000n,
} as const;

// ============ CACHE TTL CONSTANTS ============
export const CONFIG_CACHE_TTL = 30000; // 30 seconds for config
export const BALANCE_CACHE_TTL = 10000; // 10 seconds for balances
export const OWNERSHIP_CACHE_TTL = 5000; // 5 seconds for ownership
