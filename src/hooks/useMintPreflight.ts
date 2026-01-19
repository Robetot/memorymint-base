/**
 * useMintPreflight Hook - Production-Ready Pre-flight Diagnostic System
 * 
 * Features:
 * - Safe RPC reads with configurable timeouts
 * - Transaction simulation with gas estimation
 * - Wallet balance and mint count tracking
 * - Batch mint support for admin flows
 * - Auto-refresh with manual trigger
 * - Graceful error handling and fallbacks
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { encodeFunctionData, formatEther, parseEther } from 'viem';
import { 
  NFT_CONTRACT_ADDRESS, 
  CONTRACT_ABI,
  RPC_ENDPOINTS,
  BASE_CHAIN_ID_NUM,
} from '@/contracts/MemoryMintContract';
import { 
  PreflightDiagnostics, 
  createPreflightDiagnostics 
} from '@/components/game/MintPreflightPanel';

// === CONSTANTS ===
const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds timeout for RPC calls
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds auto-refresh
const SIMULATION_GAS_BUFFER = 1.2; // 20% buffer for gas estimation
const BASE_GAS_PRICE_GWEI = 0.001; // ~0.001 gwei on Base (very low)

// === HELPERS ===

/**
 * Normalize chainId to number - handles string (hex or decimal) and number inputs
 */
export const normalizeChainId = (chainId: string | number | null | undefined): number | undefined => {
  if (chainId === null || chainId === undefined) return undefined;
  if (typeof chainId === 'number') return chainId;
  if (typeof chainId === 'string') {
    if (chainId.startsWith('0x')) return parseInt(chainId, 16);
    return parseInt(chainId, 10);
  }
  return undefined;
};

/**
 * RPC call with timeout and fallback endpoints
 */
async function rpcCallWithTimeout(
  method: string, 
  params: unknown[], 
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  rpcIndex: number = 0
): Promise<unknown> {
  const endpoint = RPC_ENDPOINTS[rpcIndex] || RPC_ENDPOINTS[0];
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const json = await response.json();
    
    if (json.error) {
      throw new Error(json.error.message || 'RPC Error');
    }
    return json.result;
  } catch (err) {
    clearTimeout(timeoutId);
    
    // Try next RPC endpoint if available
    if (rpcIndex < RPC_ENDPOINTS.length - 1) {
      return rpcCallWithTimeout(method, params, timeoutMs, rpcIndex + 1);
    }
    throw err;
  }
}

// === INTERFACE ===
export interface UseMintPreflightOptions {
  address?: string | null;
  isConnected: boolean;
  chainId?: string | number | null;
  tokenURI?: string;
  tokenURIs?: string[]; // For batch mint simulation
  autoRefresh?: boolean;
  refreshInterval?: number;
  timeoutMs?: number;
}

export interface PreflightResult {
  diagnostics: PreflightDiagnostics | null;
  isRefreshing: boolean;
  lastError: string | null;
  lastRefreshTime: number | null;
  contractState: ContractState | null;
  simulationResult: SimulationResult | null;
  refresh: () => Promise<void>;
  runPreflightChecks: () => Promise<void>;
}

export interface ContractState {
  isMintActive: boolean;
  isKillSwitchActive: boolean;
  isFreeMint: boolean;
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  walletMintLimit: bigint;
  isAntiBotActive: boolean;
  antiBotMode: number;
  totalMinted: bigint;
  owner: string | null;
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  gasLimit?: bigint;
  estimatedCostEth?: string;
  estimatedCostGwei?: string;
}

