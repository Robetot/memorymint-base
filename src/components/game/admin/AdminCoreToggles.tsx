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
  
  // Handlers - EXACT CONTRACT FUNCTIONS
  onSetMintPaused: (paused: boolean) => Promise<boolean>;
  onSetFreeMint: (isFree: boolean) => Promise<boolean>;
  onSetMintPriceETH: (priceWei: bigint) => Promise<boolean>;
  onSetMintPriceUSDC: (priceUSDC: bigint) => Promise<boolean>;
  onActivateKillSwitch: () => Promise<boolean>;
  onDeactivateKillSwitch: () => Promise<boolean>;
}

export function AdminCoreToggles({
  config,
  isPreviewMode,
  isPending,
  onSetMintPaused,
  onSetFreeMint,
  onSetMintPriceETH,
  onSetMintPriceUSDC,
  onActivateKillSwitch,
  onDeactivateKillSwitch,
}: AdminCoreTogglesProps) {
  const [priceETH, setPriceETH] = useState('');
  const [priceUSDC, setPriceUSDC] = useState('');
  const [isSettingPrice, setIsSettingPrice] = useState(false);

  // RULE 9: Use explicit getter functions - DO NOT INFER
  // These may be undefined if reads failed - that's OK, writes still work
  const isMintActive = config?.isMintActive ?? true;
  const isKillSwitchActive = config?.isKillSwitchActive ?? false;
  // Free mint ONLY from explicit getters - NEVER from price inference
  const isFreeMint = config?.isFreeMint ?? config?.freeMintActive ?? false;

  // Toggle: Mint Enabled (inverted from mintPaused)
  // setMintPaused(true) = minting OFF, setMintPaused(false) = minting ON
  const handleToggleMint = async (enabled: boolean) => {
    return onSetMintPaused(!enabled);
  };

  // Toggle: Free Mint Mode - USES DEDICATED setFreeMint(bool)
  // RULE 4: Free mint source of truth is freeMintActive() / setFreeMint(bool)
  const handleToggleFreeMint = async (free: boolean) => {
    return onSetFreeMint(free);
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

  // Set paid mint prices - uses separate functions per the V3 contract
  const handleSetPriceETH = async () => {
    if (!priceETH) return;
    setIsSettingPrice(true);
    try {
      const ethWei = parseEther(priceETH);
      await onSetMintPriceETH(ethWei);
      setPriceETH('');
    } catch (err) {
      console.error('Failed to set ETH price:', err);
    } finally {
      setIsSettingPrice(false);
    }
  };

  const handleSetPriceUSDC = async () => {
    if (!priceUSDC) return;
    setIsSettingPrice(true);
    try {
      const usdcUnits = parseUnits(priceUSDC, 6);
      await onSetMintPriceUSDC(usdcUnits);
      setPriceUSDC('');
    } catch (err) {
      console.error('Failed to set USDC price:', err);
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
          {/* 1. Mint Enabled Toggle - uses isMintActive() / setMintPaused(bool) */}
          <AdminToggle
            id="mint-enabled"
            label="Mint Active"
            description={isMintActive ? 'Players can mint NFTs' : 'Minting is paused'}
            icon={<Coins className="h-4 w-4" />}
            isEnabled={isMintActive}
            onToggle={handleToggleMint}
            disabled={isKillSwitchActive}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={isMintActive ? 'success' : 'default'}
          />

          {/* 2. Free Mint Mode Toggle - uses freeMintActive() / setFreeMint(bool) */}
          <AdminToggle
            id="free-mint"
            label="Free Mint Active"
            description={isFreeMint ? '🎉 FREE MINT - Players mint for gas only' : 'Paid minting enabled'}
            icon={<Zap className="h-4 w-4" />}
            isEnabled={isFreeMint}
            onToggle={handleToggleFreeMint}
            disabled={isKillSwitchActive}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={isFreeMint ? 'success' : 'default'}
          >
            {/* When free mint is OFF, show pricing inputs */}
            {!isFreeMint && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Set mint prices (separate transactions):
                </p>
                <div className="space-y-2">
                  {/* ETH Price */}
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
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
                    <Button
                      size="sm"
                      onClick={handleSetPriceETH}
                      disabled={isPreviewMode || isPending || isSettingPrice || !priceETH}
                      className="self-end h-8"
                    >
                      {isSettingPrice ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                  </div>
                  
                  {/* USDC Price */}
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
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
                    <Button
                      size="sm"
                      onClick={handleSetPriceUSDC}
                      disabled={isPreviewMode || isPending || isSettingPrice || !priceUSDC}
                      className="self-end h-8"
                    >
                      {isSettingPrice ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </AdminToggle>

          {/* 3. Global Kill Switch (Highest Priority) - uses isKillSwitchActive() */}
          <div className="pt-2 border-t border-border/30">
            <AdminToggle
              id="kill-switch"
              label="Kill Switch (Global)"
              description={isKillSwitchActive 
                ? '🚨 ALL minting and bonuses DISABLED' 
                : 'Disables ALL minting + ALL bonuses'
              }
              icon={<Power className="h-4 w-4" />}
              isEnabled={isKillSwitchActive}
              onToggle={handleToggleKillSwitch}
              isPreviewMode={isPreviewMode}
              isPending={isPending}
              variant="danger"
            />
            
            {isKillSwitchActive && (
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
