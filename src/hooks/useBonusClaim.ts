import { useState, useCallback } from 'react';
import { encodeFunctionData, decodeErrorResult, formatEther, formatUnits } from 'viem';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_CHAIN_ID,
  CONTRACT_ABI,
  CONTRACT_ERRORS,
  USDC_DECIMALS,
  RECEIPT_POLL_INTERVAL,
  RECEIPT_MAX_POLLS,
  GAS_BUFFER_PERCENT,
  EIP1559_BASE_MAX_PRIORITY_FEE,
  RPC_ENDPOINTS,
  PaymentCurrency,
} from '@/contracts/MemoryMintContract';
import { useContractReads } from './useContractReads';

// ============ TYPES ============
export interface ClaimState {
  isClaiming: boolean;
  isEstimatingGas: boolean;
  txHash: string | null;
  claimedAmount: string | null;
  claimedCurrency: PaymentCurrency | null;
  error: string | null;
  success: boolean;
  estimatedGas: bigint | null;
}

export interface BonusClaimResult {
  success: boolean;
  txHash: string | null;
  amount: string | null;
  currency: PaymentCurrency | null;
  error: string | null;
}

// ============ ERROR DECODER ============
function decodeClaimError(error: unknown): string {
  const err = error as any;
  
  if (err?.code === 4001) return 'Transaction rejected by user';
  
  const revertData = err?.data?.data ?? err?.data ?? err?.error?.data;
  
  if (typeof revertData === 'string' && revertData.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: CONTRACT_ERRORS,
        data: revertData as `0x${string}`,
      });
      
      switch (decoded.errorName) {
        case 'ClaimNotActive': return 'Claiming is currently disabled';
        case 'InvalidBonusLevel': return 'This bonus level does not exist or is inactive';
        case 'AlreadyClaimed': return 'You have already claimed this bonus';
        case 'InsufficientBonusBalance': return 'Insufficient funds in bonus pool';
        case 'CurrencyNotEnabled': return 'This currency is not currently enabled';
        case 'WrongChain': return 'Please switch to Base network';
        case 'ReentrancyGuard': return 'Transaction blocked - please try again';
        default: return `Claim failed: ${decoded.errorName}`;
      }
    } catch {}
  }
  
  const msg = err?.message || err?.error?.message;
  if (msg) {
    if (msg.includes('insufficient funds')) return 'Insufficient ETH for gas fees';
    if (msg.includes('user rejected')) return 'Transaction rejected by user';
    return msg.slice(0, 100);
  }
  
  return 'Claim failed. Please try again.';
}

// ============ RPC HELPER ============
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.error) continue;
      
      return data.result;
    } catch {
      continue;
    }
  }
  
  throw new Error('RPC unavailable');
}

