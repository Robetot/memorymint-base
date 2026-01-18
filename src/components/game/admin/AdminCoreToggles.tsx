import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Coins, 
  Zap, 
  Power, 
  AlertTriangle,
  Loader2,
  Save,
} from 'lucide-react';
import { AdminToggle } from './AdminToggle';
import { ContractConfig } from '@/hooks/useContractReads';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';

interface AdminCoreTogglesProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  isPending: boolean;
  
  // Handlers
  onSetMintPaused: (paused: boolean) => Promise<boolean>;
  onSetMintPrice: (ethPrice: bigint, usdcPrice: bigint) => Promise<boolean>;
  onActivateKillSwitch: () => Promise<boolean>;
  onDeactivateKillSwitch: () => Promise<boolean>;
}

export function AdminCoreToggles({
  config,
  isPreviewMode,
  isPending,
  onSetMintPaused,
  onSetMintPrice,
  onActivateKillSwitch,
  onDeactivateKillSwitch,
}: AdminCoreTogglesProps) {
  const [priceETH, setPriceETH] = useState('');
  const [priceUSDC, setPriceUSDC] = useState('');
  const [isSettingPrice, setIsSettingPrice] = useState(false);

  const mintEnabled = !(config?.mintPaused ?? false);
  const killSwitchActive = config?.killSwitch ?? false;
  const isFreeMint = (config?.mintPriceETH ?? 0n) === 0n && (config?.mintPriceUSDC ?? 0n) === 0n;

  // Toggle: Mint Enabled (inverted from mintPaused)
  const handleToggleMint = async (enabled: boolean) => {
    // enabled = true means minting ON, so mintPaused = false
    return onSetMintPaused(!enabled);
  };

  // Toggle: Free Mint Mode
  const handleToggleFreeMint = async (free: boolean) => {
    if (free) {
      // Set prices to 0
      return onSetMintPrice(0n, 0n);
    } else {
      // Show paid mint inputs - don't execute anything yet
      return true;
    }
  };

  // Toggle: Kill Switch
  const handleToggleKillSwitch = async (active: boolean) => {
    if (active) {
      const confirmed = window.confirm(
        '⚠️ DANGER: Activating kill switch will disable ALL minting and ALL bonuses. This should only be used in extreme emergencies. Continue?'
      );
      if (!confirmed) return false;
      return onActivateKillSwitch();
    } else {
      return onDeactivateKillSwitch();
    }
  };

  // Set paid mint prices
  const handleSetPrices = async () => {
    if (!priceETH && !priceUSDC) return;
    
    setIsSettingPrice(true);
    try {
      const ethWei = priceETH ? parseEther(priceETH) : 0n;
      const usdcUnits = priceUSDC ? parseUnits(priceUSDC, 6) : 0n;
      await onSetMintPrice(ethWei, usdcUnits);
      setPriceETH('');
      setPriceUSDC('');
    } catch (err) {
      console.error('Failed to set prices:', err);
    } finally {
      setIsSettingPrice(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Core Contract Toggles
        </h3>
        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
          CRITICAL
        </Badge>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          {/* 1. Mint Enabled Toggle */}
          <AdminToggle
            id="mint-enabled"
            label="Mint Enabled"
            description={mintEnabled ? 'Players can mint NFTs' : 'Minting is paused'}
            icon={<Coins className="h-4 w-4" />}
            isEnabled={mintEnabled}
            onToggle={handleToggleMint}
            disabled={killSwitchActive}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={mintEnabled ? 'success' : 'default'}
          />

          {/* 2. Free Mint Mode Toggle */}
          <AdminToggle
            id="free-mint"
            label="Free Mint (Gas Only)"
            description={isFreeMint ? 'Players mint for free (gas only)' : 'Paid minting enabled'}
            icon={<Zap className="h-4 w-4" />}
            isEnabled={isFreeMint}
            onToggle={handleToggleFreeMint}
            disabled={killSwitchActive}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant="success"
          >
            {/* When free mint is OFF, show pricing inputs */}
            {!isFreeMint && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Set mint prices (one transaction updates both):
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ETH Price</Label>
                    <Input
                      type="text"
                      placeholder={formatEther(config?.mintPriceETH ?? 0n)}
                      value={priceETH}
                      onChange={(e) => setPriceETH(e.target.value)}
                      disabled={isPreviewMode || isPending || isSettingPrice}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">USDC Price</Label>
                    <Input
                      type="text"
                      placeholder={formatUnits(config?.mintPriceUSDC ?? 0n, 6)}
                      value={priceUSDC}
                      onChange={(e) => setPriceUSDC(e.target.value)}
                      disabled={isPreviewMode || isPending || isSettingPrice}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleSetPrices}
                  disabled={isPreviewMode || isPending || isSettingPrice || (!priceETH && !priceUSDC)}
                  className="w-full"
                >
                  {isSettingPrice ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Update Prices
                </Button>
              </div>
            )}
          </AdminToggle>

          {/* 3. Global Kill Switch (Highest Priority) */}
          <div className="pt-2 border-t border-border/30">
            <AdminToggle
              id="kill-switch"
              label="Kill Switch (Global)"
              description={killSwitchActive 
                ? '🚨 ALL minting and bonuses DISABLED' 
                : 'Disables ALL minting + ALL bonuses'
              }
              icon={<Power className="h-4 w-4" />}
              isEnabled={killSwitchActive}
              onToggle={handleToggleKillSwitch}
              isPreviewMode={isPreviewMode}
              isPending={isPending}
              variant="danger"
            />
            
            {killSwitchActive && (
              <div className="mt-2 p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">Kill switch overrides all other toggles</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
