import { useState, useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, decodeFunctionResult, decodeEventLog, formatEther, formatUnits, maxUint256 } from 'viem';

// ============ CONFIGURATION ============
// Deployed MemoryMintUltraSafe_Bonus contract on Base Mainnet
const NFT_CONTRACT_ADDRESS = '0x9B84d4e689000ab050e9754c5b123fC87E55A9f6';

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
const CONTRACT_ABI = parseAbi([
  // ETH payment functions
  'function mintNFT(string tokenURI) payable returns (uint256)',
  // v4: Signature functions now require nonce for replay protection
  'function mintWithSignature(string tokenURI, uint256 nonce, uint256 expiration, bytes signature) payable returns (uint256)',
  'function batchMint(uint256 quantity) payable returns (uint256)',
  // USDC payment functions
  'function mintWithUSDC(string tokenURI) returns (uint256)',
  // v4: Signature functions now require nonce for replay protection
  'function mintWithUSDCAndSignature(string tokenURI, uint256 nonce, uint256 expiration, bytes signature) returns (uint256)',
  'function batchMintWithUSDC(uint256 quantity) returns (uint256)',
  // Bonus claim functions
  'function claimBonus(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  'function claimBonusAsUSDC(uint256 levelId, uint256 gameLevel, bytes levelProof) external',
  // Price getters
  'function mintPriceUSDC() view returns (uint256)',
  'function mintPriceETH() view returns (uint256)',
  'function getMintPriceETH() view returns (uint256)',
  'function getBatchMintPriceETH(uint256 quantity) view returns (uint256)',
  'function getBatchMintPriceUSDC(uint256 quantity) view returns (uint256)',
  'function getEthUsdPrice() view returns (uint256)',
  // Bonus getters
  'function getBonusAmountETH(uint256 levelId) view returns (uint256)',
  'function getBonusAmountUSDC(uint256 levelId) view returns (uint256)',
  'function canClaimBonus(address user, uint256 levelId) view returns (bool, string)',
  'function getBonusLevel(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool)',
  'function bonusLevels(uint256 levelId) view returns (uint256, bool, uint256, uint256, bool, uint8)',
  'function owner() view returns (address)',
  // Admin toggle states
  'function mintEnabled() view returns (bool)',
  'function claimEnabled() view returns (bool)',
  'function activePaymentToken() view returns (uint8)',
  'function getDisabledReason() view returns (string)',
  'function sponsoredMintEnabled() view returns (bool)',
  // Currency config
  'function currencyConfig() view returns (bool ethEnabled, bool usdcEnabled, uint8 activeMintCurrency, uint8 activeBonusCurrency)',
  // Anti-bot
  'function mintCooldown() view returns (uint256)',
  'function lastMintTime(address) view returns (uint256)',
  'function walletMintCount(address) view returns (uint256)',
  'function maxMintsPerWallet() view returns (uint256)',
  // v4: Nonce for replay protection
  'function getNonce(address wallet) view returns (uint256)',
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

// ============ TYPES ============
export interface AdminConfig {
  mintEnabled: boolean;
  claimEnabled: boolean;
  activePaymentToken: PaymentToken;
  sponsoredMintEnabled: boolean;
  disabledReason: string | null;
  lastFetched: number;
  isLoaded: boolean;
}

export interface AntiBotConfig {
  cooldown: bigint;
  lastMintTime: bigint;
  mintCount: bigint;
  maxMints: bigint;
  canMintNow: boolean;
  cooldownRemaining: bigint;
}

export interface MintState {
  isMinting: boolean;
  isClaiming: boolean;
  isWaitingForReceipt: boolean;
  isApprovingUSDC: boolean;
  isAuthenticating: boolean;
  isSimulating: boolean;
  txHash: string | null;
  tokenId: string | null;
  tokenIds: string[] | null;
  error: string | null;
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
  requireSIWE: boolean;
  isSIWEAuthenticated: boolean;
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

// ============ FAIL-CLOSED DEFAULTS ============
const FAIL_CLOSED_ADMIN_CONFIG: AdminConfig = {
  mintEnabled: false,
  claimEnabled: false,
  activePaymentToken: 'ETH',
  sponsoredMintEnabled: false,
  disabledReason: 'Admin configuration unavailable',
  lastFetched: 0,
  isLoaded: false,
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

function decodeMintError(error: unknown): string {
  const err: any = error;

  if (err?.code === 4001) return 'Transaction rejected by user';

  const revertData: unknown =
    err?.data?.data ?? err?.data ?? err?.error?.data?.data ?? err?.error?.data;

  if (typeof revertData === 'string' && revertData.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: CONTRACT_ERROR_ABI,
        data: revertData as `0x${string}`,
      });

      switch (decoded.errorName) {
        case 'InsufficientPayment': return 'Insufficient payment. Please ensure you have enough ETH.';
        case 'InvalidQuantity':
        case 'MaxBatchExceeded': return 'Batch size must be 1–10';
        case 'TransferToNonReceiver': return 'Recipient cannot receive ERC-721 tokens';
        case 'NotOwner': return 'Not authorized';
        case 'MintDisabled': return 'Minting is currently disabled by admin';
        case 'ClaimDisabled': return 'Claiming is currently disabled by admin';
        case 'CooldownActive': return 'Please wait before minting again';
        case 'MintCapReached': return 'Wallet mint limit reached';
        case 'AlreadyClaimed': return 'Bonus already claimed for this level';
        case 'NotEligible': return 'Not eligible to claim this bonus';
        case 'OracleStalePrice':
        case 'OracleInvalidPrice':
        case 'OracleNotSet': return 'Price feed temporarily unavailable. Please try again.';
        default: return `Transaction failed: ${decoded.errorName}`;
      }
    } catch { /* fall through */ }
  }

  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) {
    if (rawMsg.toLowerCase().includes('oracle') || rawMsg.toLowerCase().includes('price feed')) {
      return 'Price feed temporarily unavailable. Please try again.';
    }
    if (rawMsg.includes('insufficient funds')) return 'Insufficient ETH balance for transaction';
    if (rawMsg.includes('gas required exceeds')) return 'Transaction would fail. Please check your balance.';
    if (rawMsg.includes('cooldown')) return 'Please wait before minting again';
    if (rawMsg.includes('disabled')) return 'Feature is currently disabled by admin';
    return rawMsg.slice(0, 100);
  }
  return 'Transaction failed. Please try again.';
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

// ============ MAIN HOOK ============
export function useNFTMint() {
  const [mintState, setMintState] = useState<MintState>({
    isMinting: false,
    isClaiming: false,
    isWaitingForReceipt: false,
    isApprovingUSDC: false,
    isAuthenticating: false,
    isSimulating: false,
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
    adminConfig: FAIL_CLOSED_ADMIN_CONFIG,
    antiBotConfig: null,
    isLoadingConfig: true,
    detectedWalletType: 'unknown',
    pollingMessage: null,
    mintQueuePosition: 0,
    requireSIWE: false,
    isSIWEAuthenticated: false,
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
    
    // If force is true, bypass pending lock
    if (force) {
      lastForcedFetchTime = now;
      
      try {
        const calls = [
          { fn: 'mintEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'mintEnabled', data: r as `0x${string}` }) as boolean },
          { fn: 'claimEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'claimEnabled', data: r as `0x${string}` }) as boolean },
          { fn: 'activePaymentToken', decode: (r: string) => (decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'activePaymentToken', data: r as `0x${string}` }) as number) === 1 ? 'USDC' : 'ETH' },
          { fn: 'sponsoredMintEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'sponsoredMintEnabled', data: r as `0x${string}` }) as boolean },
          { fn: 'getDisabledReason', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'getDisabledReason', data: r as `0x${string}` }) as string },
        ];

        const results = await Promise.allSettled(
          calls.map(async ({ fn }) => {
            const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: fn as any, args: [] });
            const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
            return { fn, result };
          })
        );

        const mintResult = results[0];
        const claimResult = results[1];
        
        if (mintResult.status === 'rejected' || claimResult.status === 'rejected') {
          console.error('[AdminConfig] Critical config call failed');
          return FAIL_CLOSED_ADMIN_CONFIG;
        }

        try {
          const mintEnabled = calls[0].decode((mintResult as PromiseFulfilledResult<{ fn: string; result: string }>).value.result) as boolean;
          const claimEnabled = calls[1].decode((claimResult as PromiseFulfilledResult<{ fn: string; result: string }>).value.result) as boolean;
          
          let activePaymentToken: PaymentToken = 'ETH';
          let sponsoredMintEnabled = false;
          let disabledReason: string | null = null;

          if (results[2].status === 'fulfilled') {
            try {
              const tokenResult = calls[2].decode((results[2] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
              activePaymentToken = tokenResult as PaymentToken;
            } catch { /* use default */ }
          }

          if (results[3].status === 'fulfilled') {
            try {
              const sponsoredResult = calls[3].decode((results[3] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
              sponsoredMintEnabled = sponsoredResult as boolean;
            } catch { /* use default */ }
          }

          if (results[4].status === 'fulfilled') {
            try {
              const reasonResult = calls[4].decode((results[4] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
              disabledReason = (reasonResult as string) || null;
            } catch { /* use default */ }
          }

          const config: AdminConfig = {
            mintEnabled,
            claimEnabled,
            activePaymentToken,
            sponsoredMintEnabled,
            disabledReason,
            lastFetched: now,
            isLoaded: true,
          };
          
          // Update cache
          cachedAdminConfig = config;
          return config;
        } catch (error) {
          console.error('[AdminConfig] Decode failed:', error);
          return FAIL_CLOSED_ADMIN_CONFIG;
        }
      } catch (error) {
        console.error('[AdminConfig] Forced fetch failed:', error);
        return FAIL_CLOSED_ADMIN_CONFIG;
      }
    }

    // Non-forced fetch uses safeRpcCall with pending lock
    return safeRpcCall(async () => {
      const calls = [
        { fn: 'mintEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'mintEnabled', data: r as `0x${string}` }) as boolean },
        { fn: 'claimEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'claimEnabled', data: r as `0x${string}` }) as boolean },
        { fn: 'activePaymentToken', decode: (r: string) => (decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'activePaymentToken', data: r as `0x${string}` }) as number) === 1 ? 'USDC' : 'ETH' },
        { fn: 'sponsoredMintEnabled', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'sponsoredMintEnabled', data: r as `0x${string}` }) as boolean },
        { fn: 'getDisabledReason', decode: (r: string) => decodeFunctionResult({ abi: CONTRACT_ABI, functionName: 'getDisabledReason', data: r as `0x${string}` }) as string },
      ];

      const results = await Promise.allSettled(
        calls.map(async ({ fn }) => {
          const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: fn as any, args: [] });
          const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
          return { fn, result };
        })
      );

      const mintResult = results[0];
      const claimResult = results[1];
      
      if (mintResult.status === 'rejected' || claimResult.status === 'rejected') {
        console.error('[AdminConfig] Critical config call failed');
        return FAIL_CLOSED_ADMIN_CONFIG;
      }

      try {
        const mintEnabled = calls[0].decode((mintResult as PromiseFulfilledResult<{ fn: string; result: string }>).value.result) as boolean;
        const claimEnabled = calls[1].decode((claimResult as PromiseFulfilledResult<{ fn: string; result: string }>).value.result) as boolean;
        
        let activePaymentToken: PaymentToken = 'ETH';
        let sponsoredMintEnabled = false;
        let disabledReason: string | null = null;

        if (results[2].status === 'fulfilled') {
          try {
            const tokenResult = calls[2].decode((results[2] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
            activePaymentToken = tokenResult as PaymentToken;
          } catch { /* use default */ }
        }

        if (results[3].status === 'fulfilled') {
          try {
            const sponsoredResult = calls[3].decode((results[3] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
            sponsoredMintEnabled = sponsoredResult as boolean;
          } catch { /* use default */ }
        }

        if (results[4].status === 'fulfilled') {
          try {
            const reasonResult = calls[4].decode((results[4] as PromiseFulfilledResult<{ fn: string; result: string }>).value.result);
            disabledReason = (reasonResult as string) || null;
          } catch { /* use default */ }
        }

        const config: AdminConfig = {
          mintEnabled,
          claimEnabled,
          activePaymentToken,
          sponsoredMintEnabled,
          disabledReason,
          lastFetched: now,
          isLoaded: true,
        };
        
        // Update cache
        cachedAdminConfig = config;
        return config;
      } catch (error) {
        console.error('[AdminConfig] Decode failed:', error);
        return FAIL_CLOSED_ADMIN_CONFIG;
      }
    }, pendingAdminConfigRef, FAIL_CLOSED_ADMIN_CONFIG);
  }, [safeRpcCall]);

  // ============ FETCH ANTI-BOT CONFIG (HARDENED) ============
  const fetchAntiBotConfig = useCallback(async (walletAddress: string): Promise<AntiBotConfig | null> => {
    // Validate wallet address format
    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('[AntiBot] Invalid wallet address format');
      return null;
    }
    
    try {
      const [cooldownData, lastMintData, countData, maxData] = await Promise.all([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintCooldown', args: [] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'lastMintTime', args: [walletAddress as `0x${string}`] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'walletMintCount', args: [walletAddress as `0x${string}`] }) }, 'latest']),
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'maxMintsPerWallet', args: [] }) }, 'latest']),
      ]);

      const cooldown = decodeUint256Result(cooldownData, 'mintCooldown');
      const lastMintTime = decodeUint256Result(lastMintData, 'lastMintTime');
      const mintCount = decodeUint256Result(countData, 'walletMintCount');
      const maxMints = decodeUint256Result(maxData, 'maxMintsPerWallet');

      // Use block timestamp for consistency (less gameable than client time)
      const blockData = await rpcCall('eth_getBlockByNumber', ['latest', false]);
      const blockTimestamp = blockData?.timestamp ? BigInt(blockData.timestamp) : BigInt(Math.floor(Date.now() / 1000));
      
      // Log any timestamp discrepancy
      const clientTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const discrepancy = clientTimestamp > blockTimestamp ? clientTimestamp - blockTimestamp : blockTimestamp - clientTimestamp;
      if (discrepancy > 60n) {
        console.warn(`[AntiBot] Timestamp discrepancy: client=${clientTimestamp}, block=${blockTimestamp}, diff=${discrepancy}s`);
      }
      
      // FIRST-TIME MINTER: If lastMintTime is 0, user has never minted - allow immediately
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
      // FAIL-OPEN for anti-bot: If we can't verify on-chain state, allow minting
      // The smart contract will enforce the real cooldown if one exists
      // This prevents false blocking of legitimate users due to RPC issues
      return {
        cooldown: 0n,
        lastMintTime: 0n,
        mintCount: 0n,
        maxMints: 0n,
        canMintNow: true, // Fail-open - let the contract enforce if needed
        cooldownRemaining: 0n,
      };
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
  const enforceMintAllowed = useCallback(async (
    walletAddress: string,
    requiredToken: PaymentToken
  ): Promise<{ allowed: boolean; error: string | null; config: AdminConfig }> => {
    if (isNetworkSwitchingRef.current) {
      return { allowed: false, error: 'Network switch in progress', config: FAIL_CLOSED_ADMIN_CONFIG };
    }

    // Always fetch fresh admin config
    const config = await fetchAdminConfig(true);
    setMintState(prev => ({ ...prev, adminConfig: config, isLoadingConfig: false }));

    if (!config.isLoaded) {
      return { allowed: false, error: 'Admin configuration unavailable', config };
    }

    if (!config.mintEnabled) {
      return { allowed: false, error: config.disabledReason || 'Minting is currently disabled', config };
    }

    if (config.activePaymentToken !== requiredToken) {
      return { allowed: false, error: `Only ${config.activePaymentToken} payments are currently accepted`, config };
    }

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
      return { allowed: false, error: 'Network switch in progress', config: FAIL_CLOSED_ADMIN_CONFIG };
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
        const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getMintPriceETH', args: [] });
        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        // Use allowEmpty=true for graceful fallback to 0n (free mint)
        return decodeUint256Result(result, 'getMintPriceETH', true);
      }, pendingEthPriceRef, 0n); // Default to 0n on any error
    } catch {
      // Graceful fallback - return 0n (free mint) instead of throwing
      return 0n;
    }
  }, [safeRpcCall, decodeUint256Result]);

  const getBatchMintPriceETH = useCallback(async (quantity: number): Promise<bigint> => {
    if (quantity <= 0) return 0n;
    
    try {
      return await safeRpcCall(async () => {
        const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getBatchMintPriceETH', args: [BigInt(quantity)] });
        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        return decodeUint256Result(result, 'getBatchMintPriceETH', true);
      }, pendingEthPriceRef, 0n);
    } catch {
      return 0n;
    }
  }, [safeRpcCall, decodeUint256Result]);

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
    
    try {
      return await safeRpcCall(async () => {
        const data = encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'getBatchMintPriceUSDC', args: [BigInt(quantity)] });
        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        return decodeUint256Result(result, 'getBatchMintPriceUSDC', true);
      }, pendingUsdcPriceRef, 0n);
    } catch {
      return 0n;
    }
  }, [safeRpcCall, decodeUint256Result]);

  // ============ GET NONCE (v4) ============
  /**
   * @notice Get current nonce for wallet address
   * @dev v4: Required for signature-based minting replay protection
   *      Frontend must call this before requesting signatures
   */
  const getNonce = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'getNonce',
        args: [walletAddress as `0x${string}`],
      });
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      return decodeUint256Result(result, 'getNonce');
    } catch (error) {
      console.error('[getNonce] Failed to fetch nonce:', error);
      return 0n; // Default to 0 on error
    }
  }, [decodeUint256Result]);

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
    gasLimit: bigint | null;
    maxFeePerGas: bigint | null;
    maxPriorityFeePerGas: bigint | null;
    estimatedCostEth: string | null;
  }> => {
    const { from, to, data, value = 0n } = params;

    try {
      setMintState(prev => ({ ...prev, isSimulating: true, pollingMessage: 'Simulating transaction...' }));

      const callParams = {
        from,
        to,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0',
      };

      // Step 1: Simulate with eth_call
      console.log('[Simulation] Running eth_call simulation...');
      let simulationResult: any;
      try {
        simulationResult = await rpcCall('eth_call', [callParams, 'latest']);
      } catch (simErr: any) {
        // Try to decode custom error
        const decoded = decodeMintError(simErr);
        console.error('[Simulation] eth_call reverted:', decoded);
        setMintState(prev => ({ ...prev, isSimulating: false, pollingMessage: null }));
        return { success: false, error: decoded, gasLimit: null, maxFeePerGas: null, maxPriorityFeePerGas: null, estimatedCostEth: null };
      }

      // Step 2: Estimate gas
      console.log('[Simulation] Estimating gas...');
      let gasEstimate: bigint;
      try {
        const gasResult = await rpcCall('eth_estimateGas', [callParams]);
        gasEstimate = BigInt(gasResult as string);
      } catch (gasErr: any) {
        const decoded = decodeMintError(gasErr);
        console.error('[Simulation] Gas estimation failed:', decoded);
        setMintState(prev => ({ ...prev, isSimulating: false, pollingMessage: null }));
        return { success: false, error: decoded, gasLimit: null, maxFeePerGas: null, maxPriorityFeePerGas: null, estimatedCostEth: null };
      }

      // Apply minimal buffer (7% for Base)
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

      console.log('[Simulation] Success:', {
        gasEstimate: gasEstimate.toString(),
        gasWithBuffer: gasWithBuffer.toString(),
        estimatedCostEth,
      });

      setMintState(prev => ({ 
        ...prev, 
        isSimulating: false, 
        pollingMessage: null,
        estimatedGasEth: estimatedCostEth,
      }));

      return { 
        success: true, 
        error: null, 
        gasLimit: gasWithBuffer,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCostEth,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Simulation failed';
      console.error('[Simulation] Unexpected error:', error);
      setMintState(prev => ({ ...prev, isSimulating: false, pollingMessage: null }));
      return { success: false, error: errorMessage, gasLimit: null, maxFeePerGas: null, maxPriorityFeePerGas: null, estimatedCostEth: null };
    }
  }, []);

  // ============ INTERNAL MINT EXECUTOR ============
  const executeMintInternal = useCallback(async (
    walletAddress: string,
    tokenURI: string | null,
    quantity: number
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    try {
      // Fetch fresh config and determine payment token
      const freshConfig = await fetchAdminConfig(true);
      const paymentToken = freshConfig.activePaymentToken;
      
      const { allowed, error, config } = await enforceMintAllowed(walletAddress, paymentToken);
      if (!allowed) {
        setMintState(prev => ({ ...prev, error }));
        return false;
      }

      const isBase = await verifyBaseNetwork();
      if (!isBase) {
        setMintState(prev => ({ ...prev, error: 'Please switch to Base network' }));
        return false;
      }

      setMintState(prev => ({
        ...prev,
        isMinting: true,
        error: null,
        success: false,
        selectedPaymentToken: paymentToken,
        pollingMessage: 'Preparing transaction...',
      }));

      let txHash: string;
      let isSponsored = false;

      if (paymentToken === 'USDC') {
        const priceUSDC = quantity === 1 ? await getMintPriceUSDC() : await getBatchMintPriceUSDC(quantity);
        setMintState(prev => ({ ...prev, mintPriceUSDC: formatUSDCAmount(priceUSDC) }));

        if (priceUSDC > 0n) {
          const allowance = await checkUSDCAllowance(walletAddress);
          if (allowance < priceUSDC) {
            const { success: approved, error: approvalError } = await approveUSDC(walletAddress, priceUSDC);
            if (!approved) {
              setMintState(prev => ({ ...prev, isMinting: false, error: approvalError, pollingMessage: null }));
              return false;
            }
          }
        }

        setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...' }));

        const data = quantity === 1
          ? encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintWithUSDC', args: [tokenURI || ''] })
          : encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'batchMintWithUSDC', args: [BigInt(quantity)] });

        txHash = await (window.ethereum as any).request({
          method: 'eth_sendTransaction',
          params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
        });
      } else {
        const priceWei = quantity === 1 ? await getMintPriceETH() : await getBatchMintPriceETH(quantity);
        setMintState(prev => ({ ...prev, mintPriceEth: formatWeiToEth(priceWei) }));

        const data = quantity === 1
          ? encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'mintNFT', args: [tokenURI || ''] })
          : encodeFunctionData({ abi: CONTRACT_ABI, functionName: 'batchMint', args: [BigInt(quantity)] });

        const canSponsor = 
          priceWei === 0n && 
          config.sponsoredMintEnabled && 
          config.isLoaded &&
          paymentToken === 'ETH' &&
          supportsWalletSendCalls();

        if (canSponsor) {
          setMintState(prev => ({ ...prev, pollingMessage: 'Requesting sponsored mint...' }));
          
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

            setMintState(prev => ({ ...prev, pollingMessage: 'Confirming sponsored transaction...' }));

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
              setMintState(prev => ({ ...prev, pollingMessage: 'Sponsored mint unavailable, using normal transaction...' }));
              
              txHash = await (window.ethereum as any).request({
                method: 'eth_sendTransaction',
                params: [{
                  from: walletAddress,
                  to: NFT_CONTRACT_ADDRESS,
                  data,
                  value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
                }],
              });
            }
          } catch (sponsorErr: any) {
            // Fallback to normal transaction on sponsored mint failure
            console.warn('[Mint] Sponsored transaction failed, falling back:', sponsorErr);
            setMintState(prev => ({ ...prev, pollingMessage: 'Using normal transaction...' }));
            
            txHash = await (window.ethereum as any).request({
              method: 'eth_sendTransaction',
              params: [{
                from: walletAddress,
                to: NFT_CONTRACT_ADDRESS,
                data,
                value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
              }],
            });
          }
        } else {
          setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...' }));
          
          txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: NFT_CONTRACT_ADDRESS,
              data,
              value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
            }],
          });
        }
      }

      setMintState(prev => ({ ...prev, txHash, isSponsored }));

      const { success, tokenIds } = await waitForReceipt(txHash!, walletAddress);

      setMintState(prev => ({
        ...prev,
        isMinting: false,
        txHash,
        tokenId: tokenIds[0] || null,
        tokenIds: tokenIds.length > 0 ? tokenIds : null,
        success,
        isSponsored,
        pollingMessage: null,
      }));

      if (success) notifyMinted(walletAddress, tokenIds, txHash!);
      return success;
    } catch (error: unknown) {
      console.error('[Mint] Error:', error);
      setMintState(prev => ({ ...prev, isMinting: false, error: decodeMintError(error), pollingMessage: null }));
      return false;
    }
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, getBatchMintPriceETH, getMintPriceUSDC, getBatchMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted]);

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

          setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...' }));

          const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: 'mintWithUSDC',
            args: [tokenURI],
          });

          const txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
          }) as string;

          setMintState(prev => ({ ...prev, txHash, isSponsored: false }));

          const { success, tokenIds } = await waitForReceipt(txHash, walletAddress);

          setMintState(prev => ({
            ...prev,
            isMinting: false,
            txHash,
            tokenId: tokenIds[0] || null,
            tokenIds: tokenIds.length > 0 ? tokenIds : null,
            success,
            isSponsored: false,
            pollingMessage: null,
          }));

          if (success) notifyMinted(walletAddress, tokenIds, txHash);
          resolve(success);
          return success;
        } catch (error: unknown) {
          console.error('[MintWithUSDC] Error:', error);
          setMintState(prev => ({ ...prev, isMinting: false, error: decodeMintError(error), pollingMessage: null }));
          resolve(false);
          return false;
        }
      };

      mintQueueRef.current.push(mintTask);
      setMintState(prev => ({ ...prev, mintQueuePosition: mintQueueRef.current.length }));
      processNextInQueue();
    });
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted, processNextInQueue]);

  /**
   * @notice Mint with USDC and signature verification
   * @dev v4: Now requires nonce parameter for replay protection
   *      Requires prior USDC approval - will auto-approve if needed
   */
  const mintWithUSDCAndSignature = useCallback(async (
    tokenURI: string,
    walletAddress: string,
    nonce: bigint,
    expiration: bigint,
    signature: `0x${string}`
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    return new Promise((resolve) => {
      const mintTask = async () => {
        try {
          // Check signature expiration
          const now = BigInt(Math.floor(Date.now() / 1000));
          if (expiration <= now) {
            setMintState(prev => ({ ...prev, error: 'Signature has expired' }));
            resolve(false);
            return false;
          }

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

          setMintState(prev => ({ ...prev, pollingMessage: 'Waiting for signature...' }));

          // v4: Include nonce in function call
          const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: 'mintWithUSDCAndSignature',
            args: [tokenURI, nonce, expiration, signature],
          });

          const txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
          }) as string;

          setMintState(prev => ({ ...prev, txHash, isSponsored: false }));

          const { success, tokenIds } = await waitForReceipt(txHash, walletAddress);

          setMintState(prev => ({
            ...prev,
            isMinting: false,
            txHash,
            tokenId: tokenIds[0] || null,
            tokenIds: tokenIds.length > 0 ? tokenIds : null,
            success,
            isSponsored: false,
            pollingMessage: null,
          }));

          if (success) notifyMinted(walletAddress, tokenIds, txHash);
          resolve(success);
          return success;
        } catch (error: unknown) {
          console.error('[MintWithUSDCAndSignature] Error:', error);
          setMintState(prev => ({ ...prev, isMinting: false, error: decodeMintError(error), pollingMessage: null }));
          resolve(false);
          return false;
        }
      };

      mintQueueRef.current.push(mintTask);
      setMintState(prev => ({ ...prev, mintQueuePosition: mintQueueRef.current.length }));
      processNextInQueue();
    });
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceUSDC, checkUSDCAllowance, approveUSDC, waitForReceipt, notifyMinted, processNextInQueue]);

  /**
   * @notice Mint with ETH and signature verification
   * @dev v4: Now requires nonce parameter for replay protection
   */
  const mintWithSignature = useCallback(async (
    tokenURI: string,
    walletAddress: string,
    nonce: bigint,
    expiration: bigint,
    signature: `0x${string}`
  ): Promise<boolean> => {
    if (!window.ethereum || !walletAddress) {
      setMintState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    return new Promise((resolve) => {
      const mintTask = async () => {
        try {
          const now = BigInt(Math.floor(Date.now() / 1000));
          if (expiration <= now) {
            setMintState(prev => ({ ...prev, error: 'Signature has expired' }));
            resolve(false);
            return false;
          }

          // Fetch fresh config and enforce
          const freshConfig = await fetchAdminConfig(true);
          const paymentToken = freshConfig.activePaymentToken;
          
          // mintWithSignature is ETH only
          if (paymentToken !== 'ETH') {
            setMintState(prev => ({ ...prev, error: 'Only ETH payments are currently accepted for signature mints' }));
            resolve(false);
            return false;
          }

          const { allowed, error } = await enforceMintAllowed(walletAddress, 'ETH');
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
            selectedPaymentToken: 'ETH',
            pollingMessage: 'Preparing signature mint...',
          }));

          const priceWei = await getMintPriceETH();
          setMintState(prev => ({ ...prev, mintPriceEth: formatWeiToEth(priceWei), pollingMessage: 'Waiting for signature...' }));

          // v4: Include nonce in function call
          const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: 'mintWithSignature',
            args: [tokenURI, nonce, expiration, signature],
          });

          const txHash = await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: NFT_CONTRACT_ADDRESS,
              data,
              value: priceWei > 0n ? `0x${priceWei.toString(16)}` : '0x0',
            }],
          });

          setMintState(prev => ({ ...prev, txHash, isSponsored: false }));

          const { success, tokenIds } = await waitForReceipt(txHash, walletAddress);

          setMintState(prev => ({
            ...prev,
            isMinting: false,
            txHash,
            tokenId: tokenIds[0] || null,
            tokenIds: tokenIds.length > 0 ? tokenIds : null,
            success,
            isSponsored: false,
            pollingMessage: null,
          }));

          if (success) notifyMinted(walletAddress, tokenIds, txHash);
          resolve(success);
          return success;
        } catch (error: unknown) {
          console.error('[MintWithSignature] Error:', error);
          setMintState(prev => ({ ...prev, isMinting: false, error: decodeMintError(error), pollingMessage: null }));
          resolve(false);
          return false;
        }
      };
      
      mintQueueRef.current.push(mintTask);
      setMintState(prev => ({ ...prev, mintQueuePosition: mintQueueRef.current.length }));
      processNextInQueue();
    });
  }, [fetchAdminConfig, enforceMintAllowed, verifyBaseNetwork, getMintPriceETH, waitForReceipt, notifyMinted, processNextInQueue]);

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
      isAuthenticating: false,
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

  // ============ SIWE AUTHENTICATION TOGGLE ============
  const setRequireSIWE = useCallback((require: boolean) => {
    setMintState(prev => ({ ...prev, requireSIWE: require }));
  }, []);

  const setSIWEAuthenticated = useCallback((authenticated: boolean) => {
    setMintState(prev => ({ ...prev, isSIWEAuthenticated: authenticated }));
  }, []);

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
    // ETH mint functions
    mintNFT,
    batchMintNFT,
    quickMint,
    mintWithSignature,
    // USDC mint functions
    mintWithUSDC,
    mintWithUSDCAndSignature,
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
    // v4: Nonce for replay protection
    getNonce,
    // Anti-bot
    fetchAntiBotConfig,
    // SIWE
    setRequireSIWE,
    setSIWEAuthenticated,
    // Constants
    NFT_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    BASE_CHAIN_ID,
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
