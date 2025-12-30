import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Fuel, Wallet } from 'lucide-react';

interface TransactionParam {
  name: string;
  value: string;
  isChanged?: boolean;
}

interface AdminTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description?: string;
  functionName: string;
  params: TransactionParam[];
  isDestructive?: boolean;
  isPending?: boolean;
  walletAddress: string;
}

export function AdminTransactionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  functionName,
  params,
  isDestructive = false,
  isPending = false,
  walletAddress,
}: AdminTransactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling is done in the parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAddress = (addr: string) => 
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDestructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Network Badge */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Network</span>
            <Badge variant="outline" className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/30">
              Base
            </Badge>
          </div>

          {/* Wallet */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Wallet
            </span>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {formatAddress(walletAddress)}
            </code>
          </div>

          {/* Function */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Function</span>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
              {functionName}
            </code>
          </div>

          {/* Parameters */}
          {params.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Parameters</span>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                {params.map((param, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{param.name}</span>
                    <span className={param.isChanged ? "text-primary font-medium" : ""}>
                      {param.value}
                      {param.isChanged && (
                        <span className="text-xs text-primary ml-1">(changed)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gas Warning */}
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
            <Fuel className="h-4 w-4 flex-shrink-0" />
            <span>This action requires gas. Transaction fees apply.</span>
          </div>

          {/* Destructive Warning */}
          {isDestructive && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>This action affects all players immediately and cannot be undone.</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting || isPending}
          >
            Cancel
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isSubmitting || isPending}
          >
            {isSubmitting || isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>Confirm (Gas Required)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
