import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkAdminConfig, type AdminConfigStatus } from '@/utils/contractStateCheck';

interface MintStatusIndicatorProps {
  className?: string;
  compact?: boolean;
  showRefresh?: boolean;
}

/**
 * Mint Status Indicator - Shows live contract admin configuration
 * Fetches from edge function with fail-open behavior
 */
export function MintStatusIndicator({ 
  className, 
  compact = false,
  showRefresh = true 
}: MintStatusIndicatorProps) {
  const [status, setStatus] = useState<AdminConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await checkAdminConfig();
      setStatus(config);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[MintStatusIndicator] Failed to fetch status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status && !isLoading) {
    return null;
  }

  const StatusBadge = ({ 
    label, 
    value, 
    isPositive 
  }: { 
    label: string; 
    value: string; 
    isPositive: boolean 
  }) => (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
      isPositive 
        ? "bg-primary/10 text-primary border-primary/20" 
        : "bg-destructive/10 text-destructive border-destructive/20"
    )}>
      {isPositive ? (
        <CheckCircle className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      <span>{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className={cn(
              "h-2 w-2 rounded-full",
              status?.mintingAllowed ? "bg-primary" : "bg-destructive"
            )} />
            <span className="text-xs text-muted-foreground">
              {status?.mintingAllowed ? 'Minting Active' : 'Minting Inactive'}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border bg-card/50 backdrop-blur-sm p-3 space-y-2",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Contract Status
        </h4>
        <div className="flex items-center gap-2">
          {status?.source && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              status.source === 'edge-function' 
                ? "bg-secondary text-secondary-foreground" 
                : status.source === 'direct-rpc'
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-muted-foreground"
            )}>
              {status.source === 'edge-function' ? 'Live' : 
               status.source === 'direct-rpc' ? 'RPC' : 'Fallback'}
            </span>
          )}
          {showRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={fetchStatus}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* Status Grid */}
      {isLoading && !status ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : status ? (
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge 
            label="Minting" 
            value={status.mintingAllowed ? 'ON' : 'OFF'} 
            isPositive={status.mintingAllowed} 
          />
          <StatusBadge 
            label="Free Mint" 
            value={status.isFreeMint ? 'YES' : 'NO'} 
            isPositive={status.isFreeMint} 
          />
          <StatusBadge 
            label="Currency" 
            value={status.mintCurrencyLabel} 
            isPositive={true} 
          />
          <StatusBadge 
            label="Kill Switch" 
            value={status.isKillSwitchActive ? 'ACTIVE' : 'OFF'} 
            isPositive={!status.isKillSwitchActive} 
          />
        </div>
      ) : null}

      {/* Warning for fallback mode */}
      {status?.source === 'fallback-defaults' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>Using defaults – contract will enforce rules</span>
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-[10px] text-muted-foreground">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
