import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Wallet,
  Clock,
  Gift,
  Hash,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { NFT_CONTRACT_ADDRESS, CONTRACT_ABI } from '@/contracts/MemoryMintContract';
import { robustRpcCall, RPC_CONFIG } from '@/utils/rpcHandler';

interface WalletData {
  mintCount: bigint;
  lastMintTime: bigint;
  claimCount: bigint;
  lastClaimTime: bigint;
  totalBonusClaimed: bigint;
  isAllowlisted: boolean;
}

interface AdminWalletDataPanelProps {
  walletAddress: string;
}

export function AdminWalletDataPanel({ walletAddress }: AdminWalletDataPanelProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);

  const formatTimestamp = (timestamp: bigint): string => {
    if (timestamp === 0n) return 'Never';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  const formatETH = (value: bigint): string => {
    const eth = Number(value) / 1e18;
    return eth.toFixed(4);
  };

  const timeSince = (timestamp: bigint): string => {
    if (timestamp === 0n) return '-';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - Number(timestamp);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const fetchWalletData = useCallback(async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Encode the walletData(address) call
      const data = encodeFunctionData({
        abi: CONTRACT_ABI as any,
        functionName: 'walletData',
        args: [walletAddress as `0x${string}`],
      });

      const result = await robustRpcCall<string>(
        'eth_call',
        [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
        { timeoutMs: RPC_CONFIG.defaultTimeoutMs * 1.5, maxRetries: 3 }
      );

      if (!result.success || !result.data || result.data === '0x') {
        throw new Error(result.error || 'Failed to fetch wallet data');
      }

      // Decode the response
      const decoded = decodeFunctionResult({
        abi: CONTRACT_ABI as any,
        functionName: 'walletData',
        data: result.data as `0x${string}`,
      }) as [bigint, bigint, bigint, bigint, bigint, boolean];

      setWalletData({
        mintCount: decoded[0],
        lastMintTime: decoded[1],
        claimCount: decoded[2],
        lastClaimTime: decoded[3],
        totalBonusClaimed: decoded[4],
        isAllowlisted: decoded[5],
      });
      setLastFetched(Date.now());
    } catch (err) {
      console.error('[AdminWalletDataPanel] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet data');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Wallet Data
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchWalletData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4">
          {/* Connected Wallet */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-mono text-muted-foreground">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </span>
            {walletData?.isAllowlisted && (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Allowlisted
              </Badge>
            )}
            {walletData && !walletData.isAllowlisted && (
              <Badge variant="outline" className="text-xs bg-muted/30 text-muted-foreground">
                <XCircle className="h-3 w-3 mr-1" />
                Not Allowlisted
              </Badge>
            )}
          </div>

          {isLoading && !walletData && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading wallet data...</span>
            </div>
          )}

          {error && !walletData && (
            <div className="text-center py-6">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive/50" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchWalletData} className="mt-3">
                Retry
              </Button>
            </div>
          )}

          {walletData && (
            <div className="grid grid-cols-2 gap-4">
              {/* Mint Count */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Mint Count</span>
                </div>
                <p className="text-2xl font-bold">{walletData.mintCount.toString()}</p>
              </div>

              {/* Claim Count */}
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Claim Count</span>
                </div>
                <p className="text-2xl font-bold">{walletData.claimCount.toString()}</p>
              </div>

              {/* Total Bonus Claimed */}
              <div className="col-span-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-muted-foreground">Total Bonus Claimed</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatETH(walletData.totalBonusClaimed)} ETH
                </p>
              </div>

              {/* Last Mint Time */}
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Last Mint</span>
                </div>
                <p className="text-sm font-medium">{timeSince(walletData.lastMintTime)}</p>
                <p className="text-xs text-muted-foreground">{formatTimestamp(walletData.lastMintTime)}</p>
              </div>

              {/* Last Claim Time */}
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Last Claim</span>
                </div>
                <p className="text-sm font-medium">{timeSince(walletData.lastClaimTime)}</p>
                <p className="text-xs text-muted-foreground">{formatTimestamp(walletData.lastClaimTime)}</p>
              </div>
            </div>
          )}

          {/* Last Fetched Indicator */}
          {lastFetched > 0 && (
            <div className="mt-4 pt-3 border-t border-border/30 text-center">
              <span className="text-xs text-muted-foreground">
                Last updated: {new Date(lastFetched).toLocaleTimeString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
