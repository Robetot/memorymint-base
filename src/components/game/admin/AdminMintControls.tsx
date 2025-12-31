import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  Shield,
  Loader2,
  Fuel,
  DollarSign,
  Users,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { formatEther, formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/contracts/MemoryMintContract';

interface AdminMintControlsProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  onSaveChanges: (settings: MintSettingsData) => Promise<boolean>;
  isPending: boolean;
}

export interface MintSettingsData {
  mintEnabled: boolean;
  freeMint: boolean;
  antiBotEnabled: boolean;
  mintPriceETH: string;
  mintPriceUSDC: string;
  maxMintsPerWallet: number;
}

// Helper to normalize ETH values for comparison (remove trailing zeros)
function normalizeEthValue(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return num.toString();
}

export function AdminMintControls({ 
  config, 
  isPreviewMode,
  onSaveChanges,
  isPending,
}: AdminMintControlsProps) {
  const [localSettings, setLocalSettings] = useState<MintSettingsData>({
    mintEnabled: config?.mintEnabled ?? false,
    freeMint: (config?.mintPriceETH ?? 0n) === 0n && (config?.mintPriceUSDC ?? 0n) === 0n,
    antiBotEnabled: (config?.antiBotMode ?? 0) > 0,
    mintPriceETH: config ? formatEther(config.mintPriceETH) : '0',
    mintPriceUSDC: config ? formatUnits(config.mintPriceUSDC, USDC_DECIMALS) : '0',
    maxMintsPerWallet: Number(config?.walletMintLimit ?? 10n),
  });

  // Store the on-chain state as source of truth for comparison
  const onChainState = useMemo(() => {
    if (!config) return null;
    return {
      mintEnabled: config.mintEnabled,
      freeMint: config.mintPriceETH === 0n && config.mintPriceUSDC === 0n,
      antiBotEnabled: config.antiBotMode > 0,
      mintPriceETH: normalizeEthValue(formatEther(config.mintPriceETH)),
      mintPriceUSDC: normalizeEthValue(formatUnits(config.mintPriceUSDC, USDC_DECIMALS)),
      maxMintsPerWallet: Number(config.walletMintLimit),
    };
  }, [config]);

  // Sync local settings when on-chain config changes (after tx confirmation)
  useEffect(() => {
    if (config) {
      setLocalSettings({
        mintEnabled: config.mintEnabled,
        freeMint: config.mintPriceETH === 0n && config.mintPriceUSDC === 0n,
        antiBotEnabled: config.antiBotMode > 0,
        mintPriceETH: formatEther(config.mintPriceETH),
        mintPriceUSDC: formatUnits(config.mintPriceUSDC, USDC_DECIMALS),
        maxMintsPerWallet: Number(config.walletMintLimit),
      });
    }
  }, [config]);

  const handleChange = <K extends keyof MintSettingsData>(
    key: K,
    value: MintSettingsData[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  // Compare local settings against ON-CHAIN state (not UI-to-UI)
  const hasChanges = useMemo(() => {
    if (!onChainState) return false;
    
    const localMintEnabled = localSettings.mintEnabled;
    const localFreeMint = localSettings.freeMint;
    const localAntiBotEnabled = localSettings.antiBotEnabled;
    const localPriceETH = normalizeEthValue(localSettings.mintPriceETH);
    const localPriceUSDC = normalizeEthValue(localSettings.mintPriceUSDC);
    const localMaxMints = localSettings.maxMintsPerWallet;

    return (
      localMintEnabled !== onChainState.mintEnabled ||
      localAntiBotEnabled !== onChainState.antiBotEnabled ||
      localMaxMints !== onChainState.maxMintsPerWallet ||
      // Only compare prices if not free mint
      (!localFreeMint && (
        localPriceETH !== onChainState.mintPriceETH ||
        localPriceUSDC !== onChainState.mintPriceUSDC
      )) ||
      // Free mint state changed
      localFreeMint !== onChainState.freeMint
    );
  }, [localSettings, onChainState]);

  const handleSave = async () => {
    await onSaveChanges(localSettings);
    // Config will be refetched after tx confirmation, which will update onChainState
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Mint Controls
        </h3>
        {hasChanges && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            Unsaved Changes
          </Badge>
        )}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-6">
          {/* Mint Enabled Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Mint Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow players to mint NFTs
              </p>
            </div>
            <Switch
              checked={localSettings.mintEnabled}
              onCheckedChange={(checked) => handleChange('mintEnabled', checked)}
              disabled={isPreviewMode}
            />
          </div>

          {/* Free Mint Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Free Mint
              </Label>
              <p className="text-sm text-muted-foreground">
                Disable minting fees (gas only)
              </p>
            </div>
            <Switch
              checked={localSettings.freeMint}
              onCheckedChange={(checked) => {
                handleChange('freeMint', checked);
                if (checked) {
                  handleChange('mintPriceETH', '0');
                  handleChange('mintPriceUSDC', '0');
                }
              }}
              disabled={isPreviewMode}
            />
          </div>

          {/* Anti-Bot Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Anti-Bot Protection
              </Label>
              <p className="text-sm text-muted-foreground">
                Prevent automated minting
              </p>
            </div>
            <Switch
              checked={localSettings.antiBotEnabled}
              onCheckedChange={(checked) => handleChange('antiBotEnabled', checked)}
              disabled={isPreviewMode}
            />
          </div>

          {/* Mint Prices */}
          {!localSettings.freeMint && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ETH Mint Price</Label>
                <Input
                  type="text"
                  value={localSettings.mintPriceETH}
                  onChange={(e) => handleChange('mintPriceETH', e.target.value)}
                  placeholder="0.01"
                  disabled={isPreviewMode}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {config ? formatEther(config.mintPriceETH) : '0'} ETH
                </p>
              </div>
              <div className="space-y-2">
                <Label>USDC Mint Price</Label>
                <Input
                  type="text"
                  value={localSettings.mintPriceUSDC}
                  onChange={(e) => handleChange('mintPriceUSDC', e.target.value)}
                  placeholder="10"
                  disabled={isPreviewMode}
                />
                <p className="text-xs text-muted-foreground">
                  Current: ${config ? formatUnits(config.mintPriceUSDC, USDC_DECIMALS) : '0'}
                </p>
              </div>
            </div>
          )}

          {/* Max Mints Per Wallet */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Max Mints Per Wallet
            </Label>
            <Input
              type="number"
              value={localSettings.maxMintsPerWallet}
              onChange={(e) => handleChange('maxMintsPerWallet', parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              disabled={isPreviewMode}
            />
            <p className="text-xs text-muted-foreground">
              Current: {config?.walletMintLimit?.toString() ?? '10'}
            </p>
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
    </div>
  );
}
