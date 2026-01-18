// ============================================================
// Robust TotalMinted Fetch Utility for MemoryMint Admin Panel
// Contract: 0x8A6EAc80dd2cC5efE7a6b10a4430a89871A4672B
// Features: 10 retries with 3s delay, proxy detection (EIP-1967/UUPS),
//           network validation, Alchemy RPC fallback
// ============================================================

import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { NFT_CONTRACT_ADDRESS, CONTRACT_ABI } from '@/contracts/MemoryMintContract';
import { robustRpcCall } from '@/utils/rpcHandler';
import { validateNetwork, logAdminAction, type NetworkValidationResult } from './useOwnerFetch';

// ============ CONFIGURATION ============
const TOTAL_MINTED_CACHE_TTL = 30 * 1000; // 30 seconds
const MAX_FETCH_ATTEMPTS = 10; // 10 retries as requested
const RETRY_DELAY_MS = 3000; // Fixed 3 seconds between retries
const BLOCK_CONFIRMATIONS_REQUIRED = 1; // 1 block confirmation

// Alchemy RPC endpoint for fallback (Base Mainnet public)
const ALCHEMY_FALLBACK_ENDPOINTS = [
  'https://base-mainnet.g.alchemy.com/v2/demo',
  'https://base.blockpi.network/v1/rpc/public',
  'https://base.gateway.tenderly.co',
] as const;

// EIP-1967 proxy slots
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

interface TotalMintedCache {
  totalMinted: bigint;
  timestamp: number;
  chainId: string;
}

let totalMintedCache: TotalMintedCache | null = null;
let isFetching = false;
let fetchPromise: Promise<bigint | null> | null = null;

// ============ PROXY DETECTION ============

interface ProxyInfo {
  isProxy: boolean;
  proxyType: 'transparent' | 'uups' | 'none';
  implementationAddress: string | null;
}

/**
 * Detect if the contract is a proxy (transparent or UUPS)
 * Read implementation address from EIP-1967 storage slot:
 * 0x360894a13ba1a3210667c828492db98dca3e2076 (standard slot for implementation)
 */
async function detectProxy(): Promise<ProxyInfo> {
  const result: ProxyInfo = {
    isProxy: false,
    proxyType: 'none',
    implementationAddress: null,
  };

  console.info('[TotalMintedFetch] Checking proxy status for contract:', NFT_CONTRACT_ADDRESS);

  try {
    // Check EIP-1967 implementation slot (used by both Transparent and UUPS proxies)
    const implResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, EIP1967_IMPLEMENTATION_SLOT, 'latest'],
      { timeoutMs: 8000, maxRetries: 3 }
    );

    if (implResult.success && implResult.data && 
        implResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        implResult.data !== '0x') {
      const implAddress = '0x' + implResult.data.slice(26).toLowerCase();
      if (implAddress !== '0x0000000000000000000000000000000000000000') {
        result.isProxy = true;
        result.implementationAddress = implAddress;
        result.proxyType = 'uups'; // Assume UUPS unless admin slot is present
        console.info('[TotalMintedFetch] EIP-1967 implementation detected:', implAddress);
      }
    }

    // Check for admin slot to determine if transparent proxy
    const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
    const adminResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, EIP1967_ADMIN_SLOT, 'latest'],
      { timeoutMs: 8000, maxRetries: 3 }
    );

    if (adminResult.success && adminResult.data && 
        adminResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        adminResult.data !== '0x') {
      const adminAddress = '0x' + adminResult.data.slice(26).toLowerCase();
      if (adminAddress !== '0x0000000000000000000000000000000000000000') {
        result.proxyType = 'transparent';
        console.info('[TotalMintedFetch] Transparent Proxy admin detected:', adminAddress);
      }
    }
  } catch (err) {
    console.warn('[TotalMintedFetch] Proxy detection failed:', err);
  }

  if (!result.isProxy) {
    console.info('[TotalMintedFetch] Contract is NOT a proxy (direct contract)');
  }

  return result;
}

/**
 * Wait for block confirmations before querying to avoid false empty responses
 */
