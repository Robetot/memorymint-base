// ============================================================
// MemoryMintUltraV3 Contract Integration
// Deployed: 0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E
// Network: Base Mainnet (Chain ID: 8453)
// Features: Dynamic Pricing, Multi-tier Bonuses, USDC Support
// ============================================================

import { parseAbi } from 'viem';

// ============ CONTRACT ADDRESS ============
export const NFT_CONTRACT_ADDRESS_V3 = '0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E' as const;

// ============ NETWORK CONSTANTS ============
export const BASE_CHAIN_ID = '0x2105'; // 8453 in hex
export const BASE_CHAIN_ID_NUM = 8453;
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export const USDC_DECIMALS = 6;

// ============ RPC ENDPOINTS ============
export const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.meowrpc.com',
  'https://base.drpc.org',
] as const;

// ============ CHAIN CONFIG ============
export const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
} as const;

// ============ ENUMS ============
export type PaymentCurrency = 'ETH' | 'USDC';
export const PaymentCurrencyEnum = { ETH: 0, USDC: 1 } as const;

export type BonusLevel = 4 | 8 | 12 | 16 | 20;
export const BONUS_LEVELS: BonusLevel[] = [4, 8, 12, 16, 20];

export type ClaimMode = 'DISABLED' | 'FCFS' | 'UNLIMITED' | 'ONE_TIME' | 'CUSTOM';
export const ClaimModeEnum = {
  DISABLED: 0,
  FCFS: 1,
  UNLIMITED: 2,
  ONE_TIME: 3,
  CUSTOM: 4,
} as const;

export type AntiBotMode = 'DISABLED' | 'SOFT' | 'MODERATE' | 'STRICT' | 'CUSTOM';
export const AntiBotModeEnum = {
  DISABLED: 0,
  SOFT: 1,
  MODERATE: 2,
  STRICT: 3,
  CUSTOM: 4,
} as const;

// ============ CONSTANTS ============
export const MAX_BATCH_SIZE = 20;
export const MAX_SUPPLY = 10000;

// ============ FULL V3 ABI ============
export const CONTRACT_ABI_V3 = parseAbi([
  // ===== ERC-721 Standard =====
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',

  // ===== Core View Functions =====
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function nextTokenId() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function MAX_BATCH_SIZE() view returns (uint256)',

  // ===== Dynamic Pricing Functions =====
  'function getMintPriceETH() view returns (uint256)',
  'function getMintPriceUSDC() view returns (uint256)',
  'function getBatchMintPriceETH(uint256 quantity) view returns (uint256)',
  'function getBatchMintPriceUSDC(uint256 quantity) view returns (uint256)',
  'function currentSupplyTier() view returns (uint8)',
  
  // ===== Price Tier Configuration =====
  'function getSupplyTier(uint8 tier) view returns (uint256 threshold, uint256 priceETH, uint256 priceUSDC)',
  'function supplyTierCount() view returns (uint8)',

  // ===== Minting Functions (ETH) =====
  'function mint(string tokenURI) payable returns (uint256)',
  'function mintNFT(string tokenURI) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  'function mintGameNFT(string tokenURI_, uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame, string playerName, uint64 farcasterFid) payable returns (uint256)',

  // ===== Minting Functions (USDC) =====
  'function mintWithUSDC(string tokenURI) returns (uint256)',
  'function batchMintWithUSDC(uint256 quantity) returns (uint256)',

  // ===== Admin Minting =====
  'function mintTo(address to, string tokenURI) returns (uint256)',

  // ===== Bonus System - View Functions =====
  'function getBonusAmountETH(uint256 levelId) view returns (uint256)',
  'function getBonusAmountUSDC(uint256 levelId) view returns (uint256)',
  'function canClaimBonus(address user, uint256 levelId) view returns (bool eligible, string reason)',
  'function getBonusLevel(uint256 levelId) view returns (uint256 minMints, bool active, uint256 baseAmountETH, uint256 baseAmountUSDC, bool allowlistOnly)',
  'function getBonusLevelFull(uint256 levelId) view returns (uint256 minMints, bool active, uint256 baseAmountETH, uint256 baseAmountUSDC, bool allowlistOnly, uint256 cooldown, uint256 maxClaims)',
  'function userBonusClaimed(address user, uint256 levelId) view returns (bool)',
  'function userLastClaimTime(address user, uint256 levelId) view returns (uint256)',
  'function userTotalClaims(address user) view returns (uint256)',
  'function bonusPoolETH() view returns (uint256)',
  'function bonusPoolUSDC() view returns (uint256)',
  'function currentBonusTier() view returns (uint8)',
  
  // ===== Bonus Tier Configuration =====
  'function getBonusTier(uint8 tier) view returns (uint256 threshold, uint256 multiplierBps)',
  'function bonusTierCount() view returns (uint8)',

  // ===== Bonus Claiming =====
  'function claimBonus(uint256 levelId) returns (uint256)',
  'function claimBonusAsUSDC(uint256 levelId) returns (uint256)',

  // ===== Player Data =====
  'function getPlayer(address player) view returns (string playerName, uint64 farcasterFid, uint32 totalMints, uint32 firstMintTime, bool nameSet)',
  'function walletMintCount(address wallet) view returns (uint256)',
  'function isAllowlisted(address user) view returns (bool)',

  // ===== NFT Metadata =====
  'function getNFTMetadata(uint256 tokenId) view returns (uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame)',
  'function isMetadataFrozen(uint256 tokenId) view returns (bool)',

  // ===== Admin Functions =====
  'function pause()',
  'function unpause()',
  'function setBaseURI(string baseURI_)',
  'function updateTokenURI(uint256 tokenId, string newTokenURI)',
  'function freezeTokenMetadata(uint256 tokenId)',
  'function batchFreezeMetadata(uint256 fromTokenId, uint256 toTokenId)',
  'function transferOwnership(address newOwner)',

  // ===== Admin: Pricing =====
  'function setSupplyTier(uint8 tier, uint256 threshold, uint256 priceETH, uint256 priceUSDC)',
  
  // ===== Admin: Bonus System =====
  'function setBonusLevel(uint256 levelId, uint256 minMints, bool active, uint256 baseAmountETH, uint256 baseAmountUSDC, bool allowlistOnly, uint256 cooldown, uint256 maxClaims)',
  'function setBonusTier(uint8 tier, uint256 threshold, uint256 multiplierBps)',
  'function depositBonusPoolETH() payable',
  'function depositBonusPoolUSDC(uint256 amount)',
  'function withdrawBonusPoolETH(uint256 amount)',
  'function withdrawBonusPoolUSDC(uint256 amount)',
  'function addToAllowlist(address[] users)',
  'function removeFromAllowlist(address[] users)',

  // ===== Admin: Fee Withdrawal =====
  'function withdrawFees()',
  'function withdrawFeesUSDC()',
  'function totalFeesCollectedETH() view returns (uint256)',
  'function totalFeesCollectedUSDC() view returns (uint256)',
]);

