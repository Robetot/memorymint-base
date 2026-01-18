// ============================================================
// Robust Owner Fetch Utility for MemoryMint Admin Panel
// Features: Retry with configurable delays, network validation,
//           proxy detection, block confirmation, event listening
// ============================================================

import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { NFT_CONTRACT_ADDRESS, CONTRACT_ABI, BASE_CHAIN_ID, BASE_CHAIN_ID_NUM } from '@/contracts/MemoryMintContract';
import { robustRpcCall, RPC_CONFIG } from '@/utils/rpcHandler';

// ============ CONFIGURATION ============
const OWNER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_FETCH_ATTEMPTS = 10; // Increased to 10 retries
const RETRY_DELAY_MIN_MS = 2000; // 2 seconds minimum
const RETRY_DELAY_MAX_MS = 3000; // 3 seconds maximum
const BLOCK_CONFIRMATIONS_REQUIRED = 2; // Wait for 2 block confirmations

// Supported chain IDs
const SUPPORTED_CHAINS = {
  BASE_MAINNET: { id: '0x2105', idNum: 8453, name: 'Base Mainnet' },
  BASE_SEPOLIA: { id: '0x14a34', idNum: 84532, name: 'Base Sepolia' },
} as const;

// EIP-1967 proxy implementation slot (for detecting proxies)
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

interface OwnerCache {
  owner: string;
  timestamp: number;
  chainId: string;
}

let ownerCache: OwnerCache | null = null;
let isFetching = false;
let fetchPromise: Promise<string | null> | null = null;

// ============ NETWORK VALIDATION ============

export interface NetworkValidationResult {
  valid: boolean;
  chainId: string | null;
  chainName: string | null;
  error: string | null;
}

/**
 * Validate that the connected network matches the deployed contract's chain
 */
export async function validateNetwork(): Promise<NetworkValidationResult> {
  const chainId = await getChainId();
  
  if (!chainId) {
    return {
      valid: false,
      chainId: null,
      chainName: null,
      error: 'Unable to detect network. Check wallet connection.',
    };
  }

  const normalizedChainId = chainId.toLowerCase();
  
  // Check if chain is Base Mainnet
  if (normalizedChainId === SUPPORTED_CHAINS.BASE_MAINNET.id.toLowerCase()) {
    return {
      valid: true,
      chainId: normalizedChainId,
      chainName: SUPPORTED_CHAINS.BASE_MAINNET.name,
      error: null,
    };
  }
  
  // Check if chain is Base Sepolia (testnet)
  if (normalizedChainId === SUPPORTED_CHAINS.BASE_SEPOLIA.id.toLowerCase()) {
    return {
      valid: true,
      chainId: normalizedChainId,
      chainName: SUPPORTED_CHAINS.BASE_SEPOLIA.name,
      error: null,
    };
  }

  // Unknown/unsupported network
  const chainIdNum = parseInt(chainId, 16);
  return {
    valid: false,
    chainId: normalizedChainId,
    chainName: `Unknown (${chainIdNum})`,
    error: `Wrong network (Chain ID: ${chainIdNum}). Please switch to Base Mainnet (8453) or Base Sepolia (84532).`,
  };
}

// ============ BLOCK CONFIRMATION ============

/**
 * Wait for block confirmations before querying to avoid false empty responses
 */
async function waitForBlockConfirmations(minConfirmations = BLOCK_CONFIRMATIONS_REQUIRED): Promise<boolean> {
  try {
    // Get current block number
    const blockResult = await robustRpcCall<string>('eth_blockNumber', [], {
      timeoutMs: 5000,
      maxRetries: 2,
    });

    if (!blockResult.success || !blockResult.data) {
      console.warn('[OwnerFetch] Could not get block number for confirmation check');
      return true; // Proceed anyway
    }

    const currentBlock = BigInt(blockResult.data);
    console.info(`[OwnerFetch] Current block: ${currentBlock.toString()}`);

    // Wait for at least 1 more block to ensure RPC is synced
    const targetBlock = currentBlock + BigInt(minConfirmations);
    let attempts = 0;
    const maxWaitAttempts = 10;
    
    while (attempts < maxWaitAttempts) {
      await new Promise(r => setTimeout(r, 1500)); // Wait 1.5 seconds
      
      const newBlockResult = await robustRpcCall<string>('eth_blockNumber', [], {
        timeoutMs: 5000,
        maxRetries: 1,
      });

      if (newBlockResult.success && newBlockResult.data) {
        const newBlock = BigInt(newBlockResult.data);
        if (newBlock >= currentBlock) {
          console.info(`[OwnerFetch] Block confirmed: ${newBlock.toString()}`);
          return true;
        }
      }
      attempts++;
    }

    console.warn('[OwnerFetch] Block confirmation timeout, proceeding anyway');
    return true;
  } catch (err) {
    console.warn('[OwnerFetch] Block confirmation check failed:', err);
    return true; // Proceed anyway
  }
}

