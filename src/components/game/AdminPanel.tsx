import { useState, useEffect, useCallback } from 'react';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Shield, RefreshCw, Crown } from 'lucide-react';
import { useContractReads } from '@/hooks/useContractReads';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_CHAIN_ID,
  CONTRACT_ABI,
  USDC_DECIMALS,
  ClaimModeEnum,
} from '@/contracts/MemoryMintContract';
import {
  AdminSystemStatus,
  AdminRewardTiers,
  AdminClaimSettings,
  AdminMintControls,
  AdminEmergencyControls,
  AdminPreviewMode,
  AdminFooter,
} from './admin';

interface AdminPanelProps {
  walletAddress: string;
  onClose?: () => void;
}

export function AdminPanel({ walletAddress, onClose }: AdminPanelProps) {
  const { config, fetchContractConfig, fetchBonusLevels, bonusLevels, isOwner, invalidateConfigCache, isLoading } = useContractReads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [lastActionTimestamp, setLastActionTimestamp] = useState<number>();

  // Load config on mount
  useEffect(() => {
    fetchContractConfig(true);
    fetchBonusLevels(walletAddress);
  }, [fetchContractConfig, fetchBonusLevels, walletAddress]);

  // Check if user is owner
  const userIsOwner = isOwner(walletAddress);

  // Send transaction helper with gas-aware UX
  const sendAdminTx = useCallback(async (
    functionName: string,
    args: unknown[],
    value?: bigint
  ): Promise<boolean> => {
    if (!window.ethereum) {
      toast.error('Wallet not connected');
      return false;
    }

    if (isPreviewMode) {
      toast.info('Preview mode active - no transactions allowed');
      return false;
    }
    
    setIsSubmitting(true);
    
    try {
      const ethereum = window.ethereum as any;
      
      // Verify chain
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      if (chainId.toLowerCase() !== BASE_CHAIN_ID.toLowerCase()) {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID }],
        });
      }
      
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: functionName as any,
        args: args as any,
      });
      
      const txParams: any = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      };
      
      if (value && value > 0n) {
        txParams.value = `0x${value.toString(16)}`;
      }
      
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
      
      toast.success('Transaction submitted', { description: `Hash: ${txHash.slice(0, 10)}...` });
      
      // Wait for confirmation
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        receipt = await ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        if (receipt) break;
      }
      
      if (receipt?.status === '0x1') {
        toast.success('Transaction confirmed');
        setLastActionTimestamp(Date.now());
        invalidateConfigCache();
        await fetchContractConfig(true);
        await fetchBonusLevels(walletAddress);
        return true;
      } else {
        toast.error('Transaction failed', { description: 'Check BaseScan for details' });
        return false;
      }
    } catch (error: any) {
      if (error?.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error?.message?.slice(0, 100) || 'Transaction failed');
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAddress, isPreviewMode, invalidateConfigCache, fetchContractConfig, fetchBonusLevels]);

  // Handler functions for each section
  const handleConfigureTier = async (
    level: number,
    amountETH: string,
    amountUSDC: string,
    active: boolean,
    maxClaims: string
  ) => {
    return sendAdminTx('configureBonusLevel', [
      BigInt(level),
      parseEther(amountETH || '0'),
      parseUnits(amountUSDC || '0', USDC_DECIMALS),
      active,
      BigInt(maxClaims),
      false,
    ]);
  };

  const handleSaveClaimSettings = async (settings: any) => {
    return sendAdminTx('setClaimMode', [
      settings.claimsEnabled ? ClaimModeEnum.UNLIMITED : ClaimModeEnum.DISABLED
    ]);
  };

  const handleSaveMintSettings = async (settings: any) => {
    // Compare against on-chain values and send transactions for changed settings
    let success = true;
    let anyChangeMade = false;
    
    // Check mintEnabled (uses pauseMinting with inverted logic)
    if (settings.mintEnabled !== config?.mintEnabled) {
      success = await sendAdminTx('pauseMinting', [!settings.mintEnabled]);
      if (!success) return false;
      anyChangeMade = true;
    }

    // Check ETH price - compare parsed values
    const currentPriceETH = config?.mintPriceETH ?? 0n;
    const newPriceETH = parseEther(settings.mintPriceETH || '0');
    if (newPriceETH !== currentPriceETH) {
      success = await sendAdminTx('setMintPriceETH', [newPriceETH]);
      if (!success) return false;
      anyChangeMade = true;
    }

    // Check USDC price - compare parsed values
    const currentPriceUSDC = config?.mintPriceUSDC ?? 0n;
    const newPriceUSDC = parseUnits(settings.mintPriceUSDC || '0', USDC_DECIMALS);
    if (newPriceUSDC !== currentPriceUSDC) {
      success = await sendAdminTx('setMintPriceUSDC', [newPriceUSDC]);
      if (!success) return false;
      anyChangeMade = true;
    }

    // Check max mints per wallet
    const currentMaxMints = Number(config?.walletMintLimit ?? 10n);
    const newMaxMints = settings.maxMintsPerWallet;
    if (newMaxMints !== currentMaxMints) {
      success = await sendAdminTx('setWalletMintLimit', [BigInt(newMaxMints)]);
      if (!success) return false;
      anyChangeMade = true;
    }

    // Check anti-bot setting
    const currentAntiBotEnabled = (config?.antiBotMode ?? 0) > 0;
    if (settings.antiBotEnabled !== currentAntiBotEnabled) {
      success = await sendAdminTx('setAntiBotMode', [settings.antiBotEnabled ? 1 : 0]);
      if (!success) return false;
      anyChangeMade = true;
    }

    if (!anyChangeMade) {
      toast.info('No changes detected');
    }
    
    return success;
  };

  const handlePauseMinting = async () => {
    return sendAdminTx('pauseMinting', [true]);
  };

  const handlePauseClaims = async () => {
    return sendAdminTx('setClaimMode', [ClaimModeEnum.DISABLED]);
  };

  // Don't render if not owner (production security)
  if (!userIsOwner) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col p-6 bg-gradient-to-br from-background via-amber-950/5 to-background overflow-y-auto pb-24">
      {/* Header with amber/gold styling */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <p className="text-sm text-muted-foreground">Owner controls for MemoryMint</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/50 text-amber-500">
            Owner Only
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchContractConfig(true)} 
            disabled={isLoading}
            className="border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {onClose && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6 max-w-4xl mx-auto w-full">

      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="bg-secondary/20 border border-secondary/50 rounded-lg p-3 text-center text-sm">
          <strong>Preview mode</strong> — no on-chain transactions allowed
        </div>
      )}

      {/* Section 1: System Status */}
      <AdminSystemStatus config={config} isLoading={isLoading} />

      <Separator />

      {/* Section 2: Reward Tiers */}
      <AdminRewardTiers
        bonusLevels={bonusLevels}
        isPreviewMode={isPreviewMode}
        onConfigureTier={handleConfigureTier}
        isPending={isSubmitting}
      />

      <Separator />

      {/* Section 3: Claim Settings */}
      <AdminClaimSettings
        config={config}
        isPreviewMode={isPreviewMode}
        onSaveChanges={handleSaveClaimSettings}
        isPending={isSubmitting}
      />

      <Separator />

      {/* Section 4: Mint Controls */}
      <AdminMintControls
        config={config}
        isPreviewMode={isPreviewMode}
        onSaveChanges={handleSaveMintSettings}
        isPending={isSubmitting}
      />

      <Separator />

      {/* Section 5: Emergency Controls */}
      <AdminEmergencyControls
        walletAddress={walletAddress}
        isPreviewMode={isPreviewMode}
        onPauseMinting={handlePauseMinting}
        onPauseClaims={handlePauseClaims}
        isPending={isSubmitting}
      />

      <Separator />

      {/* Section 6: Preview Mode */}
      <AdminPreviewMode isEnabled={isPreviewMode} onToggle={setIsPreviewMode} />

      <Separator />

      {/* Footer */}
      <AdminFooter lastActionTimestamp={lastActionTimestamp} />
      </div>
    </div>
  );
}