// ============ HOOK ============
export function useBonusClaim() {
  const [claimState, setClaimState] = useState<ClaimState>({
    isClaiming: false,
    isEstimatingGas: false,
    txHash: null,
    claimedAmount: null,
    claimedCurrency: null,
    error: null,
    success: false,
    estimatedGas: null,
  });
  
  const { fetchContractConfig, fetchWalletState, fetchBonusLevels, invalidateWalletCache } = useContractReads();

  // ============ PRE-VALIDATE CLAIM ============
  const preValidateClaim = useCallback(async (
    walletAddress: string,
    level: number
  ): Promise<{ valid: boolean; error: string | null; amount: { eth: string; usdc: string } | null }> => {
    try {
      const [config, levels] = await Promise.all([
        fetchContractConfig(true),
        fetchBonusLevels(walletAddress),
      ]);
      
      if (!config) {
        return { valid: false, error: 'Unable to fetch contract config', amount: null };
      }
      
      if (!config.claimEnabled) {
        return { valid: false, error: 'Claiming is currently disabled', amount: null };
      }
      
      const levelInfo = levels.find(l => l.level === level);
      
      if (!levelInfo) {
        return { valid: false, error: 'This bonus level does not exist', amount: null };
      }
      
      if (!levelInfo.active) {
        return { valid: false, error: 'This bonus level is not active', amount: null };
      }
      
      if (!levelInfo.canClaim) {
        return { valid: false, error: 'You are not eligible to claim this bonus', amount: null };
      }
      
      if (levelInfo.claimsRemaining === 0n) {
        return { valid: false, error: 'No claims remaining for this level', amount: null };
      }
      
      // Check pool balance
      const poolBalance = config.activeBonusCurrency === 'USDC' 
        ? config.bonusPoolUSDC 
        : config.bonusPoolETH;
      const claimAmount = config.activeBonusCurrency === 'USDC'
        ? levelInfo.amountUSDC
        : levelInfo.amountETH;
        
      if (claimAmount > poolBalance) {
        return { valid: false, error: 'Insufficient funds in bonus pool', amount: null };
      }
      
      return {
        valid: true,
        error: null,
        amount: {
          eth: formatEther(levelInfo.amountETH),
          usdc: `$${formatUnits(levelInfo.amountUSDC, USDC_DECIMALS)}`,
        },
      };
    } catch (err) {
      return { valid: false, error: 'Failed to validate claim eligibility', amount: null };
    }
  }, [fetchContractConfig, fetchBonusLevels]);

  // ============ ESTIMATE GAS ============
  const estimateClaimGas = useCallback(async (
    walletAddress: string,
    level: number,
    gameLevel: number,
    levelProof: `0x${string}`
  ): Promise<bigint | null> => {
    setClaimState(prev => ({ ...prev, isEstimatingGas: true }));
    
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'claimBonus',
        args: [BigInt(level), BigInt(gameLevel), levelProof],
      });
      
      const gasEstimate = await rpcCall('eth_estimateGas', [{
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      }]) as string;
      
      // Add buffer for safety
      const gas = BigInt(gasEstimate);
      const bufferedGas = gas + (gas * BigInt(GAS_BUFFER_PERCENT) / 100n);
      
      setClaimState(prev => ({ ...prev, estimatedGas: bufferedGas, isEstimatingGas: false }));
      return bufferedGas;
    } catch (err) {
      setClaimState(prev => ({ ...prev, isEstimatingGas: false }));
      return null;
    }
  }, []);

  // ============ CLAIM BONUS ============
  const claimBonus = useCallback(async (
    walletAddress: string,
    level: number,
    gameLevel: number,
    levelProof: `0x${string}`
  ): Promise<BonusClaimResult> => {
    // Pre-validate to prevent wasted gas
    const validation = await preValidateClaim(walletAddress, level);
    if (!validation.valid) {
      setClaimState(prev => ({ ...prev, error: validation.error }));
      return { success: false, txHash: null, amount: null, currency: null, error: validation.error };
    }
    
    setClaimState({
      isClaiming: true,
      isEstimatingGas: false,
      txHash: null,
      claimedAmount: null,
      claimedCurrency: null,
      error: null,
      success: false,
      estimatedGas: null,
    });
    
    try {
      // Verify network
      const ethereum = window.ethereum as any;
      if (!ethereum) {
        throw new Error('Wallet not connected');
      }
      
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      if (chainId.toLowerCase() !== BASE_CHAIN_ID.toLowerCase()) {
        // Try to switch
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID }],
          });
        } catch {
          throw new Error('Please switch to Base network');
        }
      }
      
      // Estimate gas with buffer
      const gasEstimate = await estimateClaimGas(walletAddress, level, gameLevel, levelProof);
      if (!gasEstimate) {
        // Still try the transaction, let wallet estimate
        console.warn('[BonusClaim] Gas estimation failed, proceeding anyway');
      }
      
      // Build transaction
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'claimBonus',
        args: [BigInt(level), BigInt(gameLevel), levelProof],
      });
      
      // Get current gas price for EIP-1559
      const feeData = await rpcCall('eth_maxPriorityFeePerGas', []) as string;
      const maxPriorityFeePerGas = BigInt(feeData || '0') || EIP1559_BASE_MAX_PRIORITY_FEE;
      
      const txParams: any = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      };
      
      if (gasEstimate) {
        txParams.gas = `0x${gasEstimate.toString(16)}`;
      }
      
      // Send transaction
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;
      
      setClaimState(prev => ({ ...prev, txHash }));
      
      // Wait for receipt
      let receipt: any = null;
      for (let i = 0; i < RECEIPT_MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, RECEIPT_POLL_INTERVAL));
        
        try {
          receipt = await ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          
          if (receipt) break;
        } catch {}
      }
      
      const success = receipt?.status === '0x1';
      
      // Get config for amount display
      const config = await fetchContractConfig();
      const levels = await fetchBonusLevels();
      const levelInfo = levels.find(l => l.level === level);
      
      const currency: PaymentCurrency = config?.activeBonusCurrency || 'ETH';
      const amount = currency === 'USDC'
        ? `$${formatUnits(levelInfo?.amountUSDC || 0n, USDC_DECIMALS)}`
        : `${formatEther(levelInfo?.amountETH || 0n)} ETH`;
      
      // Invalidate cache on success
      if (success) {
        invalidateWalletCache(walletAddress);
      }
      
      setClaimState({
        isClaiming: false,
        isEstimatingGas: false,
        txHash,
        claimedAmount: success ? amount : null,
        claimedCurrency: success ? currency : null,
        error: success ? null : 'Transaction failed',
        success,
        estimatedGas: gasEstimate,
      });
      
      return {
        success,
        txHash,
        amount: success ? amount : null,
        currency: success ? currency : null,
        error: success ? null : 'Transaction failed',
      };
    } catch (error) {
      const errorMessage = decodeClaimError(error);
      
      setClaimState(prev => ({
        ...prev,
        isClaiming: false,
        error: errorMessage,
        success: false,
      }));
      
      return { success: false, txHash: null, amount: null, currency: null, error: errorMessage };
    }
  }, [preValidateClaim, estimateClaimGas, fetchContractConfig, fetchBonusLevels, invalidateWalletCache]);

  // ============ RESET STATE ============
  const resetClaimState = useCallback(() => {
    setClaimState({
      isClaiming: false,
      isEstimatingGas: false,
      txHash: null,
      claimedAmount: null,
      claimedCurrency: null,
      error: null,
      success: false,
      estimatedGas: null,
    });
  }, []);

  return {
    ...claimState,
    preValidateClaim,
    estimateClaimGas,
    claimBonus,
    resetClaimState,
  };
}
