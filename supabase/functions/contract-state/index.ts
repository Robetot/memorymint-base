/**
 * ============================================================================
 * LOVABLE PRODUCTION CONTRACT STATE FETCHER v2.0
 * ============================================================================
 * 
 * Features:
 * - Full contract state reading (toggles, pricing, levels, tiers, bonuses)
 * - RPC circuit breaker with half-open retry logic
 * - Selective fetching via GET/POST parameters
 * - Automatic snapshot creation with versioning
 * - Comprehensive metrics tracking
 * - Health monitoring and endpoint prioritization
 * - Parallel batch fetching for performance
 * - Type-safe with full error handling
 * 
 * Deploy to: Supabase Edge Functions or Deno Deploy
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { 
  encodeFunctionData, 
  decodeFunctionResult, 
  parseAbi,
  type Abi 
} from "npm:viem@2.41.2";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  CONTRACT_ADDRESS: "0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0" as const,
  
  RPC_ENDPOINTS: [
    { url: "https://mainnet.base.org", priority: 10 },
    { url: "https://base.publicnode.com", priority: 9 },
    { url: "https://base.gateway.tenderly.co", priority: 8 },
    { url: "https://base.llamarpc.com", priority: 7 },
    { url: "https://base.drpc.org", priority: 6 },
    { url: "https://1rpc.io/base", priority: 5 },
    { url: "https://base-mainnet.public.blastapi.io", priority: 4 },
    { url: "https://base.meowrpc.com", priority: 3 },
  ],
  
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 3,           // Open circuit after N consecutive failures
    TIMEOUT_MS: 60000,              // Keep circuit open for 60 seconds
    HALF_OPEN_SUCCESS_THRESHOLD: 3, // Close circuit after N consecutive successes
  },
  
  TIMEOUTS: {
    RPC_CALL_MS: 8000,
    TOTAL_OPERATION_MS: 120000,
  },
  
  DEFAULTS: {
    MAX_LEVELS: 20,
    MAX_TIERS: 5,
  },
  
  CACHE: {
    RPC_HEALTH_TTL_MS: 30000,  // 30 seconds
    CONFIG_TTL_MS: 60000,       // 1 minute
  },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

// ============================================================================
// CONTRACT ABI
// ============================================================================

const CONTRACT_ABI = parseAbi([
  // Core toggles
  "function isMintActive() view returns (bool)",
  "function mintPaused() view returns (bool)",
  "function freeMintActive() view returns (bool)",
  "function isFreeMint() view returns (bool)",
  "function killSwitch() view returns (bool)",
  "function isKillSwitchActive() view returns (bool)",
  "function bonusClaimActive() view returns (bool)",
  "function bonusLevelsEnabled() view returns (bool)",
  "function dynamicPricingEnabled() view returns (bool)",
  "function dynamicBonusEnabled() view returns (bool)",
  "function allowBonusDeposit() view returns (bool)",
  "function withdrawFeesEnabled() view returns (bool)",
  "function ownershipTransferEnabled() view returns (bool)",
  "function throttleEnabled() view returns (bool)",
  
  // Pricing & stats
  "function mintCurrency() view returns (uint8)",
  "function mintPriceETH() view returns (uint256)",
  "function mintPriceUSDC() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function owner() view returns (address)",
  
  // Bonus pools
  "function bonusPoolETH() view returns (uint256)",
  "function bonusPoolUSDC() view returns (uint256)",
  
  // Dynamic pricing by level
  "function levelPrices(uint8 level) view returns (uint256 priceETH, uint256 priceUSDC, bool active)",
  "function levelBonuses(uint8 level) view returns (uint256 bonusETH, uint256 bonusUSDC, bool active)",
  
  // Dynamic pricing by supply
  "function supplyPriceTiers(uint8 tier) view returns (uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC, bool enabled)",
  "function supplyBonusTiers(uint8 tier) view returns (uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC, bool enabled)",
]) as Abi;

// ============================================================================
// TYPES
// ============================================================================

interface ContractState {
  toggles: {
    isMintActive: boolean;
    mintPaused: boolean;
    freeMintActive: boolean;
    isFreeMint: boolean;
    killSwitch: boolean;
    isKillSwitchActive: boolean;
    bonusClaimActive: boolean;
    bonusLevelsEnabled: boolean;
    dynamicPricingEnabled: boolean;
    dynamicBonusEnabled: boolean;
    allowBonusDeposit: boolean;
    withdrawFeesEnabled: boolean;
    ownershipTransferEnabled: boolean;
    throttleEnabled: boolean;
  };
  pricing: {
    mintCurrency: number;
    mintPriceETH: string;
    mintPriceUSDC: string;
  };
  stats: {
    totalMinted: string;
    maxSupply: string;
    owner: string;
  };
  bonusPools: {
    bonusPoolETH: string;
    bonusPoolUSDC: string;
  };
  levelPrices?: Record<number, { priceETH: string; priceUSDC: string; active: boolean }>;
  levelBonuses?: Record<number, { bonusETH: string; bonusUSDC: string; active: boolean }>;
  supplyPriceTiers?: Record<number, { minSupply: string; maxSupply: string; priceETH: string; priceUSDC: string; enabled: boolean }>;
  supplyBonusTiers?: Record<number, { minSupply: string; maxSupply: string; bonusETH: string; bonusUSDC: string; enabled: boolean }>;
}

interface FetchOptions {
  includeCore?: boolean;
  includeLevels?: boolean;
  includeTiers?: boolean;
  maxLevels?: number;
  maxTiers?: number;
  specificLevels?: number[];
  specificTiers?: number[];
  createSnapshot?: boolean;
  snapshotType?: string;
  snapshotTags?: string[];
  snapshotDescription?: string;
  requestedBy?: string;
}

interface RpcEndpointHealth {
  endpoint: string;
  status: "healthy" | "degraded" | "failed" | "circuit_open";
  priority: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  avgResponseTimeMs: number | null;
  lastSuccess: string | null;
  lastFailure: string | null;
  circuitBreakerOpenedAt: string | null;
  enabled: boolean;
}

interface RpcCallResult {
  success: boolean;
  data?: `0x${string}`;
  endpoint?: string;
  responseTime?: number;
  error?: string;
}

interface FetchMetrics {
  totalDurationMs: number;
  rpcCallCount: number;
  successfulRpcCalls: number;
  failedRpcCalls: number;
  endpointsUsed: string[];
  cacheHits: number;
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

let supabaseClient: ReturnType<typeof createClient> | null = null;
let rpcHealthCache: RpcEndpointHealth[] | null = null;
let rpcHealthCacheTime = 0;
let lastSuccessfulEndpoint: string | null = null;

// Metrics for this request
let requestMetrics: FetchMetrics = {
  totalDurationMs: 0,
  rpcCallCount: 0,
  successfulRpcCalls: 0,
  failedRpcCalls: 0,
  endpointsUsed: [],
  cacheHits: 0,
};

function resetMetrics() {
  requestMetrics = {
    totalDurationMs: 0,
    rpcCallCount: 0,
    successfulRpcCalls: 0,
    failedRpcCalls: 0,
    endpointsUsed: [],
    cacheHits: 0,
  };
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

// ============================================================================
// RPC HEALTH MANAGEMENT
// ============================================================================

async function getRpcHealth(): Promise<RpcEndpointHealth[]> {
  const now = Date.now();
  
  // Return cached health if fresh
  if (rpcHealthCache && (now - rpcHealthCacheTime) < CONFIG.CACHE.RPC_HEALTH_TTL_MS) {
    requestMetrics.cacheHits++;
    return rpcHealthCache;
  }
  
  const supabase = getSupabase();
  
  try {
    const { data, error } = await supabase
      .from("rpc_health")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: false });
    
    if (error) {
      console.warn("Failed to fetch RPC health from database:", error);
      return initializeDefaultRpcHealth();
    }
    
    if (!data || data.length === 0) {
      console.warn("No RPC health data found, initializing defaults");
      return initializeDefaultRpcHealth();
    }
    
    rpcHealthCache = data.map((row: Record<string, unknown>) => ({
      endpoint: row.endpoint as string,
      status: row.status as RpcEndpointHealth["status"],
      priority: (row.priority as number) ?? 0,
      consecutiveFailures: (row.consecutive_failures as number) ?? 0,
      consecutiveSuccesses: (row.consecutive_successes as number) ?? 0,
      avgResponseTimeMs: row.avg_response_time_ms as number | null,
      lastSuccess: row.last_success as string | null,
      lastFailure: row.last_failure as string | null,
      circuitBreakerOpenedAt: row.circuit_breaker_opened_at as string | null,
      enabled: (row.enabled as boolean) ?? true,
    }));
    
    rpcHealthCacheTime = now;
    return rpcHealthCache;
  } catch (err) {
    console.error("Exception fetching RPC health:", err);
    return initializeDefaultRpcHealth();
  }
}

function initializeDefaultRpcHealth(): RpcEndpointHealth[] {
  return CONFIG.RPC_ENDPOINTS.map(ep => ({
    endpoint: ep.url,
    status: "healthy" as const,
    priority: ep.priority,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgResponseTimeMs: null,
    lastSuccess: null,
    lastFailure: null,
    circuitBreakerOpenedAt: null,
    enabled: true,
  }));
}

async function updateRpcHealth(
  endpoint: string,
  success: boolean,
  responseTimeMs?: number,
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  
  try {
    const { data: existing } = await supabase
      .from("rpc_health")
      .select("*")
      .eq("endpoint", endpoint)
      .single();
    
    if (!existing) {
      // Insert new record
      await supabase.from("rpc_health").insert({
        endpoint,
        status: success ? "healthy" : "failed",
        priority: CONFIG.RPC_ENDPOINTS.find(ep => ep.url === endpoint)?.priority ?? 0,
        last_success: success ? now : null,
        last_failure: success ? null : now,
        consecutive_failures: success ? 0 : 1,
        consecutive_successes: success ? 1 : 0,
        avg_response_time_ms: responseTimeMs ?? null,
        p95_response_time_ms: responseTimeMs ?? null,
        total_calls: 1,
        successful_calls: success ? 1 : 0,
        failed_calls: success ? 0 : 1,
        enabled: true,
      });
      
      rpcHealthCache = null; // Invalidate cache
      return;
    }
    
    // Update existing record
    const updates: Record<string, unknown> = {
      total_calls: (existing.total_calls as number) + 1,
      updated_at: now,
    };
    
    if (success) {
      updates.last_success = now;
      updates.consecutive_failures = 0;
      updates.consecutive_successes = (existing.consecutive_successes as number) + 1;
      updates.successful_calls = (existing.successful_calls as number) + 1;
      
      // Check if we should close circuit breaker
      if (
        existing.status === "circuit_open" && 
        (updates.consecutive_successes as number) >= CONFIG.CIRCUIT_BREAKER.HALF_OPEN_SUCCESS_THRESHOLD
      ) {
        updates.status = "healthy";
        updates.circuit_breaker_opened_at = null;
        updates.circuit_breaker_attempts = 0;
      } else if (existing.status !== "circuit_open") {
        updates.status = "healthy";
      }
      
      // Update average response time (exponential moving average)
      if (responseTimeMs !== undefined) {
        const alpha = 0.3;
        updates.avg_response_time_ms = existing.avg_response_time_ms
          ? alpha * responseTimeMs + (1 - alpha) * (existing.avg_response_time_ms as number)
          : responseTimeMs;
        
        // Update p95 (simplified - use max of recent)
        updates.p95_response_time_ms = Math.max(
          (existing.p95_response_time_ms as number) ?? 0,
          responseTimeMs
        );
      }
    } else {
      updates.last_failure = now;
      updates.consecutive_successes = 0;
      updates.consecutive_failures = (existing.consecutive_failures as number) + 1;
      updates.failed_calls = (existing.failed_calls as number) + 1;
      
      // Circuit breaker logic
      if ((updates.consecutive_failures as number) >= CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
        updates.status = "circuit_open";
        updates.circuit_breaker_opened_at = now;
        updates.circuit_breaker_attempts = ((existing.circuit_breaker_attempts as number) ?? 0) + 1;
      } else if ((updates.consecutive_failures as number) >= 2) {
        updates.status = "degraded";
      } else {
        updates.status = "failed";
      }
      
      // Store error in metadata
      if (errorMessage) {
        updates.metadata = {
          ...(existing.metadata as Record<string, unknown> || {}),
          last_error: errorMessage,
          last_error_time: now,
        };
      }
    }
    
    await supabase.from("rpc_health").update(updates).eq("endpoint", endpoint);
    
    rpcHealthCache = null; // Invalidate cache
  } catch (err) {
    console.error(`Failed to update RPC health for ${endpoint}:`, err);
  }
}

function getHealthyEndpoints(rpcHealth: RpcEndpointHealth[]): string[] {
  const now = Date.now();
  const healthyEndpoints: string[] = [];
  
  // Prioritize last successful endpoint
  if (lastSuccessfulEndpoint) {
    const lastEndpoint = rpcHealth.find(ep => ep.endpoint === lastSuccessfulEndpoint);
    if (lastEndpoint && lastEndpoint.enabled && lastEndpoint.status !== "circuit_open") {
      healthyEndpoints.push(lastSuccessfulEndpoint);
    }
  }
  
  for (const endpoint of rpcHealth) {
    if (!endpoint.enabled) continue;
    if (healthyEndpoints.includes(endpoint.endpoint)) continue;
    
    // If circuit is open, check if timeout has passed
    if (endpoint.status === "circuit_open" && endpoint.circuitBreakerOpenedAt) {
      const openedAt = new Date(endpoint.circuitBreakerOpenedAt).getTime();
      const elapsed = now - openedAt;
      
      // Allow retry in half-open state after timeout
      if (elapsed >= CONFIG.CIRCUIT_BREAKER.TIMEOUT_MS) {
        healthyEndpoints.push(endpoint.endpoint);
      }
    } else if (endpoint.status === "healthy" || endpoint.status === "degraded") {
      healthyEndpoints.push(endpoint.endpoint);
    }
  }
  
  return healthyEndpoints;
}

// ============================================================================
// RPC CALL WITH CIRCUIT BREAKER
// ============================================================================

async function robustEthCall(callData: `0x${string}`): Promise<RpcCallResult> {
  const rpcHealth = await getRpcHealth();
  const healthyEndpoints = getHealthyEndpoints(rpcHealth);
  
  if (healthyEndpoints.length === 0) {
    return {
      success: false,
      error: "All RPC endpoints are unhealthy or circuit breakers are open",
    };
  }
  
  const errors: Array<{ endpoint: string; error: string; time: number }> = [];
  
  for (const endpoint of healthyEndpoints) {
    requestMetrics.rpcCallCount++;
    
    if (!requestMetrics.endpointsUsed.includes(endpoint)) {
      requestMetrics.endpointsUsed.push(endpoint);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUTS.RPC_CALL_MS);
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_call",
          params: [
            {
              to: CONFIG.CONTRACT_ADDRESS,
              data: callData,
            },
            "latest",
          ],
        }),
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        errors.push({ endpoint, error: errorMsg, time: responseTime });
        requestMetrics.failedRpcCalls++;
        await updateRpcHealth(endpoint, false, responseTime, errorMsg);
        continue;
      }
      
      const json = await response.json();
      
      // Check for JSON-RPC error
      if (json.error) {
        const errorMsg = json.error.message ?? JSON.stringify(json.error);
        errors.push({ endpoint, error: errorMsg, time: responseTime });
        requestMetrics.failedRpcCalls++;
        await updateRpcHealth(endpoint, false, responseTime, errorMsg);
        continue;
      }
      
      // Validate result
      const result = json.result;
      if (typeof result !== "string" || !result.startsWith("0x")) {
        const errorMsg = "Invalid result format";
        errors.push({ endpoint, error: errorMsg, time: responseTime });
        requestMetrics.failedRpcCalls++;
        await updateRpcHealth(endpoint, false, responseTime, errorMsg);
        continue;
      }
      
      if (result === "0x") {
        const errorMsg = "Empty result (0x)";
        errors.push({ endpoint, error: errorMsg, time: responseTime });
        requestMetrics.failedRpcCalls++;
        await updateRpcHealth(endpoint, false, responseTime, errorMsg);
        continue;
      }
      
      // Success!
      requestMetrics.successfulRpcCalls++;
      lastSuccessfulEndpoint = endpoint;
      await updateRpcHealth(endpoint, true, responseTime);
      
      return {
        success: true,
        data: result as `0x${string}`,
        endpoint,
        responseTime,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      errors.push({ endpoint, error: errorMsg, time: responseTime });
      requestMetrics.failedRpcCalls++;
      await updateRpcHealth(endpoint, false, responseTime, errorMsg);
    }
  }
  
  // All endpoints failed
  const errorSummary = errors
    .map(e => `${e.endpoint}: ${e.error} (${e.time}ms)`)
    .join("; ");
  
  return {
    success: false,
    error: `All ${errors.length} RPC endpoints failed: ${errorSummary}`,
  };
}

// ============================================================================
// CONTRACT READERS
// ============================================================================

type BoolFunction = 
  | "isMintActive" 
  | "mintPaused" 
  | "freeMintActive" 
  | "isFreeMint" 
  | "killSwitch" 
  | "isKillSwitchActive" 
  | "bonusClaimActive" 
  | "bonusLevelsEnabled" 
  | "dynamicPricingEnabled" 
  | "dynamicBonusEnabled" 
  | "allowBonusDeposit" 
  | "withdrawFeesEnabled" 
  | "ownershipTransferEnabled" 
  | "throttleEnabled";

type Uint256Function = 
  | "mintCurrency" 
  | "mintPriceETH" 
  | "mintPriceUSDC" 
  | "totalMinted" 
  | "maxSupply" 
  | "bonusPoolETH" 
  | "bonusPoolUSDC";

type AddressFunction = "owner";

async function readBool(functionName: BoolFunction): Promise<boolean> {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName,
      args: [],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      console.error(`Failed to read ${functionName}:`, result.error);
      return false;
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName,
      data: result.data,
    });
    
    return decoded as boolean;
  } catch (err) {
    console.error(`Exception reading ${functionName}:`, err);
    return false;
  }
}

async function readUint256(functionName: Uint256Function): Promise<string> {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName,
      args: [],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      console.error(`Failed to read ${functionName}:`, result.error);
      return "0";
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName,
      data: result.data,
    });
    
    return String(decoded);
  } catch (err) {
    console.error(`Exception reading ${functionName}:`, err);
    return "0";
  }
}

async function readAddress(functionName: AddressFunction): Promise<string> {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName,
      args: [],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      console.error(`Failed to read ${functionName}:`, result.error);
      return "0x0000000000000000000000000000000000000000";
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName,
      data: result.data,
    });
    
    return decoded as string;
  } catch (err) {
    console.error(`Exception reading ${functionName}:`, err);
    return "0x0000000000000000000000000000000000000000";
  }
}

async function readLevelPrice(level: number) {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "levelPrices",
      args: [level],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      return { priceETH: "0", priceUSDC: "0", active: false };
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName: "levelPrices",
      data: result.data,
    }) as [bigint, bigint, boolean];
    
    return {
      priceETH: String(decoded[0]),
      priceUSDC: String(decoded[1]),
      active: decoded[2],
    };
  } catch (err) {
    console.error(`Exception reading levelPrices[${level}]:`, err);
    return { priceETH: "0", priceUSDC: "0", active: false };
  }
}

async function readLevelBonus(level: number) {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "levelBonuses",
      args: [level],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      return { bonusETH: "0", bonusUSDC: "0", active: false };
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName: "levelBonuses",
      data: result.data,
    }) as [bigint, bigint, boolean];
    
    return {
      bonusETH: String(decoded[0]),
      bonusUSDC: String(decoded[1]),
      active: decoded[2],
    };
  } catch (err) {
    console.error(`Exception reading levelBonuses[${level}]:`, err);
    return { bonusETH: "0", bonusUSDC: "0", active: false };
  }
}

async function readSupplyPriceTier(tier: number) {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "supplyPriceTiers",
      args: [tier],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      return { minSupply: "0", maxSupply: "0", priceETH: "0", priceUSDC: "0", enabled: false };
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName: "supplyPriceTiers",
      data: result.data,
    }) as [bigint, bigint, bigint, bigint, boolean];
    
    return {
      minSupply: String(decoded[0]),
      maxSupply: String(decoded[1]),
      priceETH: String(decoded[2]),
      priceUSDC: String(decoded[3]),
      enabled: decoded[4],
    };
  } catch (err) {
    console.error(`Exception reading supplyPriceTiers[${tier}]:`, err);
    return { minSupply: "0", maxSupply: "0", priceETH: "0", priceUSDC: "0", enabled: false };
  }
}

async function readSupplyBonusTier(tier: number) {
  try {
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "supplyBonusTiers",
      args: [tier],
    });
    
    const result = await robustEthCall(callData as `0x${string}`);
    
    if (!result.success || !result.data) {
      return { minSupply: "0", maxSupply: "0", bonusETH: "0", bonusUSDC: "0", enabled: false };
    }
    
    const decoded = decodeFunctionResult({
      abi: CONTRACT_ABI,
      functionName: "supplyBonusTiers",
      data: result.data,
    }) as [bigint, bigint, bigint, bigint, boolean];
    
    return {
      minSupply: String(decoded[0]),
      maxSupply: String(decoded[1]),
      bonusETH: String(decoded[2]),
      bonusUSDC: String(decoded[3]),
      enabled: decoded[4],
    };
  } catch (err) {
    console.error(`Exception reading supplyBonusTiers[${tier}]:`, err);
    return { minSupply: "0", maxSupply: "0", bonusETH: "0", bonusUSDC: "0", enabled: false };
  }
}

// ============================================================================
// STATE FETCHING
// ============================================================================

async function fetchContractState(options: FetchOptions): Promise<ContractState> {
  const {
    includeCore = true,
    includeLevels = true,
    includeTiers = true,
    maxLevels = CONFIG.DEFAULTS.MAX_LEVELS,
    maxTiers = CONFIG.DEFAULTS.MAX_TIERS,
    specificLevels,
    specificTiers,
  } = options;
  
  const state: Partial<ContractState> = {};
  
  // Fetch core state in parallel
  if (includeCore) {
    const [
      isMintActive, mintPaused, freeMintActive, isFreeMint,
      killSwitch, isKillSwitchActive, bonusClaimActive, bonusLevelsEnabled,
      dynamicPricingEnabled, dynamicBonusEnabled, allowBonusDeposit, withdrawFeesEnabled,
      ownershipTransferEnabled, throttleEnabled,
      mintCurrency, mintPriceETH, mintPriceUSDC,
      totalMinted, maxSupply, owner,
      bonusPoolETH, bonusPoolUSDC,
    ] = await Promise.all([
      readBool("isMintActive"),
      readBool("mintPaused"),
      readBool("freeMintActive"),
      readBool("isFreeMint"),
      readBool("killSwitch"),
      readBool("isKillSwitchActive"),
      readBool("bonusClaimActive"),
      readBool("bonusLevelsEnabled"),
      readBool("dynamicPricingEnabled"),
      readBool("dynamicBonusEnabled"),
      readBool("allowBonusDeposit"),
      readBool("withdrawFeesEnabled"),
      readBool("ownershipTransferEnabled"),
      readBool("throttleEnabled"),
      readUint256("mintCurrency"),
      readUint256("mintPriceETH"),
      readUint256("mintPriceUSDC"),
      readUint256("totalMinted"),
      readUint256("maxSupply"),
      readAddress("owner"),
      readUint256("bonusPoolETH"),
      readUint256("bonusPoolUSDC"),
    ]);
    
    state.toggles = {
      isMintActive, mintPaused, freeMintActive, isFreeMint,
      killSwitch, isKillSwitchActive, bonusClaimActive, bonusLevelsEnabled,
      dynamicPricingEnabled, dynamicBonusEnabled, allowBonusDeposit, withdrawFeesEnabled,
      ownershipTransferEnabled, throttleEnabled,
    };
    
    state.pricing = {
      mintCurrency: Number(mintCurrency),
      mintPriceETH,
      mintPriceUSDC,
    };
    
    state.stats = {
      totalMinted,
      maxSupply,
      owner,
    };
    
    state.bonusPools = {
      bonusPoolETH,
      bonusPoolUSDC,
    };
  }
  
  // Fetch level data in parallel
  if (includeLevels) {
    const levelsToFetch = specificLevels ?? Array.from({ length: maxLevels }, (_, i) => i + 1);
    
    const [levelPriceResults, levelBonusResults] = await Promise.all([
      Promise.all(levelsToFetch.map(level => readLevelPrice(level))),
      Promise.all(levelsToFetch.map(level => readLevelBonus(level))),
    ]);
    
    state.levelPrices = {};
    state.levelBonuses = {};
    
    levelsToFetch.forEach((level, index) => {
      state.levelPrices![level] = levelPriceResults[index];
      state.levelBonuses![level] = levelBonusResults[index];
    });
  }
  
  // Fetch tier data in parallel
  if (includeTiers) {
    const tiersToFetch = specificTiers ?? Array.from({ length: maxTiers }, (_, i) => i);
    
    const [supplyPriceResults, supplyBonusResults] = await Promise.all([
      Promise.all(tiersToFetch.map(tier => readSupplyPriceTier(tier))),
      Promise.all(tiersToFetch.map(tier => readSupplyBonusTier(tier))),
    ]);
    
    state.supplyPriceTiers = {};
    state.supplyBonusTiers = {};
    
    tiersToFetch.forEach((tier, index) => {
      state.supplyPriceTiers![tier] = supplyPriceResults[index];
      state.supplyBonusTiers![tier] = supplyBonusResults[index];
    });
  }
  
  return state as ContractState;
}

// ============================================================================
// SNAPSHOT MANAGEMENT
// ============================================================================

async function createSnapshot(
  state: ContractState,
  options: FetchOptions,
  durationMs: number
): Promise<{ id: string; version: number } | null> {
  if (!options.createSnapshot) return null;
  
  const supabase = getSupabase();
  
  try {
    // Get next version number
    const { data: latestSnapshot } = await supabase
      .from("contract_state_snapshots")
      .select("version")
      .eq("snapshot_type", options.snapshotType ?? "manual")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const latestVersion = (latestSnapshot as { version: number } | null)?.version ?? 0;
    const nextVersion = latestVersion + 1;
    
    const { data, error } = await supabase
      .from("contract_state_snapshots")
      .insert({
        snapshot_type: options.snapshotType ?? "manual",
        version: nextVersion,
        state: state,
        tags: options.snapshotTags ?? [],
        description: options.snapshotDescription,
        requested_by: options.requestedBy,
        rpc_endpoint_used: lastSuccessfulEndpoint,
        fetch_duration_ms: durationMs,
      })
      .select("id, version")
      .single();
    
    if (error) {
      console.error("Failed to create snapshot:", error);
      return null;
    }
    
    return data as { id: string; version: number };
  } catch (err) {
    console.error("Exception creating snapshot:", err);
    return null;
  }
}

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

function parseOptions(url: URL, body?: Record<string, unknown>): FetchOptions {
  const options: FetchOptions = {};
  
  // Parse from URL params
  const includeCore = url.searchParams.get("includeCore");
  const includeLevels = url.searchParams.get("includeLevels");
  const includeTiers = url.searchParams.get("includeTiers");
  const maxLevels = url.searchParams.get("maxLevels");
  const maxTiers = url.searchParams.get("maxTiers");
  const specificLevels = url.searchParams.get("levels");
  const specificTiers = url.searchParams.get("tiers");
  const createSnapshot = url.searchParams.get("createSnapshot");
  const snapshotType = url.searchParams.get("snapshotType");
  const snapshotTags = url.searchParams.get("snapshotTags");
  const snapshotDescription = url.searchParams.get("snapshotDescription");
  const requestedBy = url.searchParams.get("requestedBy");
  
  if (includeCore !== null) options.includeCore = includeCore !== "false";
  if (includeLevels !== null) options.includeLevels = includeLevels !== "false";
  if (includeTiers !== null) options.includeTiers = includeTiers !== "false";
  if (maxLevels) options.maxLevels = parseInt(maxLevels, 10);
  if (maxTiers) options.maxTiers = parseInt(maxTiers, 10);
  if (specificLevels) options.specificLevels = specificLevels.split(",").map(s => parseInt(s, 10));
  if (specificTiers) options.specificTiers = specificTiers.split(",").map(s => parseInt(s, 10));
  if (createSnapshot !== null) options.createSnapshot = createSnapshot === "true";
  if (snapshotType) options.snapshotType = snapshotType;
  if (snapshotTags) options.snapshotTags = snapshotTags.split(",");
  if (snapshotDescription) options.snapshotDescription = snapshotDescription;
  if (requestedBy) options.requestedBy = requestedBy;
  
  // Override with body params if present
  if (body) {
    if (typeof body.includeCore === "boolean") options.includeCore = body.includeCore;
    if (typeof body.includeLevels === "boolean") options.includeLevels = body.includeLevels;
    if (typeof body.includeTiers === "boolean") options.includeTiers = body.includeTiers;
    if (typeof body.maxLevels === "number") options.maxLevels = body.maxLevels;
    if (typeof body.maxTiers === "number") options.maxTiers = body.maxTiers;
    if (Array.isArray(body.specificLevels)) options.specificLevels = body.specificLevels;
    if (Array.isArray(body.specificTiers)) options.specificTiers = body.specificTiers;
    if (typeof body.createSnapshot === "boolean") options.createSnapshot = body.createSnapshot;
    if (typeof body.snapshotType === "string") options.snapshotType = body.snapshotType;
    if (Array.isArray(body.snapshotTags)) options.snapshotTags = body.snapshotTags;
    if (typeof body.snapshotDescription === "string") options.snapshotDescription = body.snapshotDescription;
    if (typeof body.requestedBy === "string") options.requestedBy = body.requestedBy;
  }
  
  return options;
}

async function handleHealthCheck(): Promise<Response> {
  const rpcHealth = await getRpcHealth();
  const healthyCount = rpcHealth.filter(ep => ep.status === "healthy").length;
  const degradedCount = rpcHealth.filter(ep => ep.status === "degraded").length;
  const circuitOpenCount = rpcHealth.filter(ep => ep.status === "circuit_open").length;
  
  const overallHealth = healthyCount > 0 ? "healthy" : degradedCount > 0 ? "degraded" : "unhealthy";
  
  return new Response(
    JSON.stringify({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      contract: CONFIG.CONTRACT_ADDRESS,
      rpc: {
        healthy: healthyCount,
        degraded: degradedCount,
        circuitOpen: circuitOpenCount,
        total: rpcHealth.length,
      },
      endpoints: rpcHealth.map(ep => ({
        endpoint: ep.endpoint,
        status: ep.status,
        priority: ep.priority,
        avgResponseTimeMs: ep.avgResponseTimeMs,
        consecutiveFailures: ep.consecutiveFailures,
      })),
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  
  const url = new URL(req.url);
  const path = url.pathname.replace("/contract-state", "");
  
  // Health check endpoint
  if (path === "/health" || url.searchParams.get("health") === "true") {
    return await handleHealthCheck();
  }
  
  // Reset metrics for this request
  resetMetrics();
  const startTime = Date.now();
  
  try {
    // Parse options from URL and body
    let body: Record<string, unknown> | undefined;
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    const options = parseOptions(url, body);
    
    // Fetch contract state
    const state = await fetchContractState(options);
    
    requestMetrics.totalDurationMs = Date.now() - startTime;
    
    // Create snapshot if requested
    const snapshot = await createSnapshot(state, options, requestMetrics.totalDurationMs);
    
    // Derive minting status
    const mintingAllowed = 
      state.toggles?.isMintActive && 
      !state.toggles?.mintPaused && 
      !state.toggles?.killSwitch && 
      !state.toggles?.isKillSwitchActive;
    
    const msgValueZeroShouldWork = 
      state.toggles?.freeMintActive || 
      state.toggles?.isFreeMint;
    
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        contract: CONFIG.CONTRACT_ADDRESS,
        state,
        derived: {
          mintingAllowed,
          msgValueZeroShouldWork,
          currencyName: state.pricing?.mintCurrency === 0 ? "ETH" : "USDC",
        },
        snapshot: snapshot ? { id: snapshot.id, version: snapshot.version } : null,
        metrics: requestMetrics,
        rpc: {
          lastSuccessfulEndpoint,
          endpointsUsed: requestMetrics.endpointsUsed,
        },
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error fetching contract state:", err);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
        contract: CONFIG.CONTRACT_ADDRESS,
        metrics: {
          ...requestMetrics,
          totalDurationMs: Date.now() - startTime,
        },
        // Return permissive defaults to allow minting (fail-open)
        state: null,
        derived: {
          mintingAllowed: true,
          msgValueZeroShouldWork: false,
          currencyName: "ETH",
        },
      }),
      {
        status: 200, // Always 200 for fail-open
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
