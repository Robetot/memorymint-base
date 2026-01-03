import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  Loader2,
  Fuel,
  PlayCircle,
  PauseCircle,
  Info,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { CONTRACT_ABI } from '@/contracts/MemoryMintContract';

interface AdminMintControlsProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  onPause: () => Promise<boolean>;
  onUnpause: () => Promise<boolean>;
  onSetThrottle: (enabled: boolean) => Promise<boolean>;
  isPending: boolean;
}

// Helper to check if a function exists in the ABI
function abiHasFunction(functionName: string): boolean {
  const abiItems = CONTRACT_ABI as unknown as readonly any[];
  return abiItems.some(
    (i) => i && i.type === 'function' && typeof i.name === 'string' && i.name === functionName
  );
}

// Determine which admin functions are available
const AVAILABLE_FUNCTIONS = {
  pause: abiHasFunction('pause'),
  unpause: abiHasFunction('unpause'),
  setThrottle: abiHasFunction('setThrottle'),
  // These do NOT exist in MemoryMintUltra
  setWalletMintLimit: abiHasFunction('setWalletMintLimit'),
  setMintPriceETH: abiHasFunction('setMintPriceETH'),
  setMintPriceUSDC: abiHasFunction('setMintPriceUSDC'),
  setSignatureRequired: abiHasFunction('setSignatureRequired'),
  setAntiBotMode: abiHasFunction('setAntiBotMode'),
  pauseMinting: abiHasFunction('pauseMinting'),
};

export function AdminMintControls({ 
  config, 
  isPreviewMode,
  onPause,
  onUnpause,
  onSetThrottle,
  isPending,
}: AdminMintControlsProps) {
  const [localPaused, setLocalPaused] = useState(config?.paused ?? false);
  const [localThrottle, setLocalThrottle] = useState(config?.throttleEnabled ?? false);

  // Sync with on-chain state
  useEffect(() => {
    if (config) {
      setLocalPaused(config.paused);
      setLocalThrottle(config.throttleEnabled);
    }
  }, [config]);

  // Check if pause/unpause functions are available
  const canControlPause = AVAILABLE_FUNCTIONS.pause && AVAILABLE_FUNCTIONS.unpause;
  const canControlThrottle = AVAILABLE_FUNCTIONS.setThrottle;
  
  // Check for unsupported features to show info message
  const hasUnsupportedFeatures = 
    !AVAILABLE_FUNCTIONS.setWalletMintLimit ||
    !AVAILABLE_FUNCTIONS.setMintPriceETH ||
    !AVAILABLE_FUNCTIONS.setSignatureRequired;

  const hasChanges = useMemo(() => {
    if (!config) return false;
    return localPaused !== config.paused || localThrottle !== config.throttleEnabled;
  }, [localPaused, localThrottle, config]);

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
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
          Free Mint Contract
        </Badge>
      </div>

      {/* Contract type info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">MemoryMintUltra (Free Mint)</p>
              <p className="text-muted-foreground mt-1">
                This contract supports free minting (gas only). Advanced features like wallet limits, 
                pricing, and signatures are not available.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-6">
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

          {/* Throttle Toggle */}
          {canControlThrottle && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Rate Limiting</Label>
                <p className="text-sm text-muted-foreground">
                  {localThrottle ? 'Throttling is active' : 'Throttling is disabled'}
                </p>
              </div>
              <Switch
                checked={localThrottle}
                onCheckedChange={handleToggleThrottle}
                disabled={isPreviewMode || isPending}
              />
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

      {hasUnsupportedFeatures && (
        <p className="text-center text-xs text-muted-foreground">
          Wallet limits, pricing, and signature settings are not supported by this contract
        </p>
      )}
    </div>
  );
}