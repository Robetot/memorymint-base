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
  
  // Handlers - using explicit contract functions
  onSetClaimsPaused: (paused: boolean) => Promise<boolean>;
  onSetClaimMode: (mode: number) => Promise<boolean>;
  onSetBonusClaimActive: (active: boolean) => Promise<boolean>;
  onSetBonusLevelsEnabled: (enabled: boolean) => Promise<boolean>;
  onSetLevelBonus: (level: number, bonusETH: bigint, bonusUSDC: bigint) => Promise<boolean>;
}

export function AdminClaimToggles({
  config,
  isPreviewMode,
  isPending,
  onSetClaimsPaused,
  onSetClaimMode,
  onSetBonusClaimActive,
  onSetBonusLevelsEnabled,
  onSetLevelBonus,
}: AdminClaimTogglesProps) {
  const [bonusLevel, setBonusLevel] = useState('1');
  const [bonusETH, setBonusETH] = useState('');
  const [bonusUSDC, setBonusUSDC] = useState('');
  const [isSettingBonus, setIsSettingBonus] = useState(false);

  // Use explicit getters from contract - DO NOT INFER
  const claimMode = config?.claimMode ?? 0;
  const isBonusClaimActive = config?.isBonusClaimActive ?? config?.bonusClaimActive ?? false;
  const bonusLevelsEnabled = config?.bonusLevelsEnabled ?? false;
  
  const bonusPoolETH = config?.bonusPoolETH ?? 0n;
  const bonusPoolUSDC = config?.bonusPoolUSDC ?? 0n;

  // Toggle: Bonus Claim Active - uses setBonusClaimActive()
  const handleToggleBonusClaim = async (active: boolean) => {
    return onSetBonusClaimActive(active);
  };

  // Toggle: Bonus Levels Enabled - uses setBonusLevelsEnabled()
  const handleToggleBonusLevels = async (enabled: boolean) => {
    return onSetBonusLevelsEnabled(enabled);
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
          className={isBonusClaimActive 
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
            : 'bg-muted text-muted-foreground'
          }
        >
          {isBonusClaimActive ? 'Active' : 'Disabled'}
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
          {/* Bonus Claim Active Toggle - uses bonusClaimActive() */}
          <AdminToggle
            id="bonus-claim-active"
            label="Bonus Claiming"
            description={isBonusClaimActive 
              ? `Mode: ${CLAIM_MODES.find(m => m.value === claimMode)?.label || 'Active'}` 
              : 'Users cannot claim bonuses'
            }
            icon={<Gift className="h-4 w-4" />}
            isEnabled={isBonusClaimActive}
            onToggle={handleToggleBonusClaim}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={isBonusClaimActive ? 'success' : 'default'}
          />

          {/* Bonus Levels Enabled Toggle - uses bonusLevelsEnabled() */}
          <AdminToggle
            id="bonus-levels-enabled"
            label="Bonus Levels Enabled"
            description={bonusLevelsEnabled ? 'Per-level bonuses active' : 'Configure per-level bonus amounts'}
            icon={<Gift className="h-4 w-4" />}
            isEnabled={bonusLevelsEnabled}
            onToggle={handleToggleBonusLevels}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={bonusLevelsEnabled ? 'success' : 'default'}
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
