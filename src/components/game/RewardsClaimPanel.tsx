import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Coins, Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink, RefreshCw, Wallet, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useContractReads, BonusLevelInfo } from '@/hooks/useContractReads';
import { useBonusClaim } from '@/hooks/useBonusClaim';
import { formatEther, formatUnits } from 'viem';
import { USDC_DECIMALS, ClaimModeEnum } from '@/contracts/MemoryMintContract';

interface RewardsClaimPanelProps {
  walletAddress?: string;
  onClaimSuccess?: (level: number, amount: string, currency: 'ETH' | 'USDC') => void;
}

export function RewardsClaimPanel({ walletAddress, onClaimSuccess }: RewardsClaimPanelProps) {
  const { 
    config, 
    bonusLevels, 
    fetchContractConfig, 
    fetchBonusLevels,
    fetchWalletState,
    getFormattedBonusPool,
    invalidateWalletCache,
  } = useContractReads();
  
  const { 
    isClaiming, 
    txHash, 
    error: claimError, 
    success: claimSuccess,
    claimBonus, 
    resetClaimState 
  } = useBonusClaim();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);

  // Fetch data on mount and when wallet changes
  useEffect(() => {
    fetchContractConfig();
    if (walletAddress) {
      fetchBonusLevels(walletAddress);
      fetchWalletState(walletAddress);
    }
  }, [walletAddress, fetchContractConfig, fetchBonusLevels, fetchWalletState]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchContractConfig(true);
      if (walletAddress) {
        invalidateWalletCache(walletAddress);
        await fetchBonusLevels(walletAddress);
      }
    } catch (e) {
      console.error('[RewardsClaimPanel] Refresh failed', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [walletAddress, fetchContractConfig, fetchBonusLevels, invalidateWalletCache]);

  // Handle claim
  const handleClaim = async (level: BonusLevelInfo) => {
    if (!walletAddress || isClaiming) return;
    
    setClaimingLevel(level.level);
    resetClaimState();
    
    const result = await claimBonus(walletAddress, level.level, 1, '0x');
    
    if (result.success && result.amount && result.currency) {
      onClaimSuccess?.(level.level, result.amount, result.currency);
      
      // Refresh data after successful claim
      setTimeout(() => {
        handleRefresh();
      }, 2000);
    }
    
    setClaimingLevel(null);
  };

  // Get claim mode label
  const getClaimModeLabel = (mode: number): string => {
    switch (mode) {
      case ClaimModeEnum.DISABLED: return 'Disabled';
      case ClaimModeEnum.FCFS: return 'First Come First Served';
      case ClaimModeEnum.UNLIMITED: return 'Unlimited';
      case ClaimModeEnum.ONE_TIME: return 'One-Time';
      case ClaimModeEnum.CUSTOM: return 'Custom';
      default: return 'Unknown';
    }
  };

  // Format reward amount
  const formatReward = (level: BonusLevelInfo): string => {
    const currency = config?.activeBonusCurrency || 'ETH';
    if (currency === 'ETH') {
      return `${formatEther(level.amountETH)} ETH`;
    }
    return `$${formatUnits(level.amountUSDC, USDC_DECIMALS)} USDC`;
  };

  const bonusPool = getFormattedBonusPool();
  const claimingEnabled = config?.claimEnabled && config?.claimMode !== ClaimModeEnum.DISABLED;

  // Determine current step for display
  const getClaimStep = () => {
    if (claimSuccess) return 'success';
    if (claimError) return 'failed';
    if (txHash) return 'pending';
    if (isClaiming) return 'confirming';
    return 'idle';
  };
  
  const claimStep = getClaimStep();

  return (
    <div className="space-y-6">
      {/* Header with Pool Info */}
      <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <CardTitle className="text-lg">Bonus Rewards</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ETH Pool</p>
              <p className="text-lg font-bold text-amber-400">{bonusPool.eth} ETH</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">USDC Pool</p>
              <p className="text-lg font-bold text-green-400">{bonusPool.usdc}</p>
            </div>
          </div>
          
          {config && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant={claimingEnabled ? "default" : "secondary"}>
                {claimingEnabled ? 'Claims Active' : 'Claims Disabled'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {getClaimModeLabel(config.claimMode)}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet Connection Warning */}
      {!walletAddress && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-yellow-500" />
              <p className="text-sm text-yellow-200">
                Connect your wallet to view and claim rewards
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bonus Levels */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Gift className="w-4 h-4" />
          Available Reward Levels
        </h3>
        
        {bonusLevels.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Gift className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No active reward levels available
              </p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            {bonusLevels.map((level) => (
              <motion.div
                key={level.level}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className={`transition-all ${
                  level.canClaim 
                    ? 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10' 
                    : 'border-muted/30 opacity-60'
                }`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">Level {level.level}</span>
                          {level.requiresNFT && (
                            <Badge variant="outline" className="text-xs">
                              NFT Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-lg font-bold text-primary">
                          {formatReward(level)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {level.claimsRemaining.toString()} claims remaining
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {level.canClaim ? (
                          <Button
                            size="sm"
                            onClick={() => handleClaim(level)}
                            disabled={isClaiming || !claimingEnabled}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {claimingLevel === level.level && isClaiming ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {txHash ? 'Pending...' : 'Confirm...'}
                              </>
                            ) : (
                              <>
                                <Coins className="w-4 h-4 mr-2" />
                                Claim
                              </>
                            )}
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Not Eligible
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress bar for claims */}
                    {level.claimsRemaining > 0n && (
                      <div className="mt-3">
                        <Progress 
                          value={Number(level.claimsRemaining) > 100 ? 100 : Number(level.claimsRemaining)} 
                          className="h-1"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Transaction Status */}
      <AnimatePresence>
        {claimStep !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className={`${
              claimStep === 'success' ? 'border-green-500/50 bg-green-500/10' :
              claimStep === 'failed' ? 'border-red-500/50 bg-red-500/10' :
              'border-blue-500/50 bg-blue-500/10'
            }`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  {claimStep === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {claimStep === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
                  {['confirming', 'pending'].includes(claimStep) && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {claimStep === 'confirming' && 'Confirm in wallet...'}
                      {claimStep === 'pending' && 'Transaction pending...'}
                      {claimStep === 'success' && 'Reward claimed successfully!'}
                      {claimStep === 'failed' && 'Claim failed'}
                    </p>
                    
                    {claimError && (
                      <p className="text-xs text-red-400 mt-1">{claimError}</p>
                    )}
                    
                    {txHash && (
                      <a
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        View on BaseScan
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  
                  {(claimStep === 'success' || claimStep === 'failed') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetClaimState}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
