/**
 * Gas Diagnostics Hook
 * Provides detailed gas analysis for every transaction
 * Helps identify if high gas is from frontend or contract
 */

import { useCallback, useState } from 'react';
import { encodeFunctionData, formatEther, formatGwei } from 'viem';
import { NFT_CONTRACT_ADDRESS, RPC_ENDPOINTS, CONTRACT_ABI } from '@/contracts/MemoryMintContract';

// ============ TYPES ============
export interface GasDiagnostic {
  functionName: string;
  calldataBytes: number;
  estimatedGas: bigint;
  actualGasUsed: bigint | null;
  gasPrice: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
  estimatedCostEth: string;
  actualCostEth: string | null;
  valueAttached: bigint;
  timestamp: number;
  txHash: string | null;
  isBaseOptimized: boolean;
  warnings: string[];
}

export interface GasDiagnosticsState {
  isAnalyzing: boolean;
  lastDiagnostic: GasDiagnostic | null;
  history: GasDiagnostic[];
}

// ============ CONSTANTS ============
// Base-optimized: 5-7% buffer is optimal for L2
const BASE_GAS_BUFFER_PERCENT = 7n;
const BASE_MAX_PRIORITY_FEE = 1000000n; // 0.001 gwei - very low for Base

// Expected gas baselines for each function (from contract analysis)
const GAS_BASELINES: Record<string, bigint> = {
  'mintNFT': 85000n,           // Free mint with metadata
  'mintWithUSDC': 95000n,      // USDC mint (extra ERC20 transfer)
  'batchMint': 200000n,        // Batch of 10
  'claimBonus': 65000n,        // Bonus claim
  'setMintPriceETH': 28000n,   // Admin config change
  'setMintPriceUSDC': 28000n,
  'pauseMinting': 28000n,
};

// ============ RPC HELPER ============
const rpcCall = async (method: string, params: unknown[]): Promise<unknown> => {
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
};

