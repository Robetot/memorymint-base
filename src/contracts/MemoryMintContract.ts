// ============================================================
// MemoryMintUltraV3 Contract Integration
// Deployed: 0x8A6EAc80dd2cC5efE7a6b10a4430a89871A4672B
// Network: Base Mainnet (Chain ID: 8453)
// ABI: VERIFIED FROM BASESCAN (2025)
// Features: Dynamic Pricing, Multi-tier Bonuses, USDC Support,
//           Wallet Limits, Anti-Bot, Kill Switch, Signature Minting
// ============================================================

// ============ CONTRACT ADDRESS ============
export const NFT_CONTRACT_ADDRESS = '0x8A6EAc80dd2cC5efE7a6b10a4430a89871A4672B' as const;

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

// ============================================================
// VERIFIED BASESCAN ABI - DO NOT MODIFY
// Source: https://basescan.org/address/0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E#code
// ============================================================
export const CONTRACT_ABI = [
  // ===== CUSTOM ERRORS (AUDITED - matches BaseScan ABI) =====
  {"inputs":[],"name":"BatchSizeExceeded","type":"error"},
  {"inputs":[],"name":"BonusCapExceeded","type":"error"},
  {"inputs":[],"name":"ClaimCooldownActive","type":"error"},
  {"inputs":[],"name":"ClaimsPaused","type":"error"},
  {"inputs":[],"name":"CurrencyNotEnabled","type":"error"},
  {"inputs":[],"name":"ExpiredSignature","type":"error"},
  {"inputs":[],"name":"InsufficientContractBalance","type":"error"},
  {"inputs":[],"name":"InsufficientPayment","type":"error"},
  {"inputs":[],"name":"InvalidAddress","type":"error"},
  {"inputs":[],"name":"InvalidLevel","type":"error"},
  {"inputs":[],"name":"InvalidNonce","type":"error"},
  {"inputs":[],"name":"InvalidSignature","type":"error"},
  {"inputs":[],"name":"InvalidTier","type":"error"}, // ADDED - was missing
  {"inputs":[],"name":"KillSwitchActive","type":"error"},
  {"inputs":[],"name":"MintCooldownActive","type":"error"},
  {"inputs":[],"name":"MintPaused","type":"error"},
  {"inputs":[],"name":"NoBonusAvailable","type":"error"},
  {"inputs":[],"name":"NotEligible","type":"error"},
  {"inputs":[],"name":"ReentrancyGuard","type":"error"},
  {"inputs":[],"name":"SignatureExpirationTooShort","type":"error"},
  {"inputs":[],"name":"TokenNotFound","type":"error"},
  {"inputs":[],"name":"TransferFailed","type":"error"},
  {"inputs":[],"name":"USDCNotEnabled","type":"error"},
  {"inputs":[],"name":"Unauthorized","type":"error"},
  {"inputs":[],"name":"WalletLimitExceeded","type":"error"},

  // ===== EVENTS =====
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"},{"indexed":false,"internalType":"bool","name":"status","type":"bool"}],"name":"AllowlistUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"newMode","type":"uint8"}],"name":"AntiBotModeUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"fromTokenId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"toTokenId","type":"uint256"}],"name":"BatchMetadataUpdate","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":false,"internalType":"uint256","name":"startTokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"count","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalPrice","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"}],"name":"BatchMinted","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"claimer","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"level","type":"uint256"}],"name":"BonusClaimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountUSDC","type":"uint256"}],"name":"BonusDeposited","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"level","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"BonusUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountUSDC","type":"uint256"}],"name":"BonusWithdrawn","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"newMode","type":"uint8"}],"name":"ClaimModeUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"paused","type":"bool"}],"name":"ClaimsPausedUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"paused","type":"bool"}],"name":"ContractPaused","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"ethEnabled","type":"bool"},{"indexed":false,"internalType":"bool","name":"usdcEnabled","type":"bool"},{"indexed":false,"internalType":"uint8","name":"activeCurrency","type":"uint8"}],"name":"CurrencyUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"DynamicBonusEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"priority","type":"uint8"}],"name":"DynamicBonusResolutionUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"DynamicPricingEnabled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"priority","type":"uint8"}],"name":"DynamicPricingResolutionUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"minMintCount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"minHoldDuration","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"claimCooldown","type":"uint256"}],"name":"EligibilityUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyWithdrawal","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"FeeWithdrawn","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"by","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"KillSwitchActivated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"by","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"KillSwitchDeactivated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"bonusETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"LevelBonusUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"priceETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"LevelPriceUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"maxETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"maxUSDC","type":"uint256"}],"name":"MaxPriceCapUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"MetadataUpdate","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newLimit","type":"uint256"}],"name":"MintLimitUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newPriceETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newPriceUSDC","type":"uint256"}],"name":"MintPriceUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"minter","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"string","name":"metadataURI","type":"string"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"currency","type":"uint8"}],"name":"NFTMinted","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"PlayerRegistered","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newSigner","type":"address"}],"name":"SignerUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"tierId","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"minSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"maxSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bonusETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"SupplyBonusTierUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint8","name":"tierId","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"minSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"maxSupply","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"priceETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"SupplyTierUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newCooldown","type":"uint256"}],"name":"ThrottleUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"TokenMetadataFrozen","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},

  // ===== VIEW FUNCTIONS =====
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalMinted","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"walletMintLimit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"antiBotMode","outputs":[{"internalType":"enum AntiBotMode","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"claimMode","outputs":[{"internalType":"enum ClaimMode","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintPaused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"claimsPaused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"killSwitch","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"killed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintPriceETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintPriceUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"maxPriceETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"maxPriceUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mintCooldown","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"bonusPoolETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"bonusPoolUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"bonusCapPerWallet","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalBonusClaimedETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalBonusClaimedUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"signatureVerifier","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"currencyConfig","outputs":[{"internalType":"bool","name":"ethEnabled","type":"bool"},{"internalType":"bool","name":"usdcEnabled","type":"bool"},{"internalType":"enum PaymentCurrency","name":"activeCurrency","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"eligibilityRules","outputs":[{"internalType":"uint256","name":"minMintCount","type":"uint256"},{"internalType":"uint256","name":"minHoldDuration","type":"uint256"},{"internalType":"uint256","name":"claimCooldown","type":"uint256"},{"internalType":"bool","name":"requireAllowlist","type":"bool"},{"internalType":"bool","name":"requireSignature","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"dynamicPricingConfig","outputs":[{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"enum ResolutionPriority","name":"priority","type":"uint8"},{"internalType":"uint8","name":"activeLevelCount","type":"uint8"},{"internalType":"uint8","name":"activeSupplyTierCount","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"dynamicBonusConfig","outputs":[{"internalType":"bool","name":"enabled","type":"bool"},{"internalType":"enum ResolutionPriority","name":"priority","type":"uint8"},{"internalType":"uint8","name":"activeLevelCount","type":"uint8"},{"internalType":"uint8","name":"activeSupplyTierCount","type":"uint8"}],"stateMutability":"view","type":"function"},

  // ===== PARAMETERIZED VIEW FUNCTIONS =====
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner_","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner_","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"allowlist","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"walletData","outputs":[{"internalType":"uint256","name":"mintCount","type":"uint256"},{"internalType":"uint256","name":"lastMintTime","type":"uint256"},{"internalType":"uint256","name":"claimCount","type":"uint256"},{"internalType":"uint256","name":"lastClaimTime","type":"uint256"},{"internalType":"uint256","name":"totalBonusClaimed","type":"uint256"},{"internalType":"bool","name":"isAllowlisted","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"bonusLevels","outputs":[{"internalType":"uint256","name":"bonusAmountETH","type":"uint256"},{"internalType":"uint256","name":"bonusAmountUSDC","type":"uint256"},{"internalType":"uint256","name":"minMintCount","type":"uint256"},{"internalType":"uint256","name":"minHoldDuration","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"levelPrices","outputs":[{"internalType":"uint256","name":"priceETH","type":"uint256"},{"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"levelBonuses","outputs":[{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"supplyPriceTiers","outputs":[{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"priceETH","type":"uint256"},{"internalType":"uint256","name":"priceUSDC","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"supplyBonusTiers","outputs":[{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint8","name":"currency","type":"uint8"}],"name":"getEffectiveMintPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"level","type":"uint8"},{"internalType":"uint8","name":"currency","type":"uint8"}],"name":"getEffectiveBonus","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"wallet","type":"address"}],"name":"getWalletData","outputs":[{"components":[{"internalType":"uint256","name":"mintCount","type":"uint256"},{"internalType":"uint256","name":"lastMintTime","type":"uint256"},{"internalType":"uint256","name":"claimCount","type":"uint256"},{"internalType":"uint256","name":"lastClaimTime","type":"uint256"},{"internalType":"uint256","name":"totalBonusClaimed","type":"uint256"},{"internalType":"bool","name":"isAllowlisted","type":"bool"}],"internalType":"struct WalletData","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"wallet","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getCurrentTokenId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"sigHash","type":"bytes32"}],"name":"isSignatureUsed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},

  // ===== MINTING FUNCTIONS =====
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"}],"name":"mintNFT","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"},{"internalType":"uint8","name":"level","type":"uint8"}],"name":"mintNFTWithLevel","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"}],"name":"mintWithUSDC","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"},{"internalType":"uint8","name":"level","type":"uint8"}],"name":"mintWithUSDCAndLevel","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"string[]","name":"metadataURIs","type":"string[]"}],"name":"batchMint","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"metadataURI","type":"string"}],"name":"mintTo","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== SIGNATURE MINTING =====
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiration","type":"uint256"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"mintWithSignature","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"string","name":"metadataURI","type":"string"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiration","type":"uint256"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"mintWithUSDCAndSignature","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== BONUS CLAIMING =====
  {"inputs":[{"internalType":"uint256","name":"level","type":"uint256"}],"name":"claimBonus","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ERC721 FUNCTIONS =====
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== ADMIN FUNCTIONS =====
  {"inputs":[],"name":"activateKillSwitch","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"deactivateKillSwitch","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"paused","type":"bool"}],"name":"setMintPaused","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"paused","type":"bool"}],"name":"setClaimsPaused","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"setWalletMintLimit","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"setAntiBotMode","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"}],"name":"setClaimMode","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"setMintPrice","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"setMintCooldown","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"setMaxPriceCap","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"setBaseURI","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"string","name":"","type":"string"}],"name":"setTokenURI","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"freezeTokenMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"setSignatureVerifier","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address[]","name":"","type":"address[]"},{"internalType":"bool","name":"","type":"bool"}],"name":"setAllowlist","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"ethEnabled","type":"bool"},{"internalType":"bool","name":"usdcEnabled","type":"bool"},{"internalType":"enum PaymentCurrency","name":"activeCurrency","type":"uint8"}],"name":"setCurrencyConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bool","name":"","type":"bool"}],"name":"setEligibilityRules","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"","type":"bool"}],"name":"setDynamicPricingEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bool","name":"","type":"bool"}],"name":"setDynamicBonusEnabled","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"setLevelPrice","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"setLevelBonus","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8[]","name":"","type":"uint8[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"name":"batchSetLevelBonuses","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"","type":"uint8"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"setSupplyPriceTier","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint8","name":"tier","type":"uint8"},{"internalType":"uint256","name":"minSupply","type":"uint256"},{"internalType":"uint256","name":"maxSupply","type":"uint256"},{"internalType":"uint256","name":"bonusETH","type":"uint256"},{"internalType":"uint256","name":"bonusUSDC","type":"uint256"}],"name":"setSupplyBonusTier","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"cap","type":"uint256"}],"name":"setBonusCapPerWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"depositBonusPool","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"depositBonusPoolUSDC","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"ethAmount","type":"uint256"},{"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"withdrawBonusPool","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"withdrawFees","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},

  // ===== CONSTRUCTOR =====
  {"inputs":[{"internalType":"string","name":"name_","type":"string"},{"internalType":"string","name":"symbol_","type":"string"}],"stateMutability":"nonpayable","type":"constructor"}
] as const;

