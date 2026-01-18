import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3,
  Coins,
  DollarSign,
  Hash,
  Gift,
  User,
  FileCode,
  Lock,
  ExternalLink,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContractConfig } from '@/hooks/useContractReads';
import { NFT_CONTRACT_ADDRESS } from '@/contracts/MemoryMintContract';
import { toast } from 'sonner';

interface AdminReadOnlyStatsProps {
  config: ContractConfig | null;
  walletAddress: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function AdminReadOnlyStats({ 
  config, 
  walletAddress,
  isRefreshing = false,
  onRefresh 
}: AdminReadOnlyStatsProps) {
  const formatETH = (value: bigint | undefined): string => {
    if (!value) return '0.0000';
    return (Number(value) / 1e18).toFixed(4);
  };

  const formatUSDC = (value: bigint | undefined): string => {
    if (!value) return '0.00';
    return (Number(value) / 1e6).toFixed(2);
  };

  const formatAddress = (addr: string): string => {
    if (!addr) return '...';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openOnBaseScan = (addr: string) => {
    window.open(`https://basescan.org/address/${addr}`, '_blank');
  };

  const totalMinted = config?.totalSupply ?? 0n;
  const nextTokenId = config?.nextTokenId ?? 1n;
  const mintPriceETH = config?.mintPriceETH ?? 0n;
  const mintPriceUSDC = config?.mintPriceUSDC ?? 0n;
  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;
  const totalBonusClaimedETH = config?.totalBonusClaimedETH ?? 0n;
  const totalBonusClaimedUSDC = config?.totalBonusClaimedUSDC ?? 0n;
  const currentOwner = config?.owner ?? '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Live Contract State
          <Badge variant="outline" className="text-xs">Read-Only</Badge>
        </h3>
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Lock notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
        <Lock className="h-3 w-3" />
        <span>These values are read-only and always reflect on-chain state.</span>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Total Minted */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Hash className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold tabular-nums">{totalMinted.toString()}</p>
            <p className="text-xs text-muted-foreground">Total Minted</p>
          </CardContent>
        </Card>

        {/* Next Token ID */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Hash className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold tabular-nums">{nextTokenId.toString()}</p>
            <p className="text-xs text-muted-foreground">Next Token ID</p>
          </CardContent>
        </Card>

        {/* Mint Price ETH */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Coins className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold">
              {mintPriceETH === 0n ? (
                <span className="text-emerald-500">Free</span>
              ) : (
                `${formatETH(mintPriceETH)}`
              )}
            </p>
            <p className="text-xs text-muted-foreground">Mint Price (ETH)</p>
          </CardContent>
        </Card>

        {/* Mint Price USDC */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xl font-bold">
              {mintPriceUSDC === 0n ? (
                <span className="text-emerald-500">Free</span>
              ) : (
                `$${formatUSDC(mintPriceUSDC)}`
              )}
            </p>
            <p className="text-xs text-muted-foreground">Mint Price (USDC)</p>
          </CardContent>
        </Card>

        {/* Bonus Pool ETH */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Gift className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-xl font-bold tabular-nums">{formatETH(bonusPoolETH)}</p>
            <p className="text-xs text-muted-foreground">Bonus Pool (ETH)</p>
          </CardContent>
        </Card>

        {/* Bonus Pool USDC */}
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Gift className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-xl font-bold tabular-nums">${formatUSDC(bonusPoolUSDC)}</p>
            <p className="text-xs text-muted-foreground">Bonus Pool (USDC)</p>
          </CardContent>
        </Card>
      </div>

      {/* Total Bonus Claimed */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Gift className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">Total Bonus Claimed</span>
          </div>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                {formatETH(totalBonusClaimedETH)} ETH
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                ${formatUSDC(totalBonusClaimedUSDC)} USDC
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Info */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          {/* Contract Address */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Contract</span>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-xs font-mono">{formatAddress(NFT_CONTRACT_ADDRESS)}</code>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(NFT_CONTRACT_ADDRESS)}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openOnBaseScan(NFT_CONTRACT_ADDRESS)}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Current Owner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Owner</span>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-xs font-mono">{formatAddress(currentOwner)}</code>
              {currentOwner && (
                <>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(currentOwner)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openOnBaseScan(currentOwner)}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Admin Wallet */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Admin Wallet</span>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-xs font-mono">{formatAddress(walletAddress)}</code>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(walletAddress)}>
                <Copy className="h-3 w-3" />
              </Button>
              {walletAddress.toLowerCase() === currentOwner.toLowerCase() && (
                <Badge variant="outline" className="text-xs ml-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  ✓ Owner
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