async function waitForBlockConfirmations(): Promise<boolean> {
  try {
    // Get current block number
    const blockResult = await robustRpcCall<string>('eth_blockNumber', [], {
      timeoutMs: 5000,
      maxRetries: 2,
    });

    if (!blockResult.success || !blockResult.data) {
      console.warn('[TotalMintedFetch] Could not get block number for confirmation check');
      return true; // Proceed anyway
    }

    const currentBlock = BigInt(blockResult.data);
    console.info(`[TotalMintedFetch] Current block: ${currentBlock.toString()}`);

    // Wait for at least 1 more block to ensure RPC is synced
    let attempts = 0;
    const maxWaitAttempts = 5;
    
    while (attempts < maxWaitAttempts) {
      await new Promise(r => setTimeout(r, 1500)); // Wait 1.5 seconds
      
      const newBlockResult = await robustRpcCall<string>('eth_blockNumber', [], {
        timeoutMs: 5000,
        maxRetries: 1,
      });

      if (newBlockResult.success && newBlockResult.data) {
        const newBlock = BigInt(newBlockResult.data);
        if (newBlock >= currentBlock) {
          console.info(`[TotalMintedFetch] Block confirmed: ${newBlock.toString()}`);
          return true;
        }
      }
      attempts++;
    }

    console.warn('[TotalMintedFetch] Block confirmation timeout, proceeding anyway');
    return true;
  } catch (err) {
    console.warn('[TotalMintedFetch] Block confirmation check failed:', err);
    return true; // Proceed anyway
  }
}

// ============ CACHE MANAGEMENT ============

/**
 * Get cached totalMinted if still valid
 */
export function getCachedTotalMinted(): bigint | null {
  if (!totalMintedCache) return null;
  
  const now = Date.now();
  if (now - totalMintedCache.timestamp > TOTAL_MINTED_CACHE_TTL) {
    console.info('[TotalMintedFetch] Cache expired');
    return null;
  }
  
  return totalMintedCache.totalMinted;
}

/**
 * Set totalMinted in cache
 */
export function setCachedTotalMinted(totalMinted: bigint, chainId: string): void {
  totalMintedCache = {
    totalMinted,
    timestamp: Date.now(),
    chainId,
  };
  console.info('[TotalMintedFetch] TotalMinted cached:', totalMinted.toString());
}

/**
 * Invalidate totalMinted cache
 */
export function invalidateTotalMintedCache(): void {
  totalMintedCache = null;
  console.info('[TotalMintedFetch] Cache invalidated');
}

// ============ FALLBACK METHODS ============

/**
 * Fallback: Fetch totalMinted using Alchemy/external RPC directly
 */
async function fetchTotalMintedWithAlchemyFallback(): Promise<bigint | null> {
  console.info('[TotalMintedFetch] Attempting Alchemy/external RPC fallback...');
  
  const callData = encodeFunctionData({
    abi: CONTRACT_ABI as any,
    functionName: 'totalMinted',
    args: [],
  });

  for (const endpoint of ALCHEMY_FALLBACK_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_call',
          params: [{ to: NFT_CONTRACT_ADDRESS, data: callData }, 'latest'],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result !== '0x' && data.result.length >= 2) {
          const decoded = decodeFunctionResult({
            abi: CONTRACT_ABI as any,
            functionName: 'totalMinted',
            data: data.result as `0x${string}`,
          });
          
          if (typeof decoded === 'bigint') {
            console.info(`[TotalMintedFetch] ✓ Alchemy fallback success (${endpoint}):`, decoded.toString());
            return decoded;
          }
        }
      }
    } catch (err) {
      console.warn(`[TotalMintedFetch] Alchemy fallback failed for ${endpoint}:`, err);
    }
  }
  
  console.error('[TotalMintedFetch] All Alchemy fallback endpoints failed');
  return null;
}

/**
 * Try to read totalMinted from implementation contract (for proxies)
 */
async function fetchTotalMintedFromImplementation(implAddress: string): Promise<bigint | null> {
  console.info('[TotalMintedFetch] Reading totalMinted from implementation:', implAddress);
  
  const callData = encodeFunctionData({
    abi: CONTRACT_ABI as any,
    functionName: 'totalMinted',
    args: [],
  });

  const result = await robustRpcCall<string>(
    'eth_call',
    [{ to: implAddress, data: callData }, 'latest'],
    { timeoutMs: 10000, maxRetries: 3 }
  );

  if (result.success && result.data && result.data !== '0x' && result.data.length >= 2) {
    try {
      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI as any,
        functionName: 'totalMinted',
        data: result.data as `0x${string}`,
      });
      
      if (typeof decoded === 'bigint') {
        console.info('[TotalMintedFetch] ✓ Implementation read success:', decoded.toString());
        return decoded;
      }
    } catch (err) {
      console.warn('[TotalMintedFetch] Implementation decode failed:', err);
    }
  }
  
  return null;
}

// ============ GET CHAIN ID HELPER ============

