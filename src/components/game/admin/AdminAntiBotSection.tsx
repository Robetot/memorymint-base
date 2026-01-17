import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Bot,
  Shield,
  Loader2,
  Timer,
  Users,
  Lock,
  FileSignature,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { 
  ContractCapabilities, 
  SAFE_DEFAULTS, 
  ANTI_BOT_MODES, 
  AntiBotModeType,
  EnforcementType,
  ENFORCEMENT_LABELS,
} from './types';

interface AdminAntiBotSectionProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  isPreviewMode: boolean;
  onSetThrottle: (enabled: boolean) => Promise<boolean>;
  onSetAntiBotMode?: (mode: number) => Promise<boolean>;
  onSetWalletLimit?: (limit: number) => Promise<boolean>;
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

const MODE_ICONS: Record<AntiBotModeType, React.ReactNode> = {
  disabled: <Timer className="h-4 w-4 text-muted-foreground" />,
  signature: <FileSignature className="h-4 w-4 text-amber-500" />,
  allowlist: <Users className="h-4 w-4 text-blue-500" />,
  hybrid: <Lock className="h-4 w-4 text-destructive" />,
};

export function AdminAntiBotSection({ 
  config, 
  capabilities,
  isPreviewMode,
  onSetThrottle,
  onSetAntiBotMode,
  onSetWalletLimit,
  isPending,
}: AdminAntiBotSectionProps) {
  const [antiBotEnabled, setAntiBotEnabled] = useState<boolean>(SAFE_DEFAULTS.antiBotEnabled);
  const [mode, setMode] = useState<AntiBotModeType>('disabled');
  const [walletLimit, setWalletLimit] = useState('');

  useEffect(() => {
    if (config) {
      const antiBotModeValue = config.antiBotMode || 0;
      setAntiBotEnabled(config.throttleEnabled || antiBotModeValue > 0);
      // Map contract value to mode type
      const modeMap: AntiBotModeType[] = ['disabled', 'signature', 'allowlist', 'hybrid'];
      setMode(modeMap[antiBotModeValue] || 'disabled');
      if (config.walletMintLimit > 0n) {
        setWalletLimit(config.walletMintLimit.toString());
      }
    }
  }, [config]);

  const canControlThrottle = capabilities.hasSetThrottle;
  const canControlAntiBotMode = capabilities.hasSetAntiBotMode;
  const canControlWalletLimit = capabilities.hasSetWalletMintLimit;

  const handleToggleAntiBot = async (enabled: boolean) => {
    if (canControlThrottle) {
      const success = await onSetThrottle(enabled);
      if (success) setAntiBotEnabled(enabled);
    } else {
      setAntiBotEnabled(enabled);
    }
  };

  const handleModeChange = async (newMode: AntiBotModeType) => {
    if (canControlAntiBotMode && onSetAntiBotMode) {
      const modeValue = ANTI_BOT_MODES[newMode].value;
      const success = await onSetAntiBotMode(modeValue);
      if (success) setMode(newMode);
    } else {
      setMode(newMode);
    }
  };

  const handleSetWalletLimit = async () => {
    if (canControlWalletLimit && onSetWalletLimit && walletLimit) {
      const limit = parseInt(walletLimit, 10);
      if (!isNaN(limit) && limit >= 0) {
        await onSetWalletLimit(limit);
      }
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
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : "bg-muted text-muted-foreground"
          }
        >
          {antiBotEnabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      <Card className="border-amber-500/20">
        <CardContent className="p-4 space-y-4">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">Prevent Automated Minting</p>
                <p className="text-xs text-muted-foreground">
                  Protect against bot attacks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <EnforcementBadge type={canControlAntiBotMode ? 'onchain' : 'admin'} />
              <Switch
                checked={antiBotEnabled}
                onCheckedChange={handleToggleAntiBot}
                disabled={isPreviewMode || isPending}
              />
            </div>
          </div>

          {/* Mode Selector - V3 supports 4 modes */}
          {antiBotEnabled && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Protection Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ANTI_BOT_MODES) as AntiBotModeType[]).map((modeKey) => (
                  <button
                    key={modeKey}
                    onClick={() => handleModeChange(modeKey)}
                    disabled={!canControlAntiBotMode && modeKey !== mode}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === modeKey
                        ? 'border-primary bg-primary/10'
                        : 'border-border/50 bg-muted/30 hover:bg-muted/50'
                    } ${!canControlAntiBotMode && modeKey !== mode ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {MODE_ICONS[modeKey]}
                      <span className="font-medium">{ANTI_BOT_MODES[modeKey].label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ANTI_BOT_MODES[modeKey].description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Wallet Limit */}
          {antiBotEnabled && canControlWalletLimit && (
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Max Mints Per Wallet
                <EnforcementBadge type="onchain" />
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={walletLimit}
                  onChange={(e) => setWalletLimit(e.target.value)}
                  disabled={isPreviewMode || isPending}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSetWalletLimit}
                  disabled={isPreviewMode || isPending || !walletLimit}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Set'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Set to 0 for unlimited mints
              </p>
            </div>
          )}

          {/* Current Config Status */}
          <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
            <span className="text-muted-foreground">Current Mode</span>
            <Badge variant={mode !== 'disabled' ? 'default' : 'secondary'}>
              {ANTI_BOT_MODES[mode].label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
