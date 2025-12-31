// ============================================================
// MemoryMintUltraSafe_Bonus Contract Integration
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
export type AntiBotMode = 'DISABLED' | 'SOFT' | 'MODERATE' | 'STRICT' | 'CUSTOM';
export const AntiBotModeEnum = {
  DISABLED: 0,
  SOFT: 1,
  MODERATE: 2,
  STRICT: 3,
  CUSTOM: 4,
} as const;

// ============ COMPLETE ABI FROM VERIFIED CONTRACT ============
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
  'function getNonce(address wallet) view returns (uint256)',
  'function canMint(address wallet) view returns (bool)',
  'function canClaim(address wallet, uint256 levelId) view returns (bool)',
  'function mintEnabled() view returns (bool)',
  'function claimEnabled() view returns (bool)',
  'function activePaymentToken() view returns (uint8)',

  // ===== Minting Functions (ETH) =====
  'function mintNFT(string metadataURI) payable returns (uint256)',
  'function mintWithSignature(string metadataURI, uint256 nonce, uint256 expiration, bytes signature) payable returns (uint256)',

  // ===== Minting Functions (USDC) =====
  'function mintWithUSDC(string metadataURI) returns (uint256)',
  'function mintWithUSDCAndSignature(string metadataURI, uint256 nonce, uint256 expiration, bytes signature) returns (uint256)',

  // ===== Bonus Claim Functions =====
  'function claimBonus(uint256 level, uint256 gameLevel, bytes levelProof) returns (uint256)',

  // ===== Price Getters =====
  'function mintPriceETH() view returns (uint256)',
  'function mintPriceUSDC() view returns (uint256)',

  // ===== Currency Config =====
  'function currencyConfig() view returns (bool ethEnabled, bool usdcEnabled, uint8 activeMintCurrency, uint8 activeBonusCurrency)',

  // ===== Anti-Bot Config =====
  'function antiBotMode() view returns (uint8)',
  'function walletMintLimit() view returns (uint256)',
  'function mintCooldownBlocks() view returns (uint256)',
  'function allowlistEnabled() view returns (bool)',
  'function denylistEnabled() view returns (bool)',
  'function signatureRequired() view returns (bool)',
  'function signatureExpirationSeconds() view returns (uint256)',
  'function fcfsMintCap() view returns (uint256)',
  'function allowlist(address wallet) view returns (bool)',
  'function denylist(address wallet) view returns (bool)',

  // ===== Bonus Level Config =====
  'function bonusLevels(uint256 level) view returns (uint256 amountETH, uint256 amountUSDC, bool active, uint256 claimsRemaining, uint256 minScore, bool requiresNFT)',
  'function bonusPoolBalanceETH() view returns (uint256)',
  'function bonusPoolBalanceUSDC() view returns (uint256)',
  'function claimMode() view returns (uint8)',
  'function totalClaimCap() view returns (uint256)',

  // ===== Admin: Currency =====
  'function setETHEnabled(bool enabled)',
  'function setUSDCEnabled(bool enabled)',
  'function setActiveMintCurrency(uint8 currency)',
  'function setActiveBonusCurrency(uint8 currency)',

  // ===== Admin: Minting =====
  'function setMintPriceETH(uint256 newPrice)',
  'function setMintPriceUSDC(uint256 newPrice)',
  'function setBaseURI(string newBaseURI)',
  'function pauseMinting(bool paused)',
  'function setEmergencyMintDisabled(bool disabled)',

  // ===== Admin: Anti-Bot =====
  'function setAntiBotMode(uint8 mode)',
  'function setTxOriginCheck(bool enabled)',
  'function setWalletMintLimit(uint256 limit)',
  'function setMintCooldown(uint256 blocks)',
  'function setFCFSMintCap(uint256 cap)',
  'function setAllowlistEnabled(bool enabled)',
  'function setDenylistEnabled(bool enabled)',
  'function updateAllowlist(address[] wallets, bool status)',
  'function updateDenylist(address[] wallets, bool status)',
  'function setSignatureRequired(bool required)',
  'function setSignatureSigner(address signer)',
  'function setSignatureExpiration(uint256 seconds)',

  // ===== Admin: Bonus =====
  'function setClaimMode(uint8 mode)',
  'function setTotalClaimCap(uint256 cap)',
  'function configureBonusLevel(uint256 level, uint256 amountETH, uint256 amountUSDC, bool active, uint256 claimsRemaining, bool requiresNFT)',
  'function deactivateBonusLevel(uint256 level)',
  'function setEligibilityRules(bool checkLevel, bool checkNFTOwnership, bool useAndLogic)',
  'function depositBonusFundsETH() payable',
  'function depositBonusFundsUSDC(uint256 amount)',
  'function withdrawBonusFundsETH(uint256 amount)',
  'function withdrawBonusFundsUSDC(uint256 amount)',

  // ===== Admin: Ownership & Withdrawals =====
  'function transferOwnership(address newOwner)',
  'function withdrawETH(uint256 amount)',
  'function withdrawUSDC(uint256 amount)',
  'function emergencyWithdrawAll()',
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
  'event MintPriceUpdated(uint8 currency, uint256 oldPrice, uint256 newPrice)',
  'event MintingPausedUpdated(bool paused)',
  'event BaseURIUpdated(string newBaseURI)',
  'event NFTMinted(address indexed minter, uint256 indexed tokenId, string tokenURI, uint8 paymentCurrency, uint256 paymentAmount)',
  'event AntiBotModeUpdated(uint8 mode, bool txOriginCheckEnabled)',
  'event WalletMintLimitUpdated(uint256 limit)',
  'event MintCooldownUpdated(uint256 blocks)',
  'event AllowlistUpdated(address indexed wallet, bool status)',
  'event DenylistUpdated(address indexed wallet, bool status)',
  'event SignatureSignerUpdated(address indexed newSigner)',
  'event BonusClaimed(address indexed wallet, uint256 indexed level, uint256 amount, uint8 currency)',
  'event BonusLevelConfigured(uint256 indexed level, uint256 amountETH, uint256 amountUSDC, uint256 claimsRemaining)',
  'event BonusLevelDeactivated(uint256 indexed level)',
  'event BonusFundsDeposited(uint256 amount, uint8 currency)',
  'event BonusFundsWithdrawn(uint256 amount, uint8 currency)',
  'event ClaimModeUpdated(uint8 mode)',
  'event CurrencyEnabledUpdated(uint8 currency, bool enabled)',
  'event ActiveMintCurrencyUpdated(uint8 currency)',
  'event ActiveBonusCurrencyUpdated(uint8 currency)',
]);

