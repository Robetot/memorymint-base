import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  DollarSign,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { ContractCapabilities } from './types';
import { parseEther, parseUnits } from 'viem';

interface AdminTreasurySectionProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  isPreviewMode: boolean;
  onDepositETH: (amount: bigint) => Promise<boolean>;
  onDepositUSDC: (amount: bigint) => Promise<boolean>;
  onWithdrawFees: () => Promise<boolean>;
  onWithdrawFeesUSDC: () => Promise<boolean>;
  onRefresh: () => Promise<void>;
  isPending: boolean;
}

export function AdminTreasurySection({ 
  config, 
  capabilities,
  isPreviewMode,
  onDepositETH,
  onDepositUSDC,
  onWithdrawFees,
  onWithdrawFeesUSDC,
  onRefresh,
  isPending,
}: AdminTreasurySectionProps) {
  const [depositETHAmount, setDepositETHAmount] = useState('');
  const [depositUSDCAmount, setDepositUSDCAmount] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;
  const feesETH = config?.totalFeesCollectedETH ?? 0n;
  const feesUSDC = config?.totalFeesCollectedUSDC ?? 0n;

  const formatETH = (value: bigint) => (Number(value) / 1e18).toFixed(4);
  const formatUSDC = (value: bigint) => (Number(value) / 1e6).toFixed(2);

  const handleDepositETH = async () => {
    if (!depositETHAmount) return;
    try {
      const amount = parseEther(depositETHAmount);
      const success = await onDepositETH(amount);
      if (success) setDepositETHAmount('');
    } catch (err) {
      console.error('Invalid ETH amount:', err);
    }
  };

  const handleDepositUSDC = async () => {
    if (!depositUSDCAmount) return;
    try {
      const amount = parseUnits(depositUSDCAmount, 6);
      const success = await onDepositUSDC(amount);
      if (success) setDepositUSDCAmount('');
    } catch (err) {
      console.error('Invalid USDC amount:', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const canDeposit = capabilities.hasDepositETH || capabilities.hasDepositUSDC;
  const canWithdraw = feesETH > 0n || feesUSDC > 0n;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Treasury Management
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Pool Balances */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
              <Coins className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{formatETH(bonusPoolETH)} ETH</p>
              <p className="text-xs text-muted-foreground">Bonus Pool (ETH)</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold">${formatUSDC(bonusPoolUSDC)}</p>
              <p className="text-xs text-muted-foreground">Bonus Pool (USDC)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fees Collected */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Fees Collected
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-lg font-bold">{formatETH(feesETH)} ETH</p>
              <p className="text-xs text-muted-foreground">ETH Fees</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-lg font-bold">${formatUSDC(feesUSDC)}</p>
              <p className="text-xs text-muted-foreground">USDC Fees</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onWithdrawFees}
              disabled={isPreviewMode || isPending || feesETH === 0n}
              className="flex-1"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw ETH Fees'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onWithdrawFeesUSDC}
              disabled={isPreviewMode || isPending || feesUSDC === 0n}
              className="flex-1"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw USDC Fees'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deposit to Bonus Pool */}
      {canDeposit && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Deposit to Bonus Pool
            </h4>

            {capabilities.hasDepositETH && (
              <div className="space-y-2">
                <Label>Deposit ETH</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="0.1"
                    value={depositETHAmount}
                    onChange={(e) => setDepositETHAmount(e.target.value)}
                    disabled={isPreviewMode || isPending}
                  />
                  <Button
                    onClick={handleDepositETH}
                    disabled={isPreviewMode || isPending || !depositETHAmount}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
                  </Button>
                </div>
              </div>
            )}

            {capabilities.hasDepositUSDC && (
              <div className="space-y-2">
                <Label>Deposit USDC</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder="100"
                    value={depositUSDCAmount}
                    onChange={(e) => setDepositUSDCAmount(e.target.value)}
                    disabled={isPreviewMode || isPending}
                  />
                  <Button
                    onClick={handleDepositUSDC}
                    disabled={isPreviewMode || isPending || !depositUSDCAmount}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!canDeposit && !canWithdraw && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <Badge variant="outline">Treasury features not available</Badge>
        </div>
      )}
    </div>
  );
}
