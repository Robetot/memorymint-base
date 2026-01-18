import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Gift, 
  Loader2,
  Save,
  Coins,
  DollarSign,
} from 'lucide-react';
import { AdminToggle } from './AdminToggle';
import { ContractConfig } from '@/hooks/useContractReads';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';

// Claim mode enum: 0=Disabled, 1=FCFS, 2=Unlimited, 3=OneTime, 4=Custom
const CLAIM_MODES = [
  { value: 0, label: 'Disabled', description: 'Claims are disabled' },
  { value: 1, label: 'FCFS', description: 'First-come first-served' },
  { value: 2, label: 'Unlimited', description: 'Unlimited claims' },
  { value: 3, label: 'One-Time', description: 'One claim per wallet' },
  { value: 4, label: 'Custom', description: 'Custom rules apply' },
] as const;

interface AdminClaimTogglesProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  isPending: boolean;
  
  // Handlers
  onSetClaimsPaused: (paused: boolean) => Promise<boolean>;
  onSetClaimMode: (mode: number) => Promise<boolean>;
  onSetDynamicBonusEnabled: (enabled: boolean) => Promise<boolean>;
  onSetLevelBonus: (level: number, bonusETH: bigint, bonusUSDC: bigint) => Promise<boolean>;
}

export function AdminClaimToggles({
  config,
  isPreviewMode,
  isPending,
  onSetClaimsPaused,
  onSetClaimMode,
  onSetDynamicBonusEnabled,
  onSetLevelBonus,
}: AdminClaimTogglesProps) {
  const [bonusLevel, setBonusLevel] = useState('1');
  const [bonusETH, setBonusETH] = useState('');
  const [bonusUSDC, setBonusUSDC] = useState('');
  const [isSettingBonus, setIsSettingBonus] = useState(false);

  const claimMode = config?.claimMode ?? 0;
  const claimsEnabled = config?.claimEnabled ?? (claimMode > 0);
  
  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;

  // Toggle: Claim Mode
  const handleToggleClaims = async (enabled: boolean) => {
    if (enabled) {
      // Enable claims - set mode to FCFS if disabled
      if (claimMode === 0) {
        await onSetClaimMode(1);
      }
      return onSetClaimsPaused(false);
    } else {
      return onSetClaimsPaused(true);
    }
  };

  // Toggle: Dynamic Bonus Levels
  const handleToggleDynamicBonus = async (enabled: boolean) => {
    return onSetDynamicBonusEnabled(enabled);
  };

  // Set level bonus
  const handleSetBonus = async () => {
    const level = parseInt(bonusLevel, 10);
    if (isNaN(level) || level < 1) return;

    setIsSettingBonus(true);
    try {
      const ethWei = bonusETH ? parseEther(bonusETH) : 0n;
      const usdcUnits = bonusUSDC ? parseUnits(bonusUSDC, 6) : 0n;
      await onSetLevelBonus(level, ethWei, usdcUnits);
      setBonusETH('');
      setBonusUSDC('');
    } finally {
      setIsSettingBonus(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-purple-500" />
          Claim & Bonus Controls
        </h3>
        <Badge 
          variant="outline" 
          className={claimsEnabled 
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
            : 'bg-muted text-muted-foreground'
          }
        >
          {claimsEnabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      {/* Bonus Pool Status */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Coins className="h-4 w-4 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold tabular-nums">{formatEther(bonusPoolETH)}</p>
            <p className="text-xs text-muted-foreground">Pool (ETH)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-lg font-bold tabular-nums">${formatUnits(bonusPoolUSDC, 6)}</p>
            <p className="text-xs text-muted-foreground">Pool (USDC)</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-purple-500/20">
        <CardContent className="p-4 space-y-4">
          {/* Claims Enabled Toggle */}
          <AdminToggle
            id="claims-enabled"
            label="Bonus Claiming"
            description={claimsEnabled 
              ? `Mode: ${CLAIM_MODES.find(m => m.value === claimMode)?.label}` 
              : 'Users cannot claim bonuses'
            }
            icon={<Gift className="h-4 w-4" />}
            isEnabled={claimsEnabled}
            onToggle={handleToggleClaims}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={claimsEnabled ? 'success' : 'default'}
          />

          {/* Dynamic Bonus Levels Toggle */}
          <AdminToggle
            id="dynamic-bonus"
            label="Enable Bonus Levels"
            description="Configure per-level bonus amounts"
            icon={<Gift className="h-4 w-4" />}
            isEnabled={claimMode > 0}
            onToggle={handleToggleDynamicBonus}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
          >
            {/* Level Bonus Configuration */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Set Level Bonus</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Level</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={bonusLevel}
                    onChange={(e) => setBonusLevel(e.target.value)}
                    disabled={isPreviewMode || isPending || isSettingBonus}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ETH Bonus</Label>
                  <Input
                    type="text"
                    placeholder="0.01"
                    value={bonusETH}
                    onChange={(e) => setBonusETH(e.target.value)}
                    disabled={isPreviewMode || isPending || isSettingBonus}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">USDC Bonus</Label>
                  <Input
                    type="text"
                    placeholder="10.00"
                    value={bonusUSDC}
                    onChange={(e) => setBonusUSDC(e.target.value)}
                    disabled={isPreviewMode || isPending || isSettingBonus}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSetBonus}
                disabled={isPreviewMode || isPending || isSettingBonus}
                className="w-full"
              >
                {isSettingBonus ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Set Level {bonusLevel} Bonus
              </Button>
            </div>
          </AdminToggle>
        </CardContent>
      </Card>
    </div>
  );
}
