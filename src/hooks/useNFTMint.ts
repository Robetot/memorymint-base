import { useState, useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, decodeFunctionResult, decodeEventLog, formatEther, formatUnits, maxUint256 } from 'viem';
import { CONTRACT_ERRORS as VERIFIED_CONTRACT_ERRORS } from '@/contracts/MemoryMintContract';

// ============ CONFIGURATION ============
// Deployed MemoryMintUltraV3 contract on Base Mainnet
const NFT_CONTRACT_ADDRESS = '0xA26e44EA246a1BA59Fd417380204Bce6a6A3Dc7E';

// Base Mainnet USDC address
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Base Mainnet Chain ID
const BASE_CHAIN_ID = '0x2105'; // 8453

// RPC endpoints for reading contract state
const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.meowrpc.com',
];

// Coinbase Paymaster URL for Base Mainnet
const COINBASE_PAYMASTER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/paymaster';

// Payment token types
export type PaymentToken = 'ETH' | 'USDC';

// Wallet types for detection
export type DetectedWalletType = 'metamask' | 'coinbase' | 'baseapp' | 'farcaster' | 'unknown';

// ============ CONTRACT ABI ============
// Updated to match verified BaseScan ABI for MemoryMintUltraV3
const CONTRACT_ABI = parseAbi([
  // ETH payment functions (direct, no signature required)
  'function mintNFT(string tokenURI) payable returns (uint256)',
  'function mint(string metadataURI) payable',
  'function batchMint(string[] metadataURIs) payable',
  // USDC payment functions (direct, no signature required)
  'function mintWithUSDC(string tokenURI) returns (uint256)',
  // Bonus claim functions
  'function claimBonus(uint256 level) external',
  // Price getters
  'function mintPriceUSDC() view returns (uint256)',
  'function mintPriceETH() view returns (uint256)',
  // Bonus getters
  'function bonusLevels(uint256) view returns (uint256 bonusAmountETH, uint256 bonusAmountUSDC, uint256 minMintCount, uint256 minHoldDuration, bool isActive)',
  'function owner() view returns (address)',
  // V3 Admin toggle states - THESE ARE THE CORRECT FUNCTIONS
  'function mintPaused() view returns (bool)',
  'function killSwitch() view returns (bool)',
  'function claimsPaused() view returns (bool)',
  // Currency config (V3)
  'function currencyConfig() view returns (bool ethEnabled, bool usdcEnabled, uint8 activeCurrency)',
  // Anti-bot (V3)
  'function mintCooldown() view returns (uint256)',
  'function walletMintLimit() view returns (uint256)',
  'function walletData(address) view returns (uint256 mintCount, uint256 lastMintTime, uint256 claimCount, uint256 lastClaimTime, uint256 totalBonusClaimed, bool isAllowlisted)',
  // Total supply
  'function totalMinted() view returns (uint256)',
]);

// ERC20 ABI for USDC
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

// ERC721 Transfer event for token ID extraction
const ERC721_TRANSFER_EVENT = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
} as const;

// Custom errors
const CONTRACT_ERROR_ABI = parseAbi([
  'error NotOwner()',
  'error ZeroAddress()',
  'error TokenNotExist()',
  'error NotApproved()',
  'error InvalidQuantity()',
  'error MaxBatchExceeded()',
  'error TransferToNonReceiver()',
  'error InsufficientPayment()',
  'error InsufficientUSDCAllowance()',
  'error WithdrawFailed()',
  'error ClaimNotActive()',
  'error AlreadyClaimed()',
  'error NotEligible()',
  'error InvalidLevelProof()',
  'error OracleStalePrice()',
  'error OracleInvalidPrice()',
  'error OracleNotSet()',
  'error MintDisabled()',
  'error ClaimDisabled()',
  'error CooldownActive()',
  'error MintCapReached()',
]);

// Standard Solidity errors
const STANDARD_ERROR_ABI = parseAbi([
  'error Error(string)',
  'error Panic(uint256)',
]);

// Combined error ABI (legacy + verified + standard)
const ALL_ERROR_ABI = [
  ...CONTRACT_ERROR_ABI,
  ...VERIFIED_CONTRACT_ERRORS,
  ...STANDARD_ERROR_ABI,
] as const;

// ============ TYPES ============
export interface AdminConfig {
  mintEnabled: boolean;      // Derived from !mintPaused && !killSwitch
  claimEnabled: boolean;     // Derived from !claimsPaused && !killSwitch
  activePaymentToken: PaymentToken;
  signatureRequired: boolean;
  disabledReason: string | null;
  lastFetched: number;
  isLoaded: boolean;
  configFetchFailed?: boolean; // True if RPC failed - show warning but allow minting
}

export interface AntiBotConfig {
  cooldown: bigint;
  lastMintTime: bigint;
  mintCount: bigint;
  maxMints: bigint;
  canMintNow: boolean;
  cooldownRemaining: bigint;
}

// ============ TX LIFECYCLE STATES ============
export type TxPhase = 
  | 'idle'           // No transaction in progress
  | 'simulating'     // Running eth_call simulation
  | 'awaiting_wallet' // Wallet popup open, waiting for user
  | 'pending'        // TX submitted, waiting for confirmation
  | 'success'        // TX confirmed successfully
  | 'failed'         // TX reverted on-chain
  | 'cancelled';     // User rejected in wallet

export interface MintState {
  isMinting: boolean;
  isClaiming: boolean;
  isWaitingForReceipt: boolean;
  isApprovingUSDC: boolean;
  isSimulating: boolean;
  txPhase: TxPhase;
  txHash: string | null;
  tokenId: string | null;
  tokenIds: string[] | null;
  error: string | null;
  mintBlocked?: boolean;
  mintBlockedReason?: string | null;
  success: boolean;
  isSponsored: boolean;
  mintPriceEth: string | null;
  mintPriceUSDC: string | null;
  estimatedGasEth: string | null;
  selectedPaymentToken: PaymentToken;
  adminConfig: AdminConfig;
  antiBotConfig: AntiBotConfig | null;
  isLoadingConfig: boolean;
  detectedWalletType: DetectedWalletType;
  pollingMessage: string | null;
  mintQueuePosition: number;
}

export interface PriceInfo {
  ethPrice: bigint;
  mintPriceUSDC: bigint;
  mintPriceETH: bigint;
  mintPriceUSDCFormatted: string;
  mintPriceETHFormatted: string;
  isFree: boolean;
}

export interface BalanceCheck {
  hasEnough: boolean;
  balance: string;
  required: string;
  shortfall: string | null;
  token: PaymentToken;
}

// ============ ADMIN CONFIG DEFAULTS ============
// NOTE: Default to PERMISSIVE values to allow minting even when admin reads fail
// The smart contract will enforce the real state - we should not block on frontend
const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  mintEnabled: true,   // Default to enabled - contract will enforce mintPaused
  claimEnabled: true,  // Default to enabled - contract will enforce claimsPaused
  activePaymentToken: 'ETH',
  signatureRequired: false, // Default to false - allow direct minting attempts
  disabledReason: null,
  lastFetched: 0,
  isLoaded: false,       // Will be true after fetch attempt (success or fail)
  configFetchFailed: false, // Track if RPC failed
};

// ============ ADMIN CONFIG CACHE ============
const ADMIN_CONFIG_CACHE_TTL = 5000; // 5 seconds cache for non-forced fetches
const FORCED_FETCH_COOLDOWN = 1000; // 1 second minimum between forced fetches
let lastForcedFetchTime = 0;
let cachedAdminConfig: AdminConfig | null = null;

// ============ HELPER FUNCTIONS ============
function formatWeiToEth(wei: bigint): string {
  return formatEther(wei);
}

function formatUSDCAmount(amount: bigint): string {
  return `$${formatUnits(amount, USDC_DECIMALS)}`;
}

