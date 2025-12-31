import { useCallback, useState, useRef } from 'react';
import { encodeFunctionData, parseAbi, decodeErrorResult, formatEther, formatGwei } from 'viem';
import { NFT_CONTRACT_ADDRESS, RPC_ENDPOINTS, BASE_CHAIN_ID, CONTRACT_ABI, CONTRACT_ERRORS } from '@/contracts/MemoryMintContract';

// ============ TYPES ============
export interface SimulationResult {
  success: boolean;
  error: string | null;
  errorCode: string | null;
  gasEstimate: bigint | null;
  gasWithBuffer: bigint | null;
  gasPrice: bigint | null;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
  estimatedCostWei: bigint | null;
  estimatedCostEth: string | null;
  isNoOp: boolean;
}

export interface TransactionPreview {
  estimatedGasEth: string;
  estimatedGasGwei: string;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  isBaseOptimized: boolean;
  warningMessage: string | null;
}

export interface SimulationState {
  isSimulating: boolean;
  lastSimulation: SimulationResult | null;
  preview: TransactionPreview | null;
}

// ============ CONSTANTS ============
// Base-optimized: 7% buffer (between 5-8% as specified)
const GAS_BUFFER_PERCENT = 7;
const BASE_MAX_PRIORITY_FEE = 1000000n; // 0.001 gwei - minimal for Base L2
const SIMULATION_TIMEOUT_MS = 8000;

// ============ ERROR DECODING ============
const decodeSimulationError = (error: unknown): { message: string; code: string | null } => {
  const err: any = error;

  // User rejection
  if (err?.code === 4001) {
    return { message: 'Transaction rejected by user', code: 'USER_REJECTED' };
  }

  // Try to extract revert data
  const revertData: unknown =
    err?.data?.data ?? err?.data ?? err?.error?.data?.data ?? err?.error?.data;

  if (typeof revertData === 'string' && revertData.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: CONTRACT_ERRORS,
        data: revertData as `0x${string}`,
      });

      const errorMessages: Record<string, string> = {
        'InsufficientPayment': 'Insufficient ETH payment for this transaction',
        'MintingPaused': 'Minting is currently paused',
        'EmergencyMintDisabled': 'Minting is disabled for emergency',
        'AddressDenylisted': 'Your wallet address is not allowed to mint',
        'NotAllowlisted': 'Your wallet is not on the allowlist',
        'MintLimitExceeded': 'You have reached your wallet mint limit',
        'CooldownActive': 'Please wait before minting again',
        'FCFSMintCapReached': 'Mint cap has been reached',
        'InvalidSignature': 'Signature verification failed',
        'SignatureExpired': 'Signature has expired',
        'NonceAlreadyUsed': 'This signature has already been used',
        'ClaimNotActive': 'Bonus claiming is not active',
        'InvalidBonusLevel': 'Invalid bonus level',
        'AlreadyClaimed': 'You have already claimed this bonus',
        'InsufficientBonusBalance': 'Insufficient funds in bonus pool',
        'CurrencyNotEnabled': 'This payment currency is not enabled',
        'InsufficientUSDCAllowance': 'Insufficient USDC allowance',
        'USDCTransferFailed': 'USDC transfer failed',
        'ZeroAmount': 'Amount cannot be zero',
        'ReentrancyGuard': 'Transaction failed - please try again',
      };

      return {
        message: errorMessages[decoded.errorName] || `Transaction would fail: ${decoded.errorName}`,
        code: decoded.errorName,
      };
    } catch {
      // Fall through to generic error handling
    }
  }

  // Parse raw error message
  const rawMsg: string | undefined = err?.data?.message || err?.error?.message || err?.message;
  if (rawMsg) {
    if (rawMsg.includes('execution reverted')) {
      return { message: 'Transaction would revert. Check your balance and eligibility.', code: 'EXECUTION_REVERTED' };
    }
    if (rawMsg.includes('insufficient funds')) {
      return { message: 'Insufficient ETH balance for gas + value', code: 'INSUFFICIENT_FUNDS' };
    }
    if (rawMsg.includes('gas required exceeds')) {
      return { message: 'Transaction would fail due to gas limit', code: 'GAS_LIMIT_EXCEEDED' };
    }
    if (rawMsg.includes('nonce')) {
      return { message: 'Transaction nonce issue - please refresh', code: 'NONCE_ERROR' };
    }
    return { message: rawMsg.slice(0, 100), code: 'UNKNOWN' };
  }

  return { message: 'Transaction simulation failed', code: 'UNKNOWN' };
};

