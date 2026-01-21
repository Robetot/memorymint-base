// ============================================================
// Robust Multi-RPC Provider for Base Mainnet
// Features: Health monitoring, automatic failover, fail-open design
// ============================================================

// ============ RPC ENDPOINTS ============
// Prioritized list of reliable Base Mainnet endpoints
export const BASE_RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.drpc.org',
  'https://base.publicnode.com',
  'https://base-mainnet.public.blastapi.io',
  'https://1rpc.io/base',
  'https://base.meowrpc.com',
  'https://base.gateway.tenderly.co',
] as const;

const BASE_CHAIN_ID = '0x2105'; // 8453 in hex

// ============ STATE ============
interface EndpointHealth {
  url: string;
  healthy: boolean;
  latencyMs: number | null;
  lastChecked: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

const endpointHealthMap = new Map<string, EndpointHealth>();
let currentEndpointIndex = 0;
let isInitialized = false;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

// Initialize health map
BASE_RPC_ENDPOINTS.forEach((url) => {
  endpointHealthMap.set(url, {
    url,
    healthy: true, // Assume healthy until proven otherwise
    latencyMs: null,
    lastChecked: 0,
    consecutiveFailures: 0,
    totalRequests: 0,
    totalFailures: 0,
  });
});

// ============ CORE FUNCTIONS ============

/**
 * Get the current RPC URL
 */
export function getCurrentRpcUrl(): string {
  return BASE_RPC_ENDPOINTS[currentEndpointIndex];
}

/**
 * Get all endpoint health data
 */
export function getAllEndpointsHealth(): EndpointHealth[] {
  return BASE_RPC_ENDPOINTS.map((url) => endpointHealthMap.get(url)!);
}

/**
 * Get count of healthy endpoints
 */
export function getHealthyEndpointCount(): number {
  return getAllEndpointsHealth().filter((e) => e.healthy).length;
}

/**
 * Force switch to a specific endpoint
 */
export function forceEndpoint(url: string): boolean {
  const index = BASE_RPC_ENDPOINTS.indexOf(url as typeof BASE_RPC_ENDPOINTS[number]);
  if (index !== -1) {
    currentEndpointIndex = index;
    console.log('[RPC] Forced endpoint:', url);
    return true;
  }
  return false;
}

/**
 * Mark current endpoint as failed and rotate to next healthy one
 */
export function markCurrentEndpointFailed(): void {
  const currentUrl = getCurrentRpcUrl();
  const health = endpointHealthMap.get(currentUrl);
  
  if (health) {
    health.consecutiveFailures++;
    health.totalFailures++;
    health.totalRequests++;
    
    // Mark unhealthy after 3 consecutive failures
    if (health.consecutiveFailures >= 3) {
      health.healthy = false;
      console.warn('[RPC] Endpoint marked unhealthy:', currentUrl);
    }
  }
  
  // Rotate to next healthy endpoint
  rotateToNextHealthy();
}

/**
 * Mark a successful request on current endpoint
 */
export function markRequestSuccess(): void {
  const currentUrl = getCurrentRpcUrl();
  const health = endpointHealthMap.get(currentUrl);
  
  if (health) {
    health.consecutiveFailures = 0;
    health.healthy = true;
    health.totalRequests++;
  }
}

/**
 * Rotate to the next healthy endpoint
 */
function rotateToNextHealthy(): void {
  const startIndex = currentEndpointIndex;
  
  for (let i = 1; i <= BASE_RPC_ENDPOINTS.length; i++) {
    const nextIndex = (startIndex + i) % BASE_RPC_ENDPOINTS.length;
    const url = BASE_RPC_ENDPOINTS[nextIndex];
    const health = endpointHealthMap.get(url);
    
    if (health?.healthy) {
      currentEndpointIndex = nextIndex;
      console.log('[RPC] Rotated to:', url);
      return;
    }
  }
  
  // If no healthy endpoint, reset to first
  currentEndpointIndex = 0;
  console.warn('[RPC] No healthy endpoints, resetting to first');
}

// ============ HEALTH CHECK ============

/**
 * Check health of a single endpoint
 */
async function checkEndpointHealth(url: string): Promise<EndpointHealth> {
  const health = endpointHealthMap.get(url)!;
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for correct chain ID
    if (data.result === BASE_CHAIN_ID) {
      health.healthy = true;
      health.latencyMs = latencyMs;
      health.consecutiveFailures = 0;
    } else {
      health.healthy = false;
      health.latencyMs = null;
    }
  } catch {
    health.healthy = false;
    health.latencyMs = null;
    health.consecutiveFailures++;
  }
  
