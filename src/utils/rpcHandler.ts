// ============================================================
// Robust RPC Handler for Base Mainnet
// Features: Multiple endpoints, failover, retries, caching
// ============================================================

import { RPC_ENDPOINTS } from '@/contracts/MemoryMintContract';

// ============ CONFIGURATION ============
export const RPC_CONFIG = {
  // Timeouts - increased for large/complex contracts
  defaultTimeoutMs: 15000,         // 15 seconds for contract reads (was 10)
  preflightTimeoutMs: 12000,       // 12 seconds for preflight checks (was 8)
  
  // Retry configuration
  maxRetries: 4,                   // Increased retries for reliability
  baseDelayMs: 1000,               // 1 second initial delay
  maxDelayMs: 8000,                // 8 seconds max delay
  
  // Cache configuration
  contractCodeCacheTTL: 300000,    // 5 minutes for contract code
  
  // Additional RPC endpoints for redundancy
  additionalEndpoints: [
    'https://1rpc.io/base',
    'https://base.publicnode.com',
    'https://rpc.ankr.com/base',
  ] as const,
} as const;

// Combine all endpoints
export const ALL_RPC_ENDPOINTS = [
  ...RPC_ENDPOINTS,
  ...RPC_CONFIG.additionalEndpoints,
] as const;

// ============ TYPES ============
export interface RPCCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  endpoint?: string;
  attempts: number;
  totalTimeMs: number;
}

export interface RPCHealthStatus {
  endpoint: string;
  healthy: boolean;
  latencyMs?: number;
  lastChecked: number;
  failCount: number;
}

// ============ STATE ============
interface ContractCodeCache {
  code: string;
  timestamp: number;
  address: string;
}

const contractCodeCache: Map<string, ContractCodeCache> = new Map();
const endpointHealth: Map<string, RPCHealthStatus> = new Map();

// ============ HELPERS ============

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = RPC_CONFIG.baseDelayMs * Math.pow(2, attempt);
  // Add jitter (±20%)
  const jitter = delay * (0.8 + Math.random() * 0.4);
  return Math.min(jitter, RPC_CONFIG.maxDelayMs);
}

/**
 * Get prioritized endpoints based on health
 */
function getPrioritizedEndpoints(): string[] {
  const endpoints = [...ALL_RPC_ENDPOINTS];
  
  // Sort by health status (healthy first, then by latency)
  return endpoints.sort((a, b) => {
    const healthA = endpointHealth.get(a);
    const healthB = endpointHealth.get(b);
    
    // If no health data, keep original order
    if (!healthA && !healthB) return 0;
    if (!healthA) return 1;
    if (!healthB) return -1;
    
    // Healthy endpoints first
    if (healthA.healthy && !healthB.healthy) return -1;
    if (!healthA.healthy && healthB.healthy) return 1;
    
    // Then by latency
    const latA = healthA.latencyMs ?? 10000;
    const latB = healthB.latencyMs ?? 10000;
    return latA - latB;
  });
}

/**
 * Update endpoint health status
 */
function updateEndpointHealth(
  endpoint: string,
  success: boolean,
  latencyMs?: number
): void {
  const current = endpointHealth.get(endpoint);
  
  endpointHealth.set(endpoint, {
    endpoint,
    healthy: success,
    latencyMs: success ? latencyMs : current?.latencyMs,
    lastChecked: Date.now(),
    failCount: success ? 0 : (current?.failCount ?? 0) + 1,
  });
}

// ============ CORE RPC FUNCTION ============

/**
 * Make an RPC call with retry logic and failover
 */
