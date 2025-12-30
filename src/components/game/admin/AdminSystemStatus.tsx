import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Gift, 
  Coins, 
  Users, 
  CheckCircle2, 
  XCircle,
  Layers,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { formatEther, formatUnits } from 'viem';
import { USDC_DECIMALS, NFT_CONTRACT_ADDRESS } from '@/contracts/MemoryMintContract';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AdminSystemStatusProps {
  config: ContractConfig | null;
  isLoading: boolean;
}

export function AdminSystemStatus({ config, isLoading }: AdminSystemStatusProps) {
  const formatAddress = (addr: string) => 
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown';

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied to clipboard');
  };

  const openBaseScan = (addr: string) => {
    window.open(`https://basescan.org/address/${addr}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statusItems = [
    {
      label: 'Minting',
      value: config?.mintEnabled ?? false,
      icon: Coins,
      activeText: 'Enabled',
      inactiveText: 'Disabled',
    },
    {
      label: 'Rewards',
      value: config?.claimEnabled ?? false,
      icon: Gift,
      activeText: 'Active',
      inactiveText: 'Inactive',
    },
    {
      label: 'Bonus System',
      value: (config?.bonusPoolETH ?? 0n) > 0n || (config?.bonusPoolUSDC ?? 0n) > 0n,
      icon: Layers,
      activeText: 'Configured',
      inactiveText: 'Not Setup',
    },
    {
      label: 'Total Minted',
      value: config?.totalSupply?.toString() ?? '0',
      icon: Users,
      isNumber: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Contract Connected
        </Badge>
        <Badge variant="outline" className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/30">
          Network: Base
        </Badge>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statusItems.map((item) => (
          <Card key={item.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              {item.isNumber ? (
                <p className="text-xl font-bold text-foreground">{item.value}</p>
              ) : (
                <Badge 
                  variant={item.value ? "default" : "secondary"}
                  className={item.value 
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30" 
                    : "bg-muted text-muted-foreground"
                  }
                >
                  {item.value ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {item.activeText}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      {item.inactiveText}
                    </>
                  )}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bonus Pool Balances */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Bonus Pool Balances
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ETH Balance</p>
            <p className="text-lg font-bold">
              {config ? formatEther(config.bonusPoolETH) : '0'} ETH
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">USDC Balance</p>
            <p className="text-lg font-bold">
              ${config ? formatUnits(config.bonusPoolUSDC, USDC_DECIMALS) : '0'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contract Info */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Contract Owner</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {formatAddress(config?.owner ?? '')}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Contract Address</span>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {formatAddress(NFT_CONTRACT_ADDRESS)}
              </code>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => copyAddress(NFT_CONTRACT_ADDRESS)}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => openBaseScan(NFT_CONTRACT_ADDRESS)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
