import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Wallet,
  Coins,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { AdminToggle } from './AdminToggle';
import { ContractConfig } from '@/hooks/useContractReads';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';

interface AdminTreasuryTogglesProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  isPending: boolean;
  
  // Handlers
  onDepositETH: (amount: bigint) => Promise<boolean>;
  onDepositUSDC: (amount: bigint) => Promise<boolean>;
  onWithdrawFees: () => Promise<boolean>;
  onWithdrawETH: (amount: bigint) => Promise<boolean>;
  onWithdrawUSDC: (amount: bigint) => Promise<boolean>;
  onSetAllowBonusDeposit: (enabled: boolean) => Promise<boolean>;
  onSetWithdrawFeesEnabled: (enabled: boolean) => Promise<boolean>;
  onRefresh: () => void;
}

export function AdminTreasuryToggles({
  config,
  isPreviewMode,
  isPending,
  onDepositETH,
  onDepositUSDC,
  onWithdrawFees,
  onWithdrawETH,
  onWithdrawUSDC,
  onSetAllowBonusDeposit,
  onSetWithdrawFeesEnabled,
  onRefresh,
}: AdminTreasuryTogglesProps) {
  // Read on-chain state for toggles
  const allowBonusDeposit = config?.allowBonusDeposit ?? false;
  const withdrawFeesEnabled = config?.withdrawFeesEnabled ?? false;
  
  const [depositETH, setDepositETH] = useState('');
  const [depositUSDC, setDepositUSDC] = useState('');
  const [withdrawETH, setWithdrawETH] = useState('');
  const [withdrawUSDC, setWithdrawUSDC] = useState('');
  
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;
  const feesETH = config?.totalFeesCollectedETH ?? 0n;
  const feesUSDC = config?.totalFeesCollectedUSDC ?? 0n;

  // Handle ETH deposit
  const handleDepositETH = async () => {
    if (!depositETH) return;
    setIsDepositing(true);
    try {
      const amount = parseEther(depositETH);
      const success = await onDepositETH(amount);
      if (success) {
        setDepositETH('');
        onRefresh();
      }
    } finally {
      setIsDepositing(false);
    }
  };

  // Handle USDC deposit
  const handleDepositUSDC = async () => {
    if (!depositUSDC) return;
    setIsDepositing(true);
    try {
      const amount = parseUnits(depositUSDC, 6);
      const success = await onDepositUSDC(amount);
      if (success) {
        setDepositUSDC('');
        onRefresh();
      }
    } finally {
      setIsDepositing(false);
    }
  };

  // Handle withdraw fees
  const handleWithdrawFees = async () => {
    setIsWithdrawing(true);
    try {
      await onWithdrawFees();
      onRefresh();
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle ETH withdrawal from bonus pool
  const handleWithdrawETH = async () => {
    if (!withdrawETH) return;
    setIsWithdrawing(true);
    try {
      const ethAmount = parseEther(withdrawETH);
      const success = await onWithdrawETH(ethAmount);
      if (success) {
        setWithdrawETH('');
        onRefresh();
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle USDC withdrawal from bonus pool
  const handleWithdrawUSDC = async () => {
    if (!withdrawUSDC) return;
    setIsWithdrawing(true);
    try {
      const usdcAmount = parseUnits(withdrawUSDC, 6);
      const success = await onWithdrawUSDC(usdcAmount);
      if (success) {
        setWithdrawUSDC('');
        onRefresh();
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-500" />
          Treasury Controls
        </h3>
      </div>

      {/* Balances Display */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Coins className="h-4 w-4 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold tabular-nums">{formatEther(bonusPoolETH)} ETH</p>
            <p className="text-xs text-muted-foreground">Bonus Pool</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-lg font-bold tabular-nums">${formatUnits(bonusPoolUSDC, 6)}</p>
            <p className="text-xs text-muted-foreground">Bonus Pool</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-500/20">
        <CardContent className="p-4 space-y-4">
          {/* Deposit Toggle - reads from on-chain allowBonusDeposit() */}
          <AdminToggle
            id="deposit-enabled"
            label="Allow Bonus Deposits"
            description="Enable depositing ETH or USDC to bonus pool (on-chain)"
            icon={<ArrowDownCircle className="h-4 w-4" />}
            isEnabled={allowBonusDeposit}
            onToggle={onSetAllowBonusDeposit}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant="success"
          >
            {/* Deposit Controls */}
            <div className="space-y-3">
              {/* ETH Deposit */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Coins className="h-3 w-3" /> ETH Amount
                  </Label>
                  <Input
                    type="text"
                    placeholder="0.1"
                    value={depositETH}
                    onChange={(e) => setDepositETH(e.target.value)}
                    disabled={isPreviewMode || isPending || isDepositing}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleDepositETH}
                  disabled={isPreviewMode || isPending || isDepositing || !depositETH}
                  className="mt-auto h-8"
                >
                  {isDepositing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Deposit'}
                </Button>
              </div>

              {/* USDC Deposit */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> USDC Amount
                  </Label>
                  <Input
                    type="text"
                    placeholder="100"
                    value={depositUSDC}
                    onChange={(e) => setDepositUSDC(e.target.value)}
                    disabled={isPreviewMode || isPending || isDepositing}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleDepositUSDC}
                  disabled={isPreviewMode || isPending || isDepositing || !depositUSDC}
                  className="mt-auto h-8"
                >
                  {isDepositing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Deposit'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ USDC deposits require prior approval
              </p>
            </div>
          </AdminToggle>

          {/* Withdraw Toggle - reads from on-chain withdrawFeesEnabled() */}
          <AdminToggle
            id="withdraw-enabled"
            label="Withdraw Fees Enabled"
            description="Enable withdrawing collected fees and bonus pool (on-chain)"
            icon={<ArrowUpCircle className="h-4 w-4" />}
            isEnabled={withdrawFeesEnabled}
            onToggle={onSetWithdrawFeesEnabled}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant="default"
          >
            {/* Withdraw Controls */}
            <div className="space-y-3">
              {/* Withdraw Fees */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleWithdrawFees}
                disabled={isPreviewMode || isPending || isWithdrawing}
                className="w-full"
              >
                {isWithdrawing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                )}
                Withdraw Mint Fees
              </Button>

              {/* Bonus Pool Withdrawal - Separate ETH/USDC */}
              <div className="pt-2 border-t border-border/30">
                <Label className="text-xs font-medium mb-2 block">Withdraw from Bonus Pool</Label>
                
                {/* ETH Withdrawal */}
                <div className="space-y-2 mb-3">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">ETH Amount</Label>
                      <Input
                        type="text"
                        placeholder={formatEther(bonusPoolETH)}
                        value={withdrawETH}
                        onChange={(e) => setWithdrawETH(e.target.value)}
                        disabled={isPreviewMode || isPending || isWithdrawing}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleWithdrawETH}
                      disabled={isPreviewMode || isPending || isWithdrawing || !withdrawETH}
                      className="self-end"
                    >
                      {isWithdrawing ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                      )}
                      Withdraw ETH
                    </Button>
                  </div>
                </div>

                {/* USDC Withdrawal */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">USDC Amount</Label>
                      <Input
                        type="text"
                        placeholder={formatUnits(bonusPoolUSDC, 6)}
                        value={withdrawUSDC}
                        onChange={(e) => setWithdrawUSDC(e.target.value)}
                        disabled={isPreviewMode || isPending || isWithdrawing}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleWithdrawUSDC}
                      disabled={isPreviewMode || isPending || isWithdrawing || !withdrawUSDC}
                      className="self-end"
                    >
                      {isWithdrawing ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                      )}
                      Withdraw USDC
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </AdminToggle>
        </CardContent>
      </Card>
    </div>
  );
}
