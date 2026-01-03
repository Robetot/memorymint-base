import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  Loader2,
  PlayCircle,
  PauseCircle,
  Zap,
  Info,
  Link as LinkIcon,
  Brain,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { ContractCapabilities, SAFE_DEFAULTS, ENFORCEMENT_LABELS, EnforcementType } from './types';

interface AdminMintSectionProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  isPreviewMode: boolean;
  onPause: () => Promise<boolean>;
  onUnpause: () => Promise<boolean>;
  onSetThrottle: (enabled: boolean) => Promise<boolean>;
  isPending: boolean;
}

function EnforcementBadge({ type }: { type: EnforcementType }) {
  const { icon, label } = ENFORCEMENT_LABELS[type];
  return (
    <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1">
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </Badge>
  );
}

export function AdminMintSection({ 
  config, 
  capabilities,
  isPreviewMode,
  onPause,
  onUnpause,
  onSetThrottle,
  isPending,
}: AdminMintSectionProps) {
  // Use safe defaults if config not loaded
  const [localPaused, setLocalPaused] = useState(config?.paused ?? SAFE_DEFAULTS.paused);
  const [localThrottle, setLocalThrottle] = useState(config?.throttleEnabled ?? SAFE_DEFAULTS.throttleEnabled);

  // Sync with on-chain state when config loads
  useEffect(() => {
    if (config) {
      setLocalPaused(config.paused);
      setLocalThrottle(config.throttleEnabled);
    }
  }, [config]);

  const canControlPause = capabilities.hasPause && capabilities.hasUnpause;
  const canControlThrottle = capabilities.hasSetThrottle;
  
  const mintEnabled = config?.mintEnabled ?? SAFE_DEFAULTS.mintEnabled;
  const isFreeMint = (config?.mintPriceETH ?? 0n) === 0n;

  const handleTogglePause = async () => {
    if (localPaused) {
      const success = await onUnpause();
      if (success) setLocalPaused(false);
    } else {
      const success = await onPause();
      if (success) setLocalPaused(true);
    }
  };

  const handleToggleThrottle = async (enabled: boolean) => {
    const success = await onSetThrottle(enabled);
    if (success) setLocalThrottle(enabled);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Mint Controls
        </h3>
        <Badge 
          variant="outline" 
          className={isFreeMint 
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
          }
        >
          {isFreeMint ? 'Free Mint' : 'Paid Mint'}
        </Badge>
      </div>

      {/* Contract Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">MemoryMintUltra (Free Mint)</p>
              <p className="text-muted-foreground mt-1">
                This contract supports free minting (gas only). Players mint NFTs for their game achievements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-6">
          {/* Mint Enabled Status */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              {mintEnabled ? (
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-destructive" />
              )}
              <div>
                <p className="font-medium">Mint Enabled</p>
                <p className="text-xs text-muted-foreground">Allow players to mint NFTs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <EnforcementBadge type={canControlPause ? 'onchain' : 'admin'} />
              <Badge variant={mintEnabled ? 'default' : 'secondary'} className={mintEnabled 
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : ''
              }>
                {mintEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>

          {/* Pause/Unpause Toggle */}
          {canControlPause && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  {localPaused ? (
                    <PauseCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <PlayCircle className="h-4 w-4 text-emerald-500" />
                  )}
                  Contract Status
                </Label>
                <p className="text-sm text-muted-foreground">
                  {localPaused ? 'Contract is paused - minting disabled' : 'Contract is active - minting enabled'}
                </p>
              </div>
              <Button
                variant={localPaused ? 'default' : 'destructive'}
                size="sm"
                onClick={handleTogglePause}
                disabled={isPreviewMode || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : localPaused ? (
                  'Unpause'
                ) : (
                  'Pause'
                )}
              </Button>
            </div>
          )}

          {/* Free Mint Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Free Mint
              </Label>
              <p className="text-sm text-muted-foreground">
                Gas-only minting (no payment required)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EnforcementBadge type="onchain" />
              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                ON
              </Badge>
            </div>
          </div>

          {/* Throttle Toggle */}
          {canControlThrottle && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Rate Limiting
                </Label>
                <p className="text-sm text-muted-foreground">
                  {localThrottle ? 'Anti-bot throttling active' : 'Throttling disabled'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EnforcementBadge type="onchain" />
                <Switch
                  checked={localThrottle}
                  onCheckedChange={handleToggleThrottle}
                  disabled={isPreviewMode || isPending}
                />
              </div>
            </div>
          )}

          {/* Current Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{config?.totalSupply?.toString() ?? '0'}</p>
              <p className="text-xs text-muted-foreground">Total Minted</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{config?.nextTokenId?.toString() ?? '1'}</p>
              <p className="text-xs text-muted-foreground">Next Token ID</p>
            </div>
          </div>

          {!canControlPause && !canControlThrottle && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No mint controls available for this contract
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
