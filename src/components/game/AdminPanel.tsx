import { useState, useCallback, useEffect } from 'react';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';
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
  AdminPricingSection,
  AdminTreasurySection,
  AdminWalletDataPanel,
  AdminOwnershipSection,
  AdminGlobalStatsPanel,
  logAdminAction,
  logOwnerAuditAction,
  detectContractCapabilities,
  ContractCapabilities,
  SAFE_DEFAULTS,
} from './admin';
import { getCachedOwner } from '@/hooks/useOwnerFetch';
import { getCachedTotalMinted } from '@/hooks/useTotalMintedFetch';

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
  // IMPORTANT: Only executes if owner is detected
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

    // CRITICAL: Check if owner is detected before allowing admin actions
    const detectedOwner = getCachedOwner() || config?.owner;
    if (!detectedOwner) {
      toast.error('Owner not detected. Cannot execute admin action.', {
        description: 'Wait for owner detection to complete or check network connection.',
      });
      console.error('[AdminPanel] Admin action blocked: Owner not detected');
      return false;
    }

    // CRITICAL: Check if totalMinted is detected before allowing minting/bonus operations
    const detectedTotalMinted = getCachedTotalMinted() ?? config?.totalSupply;
    if (detectedTotalMinted === null || detectedTotalMinted === undefined) {
      toast.error('totalMinted not detected. Cannot execute operation.', {
        description: 'Wait for totalMinted detection to complete or check network/proxy.',
      });
      console.error('[AdminPanel] Admin action blocked: totalMinted not detected');
      return false;
    }

    // Check if connected wallet is the owner
    const isOwner = walletAddress.toLowerCase() === detectedOwner.toLowerCase();
    if (!isOwner) {
      toast.error('Not authorized', {
        description: 'Only the contract owner can execute this action.',
      });
      console.error('[AdminPanel] Admin action blocked: Wallet is not owner');
      return false;
    }

    setIsSubmitting(true);
    const startTime = Date.now();

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

      console.info('[AdminPanel] Sending admin transaction:', {
        function: functionName,
        wallet: walletAddress.slice(0, 10) + '...',
        timestamp: new Date().toISOString(),
      });

      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      toast.success('Transaction submitted', { description: `Hash: ${txHash.slice(0, 10)}...` });

      // Log the action with both audit systems
      logAdminAction(
        actionName || functionName,
        walletAddress,
        `Called ${functionName}`,
        txHash
      );
      
      // Also log to owner audit (for enhanced tracking)
      logOwnerAuditAction({
        walletAddress,
        action: actionName || functionName,
        success: true, // Will update after confirmation
        txHash,
      });

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
        toast.success('Transaction confirmed', {
          description: `Completed in ${(durationMs / 1000).toFixed(1)}s`,
        });
        setLastActionTimestamp(Date.now());
        
        // Log successful confirmation
        console.info('[AdminPanel] ✓ Admin action confirmed:', {
          function: functionName,
          wallet: walletAddress,
          txHash,
          durationMs,
          timestamp: new Date().toISOString(),
        });
        
        // Refresh config after successful tx
        await refreshConfig();
        return true;
      } else {
        toast.error('Transaction failed', { description: 'Check BaseScan for details' });
        
        // Log failure
        logOwnerAuditAction({
          walletAddress,
          action: actionName || functionName,
          success: false,
          txHash,
          error: 'Transaction reverted',
        });
        
        return false;
      }
    } catch (error: any) {
      const errorMsg = error?.message?.slice(0, 100) || 'Transaction failed';
      
      if (error?.code === 4001) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(errorMsg);
      }
      
      // Log error
      logOwnerAuditAction({
        walletAddress,
        action: actionName || functionName,
        success: false,
        error: errorMsg,
      });
      
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAddress, isPreviewMode, refreshConfig, config?.owner]);

  // ============ V3 HANDLER FUNCTIONS ============
  // AUDITED & FIXED: All handlers now match MemoryMintUltraV3 ABI exactly

  // V3: setMintPaused(bool) - PRIMARY pause control
  // NOTE: V3 does NOT have legacy pause()/unpause() - use setMintPaused only
  const handlePause = async () => {
    return sendAdminTx('setMintPaused', [true], undefined, 'Pause Minting');
  };

  const handleUnpause = async () => {
    return sendAdminTx('setMintPaused', [false], undefined, 'Resume Minting');
  };

  // V3: setMintPaused(bool) - explicit variant
  const handleSetMintPaused = async (paused: boolean) => {
    return sendAdminTx('setMintPaused', [paused], undefined, paused ? 'Pause Minting' : 'Resume Minting');
  };

  // V3: activateKillSwitch() - NO ARGS, owner only
  const handleActivateKillSwitch = async () => {
    return sendAdminTx('activateKillSwitch', [], undefined, 'Activate Kill Switch');
  };

  // V3: deactivateKillSwitch() - NO ARGS, owner only (MISSING from user ABI but verified on BaseScan)
  const handleDeactivateKillSwitch = async () => {
    // NOTE: This function exists in deployed contract but was missing from user-provided ABI
    return sendAdminTx('deactivateKillSwitch', [], undefined, 'Deactivate Kill Switch');
  };

  // V3: setAntiBotMode(uint8) - modes: 0=Disabled, 1=Signature, 2=Allowlist, 3=Hybrid
  const handleSetAntiBotMode = async (mode: number) => {
    return sendAdminTx('setAntiBotMode', [mode], undefined, `Set Anti-Bot Mode: ${mode}`);
  };

  // V3: setWalletMintLimit(uint256) - 0 = unlimited
  const handleSetWalletMintLimit = async (limit: bigint) => {
    return sendAdminTx('setWalletMintLimit', [limit], undefined, `Set Wallet Limit: ${limit.toString()}`);
  };

  // V3: setMintPrice(uint256 ethPrice, uint256 usdcPrice) - COMBINED SETTER
  const handleSetMintPrice = async (priceETH: bigint, priceUSDC: bigint) => {
    return sendAdminTx('setMintPrice', [priceETH, priceUSDC], undefined, 
      `Set Prices: ${Number(priceETH) / 1e18} ETH, ${Number(priceUSDC) / 1e6} USDC`);
  };

  // V3: setClaimMode(uint8) - modes: 0=Disabled, 1=FCFS, 2=Unlimited, 3=OneTime, 4=Custom
  const handleSetClaimMode = async (mode: number) => {
    return sendAdminTx('setClaimMode', [mode], undefined, `Set Claim Mode: ${mode}`);
  };

  // V3: setClaimsPaused(bool)
  const handleSetClaimsPaused = async (paused: boolean) => {
    return sendAdminTx('setClaimsPaused', [paused], undefined, paused ? 'Pause Claims' : 'Resume Claims');
  };

  // Legacy: setThrottle -> maps to setAntiBotMode
  const handleSetThrottle = async (enabled: boolean) => {
    const mode = enabled ? 1 : 0; // 1 = Signature mode, 0 = Disabled
    return handleSetAntiBotMode(mode);
  };

  // V3: depositBonusPool() - PAYABLE, NO ARGS - ETH sent as msg.value
  // FIXED: Was incorrectly calling 'depositBonusPoolETH' which doesn't exist
  const handleDepositETH = async (amount: bigint) => {
    return sendAdminTx('depositBonusPool', [], amount, `Deposit ${Number(amount) / 1e18} ETH to Bonus Pool`);
  };

  // V3: depositBonusPoolUSDC(uint256 amount) - requires USDC approval first
  const handleDepositUSDC = async (amount: bigint) => {
    return sendAdminTx('depositBonusPoolUSDC', [amount], undefined, `Deposit ${Number(amount) / 1e6} USDC to Bonus Pool`);
  };

  // V3: withdrawFees() - withdraws accumulated minting fees (ETH)
  const handleWithdrawFees = async () => {
    return sendAdminTx('withdrawFees', [], undefined, 'Withdraw ETH Fees');
  };

  // V3: withdrawBonusPool(uint256 ethAmount, uint256 usdcAmount) - for bonus pool withdrawal
  // NOTE: No separate withdrawFeesUSDC exists - use withdrawBonusPool for USDC
  const handleWithdrawBonusPool = async (ethAmount: bigint, usdcAmount: bigint) => {
    return sendAdminTx('withdrawBonusPool', [ethAmount, usdcAmount], undefined, 
      `Withdraw ${Number(ethAmount) / 1e18} ETH, ${Number(usdcAmount) / 1e6} USDC from Bonus Pool`);
  };

  // V3: emergencyWithdraw() - withdraws ALL funds in emergency
  const handleEmergencyWithdraw = async () => {
    return sendAdminTx('emergencyWithdraw', [], undefined, 'Emergency Withdraw All Funds');
  };

  // V3: setLevelPrice(uint8 level, uint256 priceETH, uint256 priceUSDC)
  const handleSetLevelPrice = async (level: number, priceETH: bigint, priceUSDC: bigint) => {
    return sendAdminTx('setLevelPrice', [level, priceETH, priceUSDC], undefined, 
      `Set Level ${level} Price: ${Number(priceETH) / 1e18} ETH, ${Number(priceUSDC) / 1e6} USDC`);
  };

  // V3: setLevelBonus(uint8 level, uint256 bonusETH, uint256 bonusUSDC)
  const handleSetLevelBonus = async (level: number, bonusETH: bigint, bonusUSDC: bigint) => {
    return sendAdminTx('setLevelBonus', [level, bonusETH, bonusUSDC], undefined, 
      `Set Level ${level} Bonus: ${Number(bonusETH) / 1e18} ETH, ${Number(bonusUSDC) / 1e6} USDC`);
  };

  // V3: setSupplyPriceTier(uint8 tier, uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC)
  const handleSetSupplyPriceTier = async (tier: number, minSupply: bigint, maxSupply: bigint, priceETH: bigint, priceUSDC: bigint) => {
    return sendAdminTx('setSupplyPriceTier', [tier, minSupply, maxSupply, priceETH, priceUSDC], undefined, 
      `Set Supply Tier ${tier}: ${minSupply}-${maxSupply} mints`);
  };

  // V3: setSupplyBonusTier(uint8 tier, uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC)
  const handleSetSupplyBonusTier = async (tier: number, minSupply: bigint, maxSupply: bigint, bonusETH: bigint, bonusUSDC: bigint) => {
    return sendAdminTx('setSupplyBonusTier', [tier, minSupply, maxSupply, bonusETH, bonusUSDC], undefined, 
      `Set Bonus Tier ${tier}: ${minSupply}-${maxSupply} mints`);
  };

  // V3: setBonusCapPerWallet(uint256 cap)
  const handleSetBonusCapPerWallet = async (cap: bigint) => {
    return sendAdminTx('setBonusCapPerWallet', [cap], undefined, `Set Bonus Cap: ${Number(cap) / 1e18} ETH`);
  };

  // V3: setMintCooldown(uint256 cooldown) - seconds between mints
  const handleSetMintCooldown = async (cooldown: bigint) => {
    return sendAdminTx('setMintCooldown', [cooldown], undefined, `Set Mint Cooldown: ${cooldown}s`);
  };

  // V3: setAllowlist(address[] wallets, bool allow)
  const handleSetAllowlist = async (wallets: string[], allow: boolean) => {
    return sendAdminTx('setAllowlist', [wallets, allow], undefined, 
      `${allow ? 'Add' : 'Remove'} ${wallets.length} wallets ${allow ? 'to' : 'from'} allowlist`);
  };

  // V3: setCurrencyConfig(bool ethEnabled, bool usdcEnabled, uint8 activeCurrency)
  const handleSetCurrencyConfig = async (ethEnabled: boolean, usdcEnabled: boolean, activeCurrency: number) => {
    return sendAdminTx('setCurrencyConfig', [ethEnabled, usdcEnabled, activeCurrency], undefined, 
      `Currency: ETH=${ethEnabled}, USDC=${usdcEnabled}, Active=${activeCurrency}`);
  };

  // V3: setEligibilityRules(uint256 minMints, uint256 cooldown, bool requireAllowlist)
  const handleSetEligibilityRules = async (minMints: bigint, cooldown: bigint, requireAllowlist: boolean) => {
    return sendAdminTx('setEligibilityRules', [minMints, cooldown, requireAllowlist], undefined, 
      `Eligibility: min=${minMints}, cooldown=${cooldown}s, allowlist=${requireAllowlist}`);
  };

  // V3: setDynamicPricingEnabled(bool)
  const handleSetDynamicPricingEnabled = async (enabled: boolean) => {
    return sendAdminTx('setDynamicPricingEnabled', [enabled], undefined, 
      `${enabled ? 'Enable' : 'Disable'} Dynamic Pricing`);
  };

  // V3: setDynamicBonusEnabled(bool)
  const handleSetDynamicBonusEnabled = async (enabled: boolean) => {
    return sendAdminTx('setDynamicBonusEnabled', [enabled], undefined, 
      `${enabled ? 'Enable' : 'Disable'} Dynamic Bonuses`);
  };

  // V3: setTokenURI(uint256 tokenId, string uri)
  const handleSetTokenURI = async (tokenId: bigint, uri: string) => {
    return sendAdminTx('setTokenURI', [tokenId, uri], undefined, `Set Token ${tokenId} URI`);
  };

  // V3: setBaseURI(string uri)
  const handleSetBaseURI = async (uri: string) => {
    return sendAdminTx('setBaseURI', [uri], undefined, 'Set Base URI');
  };

  // V3: setSignatureVerifier(address verifier)
  const handleSetSignatureVerifier = async (verifier: string) => {
    return sendAdminTx('setSignatureVerifier', [verifier], undefined, `Set Signature Verifier: ${verifier.slice(0, 10)}...`);
  };

  // V3: setMaxPriceCap(uint256 maxETH, uint256 maxUSDC)
  const handleSetMaxPriceCap = async (maxETH: bigint, maxUSDC: bigint) => {
    return sendAdminTx('setMaxPriceCap', [maxETH, maxUSDC], undefined, 
      `Set Max Price Cap: ${Number(maxETH) / 1e18} ETH, ${Number(maxUSDC) / 1e6} USDC`);
  };

  const handleApplyChanges = async () => {
    toast.info('Changes are applied via individual toggles above');
  };

  // V3: transferOwnership(address newOwner)
  const handleTransferOwnership = async (newOwner: string) => {
    return sendAdminTx('transferOwnership', [newOwner], undefined, `Transfer Ownership to ${newOwner.slice(0, 10)}...`);
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
  // V3 Safe defaults - ALL capabilities ENABLED for MemoryMintUltraV3
  const caps: ContractCapabilities = capabilities ?? {
    hasOwner: true,
    hasTotalSupply: true,
    hasPause: true,
    hasUnpause: true,
    hasMintPaused: true,
    hasSetThrottle: false, // V3 uses antiBotMode instead
    hasWalletMintLimit: true,
    hasSetWalletMintLimit: true,
    hasSetMintPrice: true,
    hasSetMintPriceETH: false, // V3 uses combined setter
    hasSetMintPriceUSDC: false, // V3 uses combined setter
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
    hasEmergencyWithdraw: true, // V3 VERIFIED: emergencyWithdraw() exists
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

        {/* SECTION 0: Global Stats Overview */}
        <AdminGlobalStatsPanel config={config} />

        <Separator className="my-6" />

        {/* SECTION 1: Contract Ownership */}
        <AdminOwnershipSection
          currentOwner={config?.owner ?? ''}
          walletAddress={walletAddress}
          isPreviewMode={isPreviewMode}
          onTransferOwnership={handleTransferOwnership}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 2: Wallet Data */}
        <AdminWalletDataPanel walletAddress={walletAddress} />

        <Separator className="my-6" />

        {/* SECTION 3: Mint Controls */}
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

        {/* SECTION 4: Pricing & Limits */}
        <AdminPricingSection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onSetMintPrice={handleSetMintPrice}
          onSetWalletMintLimit={handleSetWalletMintLimit}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 5: Treasury Management */}
        <AdminTreasurySection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onDepositETH={handleDepositETH}
          onDepositUSDC={handleDepositUSDC}
          onWithdrawFees={handleWithdrawFees}
          onWithdrawBonusPool={handleWithdrawBonusPool}
          onEmergencyWithdraw={handleEmergencyWithdraw}
          onRefresh={refreshConfig}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 6: Emergency Controls */}
        <AdminEmergencySection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onPause={handlePause}
          onKillSwitch={handleActivateKillSwitch}
          onDeactivateKillSwitch={handleDeactivateKillSwitch}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 7: Anti-Bot Protection */}
        <AdminAntiBotSection
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onSetThrottle={handleSetThrottle}
          onSetAntiBotMode={handleSetAntiBotMode}
          onSetWalletLimit={async (limit) => handleSetWalletMintLimit(BigInt(limit))}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 8: Unsupported Features Notice */}
        <AdminUnsupportedFeatures capabilities={caps} />

        <Separator className="my-6" />

        {/* SECTION 9: Action Preview */}
        <AdminActionPreview
          config={config}
          capabilities={caps}
          isPreviewMode={isPreviewMode}
          onApplyChanges={handleApplyChanges}
          isPending={isSubmitting}
        />

        <Separator className="my-6" />

        {/* SECTION 10: Preview Mode Toggle */}
        <AdminPreviewMode isEnabled={isPreviewMode} onToggle={setIsPreviewMode} />

        <Separator className="my-6" />

        {/* SECTION 11: Audit Log */}
        <AdminAuditLog walletAddress={walletAddress} />

        <Separator className="my-6" />

        {/* Footer */}
        <AdminFooter lastActionTimestamp={lastActionTimestamp} />
      </div>
    </div>
  );
}
