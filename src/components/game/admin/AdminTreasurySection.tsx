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
  AlertTriangle,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { ContractCapabilities } from './types';
import { parseEther, parseUnits } from 'viem';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AdminTreasurySectionProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  isPreviewMode: boolean;
  onDepositETH: (amount: bigint) => Promise<boolean>;
  onDepositUSDC: (amount: bigint) => Promise<boolean>;
  onWithdrawFees: () => Promise<boolean>;
  onWithdrawBonusPool: (ethAmount: bigint, usdcAmount: bigint) => Promise<boolean>;
  onEmergencyWithdraw?: () => Promise<boolean>;
  onRefresh: () => Promise<void> | Promise<any>;
  isPending: boolean;
}

export function AdminTreasurySection({ 
  config, 
  capabilities,
  isPreviewMode,
  onDepositETH,
  onDepositUSDC,
  onWithdrawFees,
  onWithdrawBonusPool,
  onEmergencyWithdraw,
  onRefresh,
  isPending,
}: AdminTreasurySectionProps) {
  const [depositETHAmount, setDepositETHAmount] = useState('');
  const [depositUSDCAmount, setDepositUSDCAmount] = useState('');
  const [withdrawETHAmount, setWithdrawETHAmount] = useState('');
  const [withdrawUSDCAmount, setWithdrawUSDCAmount] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);

  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;
  const feesETH = config?.totalFeesCollectedETH ?? 0n;
  const feesUSDC = config?.totalFeesCollectedUSDC ?? 0n;
  const totalBonusClaimedETH = config?.totalBonusClaimedETH ?? 0n;
  const totalBonusClaimedUSDC = config?.totalBonusClaimedUSDC ?? 0n;

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

  const handleWithdrawBonusPool = async () => {
    try {
      const ethAmount = withdrawETHAmount ? parseEther(withdrawETHAmount) : 0n;
      const usdcAmount = withdrawUSDCAmount ? parseUnits(withdrawUSDCAmount, 6) : 0n;
      if (ethAmount === 0n && usdcAmount === 0n) return;
      const success = await onWithdrawBonusPool(ethAmount, usdcAmount);
      if (success) {
        setWithdrawETHAmount('');
        setWithdrawUSDCAmount('');
      }
    } catch (err) {
      console.error('Invalid withdraw amount:', err);
    }
  };

  const handleEmergencyWithdraw = async () => {
    setShowEmergencyDialog(false);
    if (onEmergencyWithdraw) {
      await onEmergencyWithdraw();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const canDeposit = capabilities.hasDepositETH || capabilities.hasDepositUSDC;
  const canWithdrawFees = feesETH > 0n;
  const canWithdrawBonus = bonusPoolETH > 0n || bonusPoolUSDC > 0n;

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

          {/* Total Bonus Claimed Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="p-2 rounded bg-muted/30 text-center">
              <p className="text-muted-foreground">Total Claimed (ETH)</p>
              <p className="font-medium">{formatETH(totalBonusClaimedETH)} ETH</p>
            </div>
            <div className="p-2 rounded bg-muted/30 text-center">
              <p className="text-muted-foreground">Total Claimed (USDC)</p>
              <p className="font-medium">${formatUSDC(totalBonusClaimedUSDC)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fees Collected - ETH only (V3 contract) */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Mint Fees Collected
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={onWithdrawFees}
            disabled={isPreviewMode || isPending || !canWithdrawFees}
            className="w-full"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw Mint Fees (ETH)'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Note: withdrawMintFees() withdraws accumulated ETH fees to owner
          </p>
        </CardContent>
      </Card>

      {/* Withdraw from Bonus Pool */}
      {canWithdrawBonus && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw from Bonus Pool
            </h4>
            <p className="text-xs text-muted-foreground">
              Use withdrawBonusPool(ethAmount, usdcAmount) to withdraw specific amounts
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ETH Amount</Label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="0.0"
                  value={withdrawETHAmount}
                  onChange={(e) => setWithdrawETHAmount(e.target.value)}
                  disabled={isPreviewMode || isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>USDC Amount</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={withdrawUSDCAmount}
                  onChange={(e) => setWithdrawUSDCAmount(e.target.value)}
                  disabled={isPreviewMode || isPending}
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleWithdrawBonusPool}
              disabled={isPreviewMode || isPending || (!withdrawETHAmount && !withdrawUSDCAmount)}
              className="w-full"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw from Bonus Pool'}
            </Button>
          </CardContent>
        </Card>
      )}

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
                <Label>Deposit ETH (payable)</Label>
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
                <p className="text-xs text-muted-foreground">
                  Calls depositBonusPool() with ETH value
                </p>
              </div>
            )}

            {capabilities.hasDepositUSDC && (
              <div className="space-y-2">
                <Label>Deposit USDC (requires approval)</Label>
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
                <p className="text-xs text-muted-foreground">
                  Calls depositBonusPoolUSDC(amount) - ensure USDC approval first
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Emergency Withdraw */}
      {capabilities.hasEmergencyWithdraw && onEmergencyWithdraw && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Emergency Withdraw
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Withdraws ALL contract funds immediately
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowEmergencyDialog(true)}
                disabled={isPreviewMode || isPending}
              >
                Emergency
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!canDeposit && !canWithdrawFees && !canWithdrawBonus && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <Badge variant="outline">Treasury features not available</Badge>
        </div>
      )}

      {/* Emergency Withdraw Confirmation */}
      <AlertDialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Emergency Withdraw
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">⚠️ WARNING:</strong> This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Withdraw ALL ETH from the contract</li>
                <li>Withdraw ALL USDC from the contract</li>
                <li>Empty both bonus pools and fees</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmergencyWithdraw}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Emergency Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}