import { useState, useCallback } from 'react';
import { encodeFunctionData, formatEther, formatUnits } from 'viem';
import { PaymentCurrency, NFT_CONTRACT_ADDRESS, CONTRACT_ABI, RPC_ENDPOINTS, USDC_DECIMALS } from '@/contracts/MemoryMintContract';

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

// RPC helper
async function rpcCall(method: string, params: unknown[], timeout = 8000): Promise<unknown> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const data = await response.json();
      if (data.error) continue;
      return data.result;
    } catch {
      continue;
    }
  }
  throw new Error('RPC call failed');
}

// ============ HOOK ============
export function useBonusClaim() {
  const [state, setState] = useState<ClaimState>({
    isClaiming: false,
    isEstimatingGas: false,
    txHash: null,
    claimedAmount: null,
    claimedCurrency: null,
    error: null,
    success: false,
    estimatedGas: null,
  });

  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: number,
    _gameLevel?: number,
    _levelProof?: string,
  ): Promise<BonusClaimResult> => {
    if (!window.ethereum || !walletAddress) {
      return { success: false, txHash: null, amount: null, currency: null, error: 'Wallet not connected' };
    }

    setState(prev => ({ ...prev, isClaiming: true, error: null, success: false, txHash: null }));

    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'claimBonus',
        args: [levelId as number],
      });

      const txHash = await (window.ethereum as any).request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }],
      }) as string;

      setState(prev => ({ ...prev, txHash }));

      // Wait for receipt
      let receipt: any = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
      }

      if (receipt?.status === '0x1') {
        setState(prev => ({ ...prev, isClaiming: false, success: true, claimedCurrency: 'ETH' }));
        return { success: true, txHash, amount: '0', currency: 'ETH', error: null };
      }

      setState(prev => ({ ...prev, isClaiming: false, error: 'Transaction failed' }));
      return { success: false, txHash, amount: null, currency: null, error: 'Transaction failed' };
    } catch (err: any) {
      const msg = err?.code === 4001 ? 'Transaction cancelled' : 'Claim failed';
      setState(prev => ({ ...prev, isClaiming: false, error: msg }));
      return { success: false, txHash: null, amount: null, currency: null, error: msg };
    }
  }, []);

  const estimateClaimGas = useCallback(async (
    walletAddress: string,
    levelId: number,
  ): Promise<bigint | null> => {
    try {
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'claimBonus',
        args: [levelId as number],
      });
      const result = await rpcCall('eth_estimateGas', [{ from: walletAddress, to: NFT_CONTRACT_ADDRESS, data }]);
      return BigInt(result as string);
    } catch {
      return null;
    }
  }, []);

  const resetClaimState = useCallback(() => {
    setState({
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

  return { ...state, claimBonus, estimateClaimGas, resetClaimState };
}
