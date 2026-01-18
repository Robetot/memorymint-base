// ============================================================
// Robust Owner Fetch Utility for MemoryMint Admin Panel
// Features: Retry with exponential backoff, caching, event listening
// ============================================================

import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { NFT_CONTRACT_ADDRESS, CONTRACT_ABI } from '@/contracts/MemoryMintContract';
import { robustRpcCall, RPC_CONFIG } from '@/utils/rpcHandler';

// ============ CACHE CONFIGURATION ============
const OWNER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_FETCH_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 500; // 0.5 seconds

interface OwnerCache {
  owner: string;
  timestamp: number;
  chainId: string;
}

let ownerCache: OwnerCache | null = null;
let isFetching = false;
let fetchPromise: Promise<string | null> | null = null;

// ============ CACHE MANAGEMENT ============

/**
 * Get cached owner if still valid
 */
export function getCachedOwner(): string | null {
  if (!ownerCache) return null;
  
  const now = Date.now();
  if (now - ownerCache.timestamp > OWNER_CACHE_TTL) {
    // Cache expired
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

// ============ CORE FETCH FUNCTION ============

/**
 * Fetch owner with robust retry logic
 * - Uses exponential backoff
 * - Tries multiple RPC endpoints
 * - Validates response format
 */
export async function fetchOwnerRobust(
  options: {
    forceRefresh?: boolean;
    onAttempt?: (attempt: number, maxAttempts: number) => void;
    onError?: (error: string, attempt: number) => void;
  } = {}
): Promise<{ owner: string | null; error: string | null; attempts: number }> {
  const { forceRefresh = false, onAttempt, onError } = options;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedOwner();
    if (cached) {
      console.info('[OwnerFetch] Returning cached owner');
      return { owner: cached, error: null, attempts: 0 };
    }
  }

  // Deduplicate concurrent requests
  if (isFetching && fetchPromise) {
    console.info('[OwnerFetch] Waiting for existing fetch...');
    const result = await fetchPromise;
    return { owner: result, error: result ? null : 'Fetch failed', attempts: 0 };
  }

  isFetching = true;
  let lastError = '';
  let validOwner: string | null = null;

  fetchPromise = (async () => {
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

        // Make robust RPC call with increased timeout for owner
        const result = await robustRpcCall<string>(
          'eth_call',
          [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
          { 
            timeoutMs: RPC_CONFIG.defaultTimeoutMs * 1.5, // Give extra time
            maxRetries: 2, // Let internal retry handle some failures
          }
        );

        if (!result.success) {
          lastError = result.error || 'RPC call failed';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] RPC failed on attempt ${attempt}:`, lastError);
          
          // Exponential backoff before retry
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Validate response exists
        if (!result.data || result.data === '0x' || result.data === '') {
          lastError = 'Empty response from owner()';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] Empty response on attempt ${attempt}`);
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
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
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
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
          
          console.info(`[OwnerFetch] Success on attempt ${attempt}:`, validOwner.slice(0, 10) + '...');
          return validOwner;
        }

        lastError = `Invalid owner format: ${String(decodedOwner).slice(0, 20)}`;
        onError?.(lastError, attempt);
        console.warn(`[OwnerFetch] Invalid format on attempt ${attempt}:`, decodedOwner);
        
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        onError?.(lastError, attempt);
        console.error(`[OwnerFetch] Exception on attempt ${attempt}:`, err);
        
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    return null;
  })();

  try {
    const owner = await fetchPromise;
    return { 
      owner, 
      error: owner ? null : `Failed after ${MAX_FETCH_ATTEMPTS} attempts: ${lastError}`,
      attempts: MAX_FETCH_ATTEMPTS,
    };
  } finally {
    isFetching = false;
    fetchPromise = null;
  }
}

// ============ HELPER FUNCTIONS ============

async function getChainId(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    return await (window.ethereum as any).request({ method: 'eth_chainId' });
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
  refetch: (force?: boolean) => Promise<void>;
}

export function useOwner(): UseOwnerResult {
  const [owner, setOwner] = useState<string | null>(getCachedOwner);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
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
    });
    
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setOwner(result.owner);
    setError(result.error);
    setAttempts(result.attempts);
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
    refetch,
  };
}