// ============ ERC20 ABI (for USDC) ============
export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

// ============ V3 EVENTS ============
export const CONTRACT_EVENTS_V3 = parseAbi([
  // Core events
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
  'event MetadataUpdate(uint256 indexed tokenId)',
  'event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
  
  // Minting events
  'event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity, uint256 pricePaid, uint8 currency)',
  'event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity, uint256 totalPaid, uint8 currency)',
  'event PlayerRegistered(address indexed player, string name, uint64 farcasterFid)',
  'event TokenMetadataFrozen(uint256 indexed tokenId)',
  
  // Bonus events
  'event BonusClaimed(address indexed user, uint256 indexed levelId, uint256 amount, uint8 currency)',
  'event BonusLevelConfigured(uint256 indexed levelId, uint256 minMints, bool active, uint256 baseAmountETH, uint256 baseAmountUSDC)',
  'event BonusTierConfigured(uint8 indexed tier, uint256 threshold, uint256 multiplierBps)',
  'event BonusPoolDeposited(uint8 currency, uint256 amount)',
  'event BonusPoolWithdrawn(uint8 currency, uint256 amount)',
  
  // Pricing events
  'event SupplyTierConfigured(uint8 indexed tier, uint256 threshold, uint256 priceETH, uint256 priceUSDC)',
  'event PriceTierChanged(uint8 oldTier, uint8 newTier)',
  
  // Admin events
  'event ContractPaused(bool paused)',
  'event FeesWithdrawn(address indexed to, uint256 amountETH, uint256 amountUSDC)',
  'event AllowlistUpdated(address indexed user, bool added)',
]);