function detectWalletType(): DetectedWalletType {
  const ethereum = window.ethereum as any;
  if (!ethereum) return 'unknown';
  
  // Check for Farcaster context
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('fc') || urlParams.get('source') === 'farcaster') {
      return 'farcaster';
    }
  }
  
  // Check for smart wallet indicators (Base App)
  if (ethereum.isSmartWallet || ethereum.isPasskeyWallet) {
    return 'baseapp';
  }
  
  // Check user agent for Base App
  const userAgent = navigator.userAgent.toLowerCase();
  if (ethereum.isCoinbaseWallet && (userAgent.includes('base') || userAgent.includes('coinbase'))) {
    return 'baseapp';
  }
  
  // URL params for Base App
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('baseapp') || urlParams.get('source') === 'baseapp') {
    return 'baseapp';
  }
  
  // Coinbase Wallet (not Base App)
  if (ethereum.isCoinbaseWallet) {
    return 'coinbase';
  }
  
  // MetaMask
  if (ethereum.isMetaMask) {
    return 'metamask';
  }
  
  return 'unknown';
}

// ============ ERROR DETECTION ============
interface MintErrorResult {
  message: string;
  isCancelled: boolean;
  code: string | null;
}

function decodeMintErrorWithCode(error: unknown): MintErrorResult {
  const err: any = error;

  // User rejection - CRITICAL: detect this immediately
  if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') {
    return { message: 'Transaction cancelled by user', isCancelled: true, code: '4001' };
  }

  // Also check for rejection messages
  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) {
    const lowerMsg = rawMsg.toLowerCase();
    if (
      lowerMsg.includes('rejected') ||
      lowerMsg.includes('denied') ||
      lowerMsg.includes('cancelled') ||
      lowerMsg.includes('canceled')
    ) {
      return { message: 'Transaction cancelled by user', isCancelled: true, code: 'USER_REJECTED' };
    }
  }

  // Extract revert data from: wallet errors, JSON-RPC errors, viem errors
  const candidates: unknown[] = [
    err?.data?.data,
    err?.data,
    err?.error?.data?.data,
    err?.error?.data,
    err?.rpcError?.data,
    err?.rpcError?.data?.data,
    err?.rpcError,
  ];

  let revertHex: `0x${string}` | null = null;
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('0x')) {
      revertHex = c as `0x${string}`;
      break;
    }
    if (c && typeof c === 'object') {
      const maybeData = (c as any).data;
      if (typeof maybeData === 'string' && maybeData.startsWith('0x')) {
        revertHex = maybeData as `0x${string}`;
        break;
      }
      const nested = (c as any).originalError?.data;
      if (typeof nested === 'string' && nested.startsWith('0x')) {
        revertHex = nested as `0x${string}`;
        break;
      }
    }
  }

  if (revertHex) {
    // 1) Decode custom errors (incl. verified ABI)
    try {
      const decoded = decodeErrorResult({
        abi: ALL_ERROR_ABI as any,
        data: revertHex,
      }) as { errorName: string; args?: any[] };

      const errorName = decoded.errorName;
      const args = decoded.args || [];

      // Standard Error(string)
      if (errorName === 'Error' && typeof args?.[0] === 'string') {
        return { message: args[0].slice(0, 160), isCancelled: false, code: 'Error(string)' };
      }

      // Known contract errors with richer messages
      if (errorName === 'InsufficientPayment' && args?.length >= 2) {
        const required = args[0] as bigint;
        const provided = args[1] as bigint;
        return {
          message: `Invalid ETH value: required ${formatEther(required)} ETH, provided ${formatEther(provided)} ETH`,
          isCancelled: false,
          code: 'InsufficientPayment',
        };
      }

      if (errorName === 'CooldownActive' && args?.length >= 1) {
        const remainingBlocks = args[0] as bigint;
        return {
          message: `Cooldown active: ${remainingBlocks.toString()} blocks remaining`,
          isCancelled: false,
          code: 'CooldownActive',
        };
      }

      const errorMessages: Record<string, string> = {
        // Mint gating
        MintDisabled: 'Minting is disabled',
        MintingPaused: 'Minting is paused',
        EmergencyMintDisabled: 'Minting is disabled',
        MintLimitExceeded: 'Max mints per wallet reached',
        FCFSMintCapReached: 'Mint cap has been reached',

        // Allow/Deny list
        AddressDenylisted: 'Caller not allowed (denylisted)',
        NotAllowlisted: 'Caller not allowed (not on allowlist)',

        // Signature
        InvalidSignature: 'Invalid signature',
        SignatureExpired: 'Signature has expired',
        NonceAlreadyUsed: 'Signature nonce already used',

        // Currency
        CurrencyNotEnabled: 'Payment currency not enabled',
        InsufficientUSDCAllowance: 'Insufficient USDC allowance',
        USDCTransferFailed: 'USDC transfer failed',

        // Chain / misc
        WrongChain: 'Wrong network (please switch to Base)',
        ReentrancyGuard: 'Temporary protection triggered. Please try again.',

        // Claims
        ClaimDisabled: 'Claiming is disabled',
        ClaimNotActive: 'Claiming is not active',
        AlreadyClaimed: 'Already claimed',
        NotEligible: 'Not eligible',
        InvalidBonusLevel: 'Invalid bonus level',
      };

      return {
        message: errorMessages[errorName] || `Transaction would fail: ${errorName}`,
        isCancelled: false,
        code: errorName,
      };
    } catch {
      // continue
    }

    // If we have revert data but can't decode it, still surface it.
    return {
      message: `Transaction would fail (undecoded revert): ${revertHex.slice(0, 18)}…`,
      isCancelled: false,
      code: 'UNDECODED_REVERT',
    };
  }

  if (rawMsg) {
    if (rawMsg.toLowerCase().includes('oracle') || rawMsg.toLowerCase().includes('price feed')) {
      return { message: 'Price feed temporarily unavailable. Please try again.', isCancelled: false, code: 'ORACLE_ERROR' };
    }
    if (rawMsg.includes('insufficient funds')) {
      return { message: 'Insufficient ETH balance for transaction', isCancelled: false, code: 'INSUFFICIENT_FUNDS' };
    }
    if (rawMsg.includes('gas required exceeds')) {
      return { message: 'Transaction would fail. Please check your balance.', isCancelled: false, code: 'GAS_LIMIT' };
    }
    if (rawMsg.toLowerCase().includes('wrong network') || rawMsg.toLowerCase().includes('chain')) {
      return { message: 'Wrong network (please switch to Base)', isCancelled: false, code: 'WRONG_CHAIN' };
    }
    return { message: rawMsg.slice(0, 160), isCancelled: false, code: 'UNKNOWN' };
  }

  return { message: 'Transaction failed. Please try again.', isCancelled: false, code: 'UNKNOWN' };
}

function decodeMintError(error: unknown): string {
  return decodeMintErrorWithCode(error).message;
}

function supportsWalletSendCalls(): boolean {
  const ethereum = window.ethereum as any;
  if (!ethereum) return false;
  return !!(ethereum.isSmartWallet || ethereum.isPasskeyWallet || ethereum.isCoinbaseWallet);
}

// RPC call with timeout, retry logic, and rate limit handling for bot-resistance
async function rpcCall(method: string, params: any[], timeout = 10000): Promise<any> {
  const errors: string[] = [];
  const maxRetries = 2;
  
  for (const endpoint of RPC_ENDPOINTS) {
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Handle rate limiting with backoff
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }
        
        if (!response.ok) {
          errors.push(`${endpoint}: HTTP ${response.status}`);
          break; // Try next endpoint
        }
        
        const data = await response.json();
        if (data.error) {
          // Retry on temporary errors
          if (data.error.code === -32005 || data.error.message?.includes('rate limit')) {
            await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
            continue;
          }
          errors.push(`${endpoint}: ${data.error.message || 'RPC error'}`);
          break; // Try next endpoint
        }
        
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('aborted')) {
          errors.push(`${endpoint}: Request timeout`);
        } else {
          errors.push(`${endpoint}: ${msg}`);
        }
        break; // Try next endpoint
      }
    }
  }
  
  console.error('[RPC] All endpoints failed:', errors);
  throw new Error('RPC temporarily unavailable. Please try again.');
}