// ============ RPC HELPER ============
const rpcCall = async (method: string, params: unknown[], timeout = SIMULATION_TIMEOUT_MS): Promise<unknown> => {
  const errors: string[] = [];

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

      if (response.status === 429) {
        errors.push(`${endpoint}: Rate limited`);
        continue;
      }

      if (!response.ok) {
        errors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.error) {
        // Return error for simulation analysis
        return { error: data.error };
      }

      return data.result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${endpoint}: ${msg}`);
    }
  }

  console.error('[Simulation RPC] All endpoints failed:', errors);
  throw new Error('Unable to reach Base network. Please try again.');
};

// ============ MAIN HOOK ============
export function useTransactionSimulation() {
  const [state, setState] = useState<SimulationState>({
    isSimulating: false,
    lastSimulation: null,
    preview: null,
  });

  const simulationLockRef = useRef(false);

  /**
   * Simulate a transaction using eth_call to check if it would succeed
   * This is called BEFORE opening the wallet
   */
  const simulateTransaction = useCallback(async (params: {
    from: string;
    to: string;
    data: `0x${string}`;
    value?: bigint;
  }): Promise<SimulationResult> => {
    if (simulationLockRef.current) {
      return {
        success: false,
        error: 'Simulation already in progress',
        errorCode: 'BUSY',
        gasEstimate: null,
        gasWithBuffer: null,
        gasPrice: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        estimatedCostWei: null,
        estimatedCostEth: null,
        isNoOp: false,
      };
    }

    simulationLockRef.current = true;
    setState(prev => ({ ...prev, isSimulating: true }));

    try {
      const { from, to, data, value = 0n } = params;

      // Validate inputs
      if (!from || !/^0x[a-fA-F0-9]{40}$/i.test(from)) {
        throw new Error('Invalid sender address');
      }
      if (!to || !/^0x[a-fA-F0-9]{40}$/i.test(to)) {
        throw new Error('Invalid contract address');
      }
      if (!data || !data.startsWith('0x')) {
        throw new Error('Invalid transaction data');
      }

      // Step 1: Simulate with eth_call
      console.log('[Simulation] Running eth_call simulation...');
      const callParams = {
        from,
        to,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0',
      };

      const simulationResult = await rpcCall('eth_call', [callParams, 'latest']);

      // Check if simulation returned an error
      if (typeof simulationResult === 'object' && simulationResult !== null && 'error' in simulationResult) {
        const { message, code } = decodeSimulationError(simulationResult);
        console.error('[Simulation] eth_call reverted:', message);
        
        const result: SimulationResult = {
          success: false,
          error: message,
          errorCode: code,
          gasEstimate: null,
          gasWithBuffer: null,
          gasPrice: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
          estimatedCostWei: null,
          estimatedCostEth: null,
          isNoOp: false,
        };
        
        setState(prev => ({ ...prev, isSimulating: false, lastSimulation: result, preview: null }));
        return result;
      }

      console.log('[Simulation] eth_call succeeded, estimating gas...');

      // Step 2: Estimate gas with exact calldata
      const gasEstimateResult = await rpcCall('eth_estimateGas', [callParams]);

      if (typeof gasEstimateResult === 'object' && gasEstimateResult !== null && 'error' in gasEstimateResult) {
        const { message, code } = decodeSimulationError(gasEstimateResult);
        console.error('[Simulation] Gas estimation failed:', message);
        
        const result: SimulationResult = {
          success: false,
          error: message,
          errorCode: code,
          gasEstimate: null,
          gasWithBuffer: null,
          gasPrice: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
          estimatedCostWei: null,
          estimatedCostEth: null,
          isNoOp: false,
        };
        
        setState(prev => ({ ...prev, isSimulating: false, lastSimulation: result, preview: null }));
        return result;
      }

      const gasEstimate = BigInt(gasEstimateResult as string);
      
      // Apply minimal buffer (7% for Base)
      const gasWithBuffer = gasEstimate + (gasEstimate * BigInt(GAS_BUFFER_PERCENT) / 100n);

      // Step 3: Get current gas price (EIP-1559)
      const [baseFeeResult, priorityFeeResult] = await Promise.all([
        rpcCall('eth_gasPrice', []),
        rpcCall('eth_maxPriorityFeePerGas', []).catch(() => null),
      ]);

      const baseGasPrice = BigInt(baseFeeResult as string);
      const maxPriorityFeePerGas = priorityFeeResult 
        ? BigInt(priorityFeeResult as string)
        : BASE_MAX_PRIORITY_FEE;
      
      // Base-optimized: use market base fee + minimal priority
      const maxFeePerGas = baseGasPrice + maxPriorityFeePerGas;

      // Calculate estimated cost
      const estimatedCostWei = gasWithBuffer * maxFeePerGas + value;
      const estimatedCostEth = formatEther(estimatedCostWei);

      console.log('[Simulation] Gas estimate:', {
        gasEstimate: gasEstimate.toString(),
        gasWithBuffer: gasWithBuffer.toString(),
        maxFeePerGas: formatGwei(maxFeePerGas) + ' gwei',
        estimatedCostEth,
      });

      const result: SimulationResult = {
        success: true,
        error: null,
        errorCode: null,
        gasEstimate,
        gasWithBuffer,
        gasPrice: baseGasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCostWei,
        estimatedCostEth,
        isNoOp: false,
      };

      const preview: TransactionPreview = {
        estimatedGasEth: estimatedCostEth,
        estimatedGasGwei: formatGwei(maxFeePerGas),
        gasLimit: gasWithBuffer,
        maxFeePerGas,
        maxPriorityFeePerGas,
        isBaseOptimized: true,
        warningMessage: null,
      };

      setState(prev => ({ ...prev, isSimulating: false, lastSimulation: result, preview }));
      return result;
    } catch (error) {
      const { message, code } = decodeSimulationError(error);
      console.error('[Simulation] Failed:', error);
      
      const result: SimulationResult = {
        success: false,
        error: message,
        errorCode: code,
        gasEstimate: null,
        gasWithBuffer: null,
        gasPrice: null,
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        estimatedCostWei: null,
        estimatedCostEth: null,
        isNoOp: false,
      };
      
      setState(prev => ({ ...prev, isSimulating: false, lastSimulation: result, preview: null }));
      return result;
    } finally {
      simulationLockRef.current = false;
    }
  }, []);

  /**
   * Check if a transaction would be a no-op (no state change)
   * Used to block redundant transactions
   */
  const checkIsNoOp = useCallback(async (params: {
    type: 'mint' | 'claim' | 'admin';
    walletAddress: string;
    levelId?: number;
    currentValue?: unknown;
    newValue?: unknown;
  }): Promise<{ isNoOp: boolean; reason: string | null }> => {
    const { type, walletAddress, levelId, currentValue, newValue } = params;

    try {
      if (type === 'claim' && levelId !== undefined) {
        // Check if already claimed
        const data = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: 'canClaim',
          args: [walletAddress as `0x${string}`, BigInt(levelId)],
        });

        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        
        if (result === '0x' || result === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          return { isNoOp: true, reason: 'Bonus already claimed or not eligible' };
        }
      }

      if (type === 'admin' && currentValue !== undefined && newValue !== undefined) {
        // Check if value would change
        if (JSON.stringify(currentValue) === JSON.stringify(newValue)) {
          return { isNoOp: true, reason: 'Nothing to update' };
        }
      }

      if (type === 'mint') {
        // Check if can mint
        const data = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: 'canMint',
          args: [walletAddress as `0x${string}`],
        });

        const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
        
        if (result === '0x' || result === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          return { isNoOp: true, reason: 'Cannot mint: limit reached or cooldown active' };
        }
      }

      return { isNoOp: false, reason: null };
    } catch (error) {
      console.warn('[NoOp Check] Failed:', error);
      // Don't block on check failure - let simulation handle it
      return { isNoOp: false, reason: null };
    }
  }, []);

  /**
   * Full pre-transaction validation: no-op check + simulation
   * Call this BEFORE opening the wallet
   */
  const validateTransaction = useCallback(async (params: {
    type: 'mint' | 'claim' | 'admin';
    from: string;
    to: string;
    data: `0x${string}`;
    value?: bigint;
    levelId?: number;
    currentValue?: unknown;
    newValue?: unknown;
  }): Promise<{
    valid: boolean;
    error: string | null;
    simulation: SimulationResult | null;
    preview: TransactionPreview | null;
  }> => {
    const { type, from, to, data, value, levelId, currentValue, newValue } = params;

    // Step 1: Check for no-op
    const noOpResult = await checkIsNoOp({
      type,
      walletAddress: from,
      levelId,
      currentValue,
      newValue,
    });

    if (noOpResult.isNoOp) {
      return {
        valid: false,
        error: noOpResult.reason || 'Nothing to update',
        simulation: {
          success: false,
          error: noOpResult.reason,
          errorCode: 'NO_OP',
          gasEstimate: null,
          gasWithBuffer: null,
          gasPrice: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
          estimatedCostWei: null,
          estimatedCostEth: null,
          isNoOp: true,
        },
        preview: null,
      };
    }

    // Step 2: Full simulation
    const simulation = await simulateTransaction({ from, to, data, value });

    if (!simulation.success) {
      return {
        valid: false,
        error: simulation.error,
        simulation,
        preview: null,
      };
    }

    return {
      valid: true,
      error: null,
      simulation,
      preview: state.preview,
    };
  }, [checkIsNoOp, simulateTransaction, state.preview]);

  /**
   * Reset simulation state
   */
  const resetSimulation = useCallback(() => {
    setState({
      isSimulating: false,
      lastSimulation: null,
      preview: null,
    });
  }, []);

  return {
    ...state,
    simulateTransaction,
    checkIsNoOp,
    validateTransaction,
    resetSimulation,
  };
}


