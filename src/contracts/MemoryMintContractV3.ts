// ============================================================
// MemoryMintUltraV3 Contract Integration
// Deployed: 0x8A6EAc80dd2cC5efE7a6b10a4430a89871A4672B
// Network: Base Mainnet (Chain ID: 8453)
// Features: Dynamic Pricing, Multi-tier Bonuses, USDC Support
// ============================================================

import { parseAbi } from 'viem';

// ============ CONTRACT ADDRESS ============
export const NFT_CONTRACT_ADDRESS_V3 = '0x8A6EAc80dd2cC5efE7a6b10a4430a89871A4672B' as const;

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

// ============ FULL V3 ABI (from BaseScan) ============
export const CONTRACT_ABI_V3 = parseAbi([
  // ===== ERC-721 Standard =====
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner_) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner_, address operator) view returns (bool)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
  'function supportsInterface(bytes4 interfaceId) pure returns (bool)',

  // ===== Core View Functions =====
  'function owner() view returns (address)',
  'function totalMinted() view returns (uint256)',
  'function getCurrentTokenId() view returns (uint256)',
  'function mintPaused() view returns (bool)',
  'function claimsPaused() view returns (bool)',
  'function killSwitch() view returns (bool)',
  
  // ===== Price Configuration =====
  'function mintPriceETH() view returns (uint256)',
  'function mintPriceUSDC() view returns (uint256)',
  'function maxPriceETH() view returns (uint256)',
  'function maxPriceUSDC() view returns (uint256)',
  'function mintCooldown() view returns (uint256)',
  'function walletMintLimit() view returns (uint256)',
  
  // ===== Dynamic Pricing Functions =====
  'function getEffectiveMintPrice(uint8 level, uint8 currency) view returns (uint256)',
  'function getEffectiveBonus(uint8 level, uint8 currency) view returns (uint256)',
  
  // ===== Dynamic Config =====
  'function dynamicPricingConfig() view returns (bool enabled, uint8 priority, uint8 activeLevelCount, uint8 activeSupplyTierCount)',
  'function dynamicBonusConfig() view returns (bool enabled, uint8 priority, uint8 activeLevelCount, uint8 activeSupplyTierCount)',
  
  // ===== Level & Supply Tier Config =====
  'function levelPrices(uint8) view returns (uint256 priceETH, uint256 priceUSDC, bool isActive)',
  'function levelBonuses(uint8) view returns (uint256 bonusETH, uint256 bonusUSDC, bool isActive)',
  'function supplyPriceTiers(uint8) view returns (uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC, bool isActive)',
  'function supplyBonusTiers(uint8) view returns (uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC, bool isActive)',
  
  // ===== Bonus Levels Config (legacy) =====
  'function bonusLevels(uint256) view returns (uint256 bonusAmountETH, uint256 bonusAmountUSDC, uint256 minMintCount, uint256 minHoldDuration, bool isActive)',

  // ===== Currency Config =====
  'function currencyConfig() view returns (bool ethEnabled, bool usdcEnabled, uint8 activeCurrency)',
  
  // ===== Anti-Bot & Eligibility =====
  'function antiBotMode() view returns (uint8)',
  'function claimMode() view returns (uint8)',
  'function eligibilityRules() view returns (uint256 minMintCount, uint256 minHoldDuration, uint256 claimCooldown, bool requireAllowlist, bool requireSignature)',
  
  // ===== Bonus Pool =====
  'function bonusPoolETH() view returns (uint256)',
  'function bonusPoolUSDC() view returns (uint256)',
  'function bonusCapPerWallet() view returns (uint256)',
  'function totalBonusClaimedETH() view returns (uint256)',
  'function totalBonusClaimedUSDC() view returns (uint256)',

  // ===== Wallet Data =====
  'function getWalletData(address wallet) view returns ((uint256 mintCount, uint256 lastMintTime, uint256 claimCount, uint256 lastClaimTime, uint256 totalBonusClaimed, bool isAllowlisted))',
  'function walletData(address) view returns (uint256 mintCount, uint256 lastMintTime, uint256 claimCount, uint256 lastClaimTime, uint256 totalBonusClaimed, bool isAllowlisted)',
  'function allowlist(address) view returns (bool)',
  'function getNonce(address wallet) view returns (uint256)',
  'function signatureVerifier() view returns (address)',
  'function isSignatureUsed(bytes32 sigHash) view returns (bool)',

  // ===== Minting Functions (ETH) =====
  'function mint(string metadataURI) payable',
  'function mintNFT(string metadataURI) payable',
  'function mintNFTWithLevel(string metadataURI, uint8 level) payable',
  'function batchMint(string[] metadataURIs) payable',
  'function mintTo(address to, string metadataURI)',
  'function mintWithSignature(string metadataURI, uint256 nonce, uint256 expiration, bytes signature) payable',
  
  // ===== Minting Functions (USDC) =====
  'function mintWithUSDC(string metadataURI)',

  // ===== Bonus Claiming =====
  'function claimBonus(uint256 level)',

  // ===== Admin: State Control =====
  'function setMintPaused(bool paused)',
  'function setClaimsPaused(bool paused)',
  'function activateKillSwitch()',
  'function transferOwnership(address newOwner)',

  // ===== Admin: Pricing =====
  'function setMintPrice(uint256 ethPrice, uint256 usdcPrice)',
  'function setMaxPriceCap(uint256 maxETH, uint256 maxUSDC)',
  'function setMintCooldown(uint256 cooldown)',
  'function setWalletMintLimit(uint256 limit)',
  'function setDynamicPricingEnabled(bool enabled)',
  'function setLevelPrice(uint8 level, uint256 priceETH, uint256 priceUSDC)',
  'function setSupplyPriceTier(uint8 tier, uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC)',
  
  // ===== Admin: Bonus System =====
  'function setDynamicBonusEnabled(bool enabled)',
  'function setLevelBonus(uint8 level, uint256 bonusETH, uint256 bonusUSDC)',
  'function setSupplyBonusTier(uint8 tier, uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC)',
  'function setBonusCapPerWallet(uint256 cap)',
  'function depositBonusPool() payable',
  'function depositBonusPoolUSDC(uint256 amount)',
  'function withdrawBonusPool(uint256 ethAmount, uint256 usdcAmount)',

  // ===== Admin: Currency & Anti-Bot =====
  'function setCurrencyConfig(bool ethEnabled, bool usdcEnabled, uint8 activeCurrency)',
  'function setAntiBotMode(uint8 mode)',
  'function setClaimMode(uint8 mode)',
  'function setEligibilityRules(uint256 minMints, uint256 cooldown, bool requireAllowlist)',
  'function setSignatureVerifier(address verifier)',
  
  // ===== Admin: Allowlist =====
  'function setAllowlist(address[] wallets, bool allow)',
  
  // ===== Admin: Metadata =====
  'function setBaseURI(string uri)',
  'function setTokenURI(uint256 tokenId, string uri)',
  
  // ===== Admin: Fee Withdrawal =====
  'function withdrawFees()',
  'function emergencyWithdraw()',
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
  // Core ERC-721 events
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
  
  // Minting events
  'event NFTMinted(address indexed minter, uint256 indexed tokenId, string metadataURI, uint256 price, uint8 currency)',
  'event BatchMinted(address indexed minter, uint256 startTokenId, uint256 count, uint256 totalPrice, uint8 currency)',
  
  // Bonus events
  'event BonusClaimed(address indexed claimer, uint256 amount, uint8 currency, uint256 level)',
  
  // Config events
  'event CurrencyUpdated(bool ethEnabled, bool usdcEnabled, uint8 activeCurrency)',
  'event MintPriceUpdated(uint256 newPriceETH, uint256 newPriceUSDC)',
  'event MaxPriceCapUpdated(uint256 maxETH, uint256 maxUSDC)',
]);

