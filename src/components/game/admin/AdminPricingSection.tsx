import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign,
  Coins,
  Loader2,
  TrendingUp,
  Save,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { ContractCapabilities, EnforcementType, ENFORCEMENT_LABELS } from './types';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';

interface AdminPricingSectionProps {
  config: ContractConfig | null;
  capabilities: ContractCapabilities;
  isPreviewMode: boolean;
  onSetMintPrice: (priceETH: bigint, priceUSDC: bigint) => Promise<boolean>;
  onSetWalletMintLimit: (limit: bigint) => Promise<boolean>;
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

export function AdminPricingSection({ 
  config, 
  capabilities,
  isPreviewMode,
  onSetMintPrice,
  onSetWalletMintLimit,
  isPending,
}: AdminPricingSectionProps) {
  const [priceETH, setPriceETH] = useState('');
  const [priceUSDC, setPriceUSDC] = useState('');
  const [walletLimit, setWalletLimit] = useState('');
  const [isPricePending, setIsPricePending] = useState(false);
  const [isLimitPending, setIsLimitPending] = useState(false);

  // Sync with on-chain values
  useEffect(() => {
    if (config) {
      setPriceETH(formatEther(config.mintPriceETH));
      setPriceUSDC(formatUnits(config.mintPriceUSDC, 6));
      setWalletLimit(config.walletMintLimit.toString());
    }
  }, [config]);

  const canSetPrice = capabilities.hasSetMintPrice;
  const canSetWalletLimit = capabilities.hasSetWalletMintLimit;
  const isFreeMint = (config?.mintPriceETH ?? 0n) === 0n && (config?.mintPriceUSDC ?? 0n) === 0n;

  const handleSetPrice = async () => {
    if (!canSetPrice) return;
    
    try {
      setIsPricePending(true);
      const ethWei = priceETH ? parseEther(priceETH) : 0n;
      const usdcUnits = priceUSDC ? parseUnits(priceUSDC, 6) : 0n;
      await onSetMintPrice(ethWei, usdcUnits);
    } catch (err) {
      console.error('Invalid price values:', err);
    } finally {
      setIsPricePending(false);
    }
  };

  const handleSetWalletLimit = async () => {
    if (!canSetWalletLimit) return;
    
    try {
      setIsLimitPending(true);
      const limit = BigInt(walletLimit || '0');
      await onSetWalletMintLimit(limit);
    } catch (err) {
      console.error('Invalid limit value:', err);
    } finally {
      setIsLimitPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Pricing & Limits
        </h3>
        <Badge 
          variant="outline"
          className={isFreeMint 
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
          }
        >
          {isFreeMint ? 'Free Mint' : 'Paid Mint'}
        </Badge>
      </div>

      {/* Current Prices Display */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Coins className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{formatEther(config?.mintPriceETH ?? 0n)}</p>
              <p className="text-xs text-muted-foreground">ETH Price</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-lg font-bold">${formatUnits(config?.mintPriceUSDC ?? 0n, 6)}</p>
              <p className="text-xs text-muted-foreground">USDC Price</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-lg font-bold">{config?.walletMintLimit?.toString() ?? '0'}</p>
              <p className="text-xs text-muted-foreground">Wallet Limit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Set Mint Price - Combined ETH/USDC */}
      {canSetPrice && (
        <Card className="border-emerald-500/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <Label className="font-medium">Set Mint Price</Label>
              <EnforcementBadge type="onchain" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Set both ETH and USDC prices in one transaction. Set to 0 for free mint.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <Coins className="h-3 w-3" /> ETH Price
                </Label>
                <Input
                  type="text"
                  placeholder="0.001"
                  value={priceETH}
                  onChange={(e) => setPriceETH(e.target.value)}
                  disabled={isPreviewMode || isPending || isPricePending}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> USDC Price
                </Label>
                <Input
                  type="text"
                  placeholder="5.00"
                  value={priceUSDC}
                  onChange={(e) => setPriceUSDC(e.target.value)}
                  disabled={isPreviewMode || isPending || isPricePending}
                />
              </div>
            </div>

            <Button
              onClick={handleSetPrice}
              disabled={isPreviewMode || isPending || isPricePending}
              className="w-full"
            >
              {isPricePending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Update Prices
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Set Wallet Mint Limit */}
      {canSetWalletLimit && (
        <Card className="border-amber-500/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              <Label className="font-medium">Wallet Mint Limit</Label>
              <EnforcementBadge type="onchain" />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Maximum number of NFTs a single wallet can mint. Set to 0 for unlimited.
            </p>

            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                placeholder="0 = unlimited"
                value={walletLimit}
                onChange={(e) => setWalletLimit(e.target.value)}
                disabled={isPreviewMode || isPending || isLimitPending}
                className="flex-1"
              />
              <Button
                onClick={handleSetWalletLimit}
                disabled={isPreviewMode || isPending || isLimitPending}
              >
                {isLimitPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!canSetPrice && !canSetWalletLimit && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No pricing controls available for this contract
        </div>
      )}
    </div>
  );
}
