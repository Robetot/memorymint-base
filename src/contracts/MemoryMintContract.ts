// ============================================================
// MemoryMint Contract Integration - MemoryMintUltraV4
// Deployed: 0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0
// Network: Base Mainnet (Chain ID: 8453)
// ABI: Production contract - VERIFIED FROM BASESCAN
// Features: Dynamic Pricing, Level/Supply Bonuses, USDC Support
// ============================================================

// ============ CONTRACT ADDRESS ============
export const NFT_CONTRACT_ADDRESS = '0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0' as const;

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
export type AntiBotMode = 'DISABLED' | 'ENABLED' | 'STRICT';
export const AntiBotModeEnum = {
  DISABLED: 0,
  ENABLED: 1,
  STRICT: 2,
} as const;

// ============ RESOLUTION PRIORITY ============
export type ResolutionPriority = 'LEVEL_FIRST' | 'SUPPLY_FIRST' | 'LEVEL_ONLY' | 'SUPPLY_ONLY';
export const ResolutionPriorityEnum = {
  LEVEL_FIRST: 0,
  SUPPLY_FIRST: 1,
  LEVEL_ONLY: 2,
  SUPPLY_ONLY: 3,
} as const;

// ============ CACHE SETTINGS ============
export const CONFIG_CACHE_TTL = 30_000; // 30 seconds
export const BALANCE_CACHE_TTL = 15_000; // 15 seconds

// ============ CONTRACT ERRORS ABI (for decoding reverts) ============
export const CONTRACT_ERRORS = [
  {"inputs":[],"name":"AlreadyClaimed","type":"error"},
  {"inputs":[],"name":"AlreadyMinted","type":"error"},
  {"inputs":[],"name":"BonusDepositsDisabled","type":"error"},
  {"inputs":[],"name":"BonusNotEnabled","type":"error"},
  {"inputs":[],"name":"InsufficientBonusPool","type":"error"},
  {"inputs":[],"name":"InsufficientPayment","type":"error"},
  {"inputs":[],"name":"InsufficientUSDCAllowance","type":"error"},
  {"inputs":[],"name":"InsufficientUSDCBalance","type":"error"},
  {"inputs":[],"name":"InvalidBonusLevel","type":"error"},
  {"inputs":[],"name":"InvalidCurrency","type":"error"},
  {"inputs":[],"name":"InvalidQuantity","type":"error"},
  {"inputs":[],"name":"KillSwitchActive","type":"error"},
  {"inputs":[],"name":"MetadataFrozen","type":"error"},
  {"inputs":[],"name":"NotApproved","type":"error"},
  {"inputs":[],"name":"NotAuthorized","type":"error"},
  {"inputs":[],"name":"NotOwner","type":"error"},
  {"inputs":[],"name":"OwnershipTransferLocked","type":"error"},
  {"inputs":[],"name":"Paused","type":"error"},
  {"inputs":[],"name":"ReentrancyGuard","type":"error"},
  {"inputs":[],"name":"TokenNotExist","type":"error"},
  {"inputs":[],"name":"TransferToNonReceiver","type":"error"},
  {"inputs":[],"name":"USDCTransferFailed","type":"error"},
  {"inputs":[{"internalType":"uint256","name":"limit","type":"uint256"}],"name":"WalletMintLimitExceeded","type":"error"},
  {"inputs":[],"name":"WithdrawFailed","type":"error"},
  {"inputs":[],"name":"WithdrawFeesDisabled","type":"error"},
  {"inputs":[],"name":"ZeroAddress","type":"error"},
  {"inputs":[],"name":"ZeroAmount","type":"error"},
] as const;

