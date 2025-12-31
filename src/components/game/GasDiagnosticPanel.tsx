/**
 * Gas Diagnostic Panel
 * Shows detailed gas analysis for debugging high gas issues
 * Helps prove whether gas cost is frontend or contract-defined
 */

import { useState } from 'react';
import { 
  Fuel, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGasDiagnostics, GAS_BASELINES } from '@/hooks/useGasDiagnostics';
import { formatEther, formatGwei } from 'viem';
import { cn } from '@/lib/utils';

interface GasDiagnosticPanelProps {
  className?: string;
  compact?: boolean;
}

export function GasDiagnosticPanel({ className, compact = false }: GasDiagnosticPanelProps) {
  const { history, lastDiagnostic, generateGasReport } = useGasDiagnostics();
  const [expanded, setExpanded] = useState(!compact);
  const [copied, setCopied] = useState(false);

  const copyReport = async () => {
    const report = generateGasReport();
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (history.length === 0 && !lastDiagnostic) {
    return null;
  }

  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Fuel className="h-4 w-4 text-primary" />
            Gas Diagnostics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyReport}
              className="h-7 px-2 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? 'Copied!' : 'Copy Report'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 w-7 p-0"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-4 space-y-3">
          {/* Latest Transaction */}
          {lastDiagnostic && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Latest Transaction
              </div>
              <DiagnosticRow diagnostic={lastDiagnostic} />
            </div>
          )}

          {/* Gas Baselines Reference */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Info className="h-3 w-3" />
              Contract Gas Baselines (Reference)
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(GAS_BASELINES).map(([fn, gas]) => (
                <div key={fn} className="flex justify-between px-2 py-1 bg-muted/30 rounded">
                  <span className="font-mono text-muted-foreground">{fn}</span>
                  <span className="font-medium">{gas.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Proof Statement */}
          <div className="p-2 rounded bg-primary/5 border border-primary/20">
            <div className="text-xs space-y-1">
              <div className="font-medium text-primary">Gas Optimization Status</div>
              <p className="text-muted-foreground">
                All transactions use simulation-validated gas with 7% buffer. 
                If estimated gas matches contract baseline, gas cost is <strong>contract-defined</strong> and cannot be reduced without contract changes.
              </p>
            </div>
          </div>

          {/* History */}
          {history.length > 1 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                History ({history.length} transactions)
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.slice(1).map((d, i) => (
                  <DiagnosticRowCompact key={i} diagnostic={d} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Full diagnostic row
function DiagnosticRow({ diagnostic }: { diagnostic: ReturnType<typeof useGasDiagnostics>['lastDiagnostic'] }) {
  if (!diagnostic) return null;

  const baseline = GAS_BASELINES[diagnostic.functionName as keyof typeof GAS_BASELINES];
  const deviation = baseline 
    ? Number((diagnostic.estimatedGas - baseline) * 100n / baseline)
    : null;

  const isNormal = deviation === null || Math.abs(deviation) < 20;
  const isHigh = deviation !== null && deviation > 20;

  return (
    <div className="p-2 rounded border border-border/50 bg-card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{diagnostic.functionName}</span>
          {diagnostic.isBaseOptimized && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-primary" />
              Optimized
            </Badge>
          )}
        </div>
        {diagnostic.txHash && (
          <a
            href={`https://basescan.org/tx/${diagnostic.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Calldata</span>
          <span>{diagnostic.calldataBytes} bytes</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gas Price</span>
          <span>{formatGwei(diagnostic.gasPrice)} gwei</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimated Gas</span>
          <span className={cn(
            "font-medium",
            isHigh && "text-yellow-600"
          )}>
            {diagnostic.estimatedGas.toLocaleString()}
            {deviation !== null && (
              <span className={cn(
                "ml-1 text-[10px]",
                isNormal ? "text-green-600" : "text-yellow-600"
              )}>
                ({deviation > 0 ? '+' : ''}{deviation}%)
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Actual Gas</span>
          <span className="font-medium">
            {diagnostic.actualGasUsed?.toLocaleString() || 'Pending'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Cost</span>
          <span className="font-medium text-primary">{diagnostic.estimatedCostEth} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Actual Cost</span>
          <span className="font-medium">
            {diagnostic.actualCostEth ? `${diagnostic.actualCostEth} ETH` : 'Pending'}
          </span>
        </div>
      </div>

      {diagnostic.warnings.length > 0 && (
        <div className="space-y-1">
          {diagnostic.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-600">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact row for history
function DiagnosticRowCompact({ diagnostic }: { diagnostic: ReturnType<typeof useGasDiagnostics>['lastDiagnostic'] }) {
  if (!diagnostic) return null;

  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs">
      <span className="font-mono">{diagnostic.functionName}</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{diagnostic.estimatedGas.toLocaleString()} gas</span>
        <span className="font-medium">{diagnostic.estimatedCostEth} ETH</span>
        {diagnostic.warnings.length > 0 && (
          <AlertTriangle className="h-3 w-3 text-yellow-600" />
        )}
      </div>
    </div>
  );
}