// ============ V3 CUSTOM ERRORS ============
export const CONTRACT_ERRORS_V3 = parseAbi([
  // Core errors
  'error Unauthorized()',
  'error InvalidAddress()',
  'error TokenNotFound()',
  'error ReentrancyGuard()',
  'error KillSwitchActive()',
  
  // Minting errors
  'error MintPaused()',
  'error MintCooldownActive()',
  'error WalletLimitExceeded()',
  'error BatchSizeExceeded()',
  'error InsufficientPayment()',
  'error CurrencyNotEnabled()',
  'error USDCNotEnabled()',
  'error TransferFailed()',
  
  // Signature errors
  'error InvalidSignature()',
  'error InvalidNonce()',
  'error ExpiredSignature()',
  'error SignatureExpirationTooShort()',
  
  // Bonus errors
  'error ClaimsPaused()',
  'error ClaimCooldownActive()',
  'error NoBonusAvailable()',
  'error NotEligible()',
  'error BonusCapExceeded()',
  'error InsufficientContractBalance()',
  
  // Tier errors
  'error InvalidLevel()',
  'error InvalidTier()',
]);

// ============ HELPER CONSTANTS ============
export const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Gas estimates for V3
export const GAS_BASELINES_V3: Record<string, bigint> = {
  mint: 95000n,
  mintNFT: 95000n,
  mintNFTWithLevel: 100000n,
  mintWithUSDC: 110000n,
  batchMint: 200000n,
  mintWithSignature: 120000n,
  claimBonus: 65000n,
  depositBonusPool: 30000n,
  depositBonusPoolUSDC: 70000n,
  withdrawBonusPool: 50000n,
  withdrawFees: 45000n,
  setMintPrice: 45000n,
  setLevelPrice: 50000n,
  setSupplyPriceTier: 55000n,
  setLevelBonus: 50000n,
  setSupplyBonusTier: 55000n,
  setWalletMintLimit: 30000n,
  setAntiBotMode: 30000n,
  setClaimMode: 30000n,
  setAllowlist: 80000n,
} as const;

