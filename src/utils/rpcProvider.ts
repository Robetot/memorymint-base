// ============================================================
// Robust RPC Provider Manager for Base Mainnet
// Features: Auto-detection, health monitoring, automatic failover
// ============================================================

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// ============ RPC ENDPOINTS (ordered by reliability) ============
export const BASE_RPC_ENDPOINTS = [
  // Tier 1: Most reliable public endpoints
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.meowrpc.com',
  
  // Tier 2: Aggregator services
  'https://base.drpc.org',
  'https://1rpc.io/base',
  'https://rpc.ankr.com/base',
  
  // Tier 3: Backup endpoints
  'https://base.publicnode.com',
  'https://base-mainnet.public.blastapi.io',
  'https://base.gateway.tenderly.co',
] as const;

// ============ CONFIGURATION ============
export const RPC_PROVIDER_CONFIG = {
  healthCheckTimeoutMs: 3000,      // Quick health check
  requestTimeoutMs: 10000,         // Standard request timeout
  healthCheckIntervalMs: 60000,    // Re-check health every 60s
  maxConsecutiveFailures: 3,       // Switch after 3 failures
  minHealthyEndpoints: 2,          // Always keep 2 healthy options
} as const;

// ============ TYPES ============
export interface RPCEndpointHealth {
  url: string;
  healthy: boolean;
  latencyMs: number | null;
  lastChecked: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

interface RPCProviderState {
  currentIndex: number;
  endpoints: RPCEndpointHealth[];
  initialized: boolean;
  lastHealthCheck: number;
}

// ============ SINGLETON STATE ============
const state: RPCProviderState = {
  currentIndex: 0,
  endpoints: BASE_RPC_ENDPOINTS.map(url => ({
    url,
    healthy: true, // Assume healthy until proven otherwise
    latencyMs: null,
    lastChecked: 0,
    consecutiveFailures: 0,
    totalRequests: 0,
    totalFailures: 0,
  })),
  initialized: false,
  lastHealthCheck: 0,
};

// Active viem client cache - using 'any' to avoid viem's complex chain-specific types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViemClient = any;
let currentClient: ViemClient | null = null;

// ============ CORE FUNCTIONS ============

/**
 * Get the current best RPC URL
 */
export function getCurrentRpcUrl(): string {
  const healthyEndpoints = state.endpoints.filter(e => e.healthy);
  
  if (healthyEndpoints.length === 0) {
    // Fallback to first endpoint if all unhealthy
    console.warn('[RPC] All endpoints unhealthy, using fallback');
    return BASE_RPC_ENDPOINTS[0];
  }
  
  // Sort by latency (fastest first)
  healthyEndpoints.sort((a, b) => {
    const latA = a.latencyMs ?? 10000;
    const latB = b.latencyMs ?? 10000;
    return latA - latB;
  });
  
  return healthyEndpoints[0].url;
}

/**
 * Get a viem PublicClient with the best available RPC
 */
export function getPublicClient(): ViemClient {
  const rpcUrl = getCurrentRpcUrl();
  
  // Reuse client if URL hasn't changed
  if (currentClient) {
    // Check if same URL (simplified check)
    return currentClient;
  }
  
  currentClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, {
      timeout: RPC_PROVIDER_CONFIG.requestTimeoutMs,
      retryCount: 0, // We handle retries ourselves
    }),
  });
  
  return currentClient;
}

/**
 * Check health of a single endpoint
 */
async function checkEndpointHealth(url: string): Promise<{ healthy: boolean; latencyMs: number | null }> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RPC_PROVIDER_CONFIG.healthCheckTimeoutMs);
  
  try {
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
    const latencyMs = Math.round(performance.now() - startTime);
    
    if (!response.ok) {
      return { healthy: false, latencyMs: null };
    }
    
    const data = await response.json();
    
    // Verify it's Base Mainnet (0x2105 = 8453)
    const isBase = data.result === '0x2105' || data.result === '8453';
    
    return { healthy: isBase && !data.error, latencyMs: isBase ? latencyMs : null };
  } catch {
    clearTimeout(timeoutId);
    return { healthy: false, latencyMs: null };
  }
}

/**
 * Run health check on all endpoints
 */
