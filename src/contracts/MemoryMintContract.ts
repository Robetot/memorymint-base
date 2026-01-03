// ============================================================
// MemoryMintUltra Contract Integration
// Deployed: 0x9B84d4e689000ab050e9754c5b123fC87E55A9f6
// Network: Base Mainnet (Chain ID: 8453)
// ============================================================

import { parseAbi } from 'viem';

// ============ CONTRACT ADDRESS ============
export const NFT_CONTRACT_ADDRESS = '0x9B84d4e689000ab050e9754c5b123fC87E55A9f6' as const;

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
] as const;

// ============ CHAIN CONFIG ============
export const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
} as const;

// ============ PAYMENT TYPES (for compatibility - contract is FREE) ============
export type PaymentCurrency = 'ETH' | 'USDC';
export const PaymentCurrencyEnum = { ETH: 0, USDC: 1 } as const;

// ============ CLAIM MODES (for compatibility - not used in this contract) ============
export type ClaimMode = 'DISABLED' | 'FCFS' | 'UNLIMITED' | 'ONE_TIME' | 'CUSTOM';
export const ClaimModeEnum = {
  DISABLED: 0,
  FCFS: 1,
  UNLIMITED: 2,
  ONE_TIME: 3,
  CUSTOM: 4,
} as const;

// ============ ANTI-BOT MODES (for compatibility) ============
export type AntiBotMode = 'DISABLED' | 'SOFT' | 'MODERATE' | 'STRICT' | 'CUSTOM';
export const AntiBotModeEnum = {
  DISABLED: 0,
  SOFT: 1,
  MODERATE: 2,
  STRICT: 3,
  CUSTOM: 4,
} as const;

// ============ ABI MATCHING DEPLOYED MemoryMintUltra ============
export const CONTRACT_ABI = parseAbi([
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

  // ===== Minting Functions (FREE - gas only) =====
  'function mintNFT(string tokenURI_) returns (uint256)',
  'function mintGameNFT(string tokenURI_, uint8 level, uint8 rarity, uint16 score, uint32 completionTime, uint8 comboStreak, bool perfectGame, string playerName, uint64 farcasterFid) returns (uint256)',
  'function batchMint(uint256 quantity) returns (uint256)',

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

// ============ ERC20 ABI (for USDC - kept for compatibility) ============
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
} as const;

// ============ CACHE TTL CONSTANTS ============
export const CONFIG_CACHE_TTL = 30000; // 30 seconds for config
export const BALANCE_CACHE_TTL = 10000; // 10 seconds for balances
export const OWNERSHIP_CACHE_TTL = 5000; // 5 seconds for ownership