async function getChainId(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    return await (window.ethereum as any).request({ method: 'eth_chainId' });
  } catch {
    return null;
  }
}

// ============ CORE FETCH FUNCTION ============

export interface FetchTotalMintedOptions {
  forceRefresh?: boolean;
  skipNetworkValidation?: boolean;
  skipBlockConfirmation?: boolean;
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  onError?: (error: string, attempt: number) => void;
  onNetworkValidation?: (result: NetworkValidationResult) => void;
}

export interface FetchTotalMintedResult {
  totalMinted: bigint | null;
  error: string | null;
  attempts: number;
  networkInfo?: NetworkValidationResult;
  isProxy?: boolean;
  proxyType?: 'transparent' | 'uups' | 'none';
  message?: string;
}

/**
 * Fetch totalMinted with robust retry logic (10 attempts, 3s delay)
 * - Validates network matches Base mainnet (8453) or Sepolia (84532)
 * - Detects proxy contracts (Transparent/UUPS) and reads from implementation
 * - Waits for block confirmation before querying
 * - Falls back to Alchemy RPC if standard calls fail
 * - Logs successful detection in Admin Audit Log
 */
export async function fetchTotalMintedRobust(
  options: FetchTotalMintedOptions = {}
): Promise<FetchTotalMintedResult> {
  const { 
    forceRefresh = false, 
    skipNetworkValidation = false,
    skipBlockConfirmation = false,
    onAttempt, 
    onError,
    onNetworkValidation,
  } = options;

  console.info('[TotalMintedFetch] Starting robust totalMinted fetch for contract:', NFT_CONTRACT_ADDRESS);

  // 1. Validate network first
  let networkResult: NetworkValidationResult | undefined;
  if (!skipNetworkValidation) {
    networkResult = await validateNetwork();
    onNetworkValidation?.(networkResult);
    
    if (!networkResult.valid) {
      console.error('[TotalMintedFetch] ✗ Network validation failed:', networkResult.error);
      return {
        totalMinted: null,
        error: networkResult.error || 'Network validation failed. Check network or proxy.',
        attempts: 0,
        networkInfo: networkResult,
        message: 'Failed to read totalMinted. Check network or proxy',
      };
    }
    console.info('[TotalMintedFetch] ✓ Network validated:', networkResult.chainName, `(Chain ID: ${networkResult.chainId})`);
  }

  // 2. Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedTotalMinted();
    if (cached !== null) {
      console.info('[TotalMintedFetch] Returning cached totalMinted:', cached.toString());
      return { 
        totalMinted: cached, 
        error: null, 
        attempts: 0,
        message: `totalMinted detected: ${cached.toString()} tokens`,
      };
    }
  }

  // 3. Deduplicate concurrent requests
  if (isFetching && fetchPromise) {
    console.info('[TotalMintedFetch] Waiting for existing fetch...');
    const result = await fetchPromise;
    return { 
      totalMinted: result, 
      error: result === null ? 'Fetch in progress returned null' : null, 
      attempts: 0,
      message: result !== null ? `totalMinted detected: ${result.toString()} tokens` : 'Failed to read totalMinted. Check network or proxy',
    };
  }

  isFetching = true;

  // 4. Wait for block confirmation (if enabled)
  if (!skipBlockConfirmation) {
    console.info('[TotalMintedFetch] Waiting for block confirmation...');
    await waitForBlockConfirmations();
  }

  // 5. Detect if contract is a proxy
  const proxyInfo = await detectProxy();
  console.info('[TotalMintedFetch] Proxy detection result:', {
    isProxy: proxyInfo.isProxy,
    proxyType: proxyInfo.proxyType,
    implementation: proxyInfo.implementationAddress?.slice(0, 10) + '...',
  });

  const chainId = await getChainId() || '0x2105';
  let lastError = '';

  // Create the fetch promise
  fetchPromise = (async (): Promise<bigint | null> => {
    try {
      // 6. Main retry loop (10 attempts, 3s delay)
      for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
        onAttempt?.(attempt, MAX_FETCH_ATTEMPTS);
        console.info(`[TotalMintedFetch] Attempt ${attempt}/${MAX_FETCH_ATTEMPTS}...`);

        try {
          // Try reading totalMinted from the proxy address (delegatecall pattern)
          const callData = encodeFunctionData({
            abi: CONTRACT_ABI as any,
            functionName: 'totalMinted',
            args: [],
          });

          const result = await robustRpcCall<string>(
            'eth_call',
            [{ to: NFT_CONTRACT_ADDRESS, data: callData }, 'latest'],
            { timeoutMs: 10000, maxRetries: 2 }
          );

          if (result.success && result.data && result.data !== '0x' && result.data.length >= 2) {
            try {
              const decoded = decodeFunctionResult({
                abi: CONTRACT_ABI as any,
                functionName: 'totalMinted',
                data: result.data as `0x${string}`,
              });
              
              if (typeof decoded === 'bigint') {
                console.info(`[TotalMintedFetch] ✓ totalMinted detected: ${decoded.toString()} tokens (attempt ${attempt})`);
                setCachedTotalMinted(decoded, chainId);
                
                // Log in Admin Audit Log
                logAdminAction({
                  walletAddress: NFT_CONTRACT_ADDRESS,
                  action: `totalMinted detected: ${decoded.toString()} tokens`,
                  success: true,
                });
                
                return decoded;
              }
            } catch (decodeErr) {
              console.warn(`[TotalMintedFetch] Decode failed on attempt ${attempt}:`, decodeErr);
            }
          }

          // If proxy detected, try reading from implementation
          if (proxyInfo.isProxy && proxyInfo.implementationAddress) {
            console.info(`[TotalMintedFetch] Attempt ${attempt}: Trying implementation contract...`);
            const implResult = await fetchTotalMintedFromImplementation(proxyInfo.implementationAddress);
            if (implResult !== null) {
              setCachedTotalMinted(implResult, chainId);
              
              // Log in Admin Audit Log
              logAdminAction({
                walletAddress: NFT_CONTRACT_ADDRESS,
                action: `totalMinted detected from implementation: ${implResult.toString()} tokens`,
                success: true,
              });
              
              return implResult;
            }
          }

          lastError = result.error || 'Empty response from totalMinted()';
          onError?.(lastError, attempt);
          console.warn(`[TotalMintedFetch] Attempt ${attempt} failed:`, lastError);
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error';
          onError?.(lastError, attempt);
          console.warn(`[TotalMintedFetch] Attempt ${attempt} exception:`, lastError);
        }

        // Wait 3 seconds before next retry
        if (attempt < MAX_FETCH_ATTEMPTS) {
          console.info(`[TotalMintedFetch] Waiting ${RETRY_DELAY_MS}ms before retry...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      // 7. All direct attempts failed, try Alchemy fallback
      console.info('[TotalMintedFetch] All direct attempts failed, trying Alchemy fallback...');
      const alchemyResult = await fetchTotalMintedWithAlchemyFallback();
      if (alchemyResult !== null) {
        setCachedTotalMinted(alchemyResult, chainId);
        
        // Log in Admin Audit Log
        logAdminAction({
          walletAddress: NFT_CONTRACT_ADDRESS,
          action: `totalMinted detected via fallback: ${alchemyResult.toString()} tokens`,
          success: true,
        });
        
        return alchemyResult;
      }

      // 8. All methods failed
      console.error('[TotalMintedFetch] ✗ All methods failed after', MAX_FETCH_ATTEMPTS, 'attempts');
      
      // Log failure in Admin Audit Log
      logAdminAction({
        walletAddress: NFT_CONTRACT_ADDRESS,
        action: 'totalMinted fetch failed',
        success: false,
        error: lastError,
      });
      
      return null;
    } finally {
      isFetching = false;
      fetchPromise = null;
    }
  })();

  const finalResult = await fetchPromise;
  
  if (finalResult !== null) {
    return {
      totalMinted: finalResult,
      error: null,
      attempts: MAX_FETCH_ATTEMPTS,
      networkInfo: networkResult,
      isProxy: proxyInfo.isProxy,
      proxyType: proxyInfo.proxyType,
      message: `totalMinted detected: ${finalResult.toString()} tokens`,
    };
  }

  // Return descriptive error
  const proxyNote = proxyInfo.isProxy ? ` (${proxyInfo.proxyType} proxy detected)` : '';
  const networkNote = networkResult ? ` (Chain: ${networkResult.chainName})` : '';
  
  return {
    totalMinted: null,
    error: `Failed to read totalMinted. Check network or proxy.${proxyNote}${networkNote} Last error: ${lastError}`,
    attempts: MAX_FETCH_ATTEMPTS,
    networkInfo: networkResult,
    isProxy: proxyInfo.isProxy,
    proxyType: proxyInfo.proxyType,
    message: 'Failed to read totalMinted. Check network or proxy',
  };
}

/**
 * Get cached contract totalMinted (for quick access)
 */
export function getCachedContractTotalMinted(): bigint | null {
  return getCachedTotalMinted();
}
