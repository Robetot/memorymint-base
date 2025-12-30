import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Clock } from 'lucide-react';
import { NFT_CONTRACT_ADDRESS } from '@/contracts/MemoryMintContract';
import { toast } from 'sonner';

interface AdminFooterProps {
  lastActionTimestamp?: number;
}

export function AdminFooter({ lastActionTimestamp }: AdminFooterProps) {
  const formatAddress = (addr: string) => 
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown';

  const copyAddress = () => {
    navigator.clipboard.writeText(NFT_CONTRACT_ADDRESS);
    toast.success('Contract address copied to clipboard');
  };

  const openBaseScan = () => {
    window.open(`https://basescan.org/address/${NFT_CONTRACT_ADDRESS}`, '_blank');
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'No recent activity';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  return (
    <Card className="border-border/30 bg-muted/30">
      <CardContent className="p-4 space-y-3">
        {/* Contract Address */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Contract Address</span>
          <div className="flex items-center gap-1">
            <code className="text-xs bg-background px-2 py-1 rounded border">
              {formatAddress(NFT_CONTRACT_ADDRESS)}
            </code>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={copyAddress}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* BaseScan Link */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">View on Explorer</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={openBaseScan}
            className="h-7"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            BaseScan
          </Button>
        </div>

        {/* Last Admin Action */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last Admin Action
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(lastActionTimestamp)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
