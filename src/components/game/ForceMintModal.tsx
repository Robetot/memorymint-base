// ============================================================
// Force Mint Modal
// Shown when simulation is skipped due to RPC issues
// Allows user to proceed directly to wallet with warning
// ============================================================

import { AlertTriangle, Zap, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ForceMintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  warningMessage?: string;
  estimatedGas?: string;
}

export function ForceMintModal({
  isOpen,
  onClose,
  onConfirm,
  warningMessage = 'Simulation unavailable due to network issues.',
  estimatedGas,
}: ForceMintModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Proceed Without Simulation?
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p className="text-foreground font-medium">
              {warningMessage}
            </p>
            
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">The smart contract will still enforce all rules.</strong> If minting is paused, disabled, or you're ineligible, the transaction will be rejected by the contract.
                </p>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p>By proceeding, you acknowledge:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Gas estimation may be inaccurate</li>
                <li>Transaction may fail on-chain (gas will still be spent)</li>
                <li>Your wallet will show the final confirmation</li>
              </ul>
            </div>
            
            {estimatedGas && (
              <div className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                <span className="text-muted-foreground">Estimated Gas (default):</span>
                <span className="font-mono">{estimatedGas}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="default"
            className="w-full sm:w-auto"
          >
            <Zap className="h-4 w-4 mr-2" />
            Force Mint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