// ============ MAIN HOOK ============
export function useGasDiagnostics() {
  const [state, setState] = useState<GasDiagnosticsState>({
    isAnalyzing: false,
    lastDiagnostic: null,
    history: [],
  });

  /**
   * Analyze a transaction BEFORE execution
   * Compares estimated gas vs expected baseline
   */
  const analyzeTransaction = useCallback(async (params: {
    functionName: string;
    args: unknown[];
    from: string;
    value?: bigint;
  }): Promise<GasDiagnostic> => {
    const { functionName, args, from, value = 0n } = params;

    setState(prev => ({ ...prev, isAnalyzing: true }));

    try {
      // Step 1: Encode calldata
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: functionName as any,
        args: args as any,
      });

      const calldataBytes = (data.length - 2) / 2; // Remove '0x' and convert hex to bytes

      // Step 2: Build call params
      const callParams = {
        from,
        to: NFT_CONTRACT_ADDRESS,
        data,
        value: value > 0n ? `0x${value.toString(16)}` : '0x0',
      };

      // Step 3: Estimate gas
      const gasEstimateHex = await rpcCall('eth_estimateGas', [callParams]) as string;
      const estimatedGas = BigInt(gasEstimateHex);

      // Step 4: Get gas prices (EIP-1559)
      const [baseFeeHex, priorityFeeHex] = await Promise.all([
        rpcCall('eth_gasPrice', []) as Promise<string>,
        rpcCall('eth_maxPriorityFeePerGas', []).catch(() => null) as Promise<string | null>,
      ]);

      const gasPrice = BigInt(baseFeeHex);
      const maxPriorityFeePerGas = priorityFeeHex ? BigInt(priorityFeeHex) : BASE_MAX_PRIORITY_FEE;
      const maxFeePerGas = gasPrice + maxPriorityFeePerGas;

      // Step 5: Apply minimal buffer (Base-optimized: 7%)
      const gasWithBuffer = estimatedGas + (estimatedGas * BASE_GAS_BUFFER_PERCENT / 100n);

      // Step 6: Calculate costs
      const estimatedCostWei = gasWithBuffer * maxFeePerGas;
      const estimatedCostEth = formatEther(estimatedCostWei);

      // Step 7: Check for warnings
      const warnings: string[] = [];
      
      // Check against baseline
      const baseline = GAS_BASELINES[functionName];
      if (baseline) {
        const deviation = ((estimatedGas - baseline) * 100n) / baseline;
        if (deviation > 20n) {
          warnings.push(`Gas ${deviation}% above baseline (${baseline.toString()} expected)`);
        }
      }

      // Check if free mint has value attached
      if (functionName === 'mintNFT' && value > 0n) {
        // Check if contract expects payment
        try {
          const priceData = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: 'mintPriceETH',
            args: [],
          });
          const priceResult = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: priceData }, 'latest']) as string;
          const mintPrice = BigInt(priceResult || '0x0');
          
          if (mintPrice === 0n && value > 0n) {
            warnings.push('⚠️ ETH attached to FREE mint - this increases gas and may fail');
          }
        } catch {
          // Ignore price check failure
        }
      }

      // Check calldata size
      if (calldataBytes > 500) {
        warnings.push(`Large calldata (${calldataBytes} bytes) may increase gas`);
      }

      // Step 8: Build diagnostic
      const diagnostic: GasDiagnostic = {
        functionName,
        calldataBytes,
        estimatedGas,
        actualGasUsed: null, // Set after tx
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCostWei,
        estimatedCostEth,
        actualCostEth: null,
        valueAttached: value,
        timestamp: Date.now(),
        txHash: null,
        isBaseOptimized: true,
        warnings,
      };

      // Log diagnostic
      console.log('[GasDiagnostic]', {
        function: functionName,
        calldata: `${calldataBytes} bytes`,
        estimatedGas: estimatedGas.toString(),
        gasPrice: formatGwei(gasPrice) + ' gwei',
        maxFeePerGas: formatGwei(maxFeePerGas) + ' gwei',
        estimatedCost: estimatedCostEth + ' ETH',
        warnings,
      });

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        lastDiagnostic: diagnostic,
        history: [diagnostic, ...prev.history.slice(0, 9)], // Keep last 10
      }));

      return diagnostic;
    } catch (error) {
      console.error('[GasDiagnostic] Analysis failed:', error);
      setState(prev => ({ ...prev, isAnalyzing: false }));
      throw error;
    }
  }, []);

  /**
   * Update diagnostic with actual gas used after transaction
   */
  const recordActualGas = useCallback(async (txHash: string): Promise<void> => {
    try {
      // Get transaction receipt
      const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]) as any;
      if (!receipt) return;

      const actualGasUsed = BigInt(receipt.gasUsed);
      const effectiveGasPrice = BigInt(receipt.effectiveGasPrice || receipt.gasPrice);
      const actualCostWei = actualGasUsed * effectiveGasPrice;
      const actualCostEth = formatEther(actualCostWei);

      setState(prev => {
        if (!prev.lastDiagnostic) return prev;

        const updated: GasDiagnostic = {
          ...prev.lastDiagnostic,
          actualGasUsed,
          actualCostEth,
          txHash,
        };

        // Compare estimated vs actual
        const deviation = prev.lastDiagnostic.estimatedGas > 0n
          ? ((actualGasUsed - prev.lastDiagnostic.estimatedGas) * 100n) / prev.lastDiagnostic.estimatedGas
          : 0n;

        if (deviation > 5n) {
          updated.warnings = [
            ...updated.warnings,
            `Actual gas ${deviation}% higher than estimated`,
          ];
        }

        console.log('[GasDiagnostic] Actual gas:', {
          txHash,
          estimated: prev.lastDiagnostic.estimatedGas.toString(),
          actual: actualGasUsed.toString(),
          deviation: `${deviation}%`,
          actualCost: actualCostEth + ' ETH',
        });

        return {
          ...prev,
          lastDiagnostic: updated,
          history: [updated, ...prev.history.slice(1)],
        };
      });
    } catch (error) {
      console.error('[GasDiagnostic] Failed to record actual gas:', error);
    }
  }, []);

  /**
   * Get optimized gas parameters for wallet
   */
  const getOptimizedGasParams = useCallback((estimatedGas: bigint, maxFeePerGas: bigint, maxPriorityFeePerGas: bigint) => {
    // Apply 7% buffer (Base-optimized)
    const gasLimit = estimatedGas + (estimatedGas * BASE_GAS_BUFFER_PERCENT / 100n);
    
    return {
      gas: `0x${gasLimit.toString(16)}`,
      maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
    };
  }, []);

  /**
   * Check if transaction should be blocked due to gas anomaly
   */
  const shouldBlockTransaction = useCallback((diagnostic: GasDiagnostic): { block: boolean; reason: string | null } => {
    const baseline = GAS_BASELINES[diagnostic.functionName];
    if (!baseline) return { block: false, reason: null };

    // Block if gas is 50%+ above baseline
    const deviation = ((diagnostic.estimatedGas - baseline) * 100n) / baseline;
    if (deviation > 50n) {
      return {
        block: true,
        reason: `Gas anomaly detected: ${deviation}% above expected (${baseline.toString()} gas expected)`,
      };
    }

    // Block if free mint has value attached
    if (diagnostic.warnings.some(w => w.includes('FREE mint'))) {
      return {
        block: true,
        reason: 'ETH attached to free mint - this would waste gas',
      };
    }

    return { block: false, reason: null };
  }, []);

  /**
   * Generate gas report for debugging
   */
  const generateGasReport = useCallback((): string => {
    if (state.history.length === 0) {
      return 'No transactions recorded yet.';
    }

    const lines: string[] = [
      '=== GAS DIAGNOSTIC REPORT ===',
      `Transactions analyzed: ${state.history.length}`,
      '',
    ];

    for (const d of state.history) {
      lines.push(`Function: ${d.functionName}`);
      lines.push(`  Calldata: ${d.calldataBytes} bytes`);
      lines.push(`  Estimated Gas: ${d.estimatedGas.toString()}`);
      lines.push(`  Actual Gas: ${d.actualGasUsed?.toString() || 'N/A'}`);
      lines.push(`  Gas Price: ${formatGwei(d.gasPrice)} gwei`);
      lines.push(`  Estimated Cost: ${d.estimatedCostEth} ETH`);
      lines.push(`  Actual Cost: ${d.actualCostEth || 'N/A'}`);
      if (d.warnings.length > 0) {
        lines.push(`  Warnings: ${d.warnings.join(', ')}`);
      }
      lines.push('');
    }

    // Summary
    const totalEstimated = state.history.reduce((sum, d) => sum + d.estimatedCostWei, 0n);
    lines.push(`Total Estimated Cost: ${formatEther(totalEstimated)} ETH`);

    return lines.join('\n');
  }, [state.history]);

  return {
    ...state,
    analyzeTransaction,
    recordActualGas,
    getOptimizedGasParams,
    shouldBlockTransaction,
    generateGasReport,
  };
}

// Export baseline for reference
export { GAS_BASELINES };
