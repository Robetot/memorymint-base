import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle,
  StopCircle,
  Power,
  Loader2,
  Shield,
} from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContractConfig } from '@/hooks/useContractReads';
import { ContractCapabilities, EnforcementType, ENFORCEMENT_LABELS } from './types';

interface AdminEmergencySectionProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  isPreviewMode: boolean;
  onPause: () => Promise<boolean>;
  onKillSwitch?: () => Promise<boolean>;
  onDeactivateKillSwitch?: () => Promise<boolean>;
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

export function AdminEmergencySection({ 
  config, 
  capabilities,
  isPreviewMode,
  onPause,
  onKillSwitch,
  onDeactivateKillSwitch,
  isPending,
}: AdminEmergencySectionProps) {
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showKillDialog, setShowKillDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const isPaused = config?.paused ?? false;
  const isKillSwitchActive = config?.killSwitch ?? false;
  const canPause = capabilities.hasPause || capabilities.hasMintPaused;
  const canKillSwitch = capabilities.hasGlobalKillSwitch || capabilities.hasActivateKillSwitch;
  const canDeactivateKillSwitch = capabilities.hasDeactivateKillSwitch && onDeactivateKillSwitch;

  const handleEmergencyPause = async () => {
    setShowPauseDialog(false);
    await onPause();
  };

  const handleKillSwitch = async () => {
    setShowKillDialog(false);
    if (onKillSwitch) {
      await onKillSwitch();
    }
  };

  const handleDeactivateKillSwitch = async () => {
    setShowDeactivateDialog(false);
    if (onDeactivateKillSwitch) {
      await onDeactivateKillSwitch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Emergency Controls
        </h3>
        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
          Use with caution
        </Badge>
      </div>

      {/* Active Pause Warning */}
      {isPaused && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <StopCircle className="h-5 w-5" />
            Contract is PAUSED
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            All minting is currently disabled. Unpause to resume operations.
          </p>
        </div>
      )}

      {/* Active Kill Switch Warning */}
      {isKillSwitchActive && (
        <div className="p-4 bg-destructive/20 border-2 border-destructive rounded-lg">
          <div className="flex items-center gap-2 text-destructive font-bold">
            <Power className="h-5 w-5" />
            🚨 KILL SWITCH ACTIVE
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            All minting and bonus claims are disabled. Deactivate to resume operations.
          </p>
        </div>
      )}

      <Card className="border-destructive/30">
        <CardContent className="p-4 space-y-4">
          {/* Emergency Stop Mint */}
          {canPause && (
            <div className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/20">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <StopCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium">Emergency Stop Mint</span>
                  <EnforcementBadge type="onchain" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Immediately pause all minting operations
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowPauseDialog(true)}
                disabled={isPreviewMode || isPending || isPaused}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPaused ? (
                  'Already Paused'
                ) : (
                  <>
                    <StopCircle className="h-4 w-4 mr-1" />
                    Stop
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Global Kill Switch */}
          {canKillSwitch && onKillSwitch && (
            <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Power className="h-4 w-4 text-destructive" />
                  <span className="font-medium">Global Kill Switch</span>
                  <EnforcementBadge type="onchain" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Disable ALL minting + ALL bonuses
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowKillDialog(true)}
                disabled={isPreviewMode || isPending || isKillSwitchActive}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isKillSwitchActive ? (
                  'Active'
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-1" />
                    Kill
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Deactivate Kill Switch */}
          {canDeactivateKillSwitch && isKillSwitchActive && (
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">Deactivate Kill Switch</span>
                  <EnforcementBadge type="onchain" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Resume all minting and bonus claims
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-green-500 text-green-600 hover:bg-green-500/10"
                onClick={() => setShowDeactivateDialog(true)}
                disabled={isPreviewMode || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-1" />
                    Resume
                  </>
                )}
              </Button>
            </div>
          )}

          {!canPause && !canKillSwitch && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No emergency controls available for this contract
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <StopCircle className="h-5 w-5" />
              Emergency Pause
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately pause all minting operations. Players will not be able to mint new NFTs until the contract is unpaused.
              <br /><br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmergencyPause}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Pause Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kill Switch Confirmation Dialog */}
      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Power className="h-5 w-5" />
              Global Kill Switch
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">⚠️ DANGER:</strong> This action will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Disable ALL minting permanently</li>
                <li>Disable ALL bonus claims</li>
                <li>Cannot be easily reversed</li>
              </ul>
              <br />
              This should only be used in extreme emergencies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKillSwitch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Activate Kill Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Kill Switch Confirmation Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <Shield className="h-5 w-5" />
              Deactivate Kill Switch
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will resume all operations:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Re-enable minting</li>
                <li>Re-enable bonus claims</li>
                <li>Contract will be fully operational</li>
              </ul>
              <br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateKillSwitch}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Resume Operations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
