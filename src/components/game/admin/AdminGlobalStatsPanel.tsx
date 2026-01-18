import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3,
  Coins,
  DollarSign,
  Hash,
  Gift,
  TrendingUp,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';

interface AdminGlobalStatsPanelProps {
  config: ContractConfig | null;
}

export function AdminGlobalStatsPanel({ config }: AdminGlobalStatsPanelProps) {
  const formatETH = (value: bigint | undefined): string => {
    if (!value) return '0.0000';
    return (Number(value) / 1e18).toFixed(4);
  };

  const formatUSDC = (value: bigint | undefined): string => {
    if (!value) return '0.00';
    return (Number(value) / 1e6).toFixed(2);
  };

  const totalMinted = config?.totalSupply ?? 0n;
  const mintPriceETH = config?.mintPriceETH ?? 0n;
  const mintPriceUSDC = config?.mintPriceUSDC ?? 0n;
  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;
  const feesETH = config?.totalFeesCollectedETH ?? 0n;
  const feesUSDC = config?.totalFeesCollectedUSDC ?? 0n;
  const totalBonusClaimedETH = config?.totalBonusClaimedETH ?? 0n;
  const totalBonusClaimedUSDC = config?.totalBonusClaimedUSDC ?? 0n;

  // Calculate approximate total bonus claimed (pools + distributed)
  // This would ideally come from totalBonusClaimedETH/USDC if available
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Contract Statistics
        </h3>
        {config?.isLoaded && (
          <Badge variant="outline" className="text-xs">
            Live Data
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Total Minted */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Hash className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{totalMinted.toString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Minted</p>
          </CardContent>
        </Card>

        {/* Current Mint Price ETH */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Coins className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">
              {mintPriceETH === 0n ? (
                <span className="text-emerald-500">FREE</span>
              ) : (
                `${formatETH(mintPriceETH)} ETH`
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Mint Price (ETH)</p>
          </CardContent>
        </Card>

        {/* Current Mint Price USDC */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">
              {mintPriceUSDC === 0n ? (
                <span className="text-emerald-500">FREE</span>
              ) : (
                `$${formatUSDC(mintPriceUSDC)}`
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Mint Price (USDC)</p>
          </CardContent>
        </Card>

        {/* Bonus Pool ETH */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Gift className="h-6 w-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{formatETH(bonusPoolETH)} ETH</p>
            <p className="text-xs text-muted-foreground mt-1">Bonus Pool (ETH)</p>
          </CardContent>
        </Card>

        {/* Bonus Pool USDC */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Gift className="h-6 w-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">${formatUSDC(bonusPoolUSDC)}</p>
            <p className="text-xs text-muted-foreground mt-1">Bonus Pool (USDC)</p>
          </CardContent>
        </Card>

        {/* Total Fees Collected */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div>
              <p className="text-lg font-bold">{formatETH(feesETH)} ETH</p>
              <p className="text-sm font-medium text-muted-foreground">${formatUSDC(feesUSDC)} USDC</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Fees Collected</p>
          </CardContent>
        </Card>

        {/* Total Bonus Claimed */}
        <Card className="border-border/50 col-span-2 md:col-span-3">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">Total Bonus Claimed</span>
            </div>
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatETH(totalBonusClaimedETH)} ETH</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">${formatUSDC(totalBonusClaimedUSDC)} USDC</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Status Indicators */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant="outline" 
              className={config?.mintPaused 
                ? 'bg-destructive/10 text-destructive border-destructive/20' 
                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }
            >
              Minting: {config?.mintPaused ? '⏸️ Paused' : '✅ Active'}
            </Badge>
            
            <Badge 
              variant="outline" 
              className={config?.killSwitch 
                ? 'bg-destructive/10 text-destructive border-destructive/20' 
                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }
            >
              Kill Switch: {config?.killSwitch ? '🚨 ACTIVE' : '✅ Off'}
            </Badge>

            <Badge 
              variant="outline"
              className="bg-blue-500/10 text-blue-600 border-blue-500/20"
            >
              Anti-Bot Mode: {config?.antiBotMode ?? 0}
            </Badge>

            <Badge 
              variant="outline"
              className="bg-purple-500/10 text-purple-600 border-purple-500/20"
            >
              Claim Mode: {config?.claimMode ?? 0}
            </Badge>

            <Badge 
              variant="outline"
              className="bg-amber-500/10 text-amber-600 border-amber-500/20"
            >
              Wallet Limit: {config?.walletMintLimit?.toString() ?? '0'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