// ============ CUSTOM ERRORS ============
export const CONTRACT_ERRORS = parseAbi([
  'error NotOwner()',
  'error ZeroAddress()',
  'error TokenNotExist()',
  'error NotApproved()',
  'error TransferToNonReceiver()',
  'error InsufficientPayment(uint256 required, uint256 provided)',
  'error MintingPaused()',
  'error EmergencyMintDisabled()',
  'error AddressDenylisted()',
  'error NotAllowlisted()',
  'error MintLimitExceeded()',
  'error CooldownActive(uint256 remainingBlocks)',
  'error FCFSMintCapReached()',
  'error InvalidSignature()',
  'error SignatureExpired()',
  'error NonceAlreadyUsed()',
  'error WrongChain()',
  'error ClaimNotActive()',
  'error InvalidBonusLevel()',
  'error AlreadyClaimed()',
  'error InsufficientBonusBalance()',
  'error CurrencyNotEnabled()',
  'error InsufficientUSDCAllowance(uint256 required, uint256 provided)',
  'error USDCTransferFailed()',
  'error WithdrawFailed()',
  'error ZeroAmount()',
  'error ReentrancyGuard()',
]);

// ============ TRANSFER EVENT SIGNATURE ============
export const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// ============ GAS OPTIMIZATION CONSTANTS (BASE-OPTIMIZED) ============
// CRITICAL: 7% buffer is optimal for Base L2 - higher wastes gas, lower risks failure
export const GAS_BUFFER_PERCENT = 7;
// Minimal priority fee - Base doesn't need high tips
export const EIP1559_BASE_MAX_PRIORITY_FEE = 1000000n; // 0.001 gwei
export const RECEIPT_POLL_INTERVAL = 2000; // 2 seconds
export const RECEIPT_MAX_POLLS = 60; // 2 minutes max wait

// Expected gas baselines for validation (block if 50%+ above)
export const GAS_BASELINES: Record<string, bigint> = {
  mintNFT: 85000n,
  mintWithUSDC: 95000n,
  batchMint: 200000n,
  claimBonus: 65000n,
  setMintPriceETH: 28000n,
  pauseMinting: 28000n,
} as const;

// ============ CACHE TTL CONSTANTS ============
export const CONFIG_CACHE_TTL = 30000; // 30 seconds for config
export const BALANCE_CACHE_TTL = 10000; // 10 seconds for balances
export const OWNERSHIP_CACHE_TTL = 5000; // 5 seconds for ownership (invalidate on mint)
