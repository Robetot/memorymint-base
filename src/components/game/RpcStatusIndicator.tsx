// ============================================================
// RPC Status Indicator Component
// Shows real-time RPC health status in the UI with latency
// ============================================================

import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react';
import { useRpcHealth } from '@/hooks/useRpcHealth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface RpcStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export function RpcStatusIndicator({ compact = false, showDetails = false, className }: RpcStatusIndicatorProps) {
  const { isInitialized, currentRpcUrl, healthyCount, totalCount, endpoints, isHealthy, refreshHealth } = useRpcHealth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshHealth();
    setIsRefreshing(false);
  };
  
  // Extract domain from URL for display
  const formatUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Get current endpoint latency
  const currentEndpoint = endpoints.find(e => e.url === currentRpcUrl);
  const currentLatency = currentEndpoint?.latencyMs;

  // Check if using fallback (not the first/primary endpoint)
  const primaryUrl = endpoints[0]?.url;
  const isUsingFallback = currentRpcUrl !== primaryUrl && healthyCount > 0;
  
  if (!isInitialized) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-xs", className)}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }
  
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {isHealthy ? (
          <Wifi className="h-3.5 w-3.5 text-success" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-destructive" />
        )}
        <span className={cn("text-xs", isHealthy ? "text-success" : "text-destructive")}>
          {healthyCount}/{totalCount}
        </span>
        {currentLatency && (
          <span className="text-xs text-muted-foreground">
            {currentLatency}ms
          </span>
        )}
        {isUsingFallback && (
          <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-warning border-warning/50">
            Fallback
          </Badge>
        )}
      </div>
    );
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isHealthy ? (
              <Wifi className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {isHealthy ? 'Network Connected' : 'Network Issues'}
                </span>
                {isUsingFallback && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 text-warning border-warning/50">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                    Fallback
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {healthyCount} of {totalCount} endpoints healthy
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 px-2 gap-1"
              title="Reconnect RPC - find fastest healthy endpoint"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              <span className="text-xs hidden sm:inline">Reconnect</span>
            </Button>
            
            {showDetails && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>
        
        {/* Current RPC with latency */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-mono">
            {formatUrl(currentRpcUrl)}
          </Badge>
          {currentLatency !== null && currentLatency !== undefined && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs gap-1",
                currentLatency < 200 && "bg-success/10 text-success",
                currentLatency >= 200 && currentLatency < 500 && "bg-warning/10 text-warning",
                currentLatency >= 500 && "bg-destructive/10 text-destructive"
              )}
            >
              <Zap className="h-2.5 w-2.5" />
              {currentLatency}ms
            </Badge>
          )}
        </div>
        
        {showDetails && (
          <CollapsibleContent className="mt-3">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.url}
                  className={cn(
                    "flex items-center justify-between p-2 rounded text-xs",
                    endpoint.healthy ? "bg-success/10" : "bg-destructive/10",
                    endpoint.url === currentRpcUrl && "ring-1 ring-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {endpoint.healthy ? (
                      <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                    <span className="font-mono truncate">{formatUrl(endpoint.url)}</span>
                    {endpoint.url === currentRpcUrl && (
                      <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                        Active
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {endpoint.consecutiveFailures > 0 && (
                      <span className="text-destructive/70">
                        {endpoint.consecutiveFailures} fails
                      </span>
                    )}
                    {endpoint.latencyMs !== null && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{endpoint.latencyMs}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
