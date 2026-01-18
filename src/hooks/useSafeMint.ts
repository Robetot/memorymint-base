import { useCallback, useState } from 'react';
import { encodeFunctionData } from 'viem';
import { useTransactionSimulation, SimulationResult, TransactionPreview } from './useTransactionSimulation';
import { CONTRACT_ABI, NFT_CONTRACT_ADDRESS } from '@/contracts/MemoryMintContract';

export interface ValidatedTransactionParams {
  functionName: string;
  args: unknown[];
  value?: bigint;
  walletAddress: string;
}

export interface PreMintValidation {
  isValid: boolean;
  error: string | null;
  simulation: SimulationResult | null;
  preview: TransactionPreview | null;
  encodedData: `0x${string}` | null;
  gasLimit: bigint | null;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
}

export interface SafeMintState {
  isValidating: boolean;
  validationResult: PreMintValidation | null;
}

/**
 * Hook that wraps transaction validation with simulation
 * Use this to validate transactions BEFORE opening the wallet
 */
export function useSafeMint() {
  const [state, setState] = useState<SafeMintState>({
    isValidating: false,
    validationResult: null,
  });

  const {
    isSimulating,
    simulateTransaction,
    checkIsNoOp,
    resetSimulation,
  } = useTransactionSimulation();

  /**
   * Validate a mint transaction before opening the wallet
   * Returns gas-optimized parameters if valid
   */
  const validateMintTransaction = useCallback(async (params: {
    type: 'single' | 'batch';
    walletAddress: string;
    tokenURI?: string;
    quantity?: number;
    priceWei: bigint;
  }): Promise<PreMintValidation> => {
    const { type, walletAddress, tokenURI = '', quantity = 1, priceWei } = params;

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      // Step 1: Build transaction data
      // mintNFT takes no arguments in this contract version
      const encodedData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintNFT',
        args: [],
      });

      // Step 2: Check for no-op conditions
      const noOpCheck = await checkIsNoOp({
        type: 'mint',
        walletAddress,
      });

      if (noOpCheck.isNoOp) {
        const result: PreMintValidation = {
          isValid: false,
          error: noOpCheck.reason || 'Cannot mint at this time',
          simulation: null,
          preview: null,
          encodedData: null,
          gasLimit: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        };
        setState({ isValidating: false, validationResult: result });
        return result;
      }

      // Step 3: Run full simulation
      const simulation = await simulateTransaction({
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data: encodedData,
        value: priceWei,
      });

      if (!simulation.success) {
        const result: PreMintValidation = {
          isValid: false,
          error: simulation.error || 'Transaction simulation failed',
          simulation,
          preview: null,
          encodedData: null,
          gasLimit: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        };
        setState({ isValidating: false, validationResult: result });
        return result;
      }

      // Build preview
      const preview: TransactionPreview = {
        estimatedGasEth: simulation.estimatedCostEth || '0',
        estimatedGasGwei: simulation.gasPrice ? (Number(simulation.gasPrice) / 1e9).toFixed(4) : '0',
        gasLimit: simulation.gasWithBuffer || 0n,
        maxFeePerGas: simulation.maxFeePerGas || 0n,
        maxPriorityFeePerGas: simulation.maxPriorityFeePerGas || 0n,
        isBaseOptimized: true,
        warningMessage: null,
      };

      const result: PreMintValidation = {
        isValid: true,
        error: null,
        simulation,
        preview,
        encodedData,
        gasLimit: simulation.gasWithBuffer,
        maxFeePerGas: simulation.maxFeePerGas,
        maxPriorityFeePerGas: simulation.maxPriorityFeePerGas,
      };

      setState({ isValidating: false, validationResult: result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      const result: PreMintValidation = {
        isValid: false,
        error: errorMessage,
        simulation: null,
        preview: null,
        encodedData: null,
        gasLimit: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      };
      setState({ isValidating: false, validationResult: result });
      return result;
    }
  }, [simulateTransaction, checkIsNoOp]);

  /**
   * Validate a claim transaction before opening the wallet
   * NOTE: MemoryMintUltra does not support claim functionality
   */
  const validateClaimTransaction = useCallback(async (_params: {
    walletAddress: string;
    levelId: bigint;
    gameLevel: bigint;
    levelProof: `0x${string}`;
  }): Promise<PreMintValidation> => {
    const result: PreMintValidation = {
      isValid: false,
      error: 'Claim functionality is not available for this contract',
      simulation: null,
      preview: null,
      encodedData: null,
      gasLimit: null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    };
    setState({ isValidating: false, validationResult: result });
    return result;
  }, []);

  /**
   * Validate an admin transaction before opening the wallet
   */
  const validateAdminTransaction = useCallback(async (params: {
    walletAddress: string;
    functionName: string;
    args: unknown[];
    value?: bigint;
    currentValue?: unknown;
    newValue?: unknown;
  }): Promise<PreMintValidation> => {
    const { walletAddress, functionName, args, value = 0n, currentValue, newValue } = params;

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      // Check for no-op (same value)
      const noOpCheck = await checkIsNoOp({
        type: 'admin',
        walletAddress,
        currentValue,
        newValue,
      });

      if (noOpCheck.isNoOp) {
        const result: PreMintValidation = {
          isValid: false,
          error: noOpCheck.reason || 'Nothing to update',
          simulation: null,
          preview: null,
          encodedData: null,
          gasLimit: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        };
        setState({ isValidating: false, validationResult: result });
        return result;
      }

      // Build transaction data
      const encodedData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: functionName as any,
        args: args as any,
      });

      // Run simulation
      const simulation = await simulateTransaction({
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data: encodedData,
        value,
      });

      if (!simulation.success) {
        const result: PreMintValidation = {
          isValid: false,
          error: simulation.error || 'Transaction simulation failed',
          simulation,
          preview: null,
          encodedData: null,
          gasLimit: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        };
        setState({ isValidating: false, validationResult: result });
        return result;
      }

      const preview: TransactionPreview = {
        estimatedGasEth: simulation.estimatedCostEth || '0',
        estimatedGasGwei: simulation.gasPrice ? (Number(simulation.gasPrice) / 1e9).toFixed(4) : '0',
        gasLimit: simulation.gasWithBuffer || 0n,
        maxFeePerGas: simulation.maxFeePerGas || 0n,
        maxPriorityFeePerGas: simulation.maxPriorityFeePerGas || 0n,
        isBaseOptimized: true,
        warningMessage: null,
      };

      const result: PreMintValidation = {
        isValid: true,
        error: null,
        simulation,
        preview,
        encodedData,
        gasLimit: simulation.gasWithBuffer,
        maxFeePerGas: simulation.maxFeePerGas,
        maxPriorityFeePerGas: simulation.maxPriorityFeePerGas,
      };

      setState({ isValidating: false, validationResult: result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      const result: PreMintValidation = {
        isValid: false,
        error: errorMessage,
        simulation: null,
        preview: null,
        encodedData: null,
        gasLimit: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
      };
      setState({ isValidating: false, validationResult: result });
      return result;
    }
  }, [simulateTransaction, checkIsNoOp]);

  /**
   * Reset validation state
   */
  const resetValidation = useCallback(() => {
    setState({
      isValidating: false,
      validationResult: null,
    });
    resetSimulation();
  }, [resetSimulation]);

  return {
    ...state,
    isSimulating,
    validateMintTransaction,
    validateClaimTransaction,
    validateAdminTransaction,
    resetValidation,
  };
}
