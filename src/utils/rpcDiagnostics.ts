// ============================================================
// RPC Diagnostics Store
// Stores structured RPC/simulation warnings for display in UI
// ============================================================

export interface RpcDiagnosticEntry {
  id: string;
  timestamp: number;
  type: 'rpc_call' | 'simulation' | 'failover' | 'warning' | 'error';
  method: string;
  endpoint?: string;
  durationMs?: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  failoverPath?: string[];
  retryCount?: number;
}

// In-memory store with max entries
const MAX_ENTRIES = 100;
const diagnosticsStore: RpcDiagnosticEntry[] = [];

// Event listeners for real-time updates
type DiagnosticsListener = (entries: RpcDiagnosticEntry[]) => void;
const listeners = new Set<DiagnosticsListener>();

/**
 * Add a diagnostic entry
 */
export function logRpcDiagnostic(entry: Omit<RpcDiagnosticEntry, 'id' | 'timestamp'>): void {
  const fullEntry: RpcDiagnosticEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  
  diagnosticsStore.unshift(fullEntry);
  
  // Trim to max size
  if (diagnosticsStore.length > MAX_ENTRIES) {
    diagnosticsStore.pop();
  }
  
  // Notify listeners
  listeners.forEach(listener => listener([...diagnosticsStore]));
  
  // Console log for dev visibility
  if (entry.type === 'error' || !entry.success) {
    console.warn('[RPC Diagnostics]', {
      type: entry.type,
      method: entry.method,
      endpoint: entry.endpoint,
      error: entry.errorMessage,
      duration: entry.durationMs ? `${entry.durationMs}ms` : undefined,
    });
  }
}

/**
 * Log a simulation warning (fail-open scenario)
 */
export function logSimulationWarning(params: {
  method: string;
  warning: string;
  endpoint?: string;
  durationMs?: number;
  defaultGasUsed?: boolean;
}): void {
  logRpcDiagnostic({
    type: 'simulation',
    method: params.method,
    endpoint: params.endpoint,
    durationMs: params.durationMs,
    success: true, // Fail-open means we proceed
    errorType: 'SIMULATION_SKIPPED',
    errorMessage: params.warning,
  });
}

/**
 * Log an RPC failover event
 */
export function logFailover(params: {
  method: string;
  failedEndpoints: string[];
  successEndpoint?: string;
  totalDurationMs: number;
}): void {
  logRpcDiagnostic({
    type: 'failover',
    method: params.method,
    endpoint: params.successEndpoint,
    durationMs: params.totalDurationMs,
    success: !!params.successEndpoint,
    failoverPath: params.failedEndpoints,
  });
}

/**
 * Log an RPC error
 */
export function logRpcError(params: {
  method: string;
  endpoint: string;
  errorType: string;
  errorMessage: string;
  durationMs?: number;
  retryCount?: number;
}): void {
  logRpcDiagnostic({
    type: 'error',
    method: params.method,
    endpoint: params.endpoint,
    durationMs: params.durationMs,
    success: false,
    errorType: params.errorType,
    errorMessage: params.errorMessage,
    retryCount: params.retryCount,
  });
}

/**
 * Get all diagnostic entries
 */
export function getDiagnosticEntries(): RpcDiagnosticEntry[] {
  return [...diagnosticsStore];
}

/**
 * Get recent entries (last N)
 */
export function getRecentDiagnostics(count = 10): RpcDiagnosticEntry[] {
  return diagnosticsStore.slice(0, count);
}

/**
 * Clear all diagnostics
 */
export function clearDiagnostics(): void {
  diagnosticsStore.length = 0;
  listeners.forEach(listener => listener([]));
}

/**
 * Subscribe to diagnostic updates
 */
export function subscribeToDiagnostics(listener: DiagnosticsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get summary statistics
 */
export function getDiagnosticsSummary(): {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDurationMs: number;
  failoverEvents: number;
  simulationWarnings: number;
} {
  const total = diagnosticsStore.length;
  const successful = diagnosticsStore.filter(e => e.success).length;
  const failovers = diagnosticsStore.filter(e => e.type === 'failover').length;
  const simWarnings = diagnosticsStore.filter(e => e.type === 'simulation' && e.errorType === 'SIMULATION_SKIPPED').length;
  
  const durations = diagnosticsStore
    .filter(e => e.durationMs !== undefined)
    .map(e => e.durationMs!);
  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;
  
  return {
    totalCalls: total,
    successfulCalls: successful,
    failedCalls: total - successful,
    avgDurationMs: Math.round(avgDuration),
    failoverEvents: failovers,
    simulationWarnings: simWarnings,
  };
}

// Expose to console for debugging
if (typeof window !== 'undefined') {
  (window as any).rpcDiagnosticsLog = {
    getAll: getDiagnosticEntries,
    getRecent: getRecentDiagnostics,
    getSummary: getDiagnosticsSummary,
    clear: clearDiagnostics,
  };
}