export async function robustRpcCall<T = unknown>(
  method: string,
  params: unknown[],
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    skipRetryOnUserError?: boolean;
  } = {}
): Promise<RPCCallResult<T>> {
  const {
    timeoutMs = RPC_CONFIG.defaultTimeoutMs,
    maxRetries = RPC_CONFIG.maxRetries,
    skipRetryOnUserError = true,
  } = options;

  const startTime = Date.now();
  const endpoints = getPrioritizedEndpoints();
  const allErrors: string[] = [];
  let totalAttempts = 0;

  // Retry loop
  for (let retry = 0; retry <= maxRetries; retry++) {
    // Try each endpoint
    for (const endpoint of endpoints) {
      totalAttempts++;
      const callStartTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now() + Math.random(),
            method,
            params,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - callStartTime;

        // Handle rate limiting
        if (response.status === 429) {
          allErrors.push(`${endpoint}: Rate limited (429)`);
          updateEndpointHealth(endpoint, false);
          await new Promise(r => setTimeout(r, 500)); // Brief pause
          continue;
        }

        if (!response.ok) {
          allErrors.push(`${endpoint}: HTTP ${response.status}`);
          updateEndpointHealth(endpoint, false);
          continue;
        }

        const data = await response.json();

        // Handle RPC errors
        if (data.error) {
          const errorMsg = data.error.message || JSON.stringify(data.error);
          allErrors.push(`${endpoint}: ${errorMsg}`);
          
          // Don't retry on user/contract errors (revert, out of gas, etc.)
          if (skipRetryOnUserError && isUserError(data.error)) {
            return {
              success: false,
              error: errorMsg,
              endpoint,
              attempts: totalAttempts,
              totalTimeMs: Date.now() - startTime,
            };
          }
          
          updateEndpointHealth(endpoint, false);
          continue;
        }

        // Success!
        updateEndpointHealth(endpoint, true, latencyMs);
        
        return {
          success: true,
          data: data.result as T,
          endpoint,
          attempts: totalAttempts,
          totalTimeMs: Date.now() - startTime,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        
        if (controller.signal.aborted) {
          allErrors.push(`${endpoint}: Timeout after ${timeoutMs}ms`);
        } else {
          allErrors.push(`${endpoint}: ${errorMsg}`);
        }
        
        updateEndpointHealth(endpoint, false);
        continue;
      }
    }

    // If we've exhausted all endpoints, wait before retry
    if (retry < maxRetries) {
      const delay = getBackoffDelay(retry);
      console.warn(`[RPC] All endpoints failed, retrying in ${delay}ms (attempt ${retry + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: `All RPCs failed after ${totalAttempts} attempts: ${allErrors.slice(-5).join('; ')}`,
    attempts: totalAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Check if an RPC error is a user/contract error (shouldn't retry)
 */
function isUserError(error: { code?: number; message?: string }): boolean {
  const userErrorCodes = [
    -32000, // Execution reverted
    -32003, // Transaction rejected
    -32602, // Invalid params
  ];
  
  if (error.code && userErrorCodes.includes(error.code)) {
    return true;
  }
  
  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('revert') ||
    message.includes('insufficient funds') ||
    message.includes('nonce too low') ||
    message.includes('gas required exceeds')
  );
}

// ============ CONTRACT CODE CACHING ============

/**
 * Get contract code with caching
 */
export async function getCachedContractCode(address: string): Promise<string | null> {
  const cacheKey = address.toLowerCase();
  const cached = contractCodeCache.get(cacheKey);
  
  // Check cache
  if (cached && Date.now() - cached.timestamp < RPC_CONFIG.contractCodeCacheTTL) {
    console.info('[RPC] Using cached contract code for', address);
    return cached.code;
  }
  
  // Fetch fresh
  const result = await robustRpcCall<string>('eth_getCode', [address, 'latest'], {
    timeoutMs: RPC_CONFIG.preflightTimeoutMs,
  });
  
  if (result.success && result.data) {
    contractCodeCache.set(cacheKey, {
      code: result.data,
      timestamp: Date.now(),
      address,
    });
    return result.data;
  }
  
  return null;
}

/**
 * Verify contract exists with caching
 */
export async function verifyContractWithCache(address: string): Promise<{
  exists: boolean;
  code?: string;
  error?: string;
}> {
  const code = await getCachedContractCode(address);
  
  if (!code) {
    return {
      exists: false,
      error: 'Failed to fetch contract code',
    };
  }
  
  if (code === '0x' || code === '0x0' || code === '') {
    return {
      exists: false,
      error: `No contract at ${address}`,
    };
  }
  
  return {
    exists: true,
    code,
  };
}

// ============ CACHE MANAGEMENT ============

/**
 * Clear contract code cache
 */
export function clearContractCodeCache(address?: string): void {
  if (address) {
    contractCodeCache.delete(address.toLowerCase());
  } else {
    contractCodeCache.clear();
  }
}

/**
 * Clear endpoint health data
 */
export function clearEndpointHealth(): void {
  endpointHealth.clear();
}

/**
 * Get current endpoint health status
 */
export function getEndpointHealthStatus(): RPCHealthStatus[] {
  return Array.from(endpointHealth.values());
}

// ============ HEALTH CHECK ============

/**
 * Run health check on all endpoints
 */
export async function checkAllEndpointsHealth(): Promise<RPCHealthStatus[]> {
  const results = await Promise.all(
    ALL_RPC_ENDPOINTS.map(async (endpoint) => {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_chainId',
            params: [],
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          const healthy = !data.error && data.result === '0x2105';
          
          updateEndpointHealth(endpoint, healthy, healthy ? latencyMs : undefined);
          return endpointHealth.get(endpoint)!;
        }
        
        updateEndpointHealth(endpoint, false);
        return endpointHealth.get(endpoint)!;
      } catch {
        clearTimeout(timeoutId);
        updateEndpointHealth(endpoint, false);
        return endpointHealth.get(endpoint)!;
      }
    })
  );
  
  return results;
}
