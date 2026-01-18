import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Crown,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { NFT_CONTRACT_ADDRESS } from '@/contracts/MemoryMintContract';
import { toast } from 'sonner';

interface AdminOwnershipSectionProps {
  currentOwner: string;
  walletAddress: string;
  isPreviewMode: boolean;
  onTransferOwnership: (newOwner: string) => Promise<boolean>;
  isPending: boolean;
}

export function AdminOwnershipSection({
  currentOwner,
  walletAddress,
  isPreviewMode,
  onTransferOwnership,
  isPending,
}: AdminOwnershipSectionProps) {
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const formatAddress = (addr: string): string => {
    if (!addr) return 'Loading...';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied to clipboard');
  };

  const openOnBaseScan = (addr: string) => {
    window.open(`https://basescan.org/address/${addr}`, '_blank');
  };

  const handleTransfer = async () => {
    if (!isValidAddress(newOwnerAddress)) {
      toast.error('Invalid address format');
      return;
    }
    
    if (newOwnerAddress.toLowerCase() === currentOwner.toLowerCase()) {
      toast.error('New owner must be different from current owner');
      return;
    }

    const success = await onTransferOwnership(newOwnerAddress);
    if (success) {
      setNewOwnerAddress('');
      setShowConfirm(false);
    }
  };

  const isOwner = walletAddress.toLowerCase() === currentOwner.toLowerCase();
  const canTransfer = isOwner && isValidAddress(newOwnerAddress) && 
    newOwnerAddress.toLowerCase() !== currentOwner.toLowerCase();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Contract Ownership
        </h3>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          {/* Current Owner Display */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Current Owner</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <Crown className="h-5 w-5 text-amber-500" />
              <code className="flex-1 text-sm font-mono">
                {currentOwner ? formatAddress(currentOwner) : 'Loading...'}
              </code>
              {currentOwner && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyAddress(currentOwner)}
                    className="h-7 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openOnBaseScan(currentOwner)}
                    className="h-7 px-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
            {isOwner && (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                You are the owner
              </Badge>
            )}
          </div>

          {/* Contract Address */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Contract Address</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
              <code className="flex-1 text-sm font-mono text-muted-foreground">
                {formatAddress(NFT_CONTRACT_ADDRESS)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyAddress(NFT_CONTRACT_ADDRESS)}
                className="h-7 px-2"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openOnBaseScan(NFT_CONTRACT_ADDRESS)}
                className="h-7 px-2"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Transfer Ownership (Only shown to owner) */}
          {isOwner && (
            <div className="pt-4 border-t border-border/30 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <Label className="text-sm font-medium">Transfer Ownership</Label>
              </div>
              
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-xs text-destructive mb-2">
                  ⚠️ <strong>Warning:</strong> This action is irreversible. Transferring ownership 
                  will give the new address full control over the contract.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">New Owner Address</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="0x..."
                    value={newOwnerAddress}
                    onChange={(e) => {
                      setNewOwnerAddress(e.target.value);
                      setShowConfirm(false);
                    }}
                    disabled={isPreviewMode || isPending}
                    className="font-mono text-sm"
                  />
                </div>
                {newOwnerAddress && !isValidAddress(newOwnerAddress) && (
                  <p className="text-xs text-destructive">Invalid address format</p>
                )}
              </div>

              {!showConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirm(true)}
                  disabled={!canTransfer || isPreviewMode || isPending}
                  className="w-full"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Initiate Transfer
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm font-medium text-destructive mb-1">Confirm Transfer</p>
                    <p className="text-xs text-muted-foreground">
                      Transfer ownership to: <br />
                      <code className="text-destructive">{newOwnerAddress}</code>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirm(false)}
                      disabled={isPending}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleTransfer}
                      disabled={isPreviewMode || isPending}
                      className="flex-1"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Confirm Transfer'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