  health.lastChecked = Date.now();
  return health;
}

/**
 * Run health check on all endpoints
 */
export async function runHealthCheck(): Promise<void> {
  console.log('[RPC] Running health check on all endpoints...');
  
  const results = await Promise.all(
    BASE_RPC_ENDPOINTS.map((url) => checkEndpointHealth(url))
  );
  
  const healthyCount = results.filter((r) => r.healthy).length;
  console.log(`[RPC] Health check complete: ${healthyCount}/${results.length} endpoints healthy`);
  
  // Find fastest healthy endpoint
  const fastestHealthy = results
    .filter((r) => r.healthy && r.latencyMs !== null)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))[0];
  
  if (fastestHealthy) {
    const index = BASE_RPC_ENDPOINTS.indexOf(fastestHealthy.url as typeof BASE_RPC_ENDPOINTS[number]);
    if (index !== -1 && index !== currentEndpointIndex) {
      currentEndpointIndex = index;
      console.log(`[RPC] Best endpoint: ${fastestHealthy.url} (${fastestHealthy.latencyMs}ms)`);
    }
  }
}

/**
 * Initialize the RPC provider
 */
export async function initializeRpcProvider(): Promise<void> {
  if (isInitialized) return;
  
  await runHealthCheck();
  
  // Set up periodic health checks (every 60 seconds)
  if (!healthCheckInterval) {
    healthCheckInterval = setInterval(() => {
      runHealthCheck();
    }, 60000);
  }
  
  isInitialized = true;
}

// ============ RPC CALL WITH FAILOVER ============

export interface RpcCallOptions {
  timeout?: number;
  failOpen?: boolean; // Return null instead of throwing on failure
  skipRetryOnRevert?: boolean;
}

export interface RpcCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  endpoint?: string;
}

/**
 * Execute an RPC call with automatic failover
 */
