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
  AdminAuditLog,
  AdminPreviewMode,
  AdminFooter,
  AdminHealthCheck,
  AdminLoadingState,
  AdminReadOnlyStats,
  AdminCoreToggles,
  AdminAntiBotToggles,
  AdminClaimToggles,
  AdminTreasuryToggles,
  AdminEmergencyToggles,
  AdminOwnershipToggles,
  AdminBatchPreflightPanel,
  logAdminAction,
  logOwnerAuditAction,
  detectContractCapabilities,
  ContractCapabilities,
} from './admin';
import { getCachedOwner } from '@/hooks/useOwnerFetch';

// Hardcoded admin address for display verification
const ADMIN_ADDRESS = '0x830f4c15480aa516a0cc4826902443936f9596cf';

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
    isLoading,
    error,
    isReady,
    refreshConfig,
    runHealthCheck,
    retry,
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

    // RULE 1: READS MUST NEVER BLOCK WRITES
    // Owner check is best-effort - if we have cached owner, verify; otherwise allow tx
    const detectedOwner = getCachedOwner() || config?.owner;
    if (detectedOwner) {
      const isOwner = walletAddress.toLowerCase() === detectedOwner.toLowerCase();
      if (!isOwner) {
        toast.error('Not authorized - only contract owner can execute this action.');
        return false;
      }
    }
    // NOTE: We do NOT block if owner is unknown - let the contract enforce ownership

    setIsSubmitting(true);
    const startTime = Date.now();

    try {
      const ethereum = window.ethereum as any;

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

      logAdminAction(actionName || functionName, walletAddress, `Called ${functionName}`, txHash);
      logOwnerAuditAction({ walletAddress, action: actionName || functionName, success: true, txHash });

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

      const success = receipt?.status === '0x1';
      const durationMs = Date.now() - startTime;
      
      if (success) {
        toast.success('Transaction confirmed', { description: `Completed in ${(durationMs / 1000).toFixed(1)}s` });
        setLastActionTimestamp(Date.now());
        await refreshConfig();
        return true;
      } else {
        toast.error('Transaction failed', { description: 'Check BaseScan for details' });
        logOwnerAuditAction({ walletAddress, action: actionName || functionName, success: false, txHash, error: 'Transaction reverted' });
        return false;
      }
    } catch (error: any) {
      const errorMsg = error?.message?.slice(0, 100) || 'Transaction failed';
      if (error?.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(errorMsg);
      }
      logOwnerAuditAction({ walletAddress, action: actionName || functionName, success: false, error: errorMsg });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAddress, isPreviewMode, refreshConfig, config?.owner]);

  // ============ V3 HANDLER FUNCTIONS ============
  const handleSetMintPaused = async (paused: boolean) => {
    return sendAdminTx('setMintPaused', [paused], undefined, paused ? 'Pause Minting' : 'Resume Minting');
  };

  const handleActivateKillSwitch = async () => {
    return sendAdminTx('activateKillSwitch', [], undefined, 'Activate Kill Switch');
  };

  const handleDeactivateKillSwitch = async () => {
    return sendAdminTx('deactivateKillSwitch', [], undefined, 'Deactivate Kill Switch');
  };

  const handleSetAntiBotMode = async (mode: number) => {
    return sendAdminTx('setAntiBotMode', [mode], undefined, `Set Anti-Bot Mode: ${mode}`);
  };

  const handleSetWalletMintLimit = async (limit: bigint) => {
    return sendAdminTx('setWalletMintLimit', [limit], undefined, `Set Wallet Limit: ${limit.toString()}`);
  };

  const handleSetFreeMint = async (isFree: boolean) => {
    return sendAdminTx('setFreeMint', [isFree], undefined, isFree ? 'Enable Free Mint' : 'Disable Free Mint');
  };

  const handleSetMintPriceETH = async (priceWei: bigint) => {
    return sendAdminTx('setMintPriceETH', [priceWei], undefined, `Set ETH Price: ${Number(priceWei) / 1e18} ETH`);
  };

  const handleSetMintPriceUSDC = async (priceUSDC: bigint) => {
    return sendAdminTx('setMintPriceUSDC', [priceUSDC], undefined, `Set USDC Price: ${Number(priceUSDC) / 1e6} USDC`);
  };

  const handleSetClaimMode = async (mode: number) => {
    return sendAdminTx('setClaimMode', [mode], undefined, `Set Claim Mode: ${mode}`);
  };

  const handleSetClaimsPaused = async (paused: boolean) => {
    return sendAdminTx('setClaimsPaused', [paused], undefined, paused ? 'Pause Claims' : 'Resume Claims');
  };

  const handleDepositETH = async (amount: bigint) => {
    return sendAdminTx('depositBonusPool', [], amount, `Deposit ${Number(amount) / 1e18} ETH to Bonus Pool`);
  };

  const handleDepositUSDC = async (amount: bigint) => {
    return sendAdminTx('depositBonusPoolUSDC', [amount], undefined, `Deposit ${Number(amount) / 1e6} USDC to Bonus Pool`);
  };

  const handleWithdrawFees = async () => {
    return sendAdminTx('withdrawFees', [], undefined, 'Withdraw ETH Fees');
  };

  const handleWithdrawBonusPool = async (ethAmount: bigint, usdcAmount: bigint) => {
    return sendAdminTx('withdrawBonusPool', [ethAmount, usdcAmount], undefined, 
      `Withdraw ${Number(ethAmount) / 1e18} ETH, ${Number(usdcAmount) / 1e6} USDC from Bonus Pool`);
  };

  const handleEmergencyWithdraw = async () => {
    return sendAdminTx('emergencyWithdraw', [], undefined, 'Emergency Withdraw All Funds');
  };

  const handleSetLevelBonus = async (level: number, bonusETH: bigint, bonusUSDC: bigint) => {
    return sendAdminTx('setLevelBonus', [level, bonusETH, bonusUSDC], undefined, 
      `Set Level ${level} Bonus: ${Number(bonusETH) / 1e18} ETH, ${Number(bonusUSDC) / 1e6} USDC`);
  };

  const handleSetBonusClaimActive = async (active: boolean) => {
    return sendAdminTx('setBonusClaimActive', [active], undefined, 
      `${active ? 'Enable' : 'Disable'} Bonus Claiming`);
  };

  const handleSetBonusLevelsEnabled = async (enabled: boolean) => {
    return sendAdminTx('setBonusLevelsEnabled', [enabled], undefined, 
      `${enabled ? 'Enable' : 'Disable'} Bonus Levels`);
  };

  const handleSetAllowBonusDeposit = async (enabled: boolean) => {
    return sendAdminTx('setAllowBonusDeposit', [enabled], undefined, 
      `${enabled ? 'Enable' : 'Disable'} Bonus Deposits`);
  };

  const handleSetWithdrawFeesEnabled = async (enabled: boolean) => {
    return sendAdminTx('setWithdrawFeesEnabled', [enabled], undefined, 
      `${enabled ? 'Enable' : 'Disable'} Fee Withdrawals`);
  };

  const handleSetOwnershipTransferEnabled = async (enabled: boolean) => {
    return sendAdminTx('setOwnershipTransferEnabled', [enabled], undefined, 
      `${enabled ? 'Unlock' : 'Lock'} Ownership Transfer`);
  };

  const handleTransferOwnership = async (newOwner: string) => {
    return sendAdminTx('transferOwnership', [newOwner], undefined, `Transfer Ownership to ${newOwner.slice(0, 10)}...`);
  };

  // Loading state
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

  const isVerifiedAdmin = walletAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast.success('Address copied');
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-gradient-to-br from-background via-amber-950/5 to-background overflow-y-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">MemoryMintUltraV3 (Base Mainnet)</p>
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

      {/* System Status Header */}
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
        <Button variant="ghost" size="sm" onClick={copyAddress} className="h-8 px-2">
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6 max-w-4xl mx-auto w-full mt-6">
        {/* RULE 3: Non-blocking config warning - panel remains fully usable */}
        {!config && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Some on-chain reads unavailable</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Admin actions still work. Displayed values use safe defaults.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refreshConfig()} disabled={isLoading} className="h-7 px-2">
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        )}

        {/* Preview Mode Banner */}
        {isPreviewMode && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center text-sm">
            <strong className="text-amber-600 dark:text-amber-400">Preview mode</strong> — no on-chain transactions allowed
          </div>
        )}

        {/* SECTION 1: Read-Only Live Stats */}
        <AdminReadOnlyStats config={config} walletAddress={walletAddress} />

        <Separator className="my-6" />

        {/* SECTION 1.5: Batch Mint Pre-flight Simulation */}
        <AdminBatchPreflightPanel
          walletAddress={walletAddress}
          isConnected={true}
          chainId={'0x2105'}
        />

        <Separator className="my-6" />

        {/* SECTION 2: Core Contract Toggles */}
        <AdminCoreToggles
          config={config}
          onSetMintPaused={handleSetMintPaused}
          onSetFreeMint={handleSetFreeMint}
          onSetMintPriceETH={handleSetMintPriceETH}
          onSetMintPriceUSDC={handleSetMintPriceUSDC}
          onActivateKillSwitch={handleActivateKillSwitch}
          onDeactivateKillSwitch={handleDeactivateKillSwitch}
          isPending={isSubmitting}
          isPreviewMode={isPreviewMode}
        />

        <Separator className="my-6" />

        {/* SECTION 3: Anti-Bot Protection */}
        <AdminAntiBotToggles
          config={config}
          onSetAntiBotMode={handleSetAntiBotMode}
          onSetWalletMintLimit={handleSetWalletMintLimit}
          isPending={isSubmitting}
          isPreviewMode={isPreviewMode}
        />

        <Separator className="my-6" />

        {/* SECTION 4: Claim & Bonus Controls */}
        <AdminClaimToggles
          config={config}
          onSetClaimsPaused={handleSetClaimsPaused}
          onSetClaimMode={handleSetClaimMode}
          onSetBonusClaimActive={handleSetBonusClaimActive}
          onSetBonusLevelsEnabled={handleSetBonusLevelsEnabled}
          onSetLevelBonus={handleSetLevelBonus}
          isPending={isSubmitting}
          isPreviewMode={isPreviewMode}
        />

        <Separator className="my-6" />

        {/* SECTION 5: Treasury Controls */}
        <AdminTreasuryToggles
          config={config}
          onDepositETH={handleDepositETH}
          onDepositUSDC={handleDepositUSDC}
          onWithdrawFees={handleWithdrawFees}
          onWithdrawBonusPool={handleWithdrawBonusPool}
          onSetAllowBonusDeposit={handleSetAllowBonusDeposit}
          onSetWithdrawFeesEnabled={handleSetWithdrawFeesEnabled}
          onRefresh={refreshConfig}
          isPending={isSubmitting}
          isPreviewMode={isPreviewMode}
        />

        <Separator className="my-6" />

        {/* SECTION 6: Emergency Controls */}
        <AdminEmergencyToggles
          config={config}
          onSetMintPaused={handleSetMintPaused}
          onEmergencyWithdraw={handleEmergencyWithdraw}
          onActivateKillSwitch={handleActivateKillSwitch}
          onDeactivateKillSwitch={handleDeactivateKillSwitch}
          isPending={isSubmitting}
          isPreviewMode={isPreviewMode}
        />

        <Separator className="my-6" />

        {/* SECTION 7: Ownership Control */}
        <AdminOwnershipToggles
          currentOwner={config?.owner ?? ''}
          walletAddress={walletAddress}
          ownershipTransferEnabled={config?.ownershipTransferEnabled ?? false}
          onSetOwnershipTransferEnabled={handleSetOwnershipTransferEnabled}
          onTransferOwnership={handleTransferOwnership}
          isPending={isSubmitting}
          isPreviewMode={isPreviewMode}
        />

        <Separator className="my-6" />

        {/* SECTION 8: Preview Mode */}
        <AdminPreviewMode isEnabled={isPreviewMode} onToggle={setIsPreviewMode} />

        <Separator className="my-6" />

        {/* SECTION 9: Audit Log */}
        <AdminAuditLog walletAddress={walletAddress} />

        <Separator className="my-6" />

        {/* Footer */}
        <AdminFooter lastActionTimestamp={lastActionTimestamp} />
      </div>
    </div>
  );
}
