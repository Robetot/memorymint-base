import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Crown,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Lock,
  CheckCircle2,
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
import { toast } from 'sonner';

interface AdminOwnershipTogglesProps {
  currentOwner: string;
  walletAddress: string;
  isPreviewMode: boolean;
  isPending: boolean;
  ownershipTransferEnabled: boolean;
  onSetOwnershipTransferEnabled: (enabled: boolean) => Promise<boolean>;
  onTransferOwnership: (newOwner: string) => Promise<boolean>;
}

export function AdminOwnershipToggles({
  currentOwner,
  walletAddress,
  isPreviewMode,
  isPending,
  ownershipTransferEnabled,
  onSetOwnershipTransferEnabled,
  onTransferOwnership,
}: AdminOwnershipTogglesProps) {
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const isOwner = walletAddress.toLowerCase() === currentOwner.toLowerCase();

  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const formatAddress = (addr: string): string => {
    if (!addr) return '...';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  // Transfer is allowed only when on-chain ownershipTransferEnabled is true
  const canTransfer = isOwner && 
    ownershipTransferEnabled &&
    isValidAddress(newOwnerAddress) && 
    newOwnerAddress.toLowerCase() !== currentOwner.toLowerCase();

  const handleTransfer = async () => {
    setShowConfirmDialog(false);
    setIsTransferring(true);
    
    try {
      const success = await onTransferOwnership(newOwnerAddress);
      if (success) {
        setNewOwnerAddress('');
        toast.success('Ownership transferred successfully');
      }
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Ownership Control
        </h3>
        <Badge 
          variant="outline" 
          className={ownershipTransferEnabled 
            ? 'bg-destructive/10 text-destructive border-destructive/20' 
            : 'bg-muted text-muted-foreground'
          }
        >
          {ownershipTransferEnabled ? 'UNLOCKED' : 'LOCKED'}
        </Badge>
      </div>

      <Card className="border-amber-500/20">
        <CardContent className="p-4 space-y-4">
          {/* Current Owner Display */}
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Current Owner</span>
              </div>
              <code className="text-sm font-mono">{formatAddress(currentOwner)}</code>
            </div>
            {isOwner && (
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                You are the owner
              </div>
            )}
          </div>

          {/* Transfer Toggle - Only for owner */}
          {isOwner && (
            <>
              <AdminToggle
                id="transfer-enabled"
                label="Enable Ownership Transfer"
                description="Unlock the ownership transfer form (on-chain toggle)"
                icon={<Lock className="h-4 w-4" />}
                isEnabled={ownershipTransferEnabled}
                onToggle={async (enabled) => { 
                  if (enabled) {
                    const confirmed = window.confirm(
                      '⚠️ This will unlock ownership transfer ON-CHAIN. Continue?'
                    );
                    if (!confirmed) return false;
                  }
                  const success = await onSetOwnershipTransferEnabled(enabled);
                  if (!enabled && success) setNewOwnerAddress('');
                  return success;
                }}
                isPreviewMode={isPreviewMode}
                isPending={isPending}
                variant="danger"
              >
                {/* Transfer Form */}
                <div className="space-y-3">
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="font-medium">This action is irreversible</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">New Owner Address</Label>
                    <Input
                      placeholder="0x..."
                      value={newOwnerAddress}
                      onChange={(e) => setNewOwnerAddress(e.target.value)}
                      disabled={isPreviewMode || isPending || isTransferring}
                      className="font-mono text-sm"
                    />
                    {newOwnerAddress && !isValidAddress(newOwnerAddress) && (
                      <p className="text-xs text-destructive">Invalid address format</p>
                    )}
                    {newOwnerAddress && newOwnerAddress.toLowerCase() === currentOwner.toLowerCase() && (
                      <p className="text-xs text-destructive">New owner must be different</p>
                    )}
                  </div>

                  <Button
                    variant="destructive"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!canTransfer || isPreviewMode || isPending || isTransferring}
                    className="w-full"
                  >
                    {isTransferring ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Transfer Ownership
                  </Button>
                </div>
              </AdminToggle>
            </>
          )}

          {!isOwner && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Only the current owner can transfer ownership
            </div>
          )}
        </CardContent>
      </Card>

      {/* Final Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Crown className="h-5 w-5" />
              Confirm Ownership Transfer
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">⚠️ FINAL WARNING:</strong>
              <br /><br />
              You are about to transfer ownership to:
              <br />
              <code className="text-destructive font-mono">{newOwnerAddress}</code>
              <br /><br />
              You will <strong>immediately lose all admin access</strong> to this contract.
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransfer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