export async function executeWithFallback<T = unknown>(
  method: string,
  params: unknown[],
  options: RpcCallOptions = {}
): Promise<RpcCallResult<T>> {
  const { timeout = 8000, skipRetryOnRevert = true } = options;
  const errors: string[] = [];
  const triedEndpoints = new Set<string>();
  
  // Try all endpoints, starting with healthy ones
  const sortedEndpoints = [...BASE_RPC_ENDPOINTS].sort((a, b) => {
    const healthA = endpointHealthMap.get(a);
    const healthB = endpointHealthMap.get(b);
    
    // Healthy endpoints first
    if (healthA?.healthy && !healthB?.healthy) return -1;
    if (!healthA?.healthy && healthB?.healthy) return 1;
    
    // Then by latency
    const latA = healthA?.latencyMs ?? Infinity;
    const latB = healthB?.latencyMs ?? Infinity;
    return latA - latB;
  });
  
  for (const endpoint of sortedEndpoints) {
    if (triedEndpoints.has(endpoint)) continue;
    triedEndpoints.add(endpoint);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle rate limiting
      if (response.status === 429) {
        errors.push(`${endpoint}: Rate limited`);
        const health = endpointHealthMap.get(endpoint);
        if (health) {
          health.consecutiveFailures++;
          health.totalFailures++;
        }
        continue;
      }
      
      if (!response.ok) {
        errors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Check for RPC error
      if (data.error) {
        const errorMsg = data.error.message || JSON.stringify(data.error);
        
        // Don't retry on contract reverts
        if (skipRetryOnRevert && isContractRevert(data.error)) {
          return { success: false, error: errorMsg, endpoint };
        }
        
        errors.push(`${endpoint}: ${errorMsg}`);
        continue;
      }
      
      // Handle empty/truncated results (treat as retryable)
      if (data.result === '0x' || data.result === undefined) {
        errors.push(`${endpoint}: Empty result`);
        continue;
      }
      
      // Success!
      markRequestSuccess();
      return { success: true, data: data.result as T, endpoint };
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${endpoint}: ${msg}`);
    }
  }
  
  // All endpoints failed
  const errorMessage = `All RPC endpoints failed: ${errors.slice(-3).join('; ')}`;
  console.error('[RPC]', errorMessage);
  
  return { success: false, error: errorMessage };
}

/**
 * Check if an RPC error is a contract revert (shouldn't retry)
 */
function isContractRevert(error: { code?: number; message?: string }): boolean {
  const revertCodes = [-32000, -32003, 3];
  if (error.code && revertCodes.includes(error.code)) return true;
  
  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('revert') ||
    message.includes('execution reverted') ||
    message.includes('insufficient funds') ||
    message.includes('gas required exceeds')
  );
}

// ============ DIAGNOSTICS ============

/**
 * Run full diagnostics and return report
 */
export async function runRpcDiagnostics(): Promise<{
  currentUrl: string;
  healthyCount: number;
  totalCount: number;
  endpoints: EndpointHealth[];
  recommended: string | null;
}> {
  await runHealthCheck();
  
  const endpoints = getAllEndpointsHealth();
  const healthyEndpoints = endpoints.filter((e) => e.healthy);
  const fastestHealthy = healthyEndpoints.sort(
    (a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity)
  )[0];
  
  return {
    currentUrl: getCurrentRpcUrl(),
    healthyCount: healthyEndpoints.length,
    totalCount: endpoints.length,
    endpoints,
    recommended: fastestHealthy?.url ?? null,
  };
}

// ============ CONSOLE DEBUGGING ============

if (typeof window !== 'undefined') {
  // Expose debug functions to console
  (window as any).rpcDebug = () => {
    const endpoints = getAllEndpointsHealth();
    console.log('[RPC Debug] Current endpoint:', getCurrentRpcUrl());
    console.log('[RPC Debug] Healthy count:', getHealthyEndpointCount(), '/', endpoints.length);
    console.table(endpoints.map((e) => ({
      url: new URL(e.url).hostname,
      healthy: e.healthy ? '✅' : '❌',
      latency: e.latencyMs ? `${e.latencyMs}ms` : '-',
      failures: e.consecutiveFailures,
    })));
    return { current: getCurrentRpcUrl(), healthy: getHealthyEndpointCount() };
  };
  
  (window as any).rpcDiagnostics = async () => {
    console.log('[RPC] Running full diagnostics...');
    const report = await runRpcDiagnostics();
    console.log('[RPC] Diagnostics complete:');
    console.log('  Current:', report.currentUrl);
    console.log('  Healthy:', report.healthyCount, '/', report.totalCount);
    console.log('  Recommended:', report.recommended);
    console.table(report.endpoints.map((e) => ({
      url: new URL(e.url).hostname,
      healthy: e.healthy ? '✅' : '❌',
      latency: e.latencyMs ? `${e.latencyMs}ms` : '-',
      failures: e.consecutiveFailures,
    })));
    return report;
  };
  
  (window as any).rpcForce = (url: string) => {
    const success = forceEndpoint(url);
    console.log(success ? `[RPC] Forced to: ${url}` : `[RPC] Invalid endpoint: ${url}`);
    return success;
  };
}