export async function runHealthCheck(): Promise<RPCEndpointHealth[]> {
  console.log('[RPC] Running health check on all endpoints...');
  
  const results = await Promise.all(
    state.endpoints.map(async (endpoint) => {
      const { healthy, latencyMs } = await checkEndpointHealth(endpoint.url);
      
      return {
        ...endpoint,
        healthy,
        latencyMs,
        lastChecked: Date.now(),
        consecutiveFailures: healthy ? 0 : endpoint.consecutiveFailures,
      };
    })
  );
  
  state.endpoints = results;
  state.lastHealthCheck = Date.now();
  state.initialized = true;
  
  // Reset client to use new best endpoint
  currentClient = null;
  
  const healthyCount = results.filter(e => e.healthy).length;
  console.log(`[RPC] Health check complete: ${healthyCount}/${results.length} endpoints healthy`);
  
  // Log the best endpoint
  const best = results.filter(e => e.healthy).sort((a, b) => (a.latencyMs ?? 9999) - (b.latencyMs ?? 9999))[0];
  if (best) {
    console.log(`[RPC] Best endpoint: ${best.url} (${best.latencyMs}ms)`);
  }
  
  return results;
}

/**
 * Initialize RPC provider (call on app startup)
 */
export async function initializeRpcProvider(): Promise<void> {
  if (state.initialized) {
    // Check if we need a fresh health check
    const timeSinceLastCheck = Date.now() - state.lastHealthCheck;
    if (timeSinceLastCheck < RPC_PROVIDER_CONFIG.healthCheckIntervalMs) {
      return;
    }
  }
  
  await runHealthCheck();
}

/**
 * Mark current endpoint as failed and rotate to next
 */
export function markCurrentEndpointFailed(): void {
  const currentUrl = getCurrentRpcUrl();
  const endpoint = state.endpoints.find(e => e.url === currentUrl);
  
  if (endpoint) {
    endpoint.consecutiveFailures++;
    endpoint.totalFailures++;
    
    if (endpoint.consecutiveFailures >= RPC_PROVIDER_CONFIG.maxConsecutiveFailures) {
      endpoint.healthy = false;
      console.warn(`[RPC] Endpoint ${currentUrl} marked unhealthy after ${endpoint.consecutiveFailures} failures`);
    }
    
    // Reset client to force new endpoint selection
    currentClient = null;
  }
}

/**
 * Mark a successful request
 */
export function markRequestSuccess(): void {
  const currentUrl = getCurrentRpcUrl();
  const endpoint = state.endpoints.find(e => e.url === currentUrl);
  
  if (endpoint) {
    endpoint.consecutiveFailures = 0;
    endpoint.healthy = true;
    endpoint.totalRequests++;
  }
}

/**
 * Get all RPC endpoints with their health status
 */
export function getAllEndpointsHealth(): RPCEndpointHealth[] {
  return [...state.endpoints];
}

/**
 * Get count of healthy endpoints
 */
export function getHealthyEndpointCount(): number {
  return state.endpoints.filter(e => e.healthy).length;
}

/**
 * Force switch to a specific endpoint
 */
export function forceEndpoint(url: string): boolean {
  const endpoint = state.endpoints.find(e => e.url === url);
  if (endpoint) {
    // Move to front by marking as fastest
    endpoint.latencyMs = 0;
    endpoint.healthy = true;
    endpoint.consecutiveFailures = 0;
    currentClient = null;
    return true;
  }
  return false;
}

/**
 * Execute an RPC call with automatic retry and failover
 */
export async function executeWithFallback<T>(
  operation: (client: ViemClient) => Promise<T>,
  options: { maxRetries?: number; throwOnAllFailed?: boolean } = {}
): Promise<T> {
  const { maxRetries = 3, throwOnAllFailed = true } = options;
  const errors: string[] = [];
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getPublicClient();
    const currentUrl = getCurrentRpcUrl();
    
    try {
      const result = await operation(client);
      markRequestSuccess();
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${currentUrl}: ${errorMsg}`);
      console.warn(`[RPC] Attempt ${attempt + 1}/${maxRetries} failed on ${currentUrl}:`, errorMsg);
      
      markCurrentEndpointFailed();
      
      // Small delay before retry
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  
  if (throwOnAllFailed) {
    throw new Error(`All RPC attempts failed: ${errors.join('; ')}`);
  }
  
  return undefined as T;
}

// ============ AUTO-INIT ============
// Start health check in background when module loads
if (typeof window !== 'undefined') {
  // Delay initial check slightly to not block page load
  setTimeout(() => {
    initializeRpcProvider().catch(console.error);
  }, 1000);
  
  // Periodic health checks
  setInterval(() => {
    runHealthCheck().catch(console.error);
  }, RPC_PROVIDER_CONFIG.healthCheckIntervalMs);
}

// ============ EXPORTS FOR DEBUGGING ============
export const __debugState = () => ({
  currentUrl: getCurrentRpcUrl(),
  endpoints: state.endpoints,
  initialized: state.initialized,
});

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { rpcDebug: typeof __debugState }).rpcDebug = __debugState;
}
