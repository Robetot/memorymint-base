// ============================================================
// RPC Status Indicator Component
// Shows real-time RPC health status in the UI
// ============================================================

import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useRpcHealth } from '@/hooks/useRpcHealth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RpcStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
}

export function RpcStatusIndicator({ compact = false, showDetails = false }: RpcStatusIndicatorProps) {
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
  
  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }
  
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {isHealthy ? (
          <Wifi className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-red-500" />
        )}
        <span className={`text-xs ${isHealthy ? 'text-green-600' : 'text-red-500'}`}>
          {healthyCount}/{totalCount}
        </span>
      </div>
    );
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isHealthy ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <div>
              <span className="text-sm font-medium">
                {isHealthy ? 'Network Connected' : 'Network Issues'}
              </span>
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
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
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
        
        {/* Current RPC */}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            {formatUrl(currentRpcUrl)}
          </Badge>
        </div>
        
        {showDetails && (
          <CollapsibleContent className="mt-3">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.url}
                  className={`flex items-center justify-between p-2 rounded text-xs ${
                    endpoint.healthy ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {endpoint.healthy ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="font-mono truncate">{formatUrl(endpoint.url)}</span>
                  </div>
                  
                  {endpoint.latencyMs !== null && (
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{endpoint.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
