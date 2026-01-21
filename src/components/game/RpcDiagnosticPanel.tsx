// ============================================================
// RPC Diagnostics Panel (Developer Only)
// Shows structured RPC/simulation logs, failovers, and warnings
// ============================================================

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Zap,
  Trash2,
  Clock,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  RpcDiagnosticEntry,
  getDiagnosticEntries,
  getDiagnosticsSummary,
  clearDiagnostics,
  subscribeToDiagnostics,
} from '@/utils/rpcDiagnostics';
import {
  isQAModeEnabled,
  enableQAMode,
  disableQAMode,
  getDisabledEndpoints,
  disableEndpoint,
  enableEndpoint,
  BASE_RPC_ENDPOINTS,
} from '@/utils/rpcProvider';

/**
 * Developer-only diagnostic panel for RPC health and simulation monitoring.
 * Only renders in development/preview environments.
 */
export function RpcDiagnosticPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<RpcDiagnosticEntry[]>([]);
  const [qaMode, setQaMode] = useState(isQAModeEnabled());
  const [disabledList, setDisabledList] = useState<string[]>([]);

  // Subscribe to diagnostics updates
  useEffect(() => {
    setEntries(getDiagnosticEntries());
    const unsubscribe = subscribeToDiagnostics(setEntries);
    return unsubscribe;
  }, []);

  // Update QA state
  useEffect(() => {
    const interval = setInterval(() => {
      setQaMode(isQAModeEnabled());
      setDisabledList(getDisabledEndpoints());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const summary = getDiagnosticsSummary();

  const handleToggleQA = () => {
    if (qaMode) {
      disableQAMode();
    } else {
      enableQAMode();
    }
    setQaMode(isQAModeEnabled());
    setDisabledList(getDisabledEndpoints());
  };

  const handleToggleEndpoint = (url: string) => {
    if (disabledList.includes(url)) {
      enableEndpoint(url);
    } else {
      disableEndpoint(url);
    }
    setDisabledList(getDisabledEndpoints());
  };

  const getTypeIcon = (type: RpcDiagnosticEntry['type']) => {
    switch (type) {
      case 'rpc_call': return <Server className="w-3 h-3 text-primary" />;
      case 'simulation': return <Zap className="w-3 h-3 text-warning" />;
      case 'failover': return <RefreshCw className="w-3 h-3 text-muted-foreground" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-warning" />;
      case 'error': return <XCircle className="w-3 h-3 text-destructive" />;
    }
  };

  const formatUrl = (url?: string) => {
    if (!url) return '-';
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Only show in development/preview
  if (typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      !window.location.hostname.includes('preview') &&
      !window.location.hostname.includes('lovable')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden min-w-[320px] max-w-[400px]">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">RPC Diagnostics</span>
            {summary.simulationWarnings > 0 && (
              <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                {summary.simulationWarnings} skipped
              </Badge>
            )}
            {qaMode && (
              <Badge variant="destructive" className="text-xs">QA</Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-3 pt-0 border-t border-border/50 space-y-3">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-lg font-bold text-foreground">{summary.totalCalls}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="bg-success/10 rounded p-2">
                <div className="text-lg font-bold text-success">{summary.successfulCalls}</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </div>
              <div className="bg-destructive/10 rounded p-2">
                <div className="text-lg font-bold text-destructive">{summary.failedCalls}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* QA Mode Controls */}
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  QA Fault Injection
                </span>
                <Button
                  variant={qaMode ? 'destructive' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleToggleQA}
                >
                  {qaMode ? 'Disable' : 'Enable'}
                </Button>
              </div>

              {qaMode && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {BASE_RPC_ENDPOINTS.map((url) => (
                    <div 
                      key={url} 
                      className={cn(
                        "flex items-center justify-between p-1.5 rounded text-xs",
                        disabledList.includes(url) ? "bg-destructive/10" : "bg-muted/30"
                      )}
                    >
                      <span className="font-mono truncate max-w-[200px]">{formatUrl(url)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={() => handleToggleEndpoint(url)}
                      >
                        {disabledList.includes(url) ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Logs */}
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recent Events
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    clearDiagnostics();
                    setEntries([]);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div className="space-y-1 max-h-40 overflow-y-auto">
                {entries.slice(0, 10).map((entry) => (
                  <div 
                    key={entry.id} 
                    className={cn(
                      "flex items-start gap-2 p-1.5 rounded text-xs",
                      entry.success ? "bg-muted/30" : "bg-destructive/10"
                    )}
                  >
                    {getTypeIcon(entry.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-mono truncate">{entry.method}</span>
                        {entry.durationMs && (
                          <span className="text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {entry.durationMs}ms
                          </span>
                        )}
                      </div>
                      {entry.errorMessage && (
                        <p className="text-muted-foreground truncate">{entry.errorMessage}</p>
                      )}
                      {entry.endpoint && (
                        <p className="text-muted-foreground/70 truncate">{formatUrl(entry.endpoint)}</p>
                      )}
                    </div>
                    {entry.success ? (
                      <CheckCircle className="w-3 h-3 text-success shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive shrink-0" />
                    )}
                  </div>
                ))}

                {entries.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No RPC events logged yet
                  </p>
                )}
              </div>
            </div>

            {/* Dev Info */}
            <div className="border-t border-border/50 pt-2 text-xs text-muted-foreground/70">
              <p>Console: <code className="bg-muted px-1 rounded">rpcQA.help()</code></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