// RPC call for simulation ONLY: preserves revert payloads instead of masking them.
async function rpcCallForSimulation(method: string, params: any[], timeout = 8000): Promise<any> {
  let lastError: any = null;

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        lastError = new Error(`${endpoint}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data?.error) {
        // If it's a revert, it will usually include .data; preserve it and stop.
        if (data.error.data) {
          const e: any = new Error(data.error.message || 'Execution reverted');
          e.code = data.error.code;
          e.rpcError = data.error;
          e.data = data.error.data;
          throw e;
        }

        // Node error without revert payload: try next endpoint.
        lastError = new Error(data.error.message || 'RPC error');
        continue;
      }

      return data.result;
    } catch (err) {
      // If we intentionally threw a revert error, bubble it up.
      const anyErr: any = err;
      if (anyErr?.rpcError?.data || anyErr?.data) throw err;
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('Simulation RPC failed');
}

// ============ MAIN HOOK ============
export function useNFTMint() {
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    isClaiming: false,
    isWaitingForReceipt: false,
    isApprovingUSDC: false,
    isSimulating: false,
    txPhase: 'idle',
    txHash: null,
    tokenId: null,
    tokenIds: null,
    error: null,
    success: false,
    isSponsored: false,
    mintPriceEth: null,
    mintPriceUSDC: null,
    estimatedGasEth: null,
    selectedPaymentToken: 'ETH',
    adminConfig: DEFAULT_ADMIN_CONFIG,
    antiBotConfig: null,
    isLoadingConfig: true,
    detectedWalletType: 'unknown',
    pollingMessage: null,
    mintQueuePosition: 0,
    mintBlocked: false,
    mintBlockedReason: null,
  });
  
  // Separate locks by operation type
  const pendingEthPriceRef = useRef<boolean>(false);
  const pendingUsdcPriceRef = useRef<boolean>(false);
  const pendingAdminConfigRef = useRef<boolean>(false);
  
  // Mint queue instead of simple lock
  const mintQueueRef = useRef<Array<() => Promise<boolean>>>([]);
  const isMintProcessingRef = useRef<boolean>(false);
  
  // Network switch tracking
  const currentChainRef = useRef<string | null>(null);
  const isNetworkSwitchingRef = useRef<boolean>(false);

  // Repeat-failure blocking (require refresh before retry after 2 identical preflight failures)
  const repeatFailureRef = useRef<{ code: string | null; count: number }>({ code: null, count: 0 });
  const mintBlockedRef = useRef<boolean>(false);

  // Detect wallet type on mount
  useEffect(() => {
    const walletType = detectWalletType();
    setMintState(prev => ({ ...prev, detectedWalletType: walletType }));
  }, []);

  // ============ SAFE RPC WRAPPER ============
  const safeRpcCall = useCallback(async <T>(
    call: () => Promise<T>,
    pendingRef: React.MutableRefObject<boolean>,
    errorDefault?: T
  ): Promise<T> => {
    if (pendingRef.current) {
      throw new Error('Operation in progress. Please wait.');
    }
    
    pendingRef.current = true;
    try {
      return await call();
    } catch (error) {
      if (errorDefault !== undefined) return errorDefault;
      throw error;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  // ============ ABI DECODE HELPER ============
  const decodeUint256Result = useCallback((result: unknown, functionName: string, allowEmpty = false): bigint => {
    // Validate result - treat undefined, null, empty string, '0x' as empty
    const isEmpty = !result || result === '0x' || result === '' || result === null;
    
    if (isEmpty) {
      if (allowEmpty) {
        // For price functions, empty response means free mint (0)
        return 0n;
      }
      throw new Error(`Unable to fetch ${functionName}`);
    }
    
    try {
      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI,
        functionName: functionName as any,
        data: result as `0x${string}`,
      });
      
      // Validate decoded value is a valid bigint
      if (typeof decoded !== 'bigint') {
        if (allowEmpty) return 0n;
        throw new Error(`Invalid response type from ${functionName}`);
      }
      
      return decoded;
    } catch (error) {
      if (allowEmpty) {
        // Graceful fallback for price functions
        return 0n;
      }
      console.error(`[Decode] Failed to decode ${functionName}:`, error);
      throw new Error(`Unable to fetch ${functionName}`);
    }
  }, []);

   // ============ FETCH ADMIN CONFIG WITH CACHING ============
  // V3 Contract: Uses mintPaused(), killSwitch(), claimsPaused() for state checks
  // FAIL-OPEN: If reads fail, allow minting - the contract will enforce the real state
  const fetchAdminConfig = useCallback(async (force = false): Promise<AdminConfig> => {
    const now = Date.now();
    
    // Check cache for non-forced fetches
    if (!force && cachedAdminConfig && cachedAdminConfig.isLoaded) {
      if (now - cachedAdminConfig.lastFetched < ADMIN_CONFIG_CACHE_TTL) {
        return cachedAdminConfig;
      }
    }
    
    // Enforce cooldown on forced fetches
    if (force && (now - lastForcedFetchTime < FORCED_FETCH_COOLDOWN)) {
      if (cachedAdminConfig) return cachedAdminConfig;
    }
    
    lastForcedFetchTime = now;
    
    try {
      // V3 ABI: Read mintPaused, killSwitch, claimsPaused, currencyConfig
      const [mintPausedResult, killSwitchResult, claimsPausedResult, currencyConfigResult] = await Promise.allSettled([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintPaused', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'killSwitch', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'claimsPaused', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'currencyConfig', args: [] }) }, 'latest']),
      ]);

      // Decode results with fallbacks
      let mintPaused = false;
      let killSwitch = false;
      let claimsPaused = false;
      let ethEnabled = true;
      let usdcEnabled = false;
      let configFetchFailed = false;

      if (mintPausedResult.status === 'fulfilled' && mintPausedResult.value && mintPausedResult.value !== '0x') {
        try {
          mintPaused = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'mintPaused', data: mintPausedResult.value as `0x${string}` }) as boolean;
        } catch { configFetchFailed = true; }
      } else {
        configFetchFailed = true;
      }

      if (killSwitchResult.status === 'fulfilled' && killSwitchResult.value && killSwitchResult.value !== '0x') {
        try {
          killSwitch = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'killSwitch', data: killSwitchResult.value as `0x${string}` }) as boolean;
        } catch { /* continue */ }
      }

      if (claimsPausedResult.status === 'fulfilled' && claimsPausedResult.value && claimsPausedResult.value !== '0x') {
        try {
          claimsPaused = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'claimsPaused', data: claimsPausedResult.value as `0x${string}` }) as boolean;
        } catch { /* continue */ }
      }

      if (currencyConfigResult.status === 'fulfilled' && currencyConfigResult.value && currencyConfigResult.value !== '0x') {
        try {
          const currencyData = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'currencyConfig', data: currencyConfigResult.value as `0x${string}` }) as readonly [boolean, boolean, number];
          ethEnabled = currencyData[0];
          usdcEnabled = currencyData[1];
        } catch { /* continue */ }
      }

      // Derive mintEnabled/claimEnabled from pause states
      const mintEnabled = !mintPaused && !killSwitch;
      const claimEnabled = !claimsPaused && !killSwitch;

      // Determine active payment token
      let activePaymentToken: PaymentToken = 'ETH';
      if (usdcEnabled && !ethEnabled) {
        activePaymentToken = 'USDC';
      }

      // Build reason if disabled
      let disabledReason: string | null = null;
      if (killSwitch) {
        disabledReason = 'Contract is in emergency mode';
      } else if (mintPaused) {
        disabledReason = 'Minting is paused';
      }

      const config: AdminConfig = {
        mintEnabled,
        claimEnabled,
        activePaymentToken,
        signatureRequired: false, // V3 default - signature-based mint is optional
        disabledReason,
        lastFetched: now,
        isLoaded: true,
        configFetchFailed,
      };
      
      // Update cache
      cachedAdminConfig = config;
      return config;
    } catch (error) {
      console.error('[AdminConfig] Fetch failed:', error);
      // FAIL-OPEN: Return permissive config so users can still try to mint
      // The smart contract will enforce the real state on-chain
      const failOpenConfig: AdminConfig = {
        mintEnabled: true,
        claimEnabled: true,
        activePaymentToken: 'ETH',
        signatureRequired: false,
        disabledReason: null,
        lastFetched: now,
        isLoaded: true,
        configFetchFailed: true,
      };
      cachedAdminConfig = failOpenConfig;
      return failOpenConfig;
    }
  }, []);

  // ============ FETCH ANTI-BOT CONFIG (V3 - uses walletData) ============
  const fetchAntiBotConfig = useCallback(async (walletAddress: string): Promise<AntiBotConfig | null> => {
    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('[AntiBot] Invalid wallet address format');
      return null;
    }
    
    try {
      const [cooldownResult, walletLimitResult, walletDataResult] = await Promise.allSettled([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintCooldown', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'walletMintLimit', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'walletData', args: [walletAddress as `0x${string}`] }) }, 'latest']),
      ]);

      let cooldown = 0n;
      let maxMints = 0n;
      let mintCount = 0n;
      let lastMintTime = 0n;

      if (cooldownResult.status === 'fulfilled' && cooldownResult.value) {
        try { cooldown = decodeUint256Result(cooldownResult.value, 'mintCooldown', true); } catch { /* continue */ }
      }
      if (walletLimitResult.status === 'fulfilled' && walletLimitResult.value) {
        try { maxMints = decodeUint256Result(walletLimitResult.value, 'walletMintLimit', true); } catch { /* continue */ }
      }
      if (walletDataResult.status === 'fulfilled' && walletDataResult.value && walletDataResult.value !== '0x') {
        try {
          const decoded = decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'walletData', data: walletDataResult.value as `0x${string}` }) as readonly [bigint, bigint, bigint, bigint, bigint, boolean];
          mintCount = decoded[0];
          lastMintTime = decoded[1];
        } catch { /* continue */ }
      }

      const blockData = await rpcCall('eth_getBlockByNumber', ['latest', false]);
      const blockTimestamp = blockData?.timestamp ? BigInt(blockData.timestamp) : BigInt(Math.floor(Date.now() / 1000));
      
      if (lastMintTime === 0n) {
        const canMintNow = maxMints === 0n || mintCount < maxMints;
        return { cooldown, lastMintTime, mintCount, maxMints, canMintNow, cooldownRemaining: 0n };
      }
      
      const cooldownEnd = lastMintTime + cooldown;
      const cooldownRemaining = cooldownEnd > blockTimestamp ? cooldownEnd - blockTimestamp : 0n;
      const canMintNow = blockTimestamp >= cooldownEnd && (maxMints === 0n || mintCount < maxMints);

      return { cooldown, lastMintTime, mintCount, maxMints, canMintNow, cooldownRemaining };
    } catch (error) {
      console.error('[AntiBot] Failed to fetch config:', error);
      // FAIL-OPEN: allow minting, contract will enforce
      return { cooldown: 0n, lastMintTime: 0n, mintCount: 0n, maxMints: 0n, canMintNow: true, cooldownRemaining: 0n };
    }
  }, [decodeUint256Result]);

  // ============ NETWORK VERIFICATION ============
  const verifyBaseNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    if (isNetworkSwitchingRef.current) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      currentChainRef.current = chainId;
      
      if (chainId.toLowerCase() !== BASE_CHAIN_ID) {
        isNetworkSwitchingRef.current = true;
        setMintState(prev => ({ ...prev, pollingMessage: 'Switching to Base network...' }));
        
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
          currentChainRef.current = BASE_CHAIN_ID;
          setMintState(prev => ({ ...prev, pollingMessage: null }));
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            setMintState(prev => ({ ...prev, pollingMessage: 'Adding Base network...' }));
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BASE_CHAIN_ID,
                  chainName: 'Base',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              });
              currentChainRef.current = BASE_CHAIN_ID;
              setMintState(prev => ({ ...prev, pollingMessage: null }));
              return true;
            } catch {
              setMintState(prev => ({ ...prev, pollingMessage: null, error: 'Failed to add Base network. Please add it manually.' }));
              return false;
            }
          }
          setMintState(prev => ({ ...prev, pollingMessage: null, error: 'Please switch to Base network to continue.' }));
          return false;
        } finally {
          isNetworkSwitchingRef.current = false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // ============ PRE-MINT ENFORCEMENT ============
  // V3: FAIL-OPEN - if config fetch fails, allow mint attempt (contract enforces)
  const enforceMintAllowed = useCallback(async (
    walletAddress: string,
    requiredToken: PaymentToken
  ): Promise<{ allowed: boolean; error: string | null; config: AdminConfig }> => {
    if (isNetworkSwitchingRef.current) {
      return { allowed: false, error: 'Network switch in progress', config: DEFAULT_ADMIN_CONFIG };
    }

    // Fetch admin config - this will fail-open if RPC fails
    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));

    // CRITICAL: Only block on definitive on-chain states
    // If config fetch failed, allow the mint attempt - contract will enforce
    if (config.isLoaded && !config.configFetchFailed) {
      if (!config.mintEnabled) {
        return { allowed: false, error: config.disabledReason || 'Minting is currently disabled', config };
      }
    }

    // V3: signatureRequired is false by default - direct minting is allowed
    // No longer blocking on signatureRequired

    // Anti-bot check (fail-open)
    const antiBot = await fetchAntiBotConfig(walletAddress);
    if (antiBot) {
      setMintState(prev => ({ ...prev, antiBotConfig: antiBot }));
      if (!antiBot.canMintNow) {
        if (antiBot.cooldownRemaining > 0n) {
          return { allowed: false, error: `Please wait ${antiBot.cooldownRemaining} seconds before minting again`, config };
        }
        if (antiBot.maxMints > 0n && antiBot.mintCount >= antiBot.maxMints) {
          return { allowed: false, error: 'Wallet mint limit reached', config };
        }
      }
    }

    return { allowed: true, error: null, config };
  }, [fetchAdminConfig, fetchAntiBotConfig]);

  // ============ PRE-CLAIM ENFORCEMENT ============
  const enforceClaimAllowed = useCallback(async (): Promise<{ allowed: boolean; error: string | null; config: AdminConfig }> => {
    if (isNetworkSwitchingRef.current) {
      return { allowed: false, error: 'Network switch in progress', config: DEFAULT_ADMIN_CONFIG };
    }

    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));

    if (!config.isLoaded) {
      return { allowed: false, error: 'Admin configuration unavailable', config };
    }

    if (!config.claimEnabled) {
      return { allowed: false, error: config.disabledReason || 'Claiming is currently disabled', config };
    }

    return { allowed: true, error: null, config };
  }, [fetchAdminConfig]);

  // ============ CHECK USDC ALLOWANCE ============
  const checkUSDCAllowance = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as `0x${string}`, NFT_CONTRACT_ADDRESS as `0x${string}`],
      });

      const result = await rpcCall('eth_call', [{ to: USDC_ADDRESS, data }, 'latest']);

      if (!result || result === '0x') return 0n;
      
      const decoded = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'allowance',
        data: result as `0x${string}`,
      });
      return decoded as bigint;
    } catch (error) {
      console.error('[USDC] Failed to check allowance:', error);
      return 0n;
    }
  }, []);

  // ============ APPROVE USDC ============
  const approveUSDC = useCallback(async (
    walletAddress: string,
    _amount: bigint // Ignored - we use MaxUint256
  ): Promise<{ success: boolean; error: string | null }> => {
    // Verify network before approval
    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      return { success: false, error: 'Please switch to Base network before approving USDC' };
    }

    setMintState(prev => ({ ...prev, isApprovingUSDC: true, pollingMessage: 'Waiting for USDC approval...' }));

    try {
      // Approve MaxUint256 for stable approvals
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [NFT_CONTRACT_ADDRESS as `0x${string}`, maxUint256],
      });

      const ethereum = window.ethereum as any;
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: USDC_ADDRESS, data }],
      }) as string;

      setMintState(prev => ({ ...prev, pollingMessage: 'Confirming USDC approval...' }));

      let receipt: any = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          receipt = await ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          if (receipt) break;
        } catch { /* continue */ }
        
        // Update message with attempt count
        if (i % 5 === 0 && i > 0) {
          setMintState(prev => ({ ...prev, pollingMessage: `Confirming USDC approval... (${i * 2}s)` }));
        }
      }

      setMintState(prev => ({ ...prev, isApprovingUSDC: false, pollingMessage: null }));

      if (!receipt || receipt.status !== '0x1') {
        return { success: false, error: 'USDC approval failed' };
      }

      return { success: true, error: null };
    } catch (error: any) {
      setMintState(prev => ({ ...prev, isApprovingUSDC: false, pollingMessage: null }));
      if (error?.code === 4001) {
        return { success: false, error: 'Approval rejected by user' };
      }
      return { success: false, error: 'USDC approval failed' };
    }
  }, [verifyBaseNetwork]);

  // ============ GET MINT PRICE ETH (with graceful fallback) ============
  const getMintPriceETH = useCallback(async (): Promise<bigint> => {
    // Network check - don't call if not on Base
    if (window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
        if (chainId?.toLowerCase() !== BASE_CHAIN_ID) {
          // Return 0n silently - network error will be shown separately
          return 0n;
        }
      } catch {
        // Continue with call attempt
      }
    }
    
    try {
      return await safeRpcCall(async () => {
        const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintPriceETH', args: [] });
        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        return decodeUint256Result(result, 'mintPriceETH', true);
      }, pendingEthPriceRef, 0n);
    } catch {
      return 0n;
    }
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceETH = useCallback(async (quantity: number): Promise<bigint> => {
    if (quantity <= 0) return 0n;
    // V3: No batch price function - calculate as single price * quantity
    try {
      const singlePrice = await getMintPriceETH();
      return singlePrice * BigInt(quantity);
    } catch {
      return 0n;
    }
  }, []);

  // ============ GET MINT PRICE USDC (with graceful fallback) ============
  const getMintPriceUSDC = useCallback(async (): Promise<bigint> => {
    try {
      return await safeRpcCall(async () => {
        const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintPriceUSDC', args: [] });
        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        return decodeUint256Result(result, 'mintPriceUSDC', true);
      }, pendingUsdcPriceRef, 0n);
    } catch {
      return 0n;
    }
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceUSDC = useCallback(async (quantity: number): Promise<bigint> => {
    if (quantity <= 0) return 0n;
    // V3: No batch price function - calculate as single price * quantity
    try {
      const singlePrice = await getMintPriceUSDC();
      return singlePrice * BigInt(quantity);
    } catch {
      return 0n;
    }
  }, []);


  // ============ WAIT FOR RECEIPT (HARDENED) ============
  const waitForReceipt = useCallback(async (
    txHash: string,
    expectedRecipient: string,
    maxAttempts = 120
  ): Promise<{ success: boolean; tokenIds: string[] }> => {
    if (!txHash || typeof txHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new Error('Invalid transaction hash format');
    }
    
    if (!expectedRecipient || typeof expectedRecipient !== 'string' || !/^0x[a-fA-F0-9]{40}$/i.test(expectedRecipient)) {
      throw new Error('Invalid recipient address format');
    }
    
    setMintState(prev => ({ ...prev, isWaitingForReceipt: true, pollingMessage: 'Confirming transaction...' }));
    
    let receipt: any = null;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      
      // Update polling message
      const seconds = (i + 1) * 2;
      if (seconds % 10 === 0) {
        setMintState(prev => ({ ...prev, pollingMessage: `Confirming transaction... (${seconds}s)` }));
      }
      
      try {
        // Try wallet first, fallback to RPC
        receipt = await window.ethereum!.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        consecutiveErrors = 0; // Reset on success
        if (receipt) break;
      } catch (err) {
        consecutiveErrors++;
        console.warn(`[Receipt] Polling attempt ${i + 1} failed:`, err);
        
        // If wallet consistently fails, try RPC endpoint
        if (consecutiveErrors >= 3) {
          try {
            receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
            consecutiveErrors = 0;
            if (receipt) break;
          } catch {
            // Continue polling
          }
        }
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          setMintState(prev => ({ ...prev, isWaitingForReceipt: false, pollingMessage: null }));
          throw new Error('Unable to confirm transaction. Please check BaseScan manually.');
        }
        continue;
      }
    }

    setMintState(prev => ({ ...prev, isWaitingForReceipt: false, pollingMessage: null }));

    if (!receipt) {
      throw new Error('Transaction confirmation timeout. Please check the transaction on BaseScan.');
    }
    
    if (receipt.status !== '0x1') {
      throw new Error('Transaction reverted on-chain. Check gas and parameters.');
    }

    const logs = (receipt.logs as Array<{ address: string; topics: string[]; data: string }>) || [];
    const tokenIds: string[] = [];
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const seenTokenIds = new Set<string>(); // Prevent duplicates

    for (const log of logs) {
      // Strict address match for security
      if (log.address?.toLowerCase() !== NFT_CONTRACT_ADDRESS.toLowerCase()) continue;
      if (!log.topics || log.topics.length < 4) continue;
      
      try {
        const decoded = decodeEventLog({
          abi: [ERC721_TRANSFER_EVENT],
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        }) as { eventName: string; args: { from: string; to: string; tokenId: bigint } };
        
        // Strict validation: must be mint (from zero), to expected recipient
        if (
          decoded.eventName === 'Transfer' &&
          decoded.args.from.toLowerCase() === zeroAddress.toLowerCase() &&
          decoded.args.to.toLowerCase() === expectedRecipient.toLowerCase() &&
          decoded.args.tokenId !== undefined &&
          decoded.args.tokenId >= 0n
        ) {
          const tokenIdStr = decoded.args.tokenId.toString();
          if (!seenTokenIds.has(tokenIdStr)) {
            seenTokenIds.add(tokenIdStr);
            tokenIds.push(tokenIdStr);
          }
        }
      } catch (decodeErr) {
        console.warn('[Receipt] Failed to decode transfer log:', decodeErr);
        continue;
      }
    }

    return { success: true, tokenIds };
  }, []);

  // ============ NOTIFY MINTED ============
  const notifyMinted = useCallback((walletAddress: string, tokenIds: string[], txHash: string) => {
    window.dispatchEvent(
      new CustomEvent('memorymint:nft-minted', {
        detail: { address: walletAddress, tokenIds, txHash },
      })
    );
  }, []);

  // ============ TRANSACTION SIMULATION (BASE-OPTIMIZED) ============
  const GAS_BUFFER_PERCENT = 7n; // 7% buffer for Base (between 5-8%)
  
  const simulateAndEstimateGas = useCallback(async (params: {
    from: string;
    to: string;
    data: `0x${string}`;
    value?: bigint;
  }): Promise<{ 
    success: boolean; 
    error: string | null; 
    errorCode: string | null;
    gasLimit: bigint | null;
    maxFeePerGas: bigint | null;
    maxPriorityFeePerGas: bigint | null;
    estimatedCostEth: string | null;
  }> => {
    const { from, to, data, value = 0n } = params;

    // Hard block on repeated identical failures (requires refresh)
    if (mintBlockedRef.current) {
      const msg = mintState.mintBlockedReason || 'Mint blocked due to repeated failures. Please refresh to retry.';
      return {
        success: false,
        error: msg,
        errorCode: 'REPEAT_BLOCK',
        gasLimit: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        estimatedCostEth: null,
      };
    }

    try {
      setMintState(prev => ({ ...prev, isSimulating: true, pollingMessage: 'Simulating transaction...' }));

      const callParams = {
        from,
        to,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0',
      };

      // Step 1: Simulate with eth_call (static)
      console.log('[Simulation] eth_call', {
        selector: data.slice(0, 10),
        calldataBytes: (data.length - 2) / 2,
        valueWei: value.toString(),
      });

      try {
        await rpcCallForSimulation('eth_call', [callParams, 'latest']);
      } catch (simErr: any) {
        const decoded = decodeMintErrorWithCode(simErr);
        console.error('[Simulation] eth_call reverted:', decoded);

        // Repeat-failure tracking (only for deterministic preflight failures)
        repeatFailureRef.current = decoded.code && decoded.code === repeatFailureRef.current.code
          ? { code: decoded.code, count: repeatFailureRef.current.count + 1 }
          : { code: decoded.code, count: 1 };

        if (repeatFailureRef.current.count >= 2) {
          mintBlockedRef.current = true;
          const blockedMsg = `Repeated failure: ${decoded.message}. Refresh required before retry.`;
          setMintState(prev => ({
            ...prev,
            isSimulating: false,
            pollingMessage: null,
            mintBlocked: true,
            mintBlockedReason: blockedMsg,
            error: blockedMsg,
            txPhase: 'failed',
            isMinting: false,
          }));

          return {
            success: false,
            error: blockedMsg,
            errorCode: decoded.code,
            gasLimit: null,
            maxFeePerGas: null,
            maxPriorityFeePerGas: null,
            estimatedCostEth: null,
          };
        }

        setMintState(prev => ({ ...prev, isSimulating: false, pollingMessage: null }));
        return {
          success: false,
          error: decoded.message,
          errorCode: decoded.code,
          gasLimit: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
          estimatedCostEth: null,
        };
      }

      // Step 2: Estimate gas ONLY after simulation succeeded
      console.log('[Simulation] Estimating gas...');
      let gasEstimate: bigint;
      try {
        const gasResult = await rpcCallForSimulation('eth_estimateGas', [callParams]);
        gasEstimate = BigInt(gasResult as string);
      } catch (gasErr: any) {
        const decoded = decodeMintErrorWithCode(gasErr);
        console.error('[Simulation] Gas estimation failed:', decoded);
        setMintState(prev => ({ ...prev, isSimulating: false, pollingMessage: null }));
        return {
          success: false,
          error: decoded.message,
          errorCode: decoded.code,
          gasLimit: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
          estimatedCostEth: null,
        };
      }

      // Apply minimal buffer (unchanged)
      const gasWithBuffer = gasEstimate + (gasEstimate * GAS_BUFFER_PERCENT / 100n);

      // Step 3: Get gas price (EIP-1559)
      const baseGasPrice = BigInt(await rpcCall('eth_gasPrice', []) as string);
      let maxPriorityFeePerGas = 1000000n; // 0.001 gwei default for Base
      try {
        const priorityFee = await rpcCall('eth_maxPriorityFeePerGas', []);
        if (priorityFee) maxPriorityFeePerGas = BigInt(priorityFee as string);
      } catch {
        // Use default
      }

      const maxFeePerGas = baseGasPrice + maxPriorityFeePerGas;
      const estimatedCostWei = gasWithBuffer * maxFeePerGas + value;
      const estimatedCostEth = formatEther(estimatedCostWei);

      // Clear repeat-failure tracking on success
      repeatFailureRef.current = { code: null, count: 0 };

      setMintState(prev => ({
        ...prev,
        isSimulating: false,
        pollingMessage: null,
        estimatedGasEth: estimatedCostEth,
      }));

      return {
        success: true,
        error: null,
        errorCode: null,
        gasLimit: gasWithBuffer,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCostEth,
      };
    } catch (error) {
      const errorInfo = decodeMintErrorWithCode(error);
      console.error('[Simulation] Unexpected error:', error);
      setMintState(prev => ({ ...prev, isSimulating: false, pollingMessage: null }));
      return {
        success: false,
        error: errorInfo.message,
        errorCode: errorInfo.code,
        gasLimit: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        estimatedCostEth: null,
      };
    }
  }, [mintState.mintBlockedReason]);

  // ============ INTERNAL MINT EXECUTOR ============
  const executeMintInternal = useCallback(async (
    walletAddress: string,
    tokenURI: string | null,
    quantity: number
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected', txPhase: 'failed' }));
      return false;
    }

    // Helper to reset state on error/cancellation
    const resetOnError = (error: string, phase: TxPhase) => {
      setMintState(prev => ({ 
        ...prev, 
        isMinting: false,
        isClaiming: false,
        isSimulating: false,
        error,
        txPhase: phase,
        pollingMessage: null,
      }));
    };

    try {
      // Fetch fresh config and determine payment token
      const freshConfig = await fetchAdminConfig(true);
      const paymentToken = freshConfig.activePaymentToken;
      
      const { allowed, error, config } = await enforceMintAllowed(walletAddress, paymentToken);
      if (!allowed) {
        resetOnError(error || 'Mint not allowed', 'failed');
        return false;
      }

      const isBase = await verifyBaseNetwork();
      if (!isBase) {
        resetOnError('Please switch to Base network', 'failed');
        return false;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: true,
        error: null,
        success: false,
        selectedPaymentToken: paymentToken,
        txPhase: 'simulating',
        pollingMessage: 'Preparing transaction...',
      }));

      let txHash: string | undefined;
      let isSponsored = false;

      if (paymentToken === 'USDC') {
        const priceUSDC = quantity === 1 ? await getMintPriceUSDC() : await getBatchMintPriceUSDC(quantity);
        setMintState(prev => ({ ...prev, mintPriceUSDC: formatUSDCAmount(priceUSDC) }));

        if (priceUSDC > 0n) {
          const allowance = await checkUSDCAllowance(walletAddress);
          if (allowance < priceUSDC) {
            const { success: approved, error: approvalError } = await approveUSDC(walletAddress, priceUSDC);
            if (!approved) {
              const errorInfo = decodeMintErrorWithCode({ message: approvalError });
              resetOnError(approvalError || 'USDC approval failed', errorInfo.isCancelled ? 'cancelled' : 'failed');
              return false;
            }
          }
        }

        setMintState(prev => ({ ...prev, pollingMessage: 'Optimizing gas...', txPhase: 'simulating' }));

        // V3: Only single USDC mint supported
        const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintWithUSDC', args: [tokenURI || ''] });

        const simulation = await simulateAndEstimateGas({
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data,
          value: 0n,
        });

        if (!simulation.success) {
          resetOnError(simulation.error || 'Transaction would fail', 'failed');
          return false;
        }

        setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...', txPhase: 'awaiting_wallet' }));

        try {
          txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: NFT_CONTRACT_ADDRESS,
              data,
              gas: simulation.gasLimit ? `0x${simulation.gasLimit.toString(16)}` : undefined,
              maxFeePerGas: simulation.maxFeePerGas ? `0x${simulation.maxFeePerGas.toString(16)}` : undefined,
              maxPriorityFeePerGas: simulation.maxPriorityFeePerGas ? `0x${simulation.maxPriorityFeePerGas.toString(16)}` : undefined,
            }],
          });
        } catch (walletErr: unknown) {
          const errorInfo = decodeMintErrorWithCode(walletErr);
          resetOnError(errorInfo.message, errorInfo.isCancelled ? 'cancelled' : 'failed');
          return false;
        }
      } else {
        const priceWei = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
        setMintState(prev => ({ ...prev, mintPriceEth: formatWeiToEth(priceWei) }));

        // V3: Use mintNFT for single, batchMint with string array for batch
        const data = quantity === 1
          ? encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintNFT', args: [tokenURI || ''] })
          : encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'batchMint', args: [Array(quantity).fill(tokenURI || '')] });

        if (canSponsor) {
          setMintState(prev => ({ ...prev, pollingMessage: 'Requesting sponsored mint...', txPhase: 'awaiting_wallet' }));

          // CRITICAL: still preflight before opening wallet (prevents "likely to fail")
          const sponsorPreflight = await simulateAndEstimateGas({
            from: walletAddress,
            to: NFT_CONTRACT_ADDRESS,
            data,
            value: 0n,
          });

          if (!sponsorPreflight.success) {
            resetOnError(sponsorPreflight.error || 'Transaction would fail - blocked', 'failed');
            return false;
          }
          
          try {
            const callId = await (window.ethereum as any).request({
              method: 'wallet_sendCalls',
              params: [{
                version: '1.0',
                chainId: BASE_CHAIN_ID,
                from: walletAddress,
                calls: [{ to: NFT_CONTRACT_ADDRESS, data, value: '0x0' }],
                capabilities: {
                  [BASE_CHAIN_ID]: {
                    paymasterService: { url: COINBASE_PAYMASTER_URL },
                  },
                },
              }],
            });

            setMintState(prev => ({ ...prev, pollingMessage: 'Confirming sponsored transaction...', txPhase: 'pending' }));

            let confirmed = false;
            for (let i = 0; i < 60; i++) {
              try {
                const status = await (window.ethereum as any).request({
                  method: 'wallet_getCallsStatus',
                  params: [callId],
                });
                if (status?.status === 'CONFIRMED' && status?.receipts?.[0]?.transactionHash) {
                  txHash = status.receipts[0].transactionHash;
                  isSponsored = true;
                  confirmed = true;
                  break;
                }
                if (status?.status === 'FAILED') {
                  throw new Error('Sponsored transaction failed');
                }
              } catch (statusErr: any) {
                if (statusErr?.message?.includes('Sponsored transaction failed')) {
                  throw statusErr;
                }
              }
              
              // Update polling message
              if (i % 5 === 0 && i > 0) {
                setMintState(prev => ({ ...prev, pollingMessage: `Confirming sponsored transaction... (${i * 2}s)` }));
              }
              
              await new Promise(r => setTimeout(r, 2000));
            }
            
            if (!confirmed) {
              // Fallback to normal transaction if sponsored mint times out
              console.warn('[Mint] Sponsored mint timeout, falling back to normal transaction');
              setMintState(prev => ({ ...prev, pollingMessage: 'Sponsored mint unavailable, using normal transaction...', txPhase: 'awaiting_wallet' }));
              
              try {
                txHash = await (window.ethereum as any).request({
                  method: 'eth_sendTransaction',
                  params: [{
                    from: walletAddress,
                    to: NFT_CONTRACT_ADDRESS,
                    data,
                    value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
                  }],
                });
              } catch (walletErr: unknown) {
                const errorInfo = decodeMintErrorWithCode(walletErr);
                resetOnError(errorInfo.message, errorInfo.isCancelled ? 'cancelled' : 'failed');
                return false;
              }
            }
          } catch (sponsorErr: any) {
            // Check if user cancelled the sponsored transaction
            const errorInfo = decodeMintErrorWithCode(sponsorErr);
            if (errorInfo.isCancelled) {
              resetOnError(errorInfo.message, 'cancelled');
              return false;
            }
            
            // Fallback to normal transaction on sponsored mint failure
            console.warn('[Mint] Sponsored transaction failed, falling back:', sponsorErr);
            setMintState(prev => ({ ...prev, pollingMessage: 'Using normal transaction...', txPhase: 'awaiting_wallet' }));
            
            try {
              txHash = await (window.ethereum as any).request({
                method: 'eth_sendTransaction',
                params: [{
                  from: walletAddress,
                  to: NFT_CONTRACT_ADDRESS,
                  data,
                  value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
                }],
              });
            } catch (walletErr: unknown) {
              const errorInfo = decodeMintErrorWithCode(walletErr);
              resetOnError(errorInfo.message, errorInfo.isCancelled ? 'cancelled' : 'failed');
              return false;
            }
          }
        } else {
          setMintState(prev => ({ ...prev, pollingMessage: 'Optimizing gas...', txPhase: 'simulating' }));
          
          // Pre-simulate to get optimized gas params
          const simulation = await simulateAndEstimateGas({
            from: walletAddress,
            to: NFT_CONTRACT_ADDRESS,
            data,
            value: priceWei,
          });
          
          if (!simulation.success) {
            // Block transaction if simulation fails
            resetOnError(simulation.error || 'Transaction would fail - blocked', 'failed');
            return false;
          }
          
          setMintState(prev => ({ 
            ...prev, 
            pollingMessage: 'Waiting for signature...',
            txPhase: 'awaiting_wallet',
            estimatedGasEth: simulation.estimatedCostEth,
          }));
          
          // Pass optimized gas params to wallet - this is critical for gas reduction
          try {
            txHash = await (window.ethereum as any).request({
              method: 'eth_sendTransaction',
              params: [{
                from: walletAddress,
                to: NFT_CONTRACT_ADDRESS,
                data,
                // CRITICAL: Only attach value if price > 0 (free mint = no ETH)
                value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
                // Pass optimized gas limit to wallet
                gas: simulation.gasLimit ? `0x${simulation.gasLimit.toString(16)}` : undefined,
                maxFeePerGas: simulation.maxFeePerGas ? `0x${simulation.maxFeePerGas.toString(16)}` : undefined,
                maxPriorityFeePerGas: simulation.maxPriorityFeePerGas ? `0x${simulation.maxPriorityFeePerGas.toString(16)}` : undefined,
              }],
            });
          } catch (walletErr: unknown) {
            const errorInfo = decodeMintErrorWithCode(walletErr);
            console.log('[Mint] Wallet response:', { isCancelled: errorInfo.isCancelled, message: errorInfo.message });
            resetOnError(errorInfo.message, errorInfo.isCancelled ? 'cancelled' : 'failed');
            return false;
          }
        }
      }

      // CRITICAL: Only proceed if we have a txHash
      if (!txHash) {
        console.error('[Mint] No txHash returned - exiting immediately');
        resetOnError('Transaction was not submitted', 'failed');
        return false;
      }

      setMintState(prev => ({ ...prev, txHash, isSponsored, txPhase: 'pending' }));

      const { success, tokenIds } = await waitForReceipt(txHash, walletAddress);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        success,
        isSponsored,
        txPhase: success ? 'success' : 'failed',
        pollingMessage: null,
      }));

      if (success) notifyMinted(walletAddress, tokenIds, txHash);
      return success;
    } catch (error: unknown) {
      console.error('[Mint] Error:', error);
      const errorInfo = decodeMintErrorWithCode(error);
      resetOnError(errorInfo.message, errorInfo.isCancelled ? 'cancelled' : 'failed');
      return false;
    }
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, getBatchMintPriceETH, getMintPriceUSDC, getBatchMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted, simulateAndEstimateGas]);

  // ============ MINT QUEUE PROCESSOR ============
  const processNextInQueue = useCallback(async () => {
    if (isMintProcessingRef.current || mintQueueRef.current.length === 0) {
      return;
    }
    
    isMintProcessingRef.current = true;
    const nextMint = mintQueueRef.current.shift();
    
    // Update queue position for remaining items
    setMintState(prev => ({ ...prev, mintQueuePosition: mintQueueRef.current.length }));
    
    if (nextMint) {
      await nextMint();
    }
    
    isMintProcessingRef.current = false;
    
    // Process next if queue not empty
    if (mintQueueRef.current.length > 0) {
      processNextInQueue();
    }
  }, []);

  // ============ QUEUE-BASED MINT EXECUTOR ============
  const executeMint = useCallback(async (
    walletAddress: string,
    tokenURI: string | null,
    quantity: number
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const mintTask = async () => {
        const result = await executeMintInternal(walletAddress, tokenURI, quantity);
        resolve(result);
        return result;
      };
      
      mintQueueRef.current.push(mintTask);
      setMintState(prev => ({ ...prev, mintQueuePosition: mintQueueRef.current.length }));
      
      processNextInQueue();
    });
  }, [executeMintInternal, processNextInQueue]);

  // ============ PUBLIC MINT FUNCTIONS ============
  const mintNFT = useCallback(async (tokenURI: string, walletAddress: string): Promise<boolean> => {
    return executeMint(walletAddress, tokenURI, 1);
  }, [executeMint]);

  const batchMintNFT = useCallback(async (walletAddress: string, quantity: number): Promise<boolean> => {
    if (quantity < 1 || quantity > 10) {
      setMintState(prev => ({ ...prev, error: 'Batch size must be 1-10' }));
      return false;
    }
    return executeMint(walletAddress, null, quantity);
  }, [executeMint]);

  const quickMint = useCallback(async (walletAddress: string): Promise<boolean> => {
    return executeMint(walletAddress, '', 1);
  }, [executeMint]);

  // ============ USDC-SPECIFIC MINT FUNCTIONS ============
  
  /**
   * @notice Mint with USDC (direct, no signature)
   * @dev Requires prior USDC approval - will auto-approve if needed
   */
  const mintWithUSDC = useCallback(async (
    tokenURI: string,
    walletAddress: string
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    return new Promise((resolve) => {
      const mintTask = async () => {
        try {
          // Enforce USDC is active
          const freshConfig = await fetchAdminConfig(true);
          if (freshConfig.activePaymentToken !== 'USDC') {
            setMintState(prev => ({ ...prev, error: 'USDC minting is not currently active' }));
            resolve(false);
            return false;
          }

          const { allowed, error } = await enforceMintAllowed(walletAddress, 'USDC');
          if (!allowed) {
            setMintState(prev => ({ ...prev, error }));
            resolve(false);
            return false;
          }

          const isBase = await verifyBaseNetwork();
          if (!isBase) {
            setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
            resolve(false);
            return false;
          }

          setMintState(prev => ({
            ...prev,
            isMinting: true,
            error: null,
            success: false,
            selectedPaymentToken: 'USDC',
            pollingMessage: 'Fetching USDC price...',
          }));

          const priceUSDC = await getMintPriceUSDC();
          setMintState(prev => ({ ...prev, mintPriceUSDC: formatUSDCAmount(priceUSDC) }));

          // Check and approve USDC if needed
          if (priceUSDC > 0n) {
            const allowance = await checkUSDCAllowance(walletAddress);
            if (allowance < priceUSDC) {
              const { success: approved, error: approvalError } = await approveUSDC(walletAddress, priceUSDC);
              if (!approved) {
                setMintState(prev => ({ ...prev, isMinting: false, error: approvalError, pollingMessage: null }));
                resolve(false);
                return false;
              }
            }
          }

          setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...', txPhase: 'awaiting_wallet' }));

          const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: 'mintWithUSDC',
            args: [tokenURI],
          });

          let txHash: string;
          try {
            txHash = await (window.ethereum as any).request({
              method: 'eth_sendTransaction',
              params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
            }) as string;
          } catch (walletErr: unknown) {
            const errorInfo = decodeMintErrorWithCode(walletErr);
            setMintState(prev => ({ 
              ...prev, 
              isMinting: false, 
              error: errorInfo.message, 
              txPhase: errorInfo.isCancelled ? 'cancelled' : 'failed',
              pollingMessage: null 
            }));
            resolve(false);
            return false;
          }

          setMintState(prev => ({ ...prev, txHash, isSponsored: false, txPhase: 'pending' }));

          const { success, tokenIds } = await waitForReceipt(txHash, walletAddress);

          setMintState(prev => ({
            ...prev,
            isMinting: false,
            txHash,
            tokenId: tokenIds[0] || null,
            tokenIds: tokenIds.length > 0 ? tokenIds : null,
            success,
            isSponsored: false,
            txPhase: success ? 'success' : 'failed',
            pollingMessage: null,
          }));

          if (success) notifyMinted(walletAddress, tokenIds, txHash);
          resolve(success);
          return success;
        } catch (error: unknown) {
          console.error('[MintWithUSDC] Error:', error);
          const errorInfo = decodeMintErrorWithCode(error);
          setMintState(prev => ({ 
            ...prev, 
            isMinting: false, 
            error: errorInfo.message, 
            txPhase: errorInfo.isCancelled ? 'cancelled' : 'failed',
            pollingMessage: null 
          }));
          resolve(false);
          return false;
        }
      };

      mintQueueRef.current.push(mintTask);
      setMintState(prev => ({ ...prev, mintQueuePosition: mintQueueRef.current.length }));
      processNextInQueue();
    });
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted, processNextInQueue]);


  // ============ BONUS CLAIM PRE-ELIGIBILITY CHECK ============
  const checkBonusEligibility = useCallback(async (
    walletAddress: string,
    levelId: bigint
  ): Promise<{ eligible: boolean; reason: string }> => {
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'canClaimBonus',
        args: [walletAddress as `0x${string}`, levelId],
      });

      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);

      if (!result || result === '0x') {
        return { eligible: false, reason: 'Unable to check eligibility' };
      }

      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI,
        functionName: 'canClaimBonus',
        data: result as `0x${string}`,
      }) as [boolean, string];

      return { eligible: decoded[0], reason: decoded[1] || (decoded[0] ? 'Eligible' : 'Not eligible') };
    } catch (error) {
      console.error('[ClaimBonus] Eligibility check failed:', error);
      return { eligible: false, reason: 'Error checking eligibility' };
    }
  }, []);

  // ============ BONUS CLAIM ============
  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    if (!window.ethereum || !walletAddress) {
      return { success: false, txHash: null, error: 'Wallet not connected' };
    }

    // Validate levelProof format
    if (!levelProof || typeof levelProof !== 'string' || !levelProof.match(/^0x[a-fA-F0-9]*$/)) {
      return { success: false, txHash: null, error: 'Invalid level proof format' };
    }

    // Check eligibility BEFORE wallet prompt
    const eligibility = await checkBonusEligibility(walletAddress, levelId);
    if (!eligibility.eligible) {
      return { success: false, txHash: null, error: eligibility.reason };
    }

    const { allowed, error, config } = await enforceClaimAllowed();
    if (!allowed) {
      return { success: false, txHash: null, error };
    }

    const isBase = await verifyBaseNetwork();
    if (!isBase) {
      return { success: false, txHash: null, error: 'Please switch to Base network' };
    }

    setMintState(prev => ({ ...prev, isClaiming: true, error: null, pollingMessage: 'Preparing claim...' }));

    try {
      const functionName = config.activePaymentToken === 'USDC' ? 'claimBonusAsUSDC' : 'claimBonus';
      
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName,
        args: [levelId, gameLevel, levelProof],
      });

      setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...' }));

      const txHash = await (window.ethereum as any).request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
      }) as string;

      setMintState(prev => ({ ...prev, pollingMessage: 'Confirming claim...' }));

      let receipt: any = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          if (receipt) break;
        } catch { /* continue */ }
        
        if (i % 5 === 0 && i > 0) {
          setMintState(prev => ({ ...prev, pollingMessage: `Confirming claim... (${i * 2}s)` }));
        }
      }

      const success = receipt?.status === '0x1';
      
      setMintState(prev => ({
        ...prev,
        isClaiming: false,
        txHash,
        success,
        error: success ? null : 'Claim failed',
        pollingMessage: null,
      }));

      return { success, txHash, error: success ? null : 'Claim failed' };
    } catch (error: unknown) {
      const errorMessage = decodeMintError(error);
      setMintState(prev => ({ ...prev, isClaiming: false, error: errorMessage, pollingMessage: null }));
      return { success: false, txHash: null, error: errorMessage };
    }
  }, [checkBonusEligibility, enforceClaimAllowed, verifyBaseNetwork]);

  // ============ RESET STATE ============
  const resetMintState = useCallback(() => {
    setMintState(prev => ({
      ...prev,
      isMinting: false,
      isClaiming: false,
      isWaitingForReceipt: false,
      isApprovingUSDC: false,
      txHash: null,
      tokenId: null,
      tokenIds: null,
      error: null,
      success: false,
      isSponsored: false,
      mintPriceEth: null,
      mintPriceUSDC: null,
      pollingMessage: null,
      mintQueuePosition: 0,
    }));
    mintQueueRef.current = [];
    isMintProcessingRef.current = false;
    pendingEthPriceRef.current = false;
    pendingUsdcPriceRef.current = false;
  }, []);

  // ============ REFRESH ADMIN CONFIG ============
  const refreshAdminConfig = useCallback(async () => {
    setMintState(prev => ({ ...prev, isLoadingConfig: true }));
    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));
    return config;
  }, [fetchAdminConfig]);

  // ============ BACKWARD COMPATIBILITY HELPERS ============
  const getMintPriceEstimate = useCallback(async (quantity = 1) => {
    const priceWei = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
    return { priceWei, priceEth: formatWeiToEth(priceWei), isFree: priceWei === 0n };
  }, [getMintPriceETH, getBatchMintPriceETH]);

  const checkBalance = useCallback(async (walletAddress: string, quantity = 1) => {
    const balanceHex = await window.ethereum?.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] }) as string;
    const balance = BigInt(balanceHex || '0');
    const required = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
    const hasEnough = balance >= required;
    const shortfall = hasEnough ? null : formatWeiToEth(required - balance);
    return { hasEnough, balance: formatWeiToEth(balance), required: formatWeiToEth(required), shortfall, token: 'ETH' as PaymentToken };
  }, [getMintPriceETH, getBatchMintPriceETH]);


  // ============ INIT ============
  useEffect(() => {
    refreshAdminConfig();
    
    const handleChainChanged = () => {
      isNetworkSwitchingRef.current = true;
      resetMintState();
      setTimeout(() => {
        isNetworkSwitchingRef.current = false;
        refreshAdminConfig();
      }, 1000);
    };

    if (window.ethereum) {
      window.ethereum.on?.('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      }
    };
  }, [refreshAdminConfig, resetMintState]);

  return {
    ...mintState,
    // ETH mint functions (direct, no signature required)
    mintNFT,
    batchMintNFT,
    quickMint,
    // USDC mint functions (direct, no signature required)
    mintWithUSDC,
    // Claim functions
    claimBonus,
    checkBonusEligibility,
    // State management
    resetMintState,
    refreshAdminConfig,
    // Price getters
    getMintPriceETH,
    getBatchMintPriceETH,
    getMintPriceUSDC,
    getBatchMintPriceUSDC,
    getMintPriceEstimate,
    // Balance checks
    checkBalance,
    checkUSDCAllowance,
    approveUSDC,
    // Anti-bot
    fetchAntiBotConfig,
    // Constants
    NFT_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    BASE_CHAIN_ID,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
