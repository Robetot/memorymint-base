import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2,
  AlertCircle,
  Coins,
  Zap,
  Gift,
  Shield,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { 
  ContractCapabilities,
  BonusLevel,
  BONUS_LEVELS,
  BonusLevelConfig,
} from './types';

interface AdminActionPreviewProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  bonusConfigs?: BonusLevelConfig[];
  isPreviewMode: boolean;
  onApplyChanges: () => Promise<void>;
  isPending: boolean;
}

interface ChangeItem {
  label: string;
  currentValue: string;
  newValue?: string;
  hasChange: boolean;
  icon: typeof Coins;
}

export function AdminActionPreview({ 
  config, 
  capabilities,
  bonusConfigs = [],
  isPreviewMode,
  onApplyChanges,
  isPending,
}: AdminActionPreviewProps) {
  const [isApplying, setIsApplying] = useState(false);

  const changes = useMemo<ChangeItem[]>(() => {
    return [
      {
        label: 'Mint Status',
        currentValue: config?.mintEnabled ? 'Enabled' : 'Disabled',
        icon: Coins,
        hasChange: false,
      },
      {
        label: 'Free Mint',
        currentValue: (config?.mintPriceETH ?? 0n) === 0n ? 'ON' : 'OFF',
        icon: Zap,
        hasChange: false,
      },
      {
        label: 'Anti-Bot',
        currentValue: config?.throttleEnabled ? 'Active' : 'Inactive',
        icon: Shield,
        hasChange: false,
      },
      {
        label: 'Enabled Bonuses',
        currentValue: bonusConfigs.filter(b => b.enabled).length.toString() + ' levels',
        icon: Gift,
        hasChange: false,
      },
    ];
  }, [config, bonusConfigs]);

  const hasAnyChanges = changes.some(c => c.hasChange);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyChanges();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Current Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-2">
          {changes.map((item) => (
            <div 
              key={item.label}
              className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium truncate">{item.currentValue}</p>
              </div>
              {item.hasChange && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                  Changed
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Preview Mode Notice */}
        {isPreviewMode && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Preview Mode Active</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No transactions will be sent. Disable preview mode to apply changes.
            </p>
          </div>
        )}

        {/* Apply Button - only if there's bonus/claim functionality */}
        {(capabilities.hasSetBonusLevel || capabilities.hasBonusPool) && hasAnyChanges && (
          <Button
            className="w-full"
            onClick={handleApply}
            disabled={isPreviewMode || isPending || isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply Changes'}
          </Button>
        )}

        {/* Info text when no advanced features */}
        {!capabilities.hasSetBonusLevel && !capabilities.hasBonusPool && (
          <p className="text-xs text-center text-muted-foreground">
            This contract uses individual on-chain transactions. 
            Changes are applied immediately when you toggle controls above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
