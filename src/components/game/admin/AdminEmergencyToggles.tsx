import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle,
  Power,
  Shield,
  StopCircle,
  Loader2,
  Lock,
  Unlock,
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
import { AdminToggle } from './AdminToggle';
import { ContractConfig } from '@/hooks/useContractReads';

interface AdminEmergencyTogglesProps {
  config: ContractConfig | null;
  isPreviewMode: boolean;
  isPending: boolean;
  
  // Handlers
  onSetMintPaused: (paused: boolean) => Promise<boolean>;
  onEmergencyWithdraw: () => Promise<boolean>;
  onActivateKillSwitch: () => Promise<boolean>;
  onDeactivateKillSwitch: () => Promise<boolean>;
}

export function AdminEmergencyToggles({
  config,
  isPreviewMode,
  isPending,
  onSetMintPaused,
  onEmergencyWithdraw,
  onActivateKillSwitch,
  onDeactivateKillSwitch,
}: AdminEmergencyTogglesProps) {
  const [emergencyArmed, setEmergencyArmed] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);

  const isPaused = config?.mintPaused ?? false;
  const killSwitchActive = config?.killSwitch ?? false;

  // Handle emergency withdraw - requires double confirmation
  const handleEmergencyWithdraw = async () => {
    setShowEmergencyDialog(false);
    return onEmergencyWithdraw();
  };

  // Toggle: Force Pause Mint (Emergency Stop)
  const handleForceStop = async (stop: boolean) => {
    if (stop) {
      const confirmed = window.confirm(
        'This will immediately pause all minting. Continue?'
      );
      if (!confirmed) return false;
    }
    return onSetMintPaused(stop);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Emergency Controls
        </h3>
        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
          LOCKED
        </Badge>
      </div>

      {/* Warning Banner */}
      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Lock className="h-4 w-4" />
          <span className="font-medium">Requires double confirmation + signature</span>
        </div>
      </div>

      <Card className="border-destructive/30">
        <CardContent className="p-4 space-y-4">
          {/* Active Status Warnings */}
          {isPaused && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <StopCircle className="h-4 w-4" />
                Contract is PAUSED
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All minting is currently disabled.
              </p>
            </div>
          )}

          {killSwitchActive && (
            <div className="p-3 bg-destructive/20 border-2 border-destructive rounded-lg">
              <div className="flex items-center gap-2 text-destructive font-bold">
                <Power className="h-4 w-4" />
                🚨 KILL SWITCH ACTIVE
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All minting and bonus claims are disabled.
              </p>
            </div>
          )}

          {/* Emergency Withdraw */}
          <div className="space-y-3">
            <AdminToggle
              id="emergency-armed"
              label="ARM Emergency Withdraw"
              description="Enables the emergency withdrawal button"
              icon={<AlertTriangle className="h-4 w-4" />}
              isEnabled={emergencyArmed}
              onToggle={async (armed) => { 
                if (armed) {
                  const confirmed = window.confirm(
                    '⚠️ This will ARM the emergency withdraw function. Continue?'
                  );
                  if (!confirmed) return false;
                }
                setEmergencyArmed(armed); 
                return true; 
              }}
              isPreviewMode={isPreviewMode}
              isPending={isPending}
              variant="danger"
            />

            {emergencyArmed && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowEmergencyDialog(true)}
                disabled={isPreviewMode || isPending}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Emergency Withdraw ALL Funds
              </Button>
            )}
          </div>

          {/* Force Pause Toggle */}
          <div className="pt-3 border-t border-border/30">
            <AdminToggle
              id="force-pause"
              label="Force Pause Mint"
              description="Immediately stops all minting (overrides normal toggle)"
              icon={<StopCircle className="h-4 w-4" />}
              isEnabled={isPaused}
              onToggle={handleForceStop}
              isPreviewMode={isPreviewMode}
              isPending={isPending}
              variant="danger"
            />
          </div>

          {/* Kill Switch Deactivate (if active) */}
          {killSwitchActive && (
            <div className="pt-3 border-t border-border/30">
              <Button
                variant="outline"
                className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-500/10"
                onClick={async () => {
                  const confirmed = window.confirm(
                    'This will re-enable all minting and bonus claims. Continue?'
                  );
                  if (confirmed) {
                    await onDeactivateKillSwitch();
                  }
                }}
                disabled={isPreviewMode || isPending}
              >
                <Shield className="h-4 w-4 mr-2" />
                Deactivate Kill Switch
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Withdraw Confirmation Dialog */}
      <AlertDialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Emergency Withdraw
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">⚠️ FINAL WARNING:</strong>
              <br /><br />
              This action will withdraw <strong>ALL</strong> ETH and USDC from the contract to the owner address.
              <br /><br />
              This cannot be undone.
              <br /><br />
              Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmergencyWithdraw}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Withdraw Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