// Cache TTL
export const CONFIG_CACHE_TTL = 30000; // 30 seconds
export const BALANCE_CACHE_TTL = 10000; // 10 seconds
export const OWNERSHIP_CACHE_TTL = 5000; // 5 seconds
export const PRICE_CACHE_TTL = 15000; // 15 seconds

// ============ TYPE HELPERS ============
export interface SupplyTierConfig {
  tier: number;
  minSupply: bigint;
  maxSupply: bigint;
  priceETH: bigint;
  priceUSDC: bigint;
  isActive: boolean;
}

export interface SupplyBonusTierConfig {
  tier: number;
  minSupply: bigint;
  maxSupply: bigint;
  bonusETH: bigint;
  bonusUSDC: bigint;
  isActive: boolean;
}

export interface LevelPriceConfig {
  level: number;
  priceETH: bigint;
  priceUSDC: bigint;
  isActive: boolean;
}

export interface LevelBonusConfig {
  level: number;
  bonusETH: bigint;
  bonusUSDC: bigint;
  isActive: boolean;
}

export interface BonusLevelConfig {
  levelId: number;
  bonusAmountETH: bigint;
  bonusAmountUSDC: bigint;
  minMintCount: bigint;
  minHoldDuration: bigint;
  isActive: boolean;
}

export interface BonusTierConfig {
  tier: number;
  threshold: bigint;
  multiplierBps: bigint; // 10000 = 100%
}

export interface WalletData {
  mintCount: bigint;
  lastMintTime: bigint;
  claimCount: bigint;
  lastClaimTime: bigint;
  totalBonusClaimed: bigint;
  isAllowlisted: boolean;
}

export interface EligibilityRules {
  minMintCount: bigint;
  minHoldDuration: bigint;
  claimCooldown: bigint;
  requireAllowlist: boolean;
  requireSignature: boolean;
}

export interface CurrencyConfig {
  ethEnabled: boolean;
  usdcEnabled: boolean;
  activeCurrency: number;
}

export interface DynamicConfig {
  enabled: boolean;
  priority: number;
  activeLevelCount: number;
  activeSupplyTierCount: number;
}

export interface ContractConfigV3 {
  // Core
  owner: string;
  paused: boolean;
  claimsPaused: boolean;
  killSwitch: boolean;
  totalMinted: bigint;
  currentTokenId: bigint;
  
  // Pricing
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  maxPriceETH: bigint;
  maxPriceUSDC: bigint;
  mintCooldown: bigint;
  walletMintLimit: bigint;
  
  // Currency
  currencyConfig: CurrencyConfig;
  
  // Dynamic Pricing
  dynamicPricingConfig: DynamicConfig;
  dynamicBonusConfig: DynamicConfig;
  
  // Bonus Pool
  bonusPoolETH: bigint;
  bonusPoolUSDC: bigint;
  bonusCapPerWallet: bigint;
  totalBonusClaimedETH: bigint;
  totalBonusClaimedUSDC: bigint;
  
  // Anti-Bot
  antiBotMode: number;
  claimMode: number;
  eligibilityRules: EligibilityRules;
  
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
  walletData: WalletData;
  nonce: bigint;
  isAllowlisted: boolean;
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

// ============ FUNCTION INTEGRATION GUIDE ============
/*
  Integration Functions Reference:
  
  READ FUNCTIONS:
  - owner(): Fetch current contract owner
  - totalMinted(): Get total NFTs minted
  - getWalletData(address): Fetch wallet mint/claim info
  - getEffectiveMintPrice(level, currency): Get dynamic mint price (level=1, currency: 0=ETH, 1=USDC)
  - getEffectiveBonus(level, currency): Get dynamic bonus by level & currency
  
  WRITE FUNCTIONS:
  - mintNFT(metadataURI): Mint single NFT with metadata URI (payable)
  - mintNFTWithLevel(metadataURI, level): Mint NFT with specific level (payable)
  - batchMint(metadataURIs[]): Batch mint multiple NFTs (payable)
  - claimBonus(level): Claim bonus for a level
  
  ADMIN FUNCTIONS:
  - setWalletMintLimit(limit): Set wallet mint limit
  - setAntiBotMode(mode): Toggle anti-bot mode (0=disabled, 1-4=enabled modes)
  - withdrawBonusPool(ethAmount, usdcAmount): Withdraw from bonus pools
  - depositBonusPool(): Deposit ETH to bonus pool (payable)
  - depositBonusPoolUSDC(amount): Deposit USDC to bonus pool
*/
