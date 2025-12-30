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
    // Send multiple transactions if needed (inform user)
    let success = true;
    
    if (settings.mintEnabled !== config?.mintEnabled) {
      success = await sendAdminTx('pauseMinting', [!settings.mintEnabled]);
      if (!success) return false;
    }

    if (settings.mintPriceETH !== String(config?.mintPriceETH)) {
      success = await sendAdminTx('setMintPriceETH', [parseEther(settings.mintPriceETH)]);
      if (!success) return false;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Admin Panel
            </h2>
            <p className="text-sm text-muted-foreground">Owner controls for MemoryMint</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchContractConfig(true)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

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
  );
}
