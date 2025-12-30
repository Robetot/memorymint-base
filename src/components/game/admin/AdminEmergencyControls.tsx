import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Pause,
  Gift,
  ShieldAlert,
} from 'lucide-react';
import { AdminTransactionModal } from './AdminTransactionModal';

interface AdminEmergencyControlsProps {
  walletAddress: string;
  isPreviewMode: boolean;
  onPauseMinting: () => Promise<boolean>;
  onPauseClaims: () => Promise<boolean>;
  isPending: boolean;
}

export function AdminEmergencyControls({ 
  walletAddress,
  isPreviewMode,
  onPauseMinting,
  onPauseClaims,
  isPending,
}: AdminEmergencyControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  return (
    <div className="space-y-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Card className="border-destructive/50 cursor-pointer hover:border-destructive transition-colors">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-base text-destructive">Emergency Controls</CardTitle>
                  <CardDescription className="text-xs">
                    Critical system actions - use with caution
                  </CardDescription>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
          </Card>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Card className="border-destructive/30 bg-destructive/5 mt-2">
            <CardContent className="p-4 space-y-4">
              {/* Warning Banner */}
              <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Critical Actions</p>
                  <p className="text-muted-foreground">
                    These actions affect all players immediately and cannot be easily undone.
                    Each action requires explicit confirmation.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="destructive"
                  onClick={() => setShowMintModal(true)}
                  disabled={isPreviewMode || isPending}
                  className="flex-1"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Minting
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setShowClaimModal(true)}
                  disabled={isPreviewMode || isPending}
                  className="flex-1"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Pause Claims
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Pause Minting Modal */}
      <AdminTransactionModal
        isOpen={showMintModal}
        onClose={() => setShowMintModal(false)}
        onConfirm={async () => {
          await onPauseMinting();
        }}
        title="Pause Minting"
        description="This will immediately stop all minting activity."
        functionName="pauseMinting"
        params={[
          { name: 'pause', value: 'true' }
        ]}
        isDestructive
        isPending={isPending}
        walletAddress={walletAddress}
      />

      {/* Pause Claims Modal */}
      <AdminTransactionModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        onConfirm={async () => {
          await onPauseClaims();
        }}
        title="Pause Claims"
        description="This will immediately stop all reward claiming."
        functionName="setClaimMode"
        params={[
          { name: 'mode', value: 'DISABLED (0)' }
        ]}
        isDestructive
        isPending={isPending}
        walletAddress={walletAddress}
      />
    </div>
  );
}