// ============ V3 CUSTOM ERRORS ============
export const CONTRACT_ERRORS_V3 = parseAbi([
  // Core errors
  'error NotOwner()',
  'error ZeroAddress()',
  'error TokenNotExist()',
  'error NotApproved()',
  'error NotAuthorized()',
  'error InvalidQuantity()',
  'error MaxBatchExceeded()',
  'error MaxSupplyExceeded()',
  'error TransferToNonReceiver()',
  'error Paused()',
  'error ReentrancyGuard()',
  'error NameAlreadySet()',
  'error EmptyName()',
  'error MetadataFrozen()',
  'error AlreadyMinted()',
  
  // Payment errors
  'error InsufficientPayment(uint256 required, uint256 provided)',
  'error RefundFailed()',
  'error InvalidCurrency()',
  'error USDCTransferFailed()',
  'error InsufficientUSDCBalance()',
  'error InsufficientUSDCAllowance()',
  
  // Bonus errors
  'error BonusLevelNotActive()',
  'error BonusAlreadyClaimed()',
  'error BonusNotEligible(string reason)',
  'error BonusCooldownActive(uint256 remainingTime)',
  'error BonusMaxClaimsReached()',
  'error InsufficientBonusPool()',
  'error NotOnAllowlist()',
  
  // Tier errors
  'error InvalidTier()',
  'error TierNotConfigured()',
]);

// ============ HELPER CONSTANTS ============
export const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Gas estimates for V3
export const GAS_BASELINES_V3: Record<string, bigint> = {
  mint: 95000n,
  mintNFT: 95000n,
  mintWithUSDC: 110000n,
  mintGameNFT: 130000n,
  batchMint: 200000n,
  batchMintWithUSDC: 220000n,
  claimBonus: 65000n,
  claimBonusAsUSDC: 85000n,
  depositBonusPoolETH: 30000n,
  depositBonusPoolUSDC: 70000n,
  withdrawBonusPoolETH: 40000n,
  withdrawBonusPoolUSDC: 60000n,
  withdrawFees: 45000n,
  setSupplyTier: 50000n,
  setBonusLevel: 60000n,
} as const;

// Cache TTL
export const CONFIG_CACHE_TTL = 30000; // 30 seconds
export const BALANCE_CACHE_TTL = 10000; // 10 seconds
export const OWNERSHIP_CACHE_TTL = 5000; // 5 seconds
export const PRICE_CACHE_TTL = 15000; // 15 seconds

// ============ TYPE HELPERS ============
export interface SupplyTierConfig {
  tier: number;
  threshold: bigint;
  priceETH: bigint;
  priceUSDC: bigint;
}

export interface BonusLevelConfig {
  levelId: number;
  minMints: bigint;
  active: boolean;
  baseAmountETH: bigint;
  baseAmountUSDC: bigint;
  allowlistOnly: boolean;
  cooldown: bigint;
  maxClaims: bigint;
}

export interface BonusTierConfig {
  tier: number;
  threshold: bigint;
  multiplierBps: bigint; // 10000 = 100%
}

export interface ContractConfigV3 {
  // Core
  owner: string;
  paused: boolean;
  totalSupply: bigint;
  nextTokenId: bigint;
  maxSupply: bigint;
  maxBatchSize: bigint;
  
  // Pricing
  currentSupplyTier: number;
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  supplyTiers: SupplyTierConfig[];
  
  // Bonus
  bonusPoolETH: bigint;
  bonusPoolUSDC: bigint;
  currentBonusTier: number;
  bonusTiers: BonusTierConfig[];
  bonusLevels: BonusLevelConfig[];
  
  // Fees
  totalFeesCollectedETH: bigint;
  totalFeesCollectedUSDC: bigint;
  
  // Meta
  lastFetched: number;
  isLoaded: boolean;
}

export interface WalletStateV3 {
  address: string;
  nftBalance: bigint;
  ethBalance: bigint;
  usdcBalance: bigint;
  usdcAllowance: bigint;
  mintCount: bigint;
  isAllowlisted: boolean;
  totalClaims: bigint;
  lastFetched: number;
}

export interface BonusEligibility {
  levelId: number;
  eligible: boolean;
  reason: string;
  amountETH: bigint;
  amountUSDC: bigint;
  claimed: boolean;
  cooldownRemaining: bigint;
}

// ============ HELPER FUNCTIONS ============
export function formatETH(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return '0';
  if (eth < 0.0001) return '<0.0001';
  return eth.toFixed(4);
}

export function formatUSDC(amount: bigint): string {
  const usdc = Number(amount) / 1e6;
  if (usdc === 0) return '$0.00';
  return `$${usdc.toFixed(2)}`;
}

export function parseETH(eth: string): bigint {
  return BigInt(Math.floor(parseFloat(eth) * 1e18));
}

export function parseUSDC(usdc: string): bigint {
  return BigInt(Math.floor(parseFloat(usdc) * 1e6));
}
