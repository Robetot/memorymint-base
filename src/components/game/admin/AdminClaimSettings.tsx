import { useState, useEffect, useMemo } from 'react';
import { formatEther, formatUnits } from 'viem';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Gift, 
  Clock, 
  Users,
  RefreshCw,
  Loader2,
  Fuel,
  Coins,
  DollarSign,
  AlertTriangle,
  Wallet,
  Plus,
  Minus,
} from 'lucide-react';
import { ContractConfig, BonusLevelInfo } from '@/hooks/useContractReads';
import { ClaimModeEnum, PaymentCurrency, USDC_DECIMALS } from '@/contracts/MemoryMintContract';

interface AdminClaimSettingsProps {
  config: ContractConfig | null;
  bonusLevels: BonusLevelInfo[];
  isPreviewMode: boolean;
  onSaveChanges: (settings: ClaimSettingsData) => Promise<boolean>;
  onDepositETH: (amount: string) => Promise<boolean>;
  onDepositUSDC: (amount: string) => Promise<boolean>;
  onWithdrawETH: (amount: string) => Promise<boolean>;
  onWithdrawUSDC: (amount: string) => Promise<boolean>;
  isPending: boolean;
}

export interface ClaimSettingsData {
  claimsEnabled: boolean;
  cooldownEnabled: boolean;
  cooldownHours: number;
  maxClaimsPerWallet: number;
  claimMode: number;
  activeBonusCurrency: PaymentCurrency;
}

