import { useState, useCallback } from 'react';
import { PaymentCurrency } from '@/contracts/MemoryMintContract';

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

// ============ HOOK ============
// NOTE: MemoryMintUltra contract does not have bonus claim functionality.
// This hook returns stub implementations for compatibility.
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

  // Stub: No claim functionality in MemoryMintUltra
  const claimBonus = useCallback(async (
    _walletAddress: string,
    _level: number,
    _gameLevel?: number,
    _levelProof?: string,
  ): Promise<BonusClaimResult> => {
    setState(prev => ({
      ...prev,
      error: 'Bonus claiming is not available for this contract',
      success: false,
    }));

    return {
      success: false,
      txHash: null,
      amount: null,
      currency: null,
      error: 'Bonus claiming is not available for this contract',
    };
  }, []);

  const estimateClaimGas = useCallback(async (
    _walletAddress: string,
    _level: number,
  ): Promise<bigint | null> => {
    return null;
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

  return {
    ...state,
    claimBonus,
    estimateClaimGas,
    resetClaimState,
  };
}