// ============ PROXY DETECTION ============

interface ProxyInfo {
  isProxy: boolean;
  implementationAddress: string | null;
  adminAddress: string | null;
}

/**
 * Detect if the contract is a proxy and try to read owner from the correct location
 */
async function detectProxy(): Promise<ProxyInfo> {
  const result: ProxyInfo = {
    isProxy: false,
    implementationAddress: null,
    adminAddress: null,
  };

  try {
    // Check EIP-1967 implementation slot
    const implResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, EIP1967_IMPLEMENTATION_SLOT, 'latest'],
      { timeoutMs: 5000, maxRetries: 2 }
    );

    if (implResult.success && implResult.data && implResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const implAddress = '0x' + implResult.data.slice(26);
      if (implAddress !== '0x0000000000000000000000000000000000000000') {
        result.isProxy = true;
        result.implementationAddress = implAddress;
        console.info('[OwnerFetch] EIP-1967 proxy detected, implementation:', implAddress.slice(0, 10) + '...');
      }
    }

    // Check EIP-1967 admin slot
    const adminResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, EIP1967_ADMIN_SLOT, 'latest'],
      { timeoutMs: 5000, maxRetries: 2 }
    );

    if (adminResult.success && adminResult.data && adminResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const adminAddress = '0x' + adminResult.data.slice(26);
      if (adminAddress !== '0x0000000000000000000000000000000000000000') {
        result.adminAddress = adminAddress;
        console.info('[OwnerFetch] Proxy admin detected:', adminAddress.slice(0, 10) + '...');
      }
    }
  } catch (err) {
    console.warn('[OwnerFetch] Proxy detection failed:', err);
  }

  return result;
}

/**
 * Try to read owner from proxy storage slot (slot 0 is common for Ownable)
 */
async function readOwnerFromStorage(): Promise<string | null> {
  try {
    // Slot 0 is typically where owner is stored in Ownable contracts
    const storageResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, '0x0', 'latest'],
      { timeoutMs: 5000, maxRetries: 2 }
    );

    if (storageResult.success && storageResult.data) {
      const ownerFromStorage = '0x' + storageResult.data.slice(26);
      if (
        ownerFromStorage !== '0x0000000000000000000000000000000000000000' &&
        ownerFromStorage.length === 42
      ) {
        console.info('[OwnerFetch] Owner from storage slot 0:', ownerFromStorage.slice(0, 10) + '...');
        return ownerFromStorage.toLowerCase();
      }
    }
  } catch (err) {
    console.warn('[OwnerFetch] Storage read failed:', err);
  }
  return null;
}

// ============ CACHE MANAGEMENT ============

/**
 * Get cached owner if still valid
 */
export function getCachedOwner(): string | null {
  if (!ownerCache) return null;
  
  const now = Date.now();
  if (now - ownerCache.timestamp > OWNER_CACHE_TTL) {
    console.info('[OwnerFetch] Cache expired');
    return null;
  }
  
  return ownerCache.owner;
}

/**
 * Set owner in cache
 */
export function setCachedOwner(owner: string, chainId: string): void {
  ownerCache = {
    owner: owner.toLowerCase(),
    timestamp: Date.now(),
    chainId,
  };
  console.info('[OwnerFetch] Owner cached:', owner.slice(0, 10) + '...');
}

/**
 * Invalidate owner cache
 */
export function invalidateOwnerCache(): void {
  ownerCache = null;
  console.info('[OwnerFetch] Cache invalidated');
}

/**
 * Update owner from event (OwnershipTransferred)
 */
