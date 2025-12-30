import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Gift, 
  Clock, 
  Users,
  RefreshCw,
  Loader2,
  Fuel,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { ClaimModeEnum } from '@/contracts/MemoryMintContract';

interface AdminClaimSettingsProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  onSaveChanges: (settings: ClaimSettingsData) => Promise<boolean>;
  isPending: boolean;
}

interface ClaimSettingsData {
  claimsEnabled: boolean;
  cooldownEnabled: boolean;
  cooldownHours: number;
  maxClaimsPerWallet: number;
  claimMode: number;
}

export function AdminClaimSettings({ 
  config, 
  isPreviewMode,
  onSaveChanges,
  isPending,
}: AdminClaimSettingsProps) {
  // Local state for form (dirty tracking)
  const [localSettings, setLocalSettings] = useState<ClaimSettingsData>({
    claimsEnabled: config?.claimEnabled ?? false,
    cooldownEnabled: false,
    cooldownHours: 24,
    maxClaimsPerWallet: 1,
    claimMode: config?.claimMode ?? ClaimModeEnum.DISABLED,
  });

  const [isDirty, setIsDirty] = useState(false);

  // Sync with config when it changes
  useEffect(() => {
    if (config) {
      setLocalSettings(prev => ({
        ...prev,
        claimsEnabled: config.claimEnabled,
        claimMode: config.claimMode,
      }));
      setIsDirty(false);
    }
  }, [config]);

  const handleChange = <K extends keyof ClaimSettingsData>(
    key: K,
    value: ClaimSettingsData[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const success = await onSaveChanges(localSettings);
    if (success) {
      setIsDirty(false);
    }
  };

  const hasChanges = isDirty && (
    localSettings.claimsEnabled !== config?.claimEnabled ||
    localSettings.claimMode !== config?.claimMode
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Claim Settings
        </h3>
        {hasChanges && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            Unsaved Changes
          </Badge>
        )}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-6">
          {/* Claims Enabled Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Claims Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow players to claim rewards
              </p>
            </div>
            <Switch
              checked={localSettings.claimsEnabled}
              onCheckedChange={(checked) => handleChange('claimsEnabled', checked)}
              disabled={isPreviewMode}
            />
          </div>

          {/* Cooldown Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Cooldown Enabled
              </Label>
              <p className="text-sm text-muted-foreground">
                Require waiting period between claims
              </p>
            </div>
            <Switch
              checked={localSettings.cooldownEnabled}
              onCheckedChange={(checked) => handleChange('cooldownEnabled', checked)}
              disabled={isPreviewMode}
            />
          </div>

          {/* Claim Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Claim Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                One-time or repeatable claims
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={localSettings.claimMode === ClaimModeEnum.ONE_TIME ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange('claimMode', ClaimModeEnum.ONE_TIME)}
                disabled={isPreviewMode}
              >
                One-time
              </Button>
              <Button
                variant={localSettings.claimMode === ClaimModeEnum.UNLIMITED ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange('claimMode', ClaimModeEnum.UNLIMITED)}
                disabled={isPreviewMode}
              >
                Repeatable
              </Button>
            </div>
          </div>

          {/* Cooldown Time */}
          {localSettings.cooldownEnabled && (
            <div className="space-y-2">
              <Label>Cooldown Time (hours)</Label>
              <Input
                type="number"
                value={localSettings.cooldownHours}
                onChange={(e) => handleChange('cooldownHours', parseInt(e.target.value) || 0)}
                min="1"
                max="720"
                disabled={isPreviewMode}
              />
            </div>
          )}

          {/* Max Claims Per Wallet */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Max Claims Per Wallet
            </Label>
            <Input
              type="number"
              value={localSettings.maxClaimsPerWallet}
              onChange={(e) => handleChange('maxClaimsPerWallet', parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              disabled={isPreviewMode}
            />
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

      {!hasChanges && (
        <p className="text-center text-sm text-muted-foreground">
          No on-chain changes detected
        </p>
      )}
    </div>
  );
}