// ============ ERC20 ABI (for USDC) ============
export const ERC20_ABI = [
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
] as const;

// ============ CONTRACT EVENTS (For log decoding) ============
export const CONTRACT_EVENTS = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"by","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"KillSwitchActivated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"by","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"KillSwitchDeactivated","type":"event"},
] as const;

// ============ CONTRACT ERRORS (For error decoding - AUDITED) ============
export const CONTRACT_ERRORS = [
  {"inputs":[],"name":"BatchSizeExceeded","type":"error"},
  {"inputs":[],"name":"BonusCapExceeded","type":"error"},
  {"inputs":[],"name":"ClaimCooldownActive","type":"error"},
  {"inputs":[],"name":"ClaimsPaused","type":"error"},
  {"inputs":[],"name":"CurrencyNotEnabled","type":"error"},
  {"inputs":[],"name":"ExpiredSignature","type":"error"},
  {"inputs":[],"name":"InsufficientContractBalance","type":"error"},
  {"inputs":[],"name":"InsufficientPayment","type":"error"},
  {"inputs":[],"name":"InvalidAddress","type":"error"},
  {"inputs":[],"name":"InvalidLevel","type":"error"},
  {"inputs":[],"name":"InvalidNonce","type":"error"},
  {"inputs":[],"name":"InvalidSignature","type":"error"},
  {"inputs":[],"name":"InvalidTier","type":"error"}, // ADDED - was missing
  {"inputs":[],"name":"KillSwitchActive","type":"error"},
  {"inputs":[],"name":"MintCooldownActive","type":"error"},
  {"inputs":[],"name":"MintPaused","type":"error"},
  {"inputs":[],"name":"NoBonusAvailable","type":"error"},
  {"inputs":[],"name":"NotEligible","type":"error"},
  {"inputs":[],"name":"ReentrancyGuard","type":"error"},
  {"inputs":[],"name":"SignatureExpirationTooShort","type":"error"},
  {"inputs":[],"name":"TokenNotFound","type":"error"},
  {"inputs":[],"name":"TransferFailed","type":"error"},
  {"inputs":[],"name":"USDCNotEnabled","type":"error"},
  {"inputs":[],"name":"Unauthorized","type":"error"},
  {"inputs":[],"name":"WalletLimitExceeded","type":"error"},
] as const;

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
  mint: 95000n,
  mintNFT: 95000n,
  mintWithUSDC: 110000n,
  batchMint: 200000n,
  setMintPrice: 35000n,
  setWalletMintLimit: 30000n,
  setAntiBotMode: 30000n,
  setClaimMode: 30000n,
  activateKillSwitch: 35000n,
  deactivateKillSwitch: 35000n,
  claimBonus: 65000n,
  withdrawFees: 45000n,
  emergencyWithdraw: 50000n,
} as const;

// ============ CACHE TTL CONSTANTS ============
export const CONFIG_CACHE_TTL = 30000; // 30 seconds for config
export const BALANCE_CACHE_TTL = 10000; // 10 seconds for balances
export const OWNERSHIP_CACHE_TTL = 5000; // 5 seconds for ownership