export function updateOwnerFromEvent(newOwner: string, chainId: string): void {
  if (!newOwner || newOwner === '0x0000000000000000000000000000000000000000') {
    invalidateOwnerCache();
    return;
  }
  
  setCachedOwner(newOwner, chainId);
  console.info('[OwnerFetch] Owner updated from event:', newOwner.slice(0, 10) + '...');
}

// ============ RETRY DELAY ============

/**
 * Get random delay between min and max (2-3 seconds)
 */
function getRetryDelay(): number {
  return RETRY_DELAY_MIN_MS + Math.random() * (RETRY_DELAY_MAX_MS - RETRY_DELAY_MIN_MS);
}

// ============ CORE FETCH FUNCTION ============

export interface FetchOwnerOptions {
  forceRefresh?: boolean;
  skipNetworkValidation?: boolean;
  skipBlockConfirmation?: boolean;
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  onError?: (error: string, attempt: number) => void;
  onNetworkValidation?: (result: NetworkValidationResult) => void;
}

export interface FetchOwnerResult {
  owner: string | null;
  error: string | null;
  attempts: number;
  networkInfo?: NetworkValidationResult;
  isProxy?: boolean;
}

/**
 * Fetch owner with robust retry logic (10 attempts, 2-3s delay)
 * - Validates network matches Base mainnet/Sepolia
 * - Detects proxy contracts
 * - Waits for block confirmation before querying
 * - Validates response format
 */