// ============================================================
// PRODUCTION CONTRACT ABI - VERIFIED FROM BASESCAN
// Address: 0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0
// DO NOT MODIFY - This is the canonical ABI
// ============================================================
export const CONTRACT_ABI = [
  // ===== CUSTOM ERRORS =====
  {"inputs":[],"name":"AlreadyClaimed","type":"error"},
  {"inputs":[],"name":"AlreadyMinted","type":"error"},
  {"inputs":[],"name":"BonusDepositsDisabled","type":"error"},
  {"inputs":[],"name":"BonusNotEnabled","type":"error"},
  {"inputs":[],"name":"InsufficientBonusPool","type":"error"},
  {"inputs":[],"name":"InsufficientPayment","type":"error"},
  {"inputs":[],"name":"InsufficientUSDCAllowance","type":"error"},
  {"inputs":[],"name":"InsufficientUSDCBalance","type":"error"},
  {"inputs":[],"name":"InvalidBonusLevel","type":"error"},
  {"inputs":[],"name":"InvalidCurrency","type":"error"},
  {"inputs":[],"name":"InvalidQuantity","type":"error"},
  {"inputs":[],"name":"KillSwitchActive","type":"error"},
  {"inputs":[],"name":"MetadataFrozen","type":"error"},
  {"inputs":[],"name":"NotApproved","type":"error"},
  {"inputs":[],"name":"NotAuthorized","type":"error"},
  {"inputs":[],"name":"NotOwner","type":"error"},
  {"inputs":[],"name":"OwnershipTransferLocked","type":"error"},
  {"inputs":[],"name":"Paused","type":"error"},
  {"inputs":[],"name":"ReentrancyGuard","type":"error"},
  {"inputs":[],"name":"TokenNotExist","type":"error"},
  {"inputs":[],"name":"TransferToNonReceiver","type":"error"},
  {"inputs":[],"name":"USDCTransferFailed","type":"error"},
  {"inputs":[{"internalType":"uint256","name":"limit","type":"uint256"}],"name":"WalletMintLimitExceeded","type":"error"},
  {"inputs":[],"name":"WithdrawFailed","type":"error"},
  {"inputs":[],"name":"WithdrawFeesDisabled","type":"error"},
  {"inputs":[],"name":"ZeroAddress","type":"error"},
  {"inputs":[],"name":"ZeroAmount","type":"error"},

  // ===== EVENTS =====
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"enum AntiBotMode","name":"mode","type":"uint8"}],"name":"AntiBotModeUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"fromTokenId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"toTokenId","type":"uint256"}],"name":"BatchMetadataUpdate","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"startTokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"BatchMinted","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"BonusClaimActiveUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"}],"name":"BonusClaimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"BonusDepositsEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"BonusLevelConfigured","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"BonusLevelsEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"paused","type":"bool"}],"name":"ContractPaused","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"DynamicBonusEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"enum ResolutionPriority","name":"priority","type":"uint8"}],"name":"DynamicBonusResolutionUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"claimer","type":"address"},{"indexed":false,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"bonus","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"}],"name":"DynamicBonusUsed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":false,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"}],"name":"DynamicMintPriceUsed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"DynamicPricingEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"enum ResolutionPriority","name":"priority","type":"uint8"}],"name":"DynamicPricingResolutionUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ETHDeposited","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ETHWithdrawn","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"status","type":"bool"}],"name":"EmergencyStopSet","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"FreeMintUpdated","type":"event"},
  {"anonymous":false,"inputs":[],"name":"KillSwitchDeactivated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"bonusETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"LevelBonusConfigured","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"priceETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"LevelPriceConfigured","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"MetadataUpdate","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"}],"name":"MintCurrencyUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"paused","type":"bool"}],"name":"MintPausedUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newPrice","type":"uint256"}],"name":"MintPriceETHUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newPrice","type":"uint256"}],"name":"MintPriceUSDCUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"string","name":"tokenURI","type":"string"},{"indexed":false,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"rarity","type":"uint8"}],"name":"NFTMinted","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"OwnershipTransferEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"uint64","name":"farcasterFid","type":"uint64"}],"name":"PlayerRegistered","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"tierIndex","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"minSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"maxSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bonusETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"SupplyBonusTierConfigured","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"tierIndex","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"minSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"maxSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"priceETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"SupplyPriceTierConfigured","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"TokenMetadataFrozen","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"depositor","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"USDCDeposited","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"USDCWithdrawn","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newLimit","type":"uint256"}],"name":"WalletMintLimitUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"WithdrawFeesEnabled","type":"event"},

  // ===== CONSTANTS =====
  {"inputs":[],"name":"BASE_USDC","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"BONUS_LEVELS","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"CURRENCY_ETH","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"CURRENCY_USDC","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"MAX_BATCH_SIZE","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"MAX_LEVELS","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"MAX_SUPPLY_TIERS","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"USDC_DECIMALS","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},

  // ===== CORE VIEW FUNCTIONS =====
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"baseURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalMinted","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},

  // ===== MINT STATE VIEW FUNCTIONS =====
  {"inputs":[],"name":"isMintActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintPaused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"killSwitch","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"isKillSwitchActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== FREE MINT VIEW FUNCTIONS =====
  {"inputs":[],"name":"freeMintActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"isFreeMint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== PRICING VIEW FUNCTIONS =====
  {"inputs":[],"name":"mintPriceETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintPriceUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintCurrency","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},

  // ===== DYNAMIC PRICING VIEW FUNCTIONS =====
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint8","name":"currency","type":"uint8"}],"name":"getEffectiveMintPrice","outputs":[{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"bool","name":"isDynamic","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint8","name":"currency","type":"uint8"}],"name":"getEffectiveBonus","outputs":[{"internalType":"uint256","name":"bonus","type":"uint256"},{"internalType":"bool","name":"isDynamic","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"dynamicPricing","outputs":[{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"enum ResolutionPriority","name":"resolutionPriority","type":"uint8"},{"internalType":"uint8","name":"levelCount","type":"uint8"},{"internalType":"uint8","name":"supplyTierCount","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"dynamicBonus","outputs":[{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"enum ResolutionPriority","name":"resolutionPriority","type":"uint8"},{"internalType":"uint8","name":"levelCount","type":"uint8"},{"internalType":"uint8","name":"supplyTierCount","type":"uint8"}],"stateMutability":"view","type":"function"},

  // ===== LEVEL & SUPPLY TIER PRICING =====
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"levelPrices","outputs":[{"internalType":"uint256","name":"priceETH","type":"uint256"},{"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"levelBonuses","outputs":[{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"supplyPriceTiers","outputs":[{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"priceETH","type":"uint256"},{"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"internalType":"bool","name":"enabled","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"supplyBonusTiers","outputs":[{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"internalType":"bool","name":"enabled","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== BONUS POOL VIEW FUNCTIONS =====
  {"inputs":[],"name":"bonusPoolETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"bonusPoolUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"allowBonusDeposit","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== BONUS CLAIM VIEW FUNCTIONS =====
  {"inputs":[],"name":"bonusClaimActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"isBonusClaimActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"bonusLevelsEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"bonusLevels","outputs":[{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"uint8","name":"currency","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint8","name":"","type":"uint8"}],"name":"bonusClaimed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"}],"name":"getBonusLevel","outputs":[{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"uint8","name":"currency","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"wallet","type":"address"},{"internalType":"uint8","name":"level","type":"uint8"}],"name":"hasClaimed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== WALLET & ANTI-BOT VIEW FUNCTIONS =====
  {"inputs":[],"name":"walletMintLimit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"walletMintCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"antiBotMode","outputs":[{"internalType":"enum AntiBotMode","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"isAntiBotActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getAntiBotMode","outputs":[{"internalType":"uint8","name":"mode","type":"uint8"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"throttleEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== TREASURY VIEW FUNCTIONS =====
  {"inputs":[],"name":"withdrawFeesEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== OWNERSHIP VIEW FUNCTIONS =====
  {"inputs":[],"name":"ownershipTransferEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== PLAYER & NFT METADATA VIEW FUNCTIONS =====
  {"inputs":[{"internalType":"address","name":"player","type":"address"}],"name":"getPlayer","outputs":[{"internalType":"string","name":"playerName","type":"string"},{"internalType":"uint64","name":"farcasterFid","type":"uint64"},{"internalType":"uint32","name":"totalMints","type":"uint32"},{"internalType":"uint32","name":"firstMintTime","type":"uint32"},{"internalType":"bool","name":"nameSet","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getNFTMetadata","outputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint8","name":"rarity","type":"uint8"},{"internalType":"uint16","name":"score","type":"uint16"},{"internalType":"uint32","name":"completionTime","type":"uint32"},{"internalType":"uint8","name":"comboStreak","type":"uint8"},{"internalType":"bool","name":"perfectGame","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"isMetadataFrozen","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== ERC721 VIEW FUNCTIONS =====
  {"inputs":[{"internalType":"address","name":"owner_","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner_","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},

  // ===== MINTING FUNCTIONS =====
  {"inputs":[{"internalType":"string","name":"tokenURI_","type":"string"}],"name":"mintNFT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"string","name":"tokenURI_","type":"string"},{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint8","name":"rarity","type":"uint8"},{"internalType":"uint16","name":"score","type":"uint16"},{"internalType":"uint32","name":"completionTime","type":"uint32"},{"internalType":"uint8","name":"comboStreak","type":"uint8"},{"internalType":"bool","name":"perfectGame","type":"bool"},{"internalType":"string","name":"playerName","type":"string"},{"internalType":"uint64","name":"farcasterFid","type":"uint64"}],"name":"mintGameNFT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"batchMint","outputs":[{"internalType":"uint256","name":"startTokenId","type":"uint256"}],"stateMutability":"payable","type":"function"},

  // ===== ERC721 TRANSFER FUNCTIONS =====
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== BONUS CLAIM FUNCTION =====
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"}],"name":"claimBonus","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: MINT CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"_paused","type":"bool"}],"name":"setMintPaused","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"_paused","type":"bool"}],"name":"setPaused","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"_active","type":"bool"}],"name":"setFreeMintActive","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"active","type":"bool"}],"name":"setKillSwitch","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"deactivateKillSwitch","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: PRICING CONTROLS =====
  {"inputs":[{"internalType":"uint256","name":"price","type":"uint256"}],"name":"setMintPriceETH","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"price","type":"uint256"}],"name":"setMintPriceUSDC","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"currency","type":"uint8"}],"name":"setMintCurrency","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: DYNAMIC PRICING CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setDynamicPricingEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"enum ResolutionPriority","name":"priority","type":"uint8"}],"name":"setDynamicPricingResolution","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint256","name":"priceETH","type":"uint256"},{"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"name":"setLevelPrice","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"tierIndex","type":"uint8"},{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"priceETH","type":"uint256"},{"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setSupplyPriceTier","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: DYNAMIC BONUS CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setDynamicBonusEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"enum ResolutionPriority","name":"priority","type":"uint8"}],"name":"setDynamicBonusResolution","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"name":"setLevelBonus","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"tierIndex","type":"uint8"},{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setSupplyBonusTier","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: BONUS CLAIM CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"active","type":"bool"}],"name":"setBonusClaimActive","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setBonusLevelsEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"uint8","name":"currency","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"setBonusLevel","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: WALLET & ANTI-BOT CONTROLS =====
  {"inputs":[{"internalType":"uint256","name":"limit","type":"uint256"}],"name":"setWalletMintLimit","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"enum AntiBotMode","name":"mode","type":"uint8"}],"name":"setAntiBotMode","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setThrottleEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: BONUS POOL CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setAllowBonusDeposit","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"depositETH","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"depositUSDC","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdrawETH","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdrawUSDC","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: TREASURY CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setWithdrawFeesEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"withdrawMintFees","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: OWNERSHIP CONTROLS =====
  {"inputs":[{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setOwnershipTransferEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN: METADATA CONTROLS =====
  {"inputs":[{"internalType":"string","name":"baseURI_","type":"string"}],"name":"setBaseURI","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"string","name":"tokenURI_","type":"string"}],"name":"setTokenURI","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"freezeMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== RECEIVE =====
  {"stateMutability":"payable","type":"receive"},
] as const;

// ============ ERC20 ABI (for USDC) ============
export const ERC20_ABI = [
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
] as const;

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

// ============ TYPE DEFINITIONS ============
export interface LevelPriceConfig {
  level: number;
  priceETH: bigint;
  priceUSDC: bigint;
  active: boolean;
}

export interface LevelBonusConfig {
  level: number;
  bonusETH: bigint;
  bonusUSDC: bigint;
  active: boolean;
}

export interface SupplyPriceTier {
  tierIndex: number;
  minSupply: bigint;
  maxSupply: bigint;
  priceETH: bigint;
  priceUSDC: bigint;
  enabled: boolean;
}

export interface SupplyBonusTier {
  tierIndex: number;
  minSupply: bigint;
  maxSupply: bigint;
  bonusETH: bigint;
  bonusUSDC: bigint;
  enabled: boolean;
}

export interface BonusLevelConfig {
  level: number;
  enabled: boolean;
  currency: number;
  amount: bigint;
}

export interface PlayerData {
  playerName: string;
  farcasterFid: bigint;
  totalMints: number;
  firstMintTime: number;
  nameSet: boolean;
}

export interface NFTMetadata {
  level: number;
  rarity: number;
  score: number;
  completionTime: number;
  comboStreak: number;
  perfectGame: boolean;
}

export interface DynamicConfig {
  enabled: boolean;
  resolutionPriority: number;
  levelCount: number;
  supplyTierCount: number;
}