export function AdminClaimSettings({ 
  config, 
  bonusLevels,
  isPreviewMode,
  onSaveChanges,
  onDepositETH,
  onDepositUSDC,
  onWithdrawETH,
  onWithdrawUSDC,
  isPending,
}: AdminClaimSettingsProps) {
  // Local state for form
  const [localSettings, setLocalSettings] = useState<ClaimSettingsData>({
    claimsEnabled: config?.claimEnabled ?? false,
    cooldownEnabled: false,
    cooldownHours: 24,
    maxClaimsPerWallet: 1,
    claimMode: config?.claimMode ?? ClaimModeEnum.DISABLED,
    activeBonusCurrency: config?.activeBonusCurrency ?? 'ETH',
  });

  // Deposit/Withdraw dialog state
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [fundDialogMode, setFundDialogMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [fundCurrency, setFundCurrency] = useState<PaymentCurrency>('ETH');
  const [fundAmount, setFundAmount] = useState('');

  // Store the on-chain state as source of truth for comparison
  const onChainState = useMemo(() => {
    if (!config) return null;
    return {
      claimsEnabled: config.claimEnabled,
      claimMode: config.claimMode,
      activeBonusCurrency: config.activeBonusCurrency,
    };
  }, [config]);

  // Sync with config when it changes (after tx confirmation)
  useEffect(() => {
    if (config) {
      setLocalSettings(prev => ({
        ...prev,
        claimsEnabled: config.claimEnabled,
        claimMode: config.claimMode,
        activeBonusCurrency: config.activeBonusCurrency,
      }));
    }
  }, [config]);

  // Calculate required funds for active tiers
  const requiredFunds = useMemo(() => {
    const activeTiers = bonusLevels.filter(l => l.active);
    let ethRequired = 0n;
    let usdcRequired = 0n;
    
    for (const tier of activeTiers) {
      // Multiply amount by remaining claims to get max potential payout
      ethRequired += tier.amountETH * tier.claimsRemaining;
      usdcRequired += tier.amountUSDC * tier.claimsRemaining;
    }
    
    return { eth: ethRequired, usdc: usdcRequired };
  }, [bonusLevels]);

  // Check if selected currency has sufficient funds
  const insufficientFundsWarning = useMemo(() => {
    if (!config) return null;
    
    const selectedCurrency = localSettings.activeBonusCurrency;
    const poolBalance = selectedCurrency === 'ETH' ? config.bonusPoolETH : config.bonusPoolUSDC;
    const required = selectedCurrency === 'ETH' ? requiredFunds.eth : requiredFunds.usdc;
    
    // Only warn if switching to a currency with insufficient funds
    if (poolBalance < required && localSettings.activeBonusCurrency !== onChainState?.activeBonusCurrency) {
      const shortfall = required - poolBalance;
      if (selectedCurrency === 'ETH') {
        return `Insufficient ETH in pool. Need ${formatEther(shortfall)} more ETH to cover all active tier claims.`;
      } else {
        return `Insufficient USDC in pool. Need $${formatUnits(shortfall, USDC_DECIMALS)} more USDC to cover all active tier claims.`;
      }
    }
    
    return null;
  }, [config, localSettings.activeBonusCurrency, requiredFunds, onChainState]);

  const handleChange = <K extends keyof ClaimSettingsData>(
    key: K,
    value: ClaimSettingsData[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await onSaveChanges(localSettings);
    // Config will be refetched after tx confirmation, which will update onChainState
  };

  const openFundDialog = (currency: PaymentCurrency, mode: 'deposit' | 'withdraw') => {
    setFundCurrency(currency);
    setFundDialogMode(mode);
    setFundAmount('');
    setFundDialogOpen(true);
  };

  const handleFundAction = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) return;
    
    let success = false;
    if (fundDialogMode === 'deposit') {
      success = fundCurrency === 'ETH' 
        ? await onDepositETH(fundAmount)
        : await onDepositUSDC(fundAmount);
    } else {
      success = fundCurrency === 'ETH' 
        ? await onWithdrawETH(fundAmount)
        : await onWithdrawUSDC(fundAmount);
    }
    
    if (success) {
      setFundDialogOpen(false);
      setFundAmount('');
    }
  };

  // Get max withdrawable amount
  const maxWithdrawable = useMemo(() => {
    if (!config) return { eth: '0', usdc: '0' };
    return {
      eth: formatEther(config.bonusPoolETH),
      usdc: formatUnits(config.bonusPoolUSDC, USDC_DECIMALS),
    };
  }, [config]);

  // Compare local settings against ON-CHAIN state (not UI-to-UI)
  const hasChanges = useMemo(() => {
    if (!onChainState) return false;
    return (
      localSettings.claimsEnabled !== onChainState.claimsEnabled ||
      localSettings.claimMode !== onChainState.claimMode ||
      localSettings.activeBonusCurrency !== onChainState.activeBonusCurrency
    );
  }, [localSettings, onChainState]);

  // Format pool balances for display
  const formattedPoolBalances = useMemo(() => {
    if (!config) return { eth: '0', usdc: '$0.00' };
    return {
      eth: formatEther(config.bonusPoolETH),
      usdc: formatUnits(config.bonusPoolUSDC, USDC_DECIMALS),
    };
  }, [config]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Claim Settings
        </h3>
        {hasChanges && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            Unsaved Changes
          </Badge>
        )}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-6">
          {/* Claims Enabled Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Claims Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow players to claim rewards
              </p>
            </div>
            <Switch
              checked={localSettings.claimsEnabled}
              onCheckedChange={(checked) => handleChange('claimsEnabled', checked)}
              disabled={isPreviewMode}
            />
          </div>

          {/* Cooldown Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Cooldown Enabled
              </Label>
              <p className="text-sm text-muted-foreground">
                Require waiting period between claims
              </p>
            </div>
            <Switch
              checked={localSettings.cooldownEnabled}
              onCheckedChange={(checked) => handleChange('cooldownEnabled', checked)}
              disabled={isPreviewMode}
            />
          </div>

          {/* Pool Balances Display with Deposit Buttons */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Bonus Pool Balances</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-md p-2 border ${localSettings.activeBonusCurrency === 'ETH' ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs text-muted-foreground">ETH Pool</span>
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openFundDialog('ETH', 'deposit')}
                      disabled={isPreviewMode || isPending}
                      title="Deposit ETH"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openFundDialog('ETH', 'withdraw')}
                      disabled={isPreviewMode || isPending || (config?.bonusPoolETH ?? 0n) === 0n}
                      title="Withdraw ETH"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-mono font-medium mt-0.5">
                  {parseFloat(formattedPoolBalances.eth).toFixed(4)} ETH
                </p>
              </div>
              <div className={`rounded-md p-2 border ${localSettings.activeBonusCurrency === 'USDC' ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">USDC Pool</span>
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openFundDialog('USDC', 'deposit')}
                      disabled={isPreviewMode || isPending}
                      title="Deposit USDC"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openFundDialog('USDC', 'withdraw')}
                      disabled={isPreviewMode || isPending || (config?.bonusPoolUSDC ?? 0n) === 0n}
                      title="Withdraw USDC"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-mono font-medium mt-0.5">
                  ${parseFloat(formattedPoolBalances.usdc).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Payout Currency Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Payout Currency
              </Label>
              <p className="text-sm text-muted-foreground">
                Currency used for claim rewards
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={localSettings.activeBonusCurrency === 'ETH' ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange('activeBonusCurrency', 'ETH')}
                disabled={isPreviewMode}
                className="gap-1"
              >
                <Coins className="h-3 w-3" />
                ETH
              </Button>
              <Button
                variant={localSettings.activeBonusCurrency === 'USDC' ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange('activeBonusCurrency', 'USDC')}
                disabled={isPreviewMode}
                className="gap-1"
              >
                <DollarSign className="h-3 w-3" />
                USDC
              </Button>
            </div>
          </div>

          {/* Insufficient Funds Warning */}
          {insufficientFundsWarning && (
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600 dark:text-amber-400">
                {insufficientFundsWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Claim Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Claim Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                One-time or repeatable claims
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={localSettings.claimMode === ClaimModeEnum.ONE_TIME ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange('claimMode', ClaimModeEnum.ONE_TIME)}
                disabled={isPreviewMode}
              >
                One-time
              </Button>
              <Button
                variant={localSettings.claimMode === ClaimModeEnum.UNLIMITED ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange('claimMode', ClaimModeEnum.UNLIMITED)}
                disabled={isPreviewMode}
              >
                Repeatable
              </Button>
            </div>
          </div>

          {/* Cooldown Time */}
          {localSettings.cooldownEnabled && (
            <div className="space-y-2">
              <Label>Cooldown Time (hours)</Label>
              <Input
                type="number"
                value={localSettings.cooldownHours}
                onChange={(e) => handleChange('cooldownHours', parseInt(e.target.value) || 0)}
                min="1"
                max="720"
                disabled={isPreviewMode}
              />
            </div>
          )}

          {/* Max Claims Per Wallet */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Max Claims Per Wallet
            </Label>
            <Input
              type="number"
              value={localSettings.maxClaimsPerWallet}
              onChange={(e) => handleChange('maxClaimsPerWallet', parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              disabled={isPreviewMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={!hasChanges || isPending || isPreviewMode}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <Fuel className="h-4 w-4 mr-2" />
            Save Changes
            {hasChanges && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Gas Required
              </Badge>
            )}
          </>
        )}
      </Button>

      {!hasChanges && !isPending && (
        <p className="text-center text-sm text-muted-foreground">
          Settings match on-chain values
        </p>
      )}

      {/* Fund Dialog (Deposit/Withdraw) */}
      <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {fundCurrency === 'ETH' ? (
                <Coins className="h-5 w-5 text-amber-500" />
              ) : (
                <DollarSign className="h-5 w-5 text-emerald-500" />
              )}
              {fundDialogMode === 'deposit' ? 'Deposit' : 'Withdraw'} {fundCurrency} {fundDialogMode === 'deposit' ? 'to' : 'from'} Bonus Pool
            </DialogTitle>
            <DialogDescription>
              {fundDialogMode === 'deposit' 
                ? `Enter the amount to deposit into the ${fundCurrency} bonus pool.`
                : `Enter the amount to withdraw from the ${fundCurrency} bonus pool. Max: ${fundCurrency === 'ETH' ? maxWithdrawable.eth : maxWithdrawable.usdc} ${fundCurrency}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fund-amount">
                Amount ({fundCurrency})
              </Label>
              <div className="relative">
                <Input
                  id="fund-amount"
                  type="number"
                  step={fundCurrency === 'ETH' ? '0.001' : '1'}
                  min="0"
                  max={fundDialogMode === 'withdraw' ? (fundCurrency === 'ETH' ? maxWithdrawable.eth : maxWithdrawable.usdc) : undefined}
                  placeholder={fundCurrency === 'ETH' ? '0.01' : '10.00'}
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {fundCurrency}
                </span>
              </div>
              {fundDialogMode === 'withdraw' && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setFundAmount(fundCurrency === 'ETH' ? maxWithdrawable.eth : maxWithdrawable.usdc)}
                >
                  Use max: {fundCurrency === 'ETH' ? maxWithdrawable.eth : maxWithdrawable.usdc} {fundCurrency}
                </Button>
              )}
            </div>
            
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <Fuel className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
                On-chain transaction (gas required)
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFundDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFundAction}
              disabled={!fundAmount || parseFloat(fundAmount) <= 0 || isPending}
              variant={fundDialogMode === 'withdraw' ? 'destructive' : 'default'}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {fundDialogMode === 'deposit' ? 'Depositing...' : 'Withdrawing...'}
                </>
              ) : (
                <>
                  {fundDialogMode === 'deposit' ? <Plus className="h-4 w-4 mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
                  {fundDialogMode === 'deposit' ? 'Deposit' : 'Withdraw'} {fundCurrency}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
