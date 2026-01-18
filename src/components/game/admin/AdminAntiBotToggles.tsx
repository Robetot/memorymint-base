import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Bot, 
  Shield,
  Timer,
  Users,
  FileSignature,
  Lock,
  Loader2,
  Save,
} from 'lucide-react';
import { AdminToggle } from './AdminToggle';
import { ContractConfig } from '@/hooks/useContractReads';

// Anti-bot mode enum matches contract: 0=Disabled, 1=Signature, 2=Allowlist, 3=Hybrid
const ANTI_BOT_MODES = [
  { value: 0, label: 'Disabled', icon: Timer, description: 'No anti-bot protection' },
  { value: 1, label: 'Signature Required', icon: FileSignature, description: 'Requires valid backend signature' },
  { value: 2, label: 'Allowlist Only', icon: Users, description: 'Only allowlisted addresses can mint' },
  { value: 3, label: 'Hybrid', icon: Lock, description: 'Signature + Allowlist combined' },
] as const;

interface AdminAntiBotTogglesProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  isPending: boolean;
  
  // Handlers
  onSetAntiBotMode: (mode: number) => Promise<boolean>;
  onSetWalletMintLimit: (limit: bigint) => Promise<boolean>;
}

export function AdminAntiBotToggles({
  config,
  isPreviewMode,
  isPending,
  onSetAntiBotMode,
  onSetWalletMintLimit,
}: AdminAntiBotTogglesProps) {
  const [walletLimit, setWalletLimit] = useState('');
  const [isSettingLimit, setIsSettingLimit] = useState(false);
  const [selectedMode, setSelectedMode] = useState(0);

  const antiBotMode = config?.antiBotMode ?? 0;
  const antiBotEnabled = antiBotMode > 0;
  const currentWalletLimit = config?.walletMintLimit ?? 0n;

  // Sync selected mode with on-chain state
  useEffect(() => {
    setSelectedMode(antiBotMode);
  }, [antiBotMode]);

  // Sync wallet limit with on-chain state
  useEffect(() => {
    if (currentWalletLimit > 0n) {
      setWalletLimit(currentWalletLimit.toString());
    }
  }, [currentWalletLimit]);

  // Toggle: Anti-Bot Enabled (mode 0 = off, mode 1+ = on)
  const handleToggleAntiBot = async (enabled: boolean) => {
    if (enabled) {
      // Default to signature mode when enabling
      return onSetAntiBotMode(1);
    } else {
      return onSetAntiBotMode(0);
    }
  };

  // Change anti-bot mode
  const handleModeChange = async (value: string) => {
    const mode = parseInt(value, 10);
    setSelectedMode(mode);
    return onSetAntiBotMode(mode);
  };

  // Set wallet limit
  const handleSetWalletLimit = async () => {
    const limit = BigInt(walletLimit || '0');
    setIsSettingLimit(true);
    try {
      await onSetWalletMintLimit(limit);
    } finally {
      setIsSettingLimit(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-amber-500" />
          Anti-Bot Protection
        </h3>
        <Badge 
          variant="outline" 
          className={antiBotEnabled 
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
            : 'bg-muted text-muted-foreground'
          }
        >
          {antiBotEnabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      <Card className="border-amber-500/20">
        <CardContent className="p-4 space-y-4">
          {/* Main Toggle */}
          <AdminToggle
            id="anti-bot-enabled"
            label="Anti-Bot System"
            description={antiBotEnabled 
              ? `Mode: ${ANTI_BOT_MODES.find(m => m.value === antiBotMode)?.label}` 
              : 'No bot protection active'
            }
            icon={<Shield className="h-4 w-4" />}
            isEnabled={antiBotEnabled}
            onToggle={handleToggleAntiBot}
            isPreviewMode={isPreviewMode}
            isPending={isPending}
            variant={antiBotEnabled ? 'success' : 'default'}
          >
            {/* Mode Selector - only when enabled */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Protection Mode</Label>
              <RadioGroup 
                value={selectedMode.toString()} 
                onValueChange={handleModeChange}
                className="grid grid-cols-2 gap-2"
                disabled={isPreviewMode || isPending}
              >
                {ANTI_BOT_MODES.slice(1).map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <div key={mode.value} className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value={mode.value.toString()} 
                        id={`mode-${mode.value}`}
                        disabled={isPreviewMode || isPending}
                      />
                      <Label 
                        htmlFor={`mode-${mode.value}`} 
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Icon className="h-3 w-3" />
                        {mode.label}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {ANTI_BOT_MODES.find(m => m.value === selectedMode)?.description}
              </p>
            </div>
          </AdminToggle>

          {/* Wallet Mint Limit - separate toggle-like control */}
          <div className="pt-3 border-t border-border/30">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Max Mints Per Wallet
                </Label>
                <Badge variant="outline" className="text-xs">
                  {currentWalletLimit === 0n ? 'Unlimited' : currentWalletLimit.toString()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Set to 0 for unlimited mints per wallet
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="0 = Unlimited"
                  value={walletLimit}
                  onChange={(e) => setWalletLimit(e.target.value)}
                  disabled={isPreviewMode || isPending || isSettingLimit}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleSetWalletLimit}
                  disabled={isPreviewMode || isPending || isSettingLimit}
                  className="h-8"
                >
                  {isSettingLimit ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