// === MAIN HOOK ===
export function useMintPreflight({
  address,
  isConnected,
  chainId,
  tokenURI,
  tokenURIs,
  autoRefresh = true,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseMintPreflightOptions): PreflightResult {
  const [diagnostics, setDiagnostics] = useState<PreflightDiagnostics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [contractState, setContractState] = useState<ContractState | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  
  const refreshTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Safe contract read with timeout
  const safeContractRead = useCallback(async <T>(
    methodName: string, 
    defaultValue: T,
    args: unknown[] = []
  ): Promise<T> => {
    try {
      const calldata = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: methodName as any,
        args: args as any,
      });
      
      const result = await rpcCallWithTimeout(
        'eth_call', 
        [{ to: NFT_CONTRACT_ADDRESS, data: calldata }, 'latest'],
        timeoutMs
      );
      
      const str = String(result);
      
      // Handle empty response
      if (!str || str === '0x') return defaultValue;
      
      // Parse based on expected type
      if (typeof defaultValue === 'boolean') {
        return (BigInt(str) !== 0n) as unknown as T;
      }
      if (typeof defaultValue === 'bigint') {
        return BigInt(str) as unknown as T;
      }
      if (typeof defaultValue === 'number') {
        return Number(BigInt(str)) as unknown as T;
      }
      if (typeof defaultValue === 'string' && str.length === 66) {
        // Address (0x + 64 hex chars, last 40 are the address)
        return ('0x' + str.slice(-40)) as unknown as T;
      }
      
      return defaultValue;
    } catch (err) {
      console.warn(`[Preflight] Failed to read ${methodName}:`, err);
      return defaultValue;
    }
  }, [timeoutMs]);

  // Get wallet balance
  const getWalletBalance = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      const result = await rpcCallWithTimeout(
        'eth_getBalance', 
        [walletAddress, 'latest'],
        timeoutMs
      );
      return BigInt(String(result));
    } catch {
      return 0n;
    }
  }, [timeoutMs]);

  // Get wallet mint count
  const getWalletMintCount = useCallback(async (walletAddress: string): Promise<bigint> => {
    try {
      return await safeContractRead('walletMintCount', 0n, [walletAddress]);
    } catch {
      return 0n;
    }
  }, [safeContractRead]);

  // Simulate transaction
  const simulateTransaction = useCallback(async (
    walletAddress: string,
    uri: string,
    mintPrice: bigint,
    isFreeMint: boolean
  ): Promise<SimulationResult> => {
    try {
      const value = isFreeMint ? 0n : mintPrice;
      
      // Encode mint function call
      const calldata = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintNFT',
        args: [uri],
      });

      // Estimate gas
      const gasEstimate = await rpcCallWithTimeout(
        'eth_estimateGas',
        [{
          from: walletAddress,
          to: NFT_CONTRACT_ADDRESS,
          data: calldata,
          value: value > 0n ? `0x${value.toString(16)}` : undefined,
        }],
        timeoutMs
      );

      const gasLimit = BigInt(String(gasEstimate));
      const bufferedGas = BigInt(Math.ceil(Number(gasLimit) * SIMULATION_GAS_BUFFER));
      
      // Get gas price
      let gasPrice = parseEther(BASE_GAS_PRICE_GWEI.toString()) / 1000000000n; // Convert to wei
      try {
        const gasPriceResult = await rpcCallWithTimeout('eth_gasPrice', [], timeoutMs);
        gasPrice = BigInt(String(gasPriceResult));
      } catch {}

      const estimatedCost = bufferedGas * gasPrice;
      
      return {
        success: true,
        gasLimit: bufferedGas,
        estimatedCostEth: formatEther(estimatedCost),
        estimatedCostGwei: (Number(gasPrice) / 1e9).toFixed(4),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Simulation failed';
      
      // Parse common contract errors
      let friendlyError = errorMsg;
      if (errorMsg.includes('Paused')) friendlyError = 'Minting is paused';
      else if (errorMsg.includes('KillSwitch')) friendlyError = 'Emergency stop is active';
      else if (errorMsg.includes('InsufficientPayment')) friendlyError = 'Insufficient ETH sent';
      else if (errorMsg.includes('WalletMintLimit')) friendlyError = 'Wallet mint limit exceeded';
      else if (errorMsg.includes('execution reverted')) friendlyError = 'Transaction would fail';
      
      return {
        success: false,
        error: friendlyError,
      };
    }
  }, [timeoutMs]);

  // Main preflight check routine
  const runPreflightChecks = useCallback(async () => {
    const numericChainId = normalizeChainId(chainId);
    
    // Early return for disconnected state
    if (!isConnected || !address) {
      const diag = createPreflightDiagnostics({ 
        isConnected, 
        address: address || undefined, 
        chainId: numericChainId 
      });
      if (isMountedRef.current) {
        setDiagnostics(diag);
        setContractState(null);
        setSimulationResult(null);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsRefreshing(true);
      setLastError(null);
    }

    try {
      // Batch all contract reads for efficiency
      const [
        isMintActive,
        isKillSwitchActive,
        isFreeMint,
        mintPriceETH,
        mintPriceUSDC,
        walletMintLimit,
        isAntiBotActive,
        antiBotMode,
        totalMinted,
        owner,
        walletBalance,
        walletMintCount,
      ] = await Promise.all([
        safeContractRead('isMintActive', true),
        safeContractRead('iskillSwitchActive', false),
        safeContractRead('isFreeMint', false),
        safeContractRead('mintPriceETH', 0n),
        safeContractRead('mintPriceUSDC', 0n),
        safeContractRead('walletMintLimit', 0n),
        safeContractRead('isAntiBotActive', false),
        safeContractRead('antiBotMode', 0),
        safeContractRead('totalMinted', 0n),
        safeContractRead('owner', ''),
        getWalletBalance(address),
        getWalletMintCount(address),
      ]);

      const state: ContractState = {
        isMintActive,
        isKillSwitchActive,
        isFreeMint,
        mintPriceETH,
        mintPriceUSDC,
        walletMintLimit,
        isAntiBotActive,
        antiBotMode,
        totalMinted,
        owner: owner || null,
      };

      // Run simulation if we have a tokenURI
      let simResult: SimulationResult | null = null;
      const uriToSimulate = tokenURI || (tokenURIs && tokenURIs[0]);
      
      if (uriToSimulate && numericChainId === BASE_CHAIN_ID_NUM) {
        simResult = await simulateTransaction(address, uriToSimulate, mintPriceETH, isFreeMint);
      }

      // Create diagnostics
      const diag = createPreflightDiagnostics({
        isConnected,
        address,
        chainId: numericChainId,
        isMintActive,
        isKillSwitchActive,
        isFreeMint,
        mintPriceETH,
        walletBalance,
        walletMintCount,
        walletMintLimit,
        isAntiBotActive,
        simulationResult: simResult ? {
          success: simResult.success,
          error: simResult.error,
          gasLimit: simResult.gasLimit,
          estimatedCostEth: simResult.estimatedCostEth,
        } : undefined,
      });

      if (isMountedRef.current) {
        setContractState(state);
        setSimulationResult(simResult);
        setDiagnostics(diag);
        setLastRefreshTime(Date.now());
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Preflight check failed';
      console.error('[Preflight] Error:', errorMsg);
      
      if (isMountedRef.current) {
        setLastError(errorMsg);
        // Still create basic diagnostics on error
        setDiagnostics(createPreflightDiagnostics({ 
          isConnected, 
          address, 
          chainId: numericChainId 
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [
    isConnected, 
    address, 
    chainId, 
    tokenURI, 
    tokenURIs, 
    safeContractRead, 
    getWalletBalance, 
    getWalletMintCount, 
    simulateTransaction
  ]);

  // Initial check and auto-refresh
  useEffect(() => {
    isMountedRef.current = true;
    
    // Run initial check
    runPreflightChecks();
    
    // Set up auto-refresh if enabled
    if (autoRefresh && isConnected) {
      refreshTimeoutRef.current = setInterval(runPreflightChecks, refreshInterval);
    }
    
    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [autoRefresh, isConnected, refreshInterval, runPreflightChecks]);

  // Re-run checks when tokenURI changes
  useEffect(() => {
    if (tokenURI || tokenURIs) {
      runPreflightChecks();
    }
  }, [tokenURI, tokenURIs, runPreflightChecks]);

  return {
    diagnostics,
    isRefreshing,
    lastError,
    lastRefreshTime,
    contractState,
    simulationResult,
    refresh: runPreflightChecks,
    runPreflightChecks,
  };
}

// === BATCH PREFLIGHT HOOK ===
export interface UseBatchPreflightOptions {
  address?: string | null;
  isConnected: boolean;
  chainId?: string | number | null;
  tokenURIs: string[];
  timeoutMs?: number;
}

export interface BatchPreflightResult {
  results: Map<number, PreflightDiagnostics>;
  isLoading: boolean;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  refreshCurrent: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export function useBatchPreflight({
  address,
  isConnected,
  chainId,
  tokenURIs,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseBatchPreflightOptions): BatchPreflightResult {
  const [results, setResults] = useState<Map<number, PreflightDiagnostics>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { diagnostics, refresh } = useMintPreflight({
    address,
    isConnected,
    chainId,
    tokenURI: tokenURIs[currentIndex],
    autoRefresh: false,
    timeoutMs,
  });

  // Update results when diagnostics change
  useEffect(() => {
    if (diagnostics && tokenURIs[currentIndex]) {
      setResults(prev => new Map(prev).set(currentIndex, diagnostics));
    }
  }, [diagnostics, currentIndex, tokenURIs]);

  const refreshCurrent = useCallback(async () => {
    setIsLoading(true);
    await refresh();
    setIsLoading(false);
  }, [refresh]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    const newResults = new Map<number, PreflightDiagnostics>();
    
    for (let i = 0; i < tokenURIs.length; i++) {
      setCurrentIndex(i);
      await refresh();
      if (diagnostics) {
        newResults.set(i, diagnostics);
      }
    }
    
    setResults(newResults);
    setIsLoading(false);
  }, [tokenURIs, refresh, diagnostics]);

  return {
    results,
    isLoading,
    currentIndex,
    setCurrentIndex,
    refreshCurrent,
    refreshAll,
  };
}

export default useMintPreflight;
