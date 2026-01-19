/**
 * Mint Pre-flight Diagnostic Panel
 * Shows all contract state checks before minting to help debug 'transaction likely to fail' warnings.
 * Displays: contract state, wallet state, pricing, simulation status, and blockers.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Fuel,
  Shield,
  Wallet,
  Coins,
  Activity,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatEther } from 'viem';

export interface PreflightCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warn';
  message?: string;
  value?: string;
  category: 'contract' | 'wallet' | 'pricing' | 'simulation';
  blocking?: boolean; // If true, this failure will prevent minting
}

export interface PreflightDiagnostics {
  checks: PreflightCheck[];
  overallStatus: 'pending' | 'checking' | 'ready' | 'blocked' | 'warn';
  blockers: string[];
  warnings: string[];
  estimatedGas?: bigint;
  estimatedCostEth?: string;
  simulationPassed?: boolean;
  timestamp: number;
}

interface MintPreflightPanelProps {
  diagnostics: PreflightDiagnostics | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  compact?: boolean;
}

const categoryIcons = {
  contract: Shield,
  wallet: Wallet,
  pricing: Coins,
  simulation: Activity,
};

const categoryLabels = {
  contract: 'Contract State',
  wallet: 'Wallet Checks',
  pricing: 'Pricing & Fees',
  simulation: 'Simulation',
};

export function MintPreflightPanel({ 
  diagnostics, 
  onRefresh, 
  isRefreshing = false,
  className,
  compact = false 
}: MintPreflightPanelProps) {
  const [expanded, setExpanded] = useState(!compact);

  if (!diagnostics) {
    return null;
  }

  const { checks, overallStatus, blockers, warnings, estimatedGas, estimatedCostEth, simulationPassed } = diagnostics;

  // Group checks by category
  const checksByCategory = checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, PreflightCheck[]>);

  const statusIcon = {
    pending: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
    checking: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    ready: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    blocked: <XCircle className="h-4 w-4 text-destructive" />,
    warn: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  };

  const statusLabel = {
    pending: 'Pending',
    checking: 'Checking...',
    ready: 'Ready to Mint',
    blocked: 'Blocked',
    warn: 'Warnings',
  };

  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Fuel className="h-4 w-4 text-primary" />
            Pre-flight Checks
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Overall Status */}
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                overallStatus === 'ready' && "border-green-500/50 text-green-600 bg-green-500/10",
                overallStatus === 'blocked' && "border-destructive/50 text-destructive bg-destructive/10",
                overallStatus === 'warn' && "border-yellow-500/50 text-yellow-600 bg-yellow-500/10",
                overallStatus === 'checking' && "border-primary/50 text-primary bg-primary/10"
              )}
            >
              {statusIcon[overallStatus]}
              <span className="ml-1">{statusLabel[overallStatus]}</span>
            </Badge>
            
            {/* Refresh Button */}
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-7 w-7 p-0"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </Button>
            )}
            
            {/* Expand/Collapse */}
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
          {/* Quick Summary - Always visible */}
          <div className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {checks.filter(c => c.status === 'pass').length}/{checks.length} checks passed
              </span>
              {simulationPassed !== undefined && (
                <span className={cn(
                  "flex items-center gap-1",
                  simulationPassed ? "text-green-600" : "text-destructive"
                )}>
                  {simulationPassed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Simulation {simulationPassed ? 'OK' : 'Failed'}
                </span>
              )}
            </div>
            {estimatedCostEth && (
              <span className="text-primary font-medium">
                Est. {estimatedCostEth} ETH
              </span>
            )}
          </div>

          {/* Blockers - High Priority */}
          {blockers.length > 0 && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/30 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                Blockers ({blockers.length})
              </div>
              {blockers.map((msg, i) => (
                <div key={i} className="text-xs text-destructive/80 pl-5">
                  • {msg}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warnings ({warnings.length})
              </div>
              {warnings.map((msg, i) => (
                <div key={i} className="text-xs text-yellow-600/80 pl-5">
                  • {msg}
                </div>
              ))}
            </div>
          )}

          {/* Checks by Category */}
          {Object.entries(checksByCategory).map(([category, categoryChecks]) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            const label = categoryLabels[category as keyof typeof categoryLabels];
            
            return (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="space-y-1">
                  {categoryChecks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Gas Details */}
          {estimatedGas && (
            <div className="p-2 rounded bg-primary/5 border border-primary/20">
              <div className="text-xs space-y-1">
                <div className="font-medium text-primary flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Gas Estimate
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Gas Units</span>
                  <span className="font-mono">{estimatedGas.toLocaleString()}</span>
                </div>
                {estimatedCostEth && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Est. Cost</span>
                    <span className="font-medium text-foreground">{estimatedCostEth} ETH</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-[10px] text-muted-foreground text-right">
            Last checked: {new Date(diagnostics.timestamp).toLocaleTimeString()}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Individual check row component
function CheckRow({ check }: { check: PreflightCheck }) {
  const statusIcon = {
    pending: <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />,
    checking: <Loader2 className="h-3 w-3 animate-spin text-primary" />,
    pass: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    fail: <XCircle className="h-3 w-3 text-destructive" />,
    warn: <AlertTriangle className="h-3 w-3 text-yellow-500" />,
  };

  return (
    <div className={cn(
      "flex items-center justify-between px-2 py-1.5 rounded text-xs",
      check.status === 'fail' && check.blocking && "bg-destructive/10",
      check.status === 'fail' && !check.blocking && "bg-yellow-500/10",
      check.status === 'pass' && "bg-muted/30",
      check.status === 'warn' && "bg-yellow-500/10",
      check.status === 'checking' && "bg-primary/10"
    )}>
      <div className="flex items-center gap-2">
        {statusIcon[check.status]}
        <span className={cn(
          check.status === 'fail' && "text-destructive",
          check.status === 'warn' && "text-yellow-600"
        )}>
          {check.label}
        </span>
        {check.blocking && check.status === 'fail' && (
          <Badge variant="destructive" className="text-[9px] h-4 px-1">
            BLOCKING
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {check.value && (
          <span className="font-mono text-muted-foreground">{check.value}</span>
        )}
        {check.message && check.status !== 'pass' && (
          <span className={cn(
            "max-w-[150px] truncate",
            check.status === 'fail' ? "text-destructive" : "text-yellow-600"
          )}>
            {check.message}
          </span>
        )}
      </div>
    </div>
  );
}

// Export helper to create preflight diagnostics
export function createPreflightDiagnostics(config: {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  isMintActive?: boolean;
  isKillSwitchActive?: boolean;
  isFreeMint?: boolean;
  mintPaused?: boolean;
  mintPriceETH?: bigint;
  walletBalance?: bigint;
  walletMintCount?: bigint;
  walletMintLimit?: bigint;
  isAntiBotActive?: boolean;
  simulationResult?: {
    success: boolean;
    error?: string;
    gasLimit?: bigint;
    estimatedCostEth?: string;
  };
}): PreflightDiagnostics {
  const checks: PreflightCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // === Contract State Checks ===
  
  // Kill Switch
  checks.push({
    id: 'kill-switch',
    label: 'Emergency Stop',
    status: config.isKillSwitchActive === undefined ? 'pending' : 
            config.isKillSwitchActive ? 'fail' : 'pass',
    message: config.isKillSwitchActive ? 'Kill switch is active' : undefined,
    value: config.isKillSwitchActive ? 'ACTIVE' : 'OK',
    category: 'contract',
    blocking: true,
  });
  if (config.isKillSwitchActive) {
    blockers.push('Kill switch is active - all minting is disabled');
  }

  // Mint Active
  checks.push({
    id: 'mint-active',
    label: 'Minting Enabled',
    status: config.isMintActive === undefined ? 'pending' :
            config.isMintActive ? 'pass' : 'fail',
    message: !config.isMintActive ? 'Minting is paused' : undefined,
    value: config.isMintActive ? 'Active' : 'Paused',
    category: 'contract',
    blocking: true,
  });
  if (config.isMintActive === false) {
    blockers.push('Minting is currently paused');
  }

  // Anti-Bot
  checks.push({
    id: 'anti-bot',
    label: 'Anti-Bot Mode',
    status: config.isAntiBotActive === undefined ? 'pending' :
            config.isAntiBotActive ? 'warn' : 'pass',
    value: config.isAntiBotActive ? 'Active' : 'Off',
    category: 'contract',
    blocking: false,
  });
  if (config.isAntiBotActive) {
    warnings.push('Anti-bot protection is active - transactions may require cooldown');
  }

  // === Wallet Checks ===
  
  // Wallet Connected
  checks.push({
    id: 'wallet-connected',
    label: 'Wallet Connected',
    status: config.isConnected ? 'pass' : 'fail',
    value: config.address ? `${config.address.slice(0, 6)}...${config.address.slice(-4)}` : undefined,
    category: 'wallet',
    blocking: true,
  });
  if (!config.isConnected) {
    blockers.push('Please connect your wallet');
  }

  // Network Check
  const isBaseNetwork = config.chainId === 8453;
  checks.push({
    id: 'network',
    label: 'Network',
    status: config.chainId === undefined ? 'pending' :
            isBaseNetwork ? 'pass' : 'fail',
    message: !isBaseNetwork && config.chainId ? 'Please switch to Base' : undefined,
    value: isBaseNetwork ? 'Base' : `Chain ${config.chainId}`,
    category: 'wallet',
    blocking: true,
  });
  if (config.chainId && !isBaseNetwork) {
    blockers.push('Wrong network - please switch to Base Mainnet');
  }

  // Wallet Mint Limit
  if (config.walletMintLimit !== undefined && config.walletMintLimit > 0n) {
    const limitReached = config.walletMintCount !== undefined && 
                         config.walletMintCount >= config.walletMintLimit;
    checks.push({
      id: 'mint-limit',
      label: 'Wallet Limit',
      status: limitReached ? 'fail' : 'pass',
      value: `${config.walletMintCount?.toString() || '0'}/${config.walletMintLimit.toString()}`,
      category: 'wallet',
      blocking: true,
    });
    if (limitReached) {
      blockers.push('Wallet has reached mint limit');
    }
  }

  // === Pricing Checks ===
  
  // Free Mint Status
  checks.push({
    id: 'free-mint',
    label: 'Free Mint',
    status: config.isFreeMint === undefined ? 'pending' : 'pass',
    value: config.isFreeMint ? 'Yes' : 'No',
    category: 'pricing',
    blocking: false,
  });

  // ETH Balance (only if not free mint)
  if (!config.isFreeMint && config.mintPriceETH !== undefined && config.mintPriceETH > 0n) {
    const hasEnoughBalance = config.walletBalance !== undefined && 
                             config.walletBalance >= config.mintPriceETH;
    checks.push({
      id: 'eth-balance',
      label: 'ETH Balance',
      status: config.walletBalance === undefined ? 'pending' :
              hasEnoughBalance ? 'pass' : 'fail',
      value: config.walletBalance ? `${parseFloat(formatEther(config.walletBalance)).toFixed(4)} ETH` : undefined,
      message: !hasEnoughBalance ? `Need ${formatEther(config.mintPriceETH)} ETH` : undefined,
      category: 'pricing',
      blocking: true,
    });
    if (!hasEnoughBalance && config.walletBalance !== undefined) {
      blockers.push(`Insufficient ETH balance. Need ${formatEther(config.mintPriceETH)} ETH`);
    }
  }

  // Mint Price
  checks.push({
    id: 'mint-price',
    label: 'Mint Price',
    status: 'pass',
    value: config.isFreeMint ? 'FREE' : 
           config.mintPriceETH ? `${formatEther(config.mintPriceETH)} ETH` : 'Unknown',
    category: 'pricing',
    blocking: false,
  });

  // === Simulation Checks ===
  
  if (config.simulationResult) {
    checks.push({
      id: 'simulation',
      label: 'TX Simulation',
      status: config.simulationResult.success ? 'pass' : 'fail',
      message: config.simulationResult.error,
      value: config.simulationResult.success ? 'Success' : 'Failed',
      category: 'simulation',
      blocking: config.simulationResult.success === false,
    });
    if (!config.simulationResult.success && config.simulationResult.error) {
      blockers.push(`Simulation failed: ${config.simulationResult.error}`);
    }

    if (config.simulationResult.gasLimit) {
      checks.push({
        id: 'gas-estimate',
        label: 'Gas Estimate',
        status: 'pass',
        value: `${config.simulationResult.gasLimit.toLocaleString()} units`,
        category: 'simulation',
        blocking: false,
      });
    }
  }

  // Calculate overall status
  let overallStatus: PreflightDiagnostics['overallStatus'] = 'ready';
  if (checks.some(c => c.status === 'pending' || c.status === 'checking')) {
    overallStatus = 'checking';
  } else if (blockers.length > 0) {
    overallStatus = 'blocked';
  } else if (warnings.length > 0) {
    overallStatus = 'warn';
  }

  return {
    checks,
    overallStatus,
    blockers,
    warnings,
    estimatedGas: config.simulationResult?.gasLimit,
    estimatedCostEth: config.simulationResult?.estimatedCostEth,
    simulationPassed: config.simulationResult?.success,
    timestamp: Date.now(),
  };
}
