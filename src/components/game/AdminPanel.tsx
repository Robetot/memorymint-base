import { useState, useCallback, useEffect } from 'react';
import { encodeFunctionData } from 'viem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RefreshCw, Crown, CheckCircle2, Copy } from 'lucide-react';
import { useAdminState } from '@/hooks/useAdminState';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_CHAIN_ID,
  CONTRACT_ABI,
} from '@/contracts/MemoryMintContract';
import {
  AdminStatusHeader,
  AdminMintSection,
  AdminEmergencySection,
  AdminAntiBotSection,
  AdminUnsupportedFeatures,
  AdminAuditLog,
  AdminActionPreview,
  AdminPreviewMode,
  AdminFooter,
  AdminHealthCheck,
  AdminLoadingState,
  logAdminAction,
  detectContractCapabilities,
  ContractCapabilities,
  SAFE_DEFAULTS,
} from './admin';

// Hardcoded admin address for display verification
const ADMIN_ADDRESS = '0x830f4c15480aa516a0cc4826902443936f9596cf';

// Global init timeout (5 seconds)
const GLOBAL_INIT_TIMEOUT_MS = 5000;

interface AdminPanelProps {
  walletAddress: string;
  onClose?: () => void;
}

export function AdminPanel({ walletAddress, onClose }: AdminPanelProps) {
  const {
    initState,
    authPhase,
    healthStatus,
    config,
    bonusLevels,
    isLoading,
    error,
    isReady,
    refreshConfig,
    runHealthCheck,
    retry,
    invalidateConfigCache,
  } = useAdminState(walletAddress);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [lastActionTimestamp, setLastActionTimestamp] = useState<number>();
  const [capabilities, setCapabilities] = useState<ContractCapabilities | null>(null);
  const [initTimeMs, setInitTimeMs] = useState<number>();

  // Detect contract capabilities on mount
  useEffect(() => {
    const caps = detectContractCapabilities();
    setCapabilities(caps);
  }, []);

  // Track init time
  useEffect(() => {
    if (initState === 'ready' && healthStatus.lastCheck) {
      setInitTimeMs(Date.now() - healthStatus.lastCheck);
    }
  }, [initState, healthStatus.lastCheck]);

  // Send transaction helper with gas-aware UX
  const sendAdminTx = useCallback(async (
    functionName: string,
    args: unknown[],
    value?: bigint,
    actionName?: string
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

      // Log the action
      logAdminAction(
        actionName || functionName,
        walletAddress,
        `Called ${functionName}`,
        txHash
      );

      // Wait for confirmation
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        receipt = await ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        if (receipt) break;
      }

      if (receipt?.status === '0x1') {
        toast.success('Transaction confirmed');
        setLastActionTimestamp(Date.now());
        // Refresh config after successful tx
        await refreshConfig();
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
  }, [walletAddress, isPreviewMode, refreshConfig]);

  // Handler functions for AVAILABLE contract functions only
  const handlePause = async () => {
    return sendAdminTx('pause', [], undefined, 'Pause Contract');
  };

  const handleUnpause = async () => {
    return sendAdminTx('unpause', [], undefined, 'Unpause Contract');
  };

  const handleSetThrottle = async (enabled: boolean) => {
    return sendAdminTx('setThrottle', [enabled], undefined, enabled ? 'Enable Throttle' : 'Disable Throttle');
  };

  const handleApplyChanges = async () => {
    // For this contract, changes are applied individually
    toast.info('Changes are applied via individual toggles above');
  };

  // Always render a visible state (never blank)
  if (!isReady) {
    return (
      <AdminLoadingState
        initState={initState}
        authPhase={authPhase}
        error={error}
        onRetry={retry}
        onClose={onClose}
      />
    );
  }

  // Check if connected wallet matches admin address
  const isVerifiedAdmin = walletAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast.success('Address copied');
  };

  // Use safe defaults for capabilities if not loaded - matches V3 contract
  const caps: ContractCapabilities = capabilities ?? {
    hasOwner: true,
    hasTotalSupply: true,
    hasPause: true,
    hasUnpause: true,
    hasMintPaused: true,
    hasSetThrottle: false,
    hasWalletMintLimit: true,
    hasSetWalletMintLimit: true,
    hasSetMintPrice: true,
    hasSetMintPriceETH: false,
    hasSetMintPriceUSDC: false,
    hasBonusPool: true,
    hasDepositETH: true,
    hasDepositUSDC: true,
    hasWithdrawETH: true,
    hasWithdrawUSDC: true,
    hasSetBonusLevel: true,
    hasKillSwitch: true,
    hasActivateKillSwitch: true,
    hasDeactivateKillSwitch: true,
    hasGlobalKillSwitch: true,
    hasEmergencyWithdraw: false,
    hasAntiBotMode: true,
    hasSetAntiBotMode: true,
    hasClaimMode: true,
    hasSetClaimMode: true,
    hasSetEligibilityRules: true,
    hasDynamicPricing: true,
    hasMintPriceETH: true,
    hasMintPriceUSDC: true,
    hasGetEffectiveBonus: true,
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-gradient-to-br from-background via-amber-950/5 to-background overflow-y-auto pb-24">
      {/* Header with amber/gold styling */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">MemoryMintUltra (Base Mainnet)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refreshConfig()} 
            disabled={isLoading}
            className="border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-2">Refresh</span>
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

      {/* System Status Header - Always Visible, Non-blocking */}
      <AdminStatusHeader
        walletAddress={walletAddress}
        isOwner={isVerifiedAdmin}
        contractReachable={healthStatus.contractReachable}
        configLoaded={healthStatus.configLoaded}
        networkCorrect={healthStatus.networkCorrect}
        loadTimeMs={initTimeMs}
        onRefresh={refreshConfig}
        isRefreshing={isLoading}
      />

      {/* Admin Wallet Verification Banner */}
      <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between ${
        isVerifiedAdmin 
          ? 'bg-emerald-500/10 border-emerald-500/30' 
          : 'bg-destructive/10 border-destructive/30'
      }`}>
        <div className="flex items-center gap-2">
          {isVerifiedAdmin ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Crown className="h-5 w-5 text-destructive" />
          )}
          <div>
            <p className={`text-sm font-medium ${isVerifiedAdmin ? 'text-emerald-500' : 'text-destructive'}`}>
              {isVerifiedAdmin ? 'Verified Admin Wallet' : 'Wallet Mismatch'}
            </p>
            <p className="text-xs text-muted-foreground">
              Connected: {formatAddress(walletAddress)}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={copyAddress}
          className="h-8 px-2"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6 max-w-4xl mx-auto w-full mt-6">
        {/* If contract config couldn't load, render a visible partial UI + retry */}
        {!config && (
          <div className="mb-2">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="font-medium">Admin configuration unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">
                On-chain reads failed or timed out. Safe defaults are applied.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={retry}>
                  Retry
                </Button>
                <Button variant="ghost" size="sm" onClick={() => refreshConfig()} disabled={isLoading}>
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <AdminHealthCheck healthStatus={healthStatus} onRunCheck={runHealthCheck} isLoading={isLoading} />
            </div>
          </div>
        )}

        {/* Preview Mode Banner */}
        {isPreviewMode && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center text-sm">
            <strong className="text-amber-600 dark:text-amber-400">Preview mode</strong> — no on-chain transactions allowed
          </div>
        )}

        {/* SECTION 1: Mint Controls */}
        <AdminMintSection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onPause={handlePause}
          onUnpause={handleUnpause}
          onSetThrottle={handleSetThrottle}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 2: Emergency Controls */}
        <AdminEmergencySection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onPause={handlePause}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 3: Anti-Bot Protection */}
        <AdminAntiBotSection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onSetThrottle={handleSetThrottle}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 4: Unsupported Features Notice */}
        <AdminUnsupportedFeatures capabilities={caps} />

        <Separator className="my-6" />

        {/* SECTION 5: Action Preview */}
        <AdminActionPreview
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onApplyChanges={handleApplyChanges}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 6: Preview Mode Toggle */}
        <AdminPreviewMode isEnabled={isPreviewMode} onToggle={setIsPreviewMode} />

        <Separator className="my-6" />

        {/* SECTION 7: Audit Log */}
        <AdminAuditLog walletAddress={walletAddress} />

        <Separator className="my-6" />

        {/* Footer */}
        <AdminFooter lastActionTimestamp={lastActionTimestamp} />
      </div>
    </div>
  );
}
