// ============================================================
// MemoryMintUltraV2 Contract Integration
// Network: Base Mainnet (Chain ID: 8453)
// ============================================================

import { parseAbi } from 'viem';

// ============ CONTRACT ADDRESS ============
// TODO: Update after deployment
export const NFT_CONTRACT_ADDRESS_V2 = '0x0000000000000000000000000000000000000000' as const;

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

// ============ FULL V2 ABI ============
export const CONTRACT_ABI_V2 = parseAbi([
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
  'function throttleEnabled() view returns (bool)',
  'function nextTokenId() view returns (uint256)',

  // ===== V2: Kill Switch =====
  'function killSwitch() view returns (bool)',
  'function emergencyStop(bool status)',

  // ===== V2: Wallet Mint Limits =====
  'function walletMintLimit() view returns (uint256)',
  'function walletMintCount(address wallet) view returns (uint256)',
  'function setWalletMintLimit(uint256 maxMints)',

  // ===== V2: Pricing =====
  'function mintPriceETH() view returns (uint256)',
  'function mintPriceUSDC() view returns (uint256)',
  'function mintCurrency() view returns (uint8)',
  'function setMintPriceETH(uint256 priceWei)',
  'function setMintPriceUSDC(uint256 priceUSDC)',
  'function setMintCurrency(uint8 currency)',

  // ===== V2: Bonus System =====
  'function bonusLevels(uint8 level) view returns (bool enabled, uint8 currency, uint256 amount)',
  'function getBonusLevel(uint8 level) view returns (bool enabled, uint8 currency, uint256 amount)',
  'function bonusClaimed(address wallet, uint8 level) view returns (bool)',
  'function hasClaimed(address wallet, uint8 level) view returns (bool)',
  'function setBonusLevel(uint8 level, bool enabled, uint8 currency, uint256 amount)',
  'function claimBonus(uint8 level)',

  // ===== V2: Bonus Pools =====
  'function bonusPoolETH() view returns (uint256)',
  'function bonusPoolUSDC() view returns (uint256)',
  'function depositETH() payable',
  'function depositUSDC(uint256 amount)',
  'function withdrawETH(uint256 amount)',
  'function withdrawUSDC(uint256 amount)',
  'function withdrawMintFees()',

  // ===== Minting Functions =====
  'function mintNFT(string tokenURI_) payable returns (uint256)',
  'function mintGameNFT(string tokenURI_, uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame, string playerName, uint64 farcasterFid) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',

  // ===== Player Data =====
  'function getPlayer(address player) view returns (string playerName, uint64 farcasterFid, uint32 totalMints, uint32 firstMintTime, bool nameSet)',

  // ===== NFT Metadata =====
  'function getNFTMetadata(uint256 tokenId) view returns (uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame)',
  'function isMetadataFrozen(uint256 tokenId) view returns (bool)',

  // ===== Admin Functions =====
  'function pause()',
  'function unpause()',
  'function setThrottle(bool enabled)',
  'function setBaseURI(string baseURI_)',
  'function updateTokenURI(uint256 tokenId, string newTokenURI)',
  'function freezeTokenMetadata(uint256 tokenId)',
  'function batchFreezeMetadata(uint256 fromTokenId, uint256 toTokenId)',
  'function transferOwnership(address newOwner)',
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

// ============ V2 EVENTS ============
export const CONTRACT_EVENTS_V2 = parseAbi([
  // Core events
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
  // V2 events
  'event WalletMintLimitUpdated(uint256 newLimit)',
  'event MintPriceETHUpdated(uint256 newPrice)',
  'event MintPriceUSDCUpdated(uint256 newPrice)',
  'event MintCurrencyUpdated(uint8 currency)',
  'event BonusLevelConfigured(uint8 indexed level, bool enabled, uint8 currency, uint256 amount)',
  'event BonusClaimed(address indexed user, uint8 indexed level, uint256 amount, uint8 currency)',
  'event ETHDeposited(address indexed depositor, uint256 amount)',
  'event USDCDeposited(address indexed depositor, uint256 amount)',
  'event ETHWithdrawn(address indexed to, uint256 amount)',
  'event USDCWithdrawn(address indexed to, uint256 amount)',
  'event EmergencyStopSet(bool status)',
]);

// ============ V2 CUSTOM ERRORS ============
export const CONTRACT_ERRORS_V2 = parseAbi([
  // Core errors
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
  // V2 errors
  'error KillSwitchActive()',
  'error InsufficientPayment()',
  'error WalletMintLimitExceeded(uint256 limit)',
  'error InvalidBonusLevel()',
  'error BonusNotEnabled()',
  'error AlreadyClaimed()',
  'error InsufficientBonusPool()',
  'error WithdrawFailed()',
  'error ZeroAmount()',
  'error InvalidCurrency()',
  'error USDCTransferFailed()',
  'error InsufficientUSDCBalance()',
  'error InsufficientUSDCAllowance()',
]);

// ============ HELPER CONSTANTS ============
export const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Gas estimates
export const GAS_BASELINES_V2: Record<string, bigint> = {
  mintNFT: 85000n,
  mintNFTWithPayment: 90000n,
  mintGameNFT: 120000n,
  batchMint: 200000n,
  setWalletMintLimit: 30000n,
  setMintPriceETH: 30000n,
  setMintPriceUSDC: 30000n,
  setMintCurrency: 28000n,
  setBonusLevel: 45000n,
  claimBonusETH: 55000n,
  claimBonusUSDC: 75000n,
  depositETH: 25000n,
  depositUSDC: 65000n,
  withdrawETH: 35000n,
  withdrawUSDC: 55000n,
  emergencyStop: 28000n,
} as const;

// Cache TTL
export const CONFIG_CACHE_TTL = 30000;
export const BALANCE_CACHE_TTL = 10000;
export const OWNERSHIP_CACHE_TTL = 5000;

// ============ TYPE HELPERS ============
export interface BonusLevelConfig {
  level: BonusLevel;
  enabled: boolean;
  currency: 'ETH' | 'USDC';
  amount: bigint;
}

export interface ContractConfigV2 {
  // Core
  owner: string;
  paused: boolean;
  throttleEnabled: boolean;
  totalSupply: bigint;
  nextTokenId: bigint;
  // V2: Kill switch
  killSwitch: boolean;
  // V2: Wallet limits
  walletMintLimit: bigint;
  // V2: Pricing
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  mintCurrency: number;
  // V2: Bonus pools
  bonusPoolETH: bigint;
  bonusPoolUSDC: bigint;
  // V2: Bonus levels
  bonusLevels: BonusLevelConfig[];
}

// ============ ABI FUNCTION LIST (for detection) ============
export const V2_FUNCTIONS = [
  // New V2 functions
  'killSwitch',
  'emergencyStop',
  'walletMintLimit',
  'walletMintCount',
  'setWalletMintLimit',
  'mintPriceETH',
  'mintPriceUSDC',
  'mintCurrency',
  'setMintPriceETH',
  'setMintPriceUSDC',
  'setMintCurrency',
  'bonusLevels',
  'getBonusLevel',
  'bonusClaimed',
  'hasClaimed',
  'setBonusLevel',
  'claimBonus',
  'bonusPoolETH',
  'bonusPoolUSDC',
  'depositETH',
  'depositUSDC',
  'withdrawETH',
  'withdrawUSDC',
  'withdrawMintFees',
] as const;

/**
 * Check if the connected contract supports V2 features
 * by checking for presence of V2-specific functions
 */
export function isV2Contract(abiStrings: string[]): boolean {
  const v2Required = ['killSwitch', 'walletMintLimit', 'bonusPoolETH', 'setBonusLevel'];
  return v2Required.every(fn => 
    abiStrings.some(abi => abi.includes(fn))
  );
}
