import { Fuel, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GasPreviewProps {
  estimatedGasEth: string | null;
  estimatedGasGwei?: string | null;
  isSimulating?: boolean;
  isBaseOptimized?: boolean;
  warningMessage?: string | null;
  error?: string | null;
  showDetails?: boolean;
  className?: string;
}

export function GasPreview({
  estimatedGasEth,
  estimatedGasGwei,
  isSimulating = false,
  isBaseOptimized = true,
  warningMessage,
  error,
  showDetails = false,
  className,
}: GasPreviewProps) {
  if (isSimulating) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Estimating gas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30",
        className
      )}>
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">{error}</span>
      </div>
    );
  }

  if (!estimatedGasEth) {
    return null;
  }

  // Format ETH display - show more precision for small amounts
  const ethValue = parseFloat(estimatedGasEth);
  const formattedEth = ethValue < 0.0001 
    ? '< 0.0001' 
    : ethValue < 0.01 
      ? ethValue.toFixed(6) 
      : ethValue.toFixed(4);

  return (
    <div className={cn(
      "flex flex-col gap-1 px-3 py-2 rounded-lg border",
      warningMessage 
        ? "bg-yellow-500/10 border-yellow-500/30" 
        : "bg-primary/5 border-primary/20",
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Estimated Gas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formattedEth} ETH</span>
          {isBaseOptimized && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
                Base Optimized
              </span>
            </div>
          )}
        </div>
      </div>

      {showDetails && estimatedGasGwei && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>Gas Price</span>
          <span>{estimatedGasGwei} gwei</span>
        </div>
      )}

      {warningMessage && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-yellow-600 dark:text-yellow-500">
          <AlertTriangle className="h-3 w-3" />
          <span>{warningMessage}</span>
        </div>
      )}
    </div>
  );
}

// Compact version for inline display
export function GasPreviewInline({
  estimatedGasEth,
  isSimulating = false,
  isBaseOptimized = true,
  className,
}: Pick<GasPreviewProps, 'estimatedGasEth' | 'isSimulating' | 'isBaseOptimized' | 'className'>) {
  if (isSimulating) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Estimating...</span>
      </span>
    );
  }

  if (!estimatedGasEth) return null;

  const ethValue = parseFloat(estimatedGasEth);
  const formattedEth = ethValue < 0.0001 
    ? '< 0.0001' 
    : ethValue < 0.01 
      ? ethValue.toFixed(6) 
      : ethValue.toFixed(4);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <Fuel className="h-3 w-3 text-primary" />
      <span className="font-medium">{formattedEth} ETH</span>
      {isBaseOptimized && (
        <CheckCircle2 className="h-3 w-3 text-primary" />
      )}
    </span>
  );
}