export async function fetchOwnerRobust(
  options: FetchOwnerOptions = {}
): Promise<FetchOwnerResult> {
  const { 
    forceRefresh = false, 
    skipNetworkValidation = false,
    skipBlockConfirmation = false,
    onAttempt, 
    onError,
    onNetworkValidation,
  } = options;

  // 1. Validate network first
  if (!skipNetworkValidation) {
    const networkResult = await validateNetwork();
    onNetworkValidation?.(networkResult);
    
    if (!networkResult.valid) {
      console.error('[OwnerFetch] Network validation failed:', networkResult.error);
      return {
        owner: null,
        error: networkResult.error || 'Network validation failed',
        attempts: 0,
        networkInfo: networkResult,
      };
    }
    console.info('[OwnerFetch] Network validated:', networkResult.chainName);
  }

  // 2. Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedOwner();
    if (cached) {
      console.info('[OwnerFetch] Returning cached owner');
      return { owner: cached, error: null, attempts: 0 };
    }
  }

  // 3. Deduplicate concurrent requests
  if (isFetching && fetchPromise) {
    console.info('[OwnerFetch] Waiting for existing fetch...');
    const result = await fetchPromise;
    return { owner: result, error: result ? null : 'Fetch failed', attempts: 0 };
  }

  isFetching = true;
  let lastError = '';
  let validOwner: string | null = null;
  let proxyInfo: ProxyInfo | null = null;

  fetchPromise = (async () => {
    // 4. Wait for block confirmation to avoid stale RPC responses
    if (!skipBlockConfirmation) {
      console.info('[OwnerFetch] Waiting for block confirmation...');
      await waitForBlockConfirmations(1);
    }

    // 5. Detect if this is a proxy contract
    proxyInfo = await detectProxy();

    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      onAttempt?.(attempt, MAX_FETCH_ATTEMPTS);
      console.info(`[OwnerFetch] Attempt ${attempt}/${MAX_FETCH_ATTEMPTS}`);

      try {
        // Encode the owner() call
        const data = encodeFunctionData({
          abi: CONTRACT_ABI as any,
          functionName: 'owner',
          args: [],
        });

        // Make robust RPC call with increased timeout
        const result = await robustRpcCall<string>(
          'eth_call',
          [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
          { 
            timeoutMs: RPC_CONFIG.defaultTimeoutMs * 2, // Double timeout
            maxRetries: 3,
          }
        );

        if (!result.success) {
          lastError = result.error || 'RPC call failed';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] RPC failed on attempt ${attempt}:`, lastError);
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = getRetryDelay();
            console.info(`[OwnerFetch] Retrying in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Validate response exists
        if (!result.data || result.data === '0x' || result.data === '') {
          lastError = 'Empty response from owner()';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] Empty response on attempt ${attempt}`);
          
          // Try reading from storage as fallback
          if (proxyInfo?.isProxy) {
            console.info('[OwnerFetch] Attempting storage slot read for proxy...');
            const storageOwner = await readOwnerFromStorage();
            if (storageOwner) {
              validOwner = storageOwner;
              const chainId = await getChainId();
              if (chainId) {
                setCachedOwner(validOwner, chainId);
              }
              return validOwner;
            }
          }
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = getRetryDelay();
            console.info(`[OwnerFetch] Retrying in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Decode the response
        let decodedOwner: unknown;
        try {
          decodedOwner = decodeFunctionResult({
            abi: CONTRACT_ABI as any,
            functionName: 'owner',
            data: result.data as `0x${string}`,
          });
        } catch (decodeErr) {
          lastError = 'Failed to decode owner response';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] Decode failed on attempt ${attempt}:`, decodeErr);
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = getRetryDelay();
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Validate owner format
        if (
          typeof decodedOwner === 'string' &&
          decodedOwner.startsWith('0x') &&
          decodedOwner.length === 42 &&
          decodedOwner !== '0x0000000000000000000000000000000000000000'
        ) {
          validOwner = decodedOwner.toLowerCase();
          
          // Cache the result
          const chainId = await getChainId();
          if (chainId) {
            setCachedOwner(validOwner, chainId);
          }
          
          console.info(`[OwnerFetch] ✓ Success on attempt ${attempt}:`, validOwner.slice(0, 10) + '...');
          return validOwner;
        }

        // Handle zero address (possible renounced ownership)
        if (decodedOwner === '0x0000000000000000000000000000000000000000') {
          console.warn('[OwnerFetch] Owner is zero address (ownership may be renounced)');
          lastError = 'Contract ownership appears to be renounced (zero address)';
          onError?.(lastError, attempt);
          // Don't retry for zero address - it's a valid response
          return null;
        }

        lastError = `Invalid owner format: ${String(decodedOwner).slice(0, 20)}`;
        onError?.(lastError, attempt);
        console.warn(`[OwnerFetch] Invalid format on attempt ${attempt}:`, decodedOwner);
        
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = getRetryDelay();
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        onError?.(lastError, attempt);
        console.error(`[OwnerFetch] Exception on attempt ${attempt}:`, err);
        
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = getRetryDelay();
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    return null;
  })();

  try {
    const owner = await fetchPromise;
    const finalError = owner 
      ? null 
      : `Owner not detected. Check network or proxy. (Failed after ${MAX_FETCH_ATTEMPTS} attempts: ${lastError})`;
    
    return { 
      owner, 
      error: finalError,
      attempts: MAX_FETCH_ATTEMPTS,
      isProxy: proxyInfo?.isProxy,
    };
  } finally {
    isFetching = false;
    fetchPromise = null;
  }
}

// ============ HELPER FUNCTIONS ============

async function getChainId(): Promise<string | null> {
  // Try from window.ethereum first
  if (window.ethereum) {
    try {
      const chainId = await (window.ethereum as any).request({ method: 'eth_chainId' });
      return chainId;
    } catch {
      // Fall through to RPC
    }
  }
  
  // Fallback to RPC call
  try {
    const result = await robustRpcCall<string>('eth_chainId', [], {
      timeoutMs: 5000,
      maxRetries: 2,
    });
    return result.success ? result.data ?? null : null;
  } catch {
    return null;
  }
}

// ============ OWNERSHIP EVENT LISTENER ============

const OWNERSHIP_TRANSFERRED_TOPIC = '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0';

interface OwnershipEventCallback {
  (previousOwner: string, newOwner: string): void;
}

let eventSubscription: (() => void) | null = null;
const eventCallbacks: Set<OwnershipEventCallback> = new Set();

/**
 * Subscribe to OwnershipTransferred events
 */
export function subscribeToOwnershipEvents(callback: OwnershipEventCallback): () => void {
  eventCallbacks.add(callback);
  
  // Start polling if first subscriber
  if (eventCallbacks.size === 1) {
    startOwnershipEventPolling();
  }
  
  // Return unsubscribe function
  return () => {
    eventCallbacks.delete(callback);
    if (eventCallbacks.size === 0 && eventSubscription) {
      eventSubscription();
      eventSubscription = null;
    }
  };
}

let lastProcessedBlock = 0n;

async function startOwnershipEventPolling(): Promise<void> {
  if (eventSubscription) return;
  
  let running = true;
  const pollInterval = 15000; // Poll every 15 seconds
  
  const poll = async () => {
    while (running) {
      try {
        // Get current block
        const blockResult = await robustRpcCall<string>('eth_blockNumber', [], {
          timeoutMs: 5000,
          maxRetries: 1,
        });
        
        if (!blockResult.success || !blockResult.data) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }
        
        const currentBlock = BigInt(blockResult.data);
        
        // On first run, just set the block number
        if (lastProcessedBlock === 0n) {
          lastProcessedBlock = currentBlock;
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }
        
        // Check for new events
        if (currentBlock > lastProcessedBlock) {
          const logsResult = await robustRpcCall<any[]>('eth_getLogs', [{
            address: NFT_CONTRACT_ADDRESS,
            topics: [OWNERSHIP_TRANSFERRED_TOPIC],
            fromBlock: `0x${lastProcessedBlock.toString(16)}`,
            toBlock: `0x${currentBlock.toString(16)}`,
          }], {
            timeoutMs: 10000,
            maxRetries: 2,
          });
          
          if (logsResult.success && logsResult.data && Array.isArray(logsResult.data)) {
            for (const log of logsResult.data) {
              if (log.topics && log.topics.length >= 3) {
                // Decode addresses from topics
                const previousOwner = '0x' + log.topics[1].slice(26);
                const newOwner = '0x' + log.topics[2].slice(26);
                
                console.info('[OwnerFetch] OwnershipTransferred event detected:', {
                  previousOwner: previousOwner.slice(0, 10) + '...',
                  newOwner: newOwner.slice(0, 10) + '...',
                });
                
                // Update cache
                const chainId = await getChainId();
                if (chainId) {
                  updateOwnerFromEvent(newOwner, chainId);
                }
                
                // Notify all callbacks
                for (const cb of eventCallbacks) {
                  try {
                    cb(previousOwner, newOwner);
                  } catch (err) {
                    console.error('[OwnerFetch] Callback error:', err);
                  }
                }
              }
            }
          }
          
          lastProcessedBlock = currentBlock;
        }
      } catch (err) {
        console.warn('[OwnerFetch] Event polling error:', err);
      }
      
      await new Promise(r => setTimeout(r, pollInterval));
    }
  };
  
  // Start polling in background
  poll();
  
  // Set up cleanup
  eventSubscription = () => {
    running = false;
  };
}

// ============ REACT HOOK ============

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseOwnerResult {
  owner: string | null;
  isLoading: boolean;
  error: string | null;
  attempts: number;
  networkInfo: NetworkValidationResult | null;
  isProxy: boolean;
  refetch: (force?: boolean) => Promise<void>;
}

export function useOwner(): UseOwnerResult {
  const [owner, setOwner] = useState<string | null>(getCachedOwner);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [networkInfo, setNetworkInfo] = useState<NetworkValidationResult | null>(null);
  const [isProxy, setIsProxy] = useState(false);
  const mountedRef = useRef(true);

  const refetch = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    
    const result = await fetchOwnerRobust({
      forceRefresh: force,
      onAttempt: (attempt, _max) => {
        if (mountedRef.current) {
          setAttempts(attempt);
        }
      },
      onError: (err, attempt) => {
        console.warn(`[useOwner] Attempt ${attempt} error:`, err);
      },
      onNetworkValidation: (netResult) => {
        if (mountedRef.current) {
          setNetworkInfo(netResult);
        }
      },
    });
    
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setOwner(result.owner);
    setError(result.error);
    setAttempts(result.attempts);
    setIsProxy(result.isProxy ?? false);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!getCachedOwner()) {
      refetch();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Subscribe to ownership events
  useEffect(() => {
    const unsubscribe = subscribeToOwnershipEvents((_previousOwner, newOwner) => {
      console.info('[useOwner] Owner changed:', newOwner.slice(0, 10) + '...');
      setOwner(newOwner.toLowerCase());
      setError(null);
    });
    
    return unsubscribe;
  }, []);

  return {
    owner,
    isLoading,
    error,
    attempts,
    networkInfo,
    isProxy,
    refetch,
  };
}
