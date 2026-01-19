/**
 * useMintPreflight Hook
 * Performs pre-flight checks before minting to help debug 'transaction likely to fail' warnings.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { encodeFunctionData, formatEther } from 'viem';
import { 
  NFT_CONTRACT_ADDRESS, 
  CONTRACT_ABI 
} from '@/contracts/MemoryMintContract';
import { 
  PreflightDiagnostics, 
  createPreflightDiagnostics 
} from '@/components/game/MintPreflightPanel';

const BASE_CHAIN_ID = 8453;

// Helper to normalize chainId to number
const normalizeChainId = (chainId: string | number | null | undefined): number | undefined => {
  if (chainId === null || chainId === undefined) return undefined;
  if (typeof chainId === 'number') return chainId;
  if (chainId.startsWith('0x')) return parseInt(chainId, 16);
  return parseInt(chainId, 10);
};

// Simple RPC call helper
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || 'RPC Error');
  return json.result;
}

interface UseMintPreflightProps {
  address?: string | null;
  isConnected: boolean;
  chainId?: string | null;
  tokenURI?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useMintPreflight({
  address,
  isConnected,
  chainId,
  tokenURI,
  autoRefresh = true,
  refreshInterval = 30000,
}: UseMintPreflightProps) {
  const [diagnostics, setDiagnostics] = useState<PreflightDiagnostics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const safeRead = useCallback(async <T>(method: string, defaultValue: T): Promise<T> => {
    try {
      const calldata = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: method as 'isMintActive',
        args: [],
      });
      const result = await Promise.race([
        rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data: calldata }, 'latest']),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout')), 3000))
      ]);
      const str = String(result);
      if (typeof defaultValue === 'boolean') return (str !== '0x' && str !== '0x0' && BigInt(str) !== 0n) as unknown as T;
      if (typeof defaultValue === 'bigint') return BigInt(str) as unknown as T;
      return defaultValue;
    } catch { return defaultValue; }
  }, []);

  const runPreflightChecks = useCallback(async () => {
    const numericChainId = normalizeChainId(chainId);
    if (!isConnected || !address) {
      setDiagnostics(createPreflightDiagnostics({ isConnected, address: address || undefined, chainId: numericChainId }));
      return;
    }
    setIsRefreshing(true);
    try {
      const [isMintActive, isKillSwitchActive, isFreeMint, mintPriceETH, walletMintLimit, isAntiBotActive] = await Promise.all([
        safeRead('isMintActive', true),
        safeRead('iskillSwitchActive', false),
        safeRead('isFreeMint', false),
        safeRead('mintPriceETH', 0n),
        safeRead('walletMintLimit', 0n),
        safeRead('isAntiBotActive', false),
      ]);
      
      let walletBalance = 0n;
      try {
        const bal = await rpcCall('eth_getBalance', [address, 'latest']);
        walletBalance = BigInt(String(bal));
      } catch {}

      setDiagnostics(createPreflightDiagnostics({
        isConnected, address, chainId: numericChainId,
        isMintActive, isKillSwitchActive, isFreeMint, mintPriceETH,
        walletBalance, walletMintLimit, isAntiBotActive,
      }));
    } catch (err: unknown) {
      setLastError(err instanceof Error ? err.message : 'Preflight failed');
      setDiagnostics(createPreflightDiagnostics({ isConnected, address, chainId: numericChainId }));
    } finally {
      setIsRefreshing(false);
    }
  }, [isConnected, address, chainId, safeRead]);

  useEffect(() => {
    if (!autoRefresh || !isConnected) return;
    runPreflightChecks();
    refreshTimeoutRef.current = setInterval(runPreflightChecks, refreshInterval);
    return () => { if (refreshTimeoutRef.current) clearInterval(refreshTimeoutRef.current); };
  }, [autoRefresh, isConnected, refreshInterval, runPreflightChecks]);

  return { diagnostics, isRefreshing, lastError, refresh: runPreflightChecks, runPreflightChecks };
}

export default useMintPreflight;
