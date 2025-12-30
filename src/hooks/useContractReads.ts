import { useState, useCallback, useRef, useEffect } from 'react';
import { encodeFunctionData, decodeFunctionResult, formatEther, formatUnits } from 'viem';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_USDC_ADDRESS,
  RPC_ENDPOINTS,
  CONTRACT_ABI,
  ERC20_ABI,
  USDC_DECIMALS,
  CONFIG_CACHE_TTL,
  BALANCE_CACHE_TTL,
  PaymentCurrency,
  ClaimModeEnum,
  AntiBotModeEnum,
} from '@/contracts/MemoryMintContract';

// ============ TYPES ============
export interface ContractConfig {
  // Core state
  owner: string;
  mintEnabled: boolean;
  claimEnabled: boolean;
  totalSupply: bigint;
  
  // Currency config
  ethEnabled: boolean;
  usdcEnabled: boolean;
  activeMintCurrency: PaymentCurrency;
  activeBonusCurrency: PaymentCurrency;
  
  // Prices
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  
  // Anti-bot
  antiBotMode: number;
  walletMintLimit: bigint;
  mintCooldownBlocks: bigint;
  signatureRequired: boolean;
  
  // Bonus
  claimMode: number;
  bonusPoolETH: bigint;
  bonusPoolUSDC: bigint;
  
  // Meta
  lastFetched: number;
  isLoaded: boolean;
}

export interface WalletState {
  address: string;
  canMint: boolean;
  nftBalance: bigint;
  ethBalance: bigint;
  usdcBalance: bigint;
  usdcAllowance: bigint;
  nonce: bigint;
  isOnAllowlist: boolean;
  isOnDenylist: boolean;
  lastFetched: number;
}

export interface BonusLevelInfo {
  level: number;
  amountETH: bigint;
  amountUSDC: bigint;
  active: boolean;
  claimsRemaining: bigint;
  requiresNFT: boolean;
  canClaim: boolean;
}

// ============ CACHE ============
const configCache: { data: ContractConfig | null; timestamp: number } = { data: null, timestamp: 0 };
const walletCache: Map<string, { data: WalletState; timestamp: number }> = new Map();

// ============ RPC HELPER ============
async function rpcCall(method: string, params: unknown[], timeout = 10000): Promise<unknown> {
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
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      if (!response.ok) {
        errors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      if (data.error) {
        errors.push(`${endpoint}: ${data.error.message}`);
        continue;
      }
      
      return data.result;
    } catch (err) {
      errors.push(`${endpoint}: ${err instanceof Error ? err.message : 'Unknown'}`);
      continue;
    }
  }
  
  throw new Error(`All RPCs failed: ${errors.join(', ')}`);
}

// ============ BATCH READ HELPER ============
async function batchReadContract(calls: Array<{ functionName: string; args?: unknown[] }>): Promise<unknown[]> {
  const results = await Promise.allSettled(
    calls.map(async ({ functionName, args = [] }) => {
      // Use type assertion to avoid deep type instantiation
      const data = encodeFunctionData({
        abi: CONTRACT_ABI as any,
        functionName: functionName,
        args: args as any[],
      });
      
      const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest']);
      
      if (!result || result === '0x') return null;
      
      return decodeFunctionResult({
        abi: CONTRACT_ABI as any,
        functionName: functionName,
        data: result as `0x${string}`,
      });
    })
  );
  
  return results.map(r => r.status === 'fulfilled' ? r.value : null);
}

// ============ HOOK ============
export function useContractReads() {
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [bonusLevels, setBonusLevels] = useState<BonusLevelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isFetchingConfigRef = useRef(false);
  const isFetchingWalletRef = useRef(false);

  // ============ FETCH CONTRACT CONFIG (Batched) ============
  const fetchContractConfig = useCallback(async (force = false): Promise<ContractConfig | null> => {
    const now = Date.now();
    
    // Check cache
    if (!force && configCache.data && now - configCache.timestamp < CONFIG_CACHE_TTL) {
      setConfig(configCache.data);
      return configCache.data;
    }
    
    if (isFetchingConfigRef.current) return configCache.data;
    isFetchingConfigRef.current = true;
    setIsLoading(true);
    
    try {
      const results = await batchReadContract([
        { functionName: 'owner' },
        { functionName: 'mintEnabled' },
        { functionName: 'claimEnabled' },
        { functionName: 'totalSupply' },
        { functionName: 'currencyConfig' },
        { functionName: 'mintPriceETH' },
        { functionName: 'mintPriceUSDC' },
        { functionName: 'antiBotMode' },
        { functionName: 'walletMintLimit' },
        { functionName: 'mintCooldownBlocks' },
        { functionName: 'signatureRequired' },
        { functionName: 'claimMode' },
        { functionName: 'bonusPoolBalanceETH' },
        { functionName: 'bonusPoolBalanceUSDC' },
      ]);
      
      const currencyConfig = results[4] as [boolean, boolean, number, number] | null;
      
      const configData: ContractConfig = {
        owner: (results[0] as string) || '',
        mintEnabled: (results[1] as boolean) ?? false,
        claimEnabled: (results[2] as boolean) ?? false,
        totalSupply: (results[3] as bigint) ?? 0n,
        ethEnabled: currencyConfig?.[0] ?? true,
        usdcEnabled: currencyConfig?.[1] ?? false,
        activeMintCurrency: currencyConfig?.[2] === 1 ? 'USDC' : 'ETH',
        activeBonusCurrency: currencyConfig?.[3] === 1 ? 'USDC' : 'ETH',
        mintPriceETH: (results[5] as bigint) ?? 0n,
        mintPriceUSDC: (results[6] as bigint) ?? 0n,
        antiBotMode: (results[7] as number) ?? 2,
        walletMintLimit: (results[8] as bigint) ?? 10n,
        mintCooldownBlocks: (results[9] as bigint) ?? 2n,
        signatureRequired: (results[10] as boolean) ?? true,
        claimMode: (results[11] as number) ?? 0,
        bonusPoolETH: (results[12] as bigint) ?? 0n,
        bonusPoolUSDC: (results[13] as bigint) ?? 0n,
        lastFetched: now,
        isLoaded: true,
      };
      
      configCache.data = configData;
      configCache.timestamp = now;
      setConfig(configData);
      setError(null);
      
      return configData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch config';
      setError(msg);
      console.error('[ContractReads] Config fetch failed:', err);
      return null;
    } finally {
      isFetchingConfigRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // ============ FETCH WALLET STATE (Batched) ============
  const fetchWalletState = useCallback(async (address: string, force = false): Promise<WalletState | null> => {
    if (!address) return null;
    
    const now = Date.now();
    const cached = walletCache.get(address.toLowerCase());
    
    if (!force && cached && now - cached.timestamp < BALANCE_CACHE_TTL) {
      setWalletState(cached.data);
      return cached.data;
    }
    
    if (isFetchingWalletRef.current) return cached?.data ?? null;
    isFetchingWalletRef.current = true;
    
    try {
      // Batch contract reads
      const contractResults = await batchReadContract([
        { functionName: 'canMint', args: [address] },
        { functionName: 'balanceOf', args: [address] },
        { functionName: 'getNonce', args: [address] },
        { functionName: 'allowlist', args: [address] },
        { functionName: 'denylist', args: [address] },
      ]);
      
      // Get ETH balance
      const ethBalanceHex = await rpcCall('eth_getBalance', [address, 'latest']) as string;
      const ethBalance = BigInt(ethBalanceHex || '0');
      
      // Get USDC balance and allowance
      const usdcCalls = await Promise.allSettled([
        rpcCall('eth_call', [{
          to: BASE_USDC_ADDRESS,
          data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] }),
        }, 'latest']),
        rpcCall('eth_call', [{
          to: BASE_USDC_ADDRESS,
          data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, NFT_CONTRACT_ADDRESS] }),
        }, 'latest']),
      ]);
      
      let usdcBalance = 0n;
      let usdcAllowance = 0n;
      
      if (usdcCalls[0].status === 'fulfilled' && usdcCalls[0].value) {
        try {
          usdcBalance = decodeFunctionResult({
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            data: usdcCalls[0].value as `0x${string}`,
          }) as bigint;
        } catch {}
      }
      
      if (usdcCalls[1].status === 'fulfilled' && usdcCalls[1].value) {
        try {
          usdcAllowance = decodeFunctionResult({
            abi: ERC20_ABI,
            functionName: 'allowance',
            data: usdcCalls[1].value as `0x${string}`,
          }) as bigint;
        } catch {}
      }
      
      const state: WalletState = {
        address,
        canMint: (contractResults[0] as boolean) ?? false,
        nftBalance: (contractResults[1] as bigint) ?? 0n,
        nonce: (contractResults[2] as bigint) ?? 0n,
        isOnAllowlist: (contractResults[3] as boolean) ?? false,
        isOnDenylist: (contractResults[4] as boolean) ?? false,
        ethBalance,
        usdcBalance,
        usdcAllowance,
        lastFetched: now,
      };
      
      walletCache.set(address.toLowerCase(), { data: state, timestamp: now });
      setWalletState(state);
      
      return state;
    } catch (err) {
      console.error('[ContractReads] Wallet state fetch failed:', err);
      return null;
    } finally {
      isFetchingWalletRef.current = false;
    }
  }, []);

  // ============ FETCH BONUS LEVELS ============
  const fetchBonusLevels = useCallback(async (walletAddress?: string): Promise<BonusLevelInfo[]> => {
    const levels: BonusLevelInfo[] = [];
    
    // Fetch levels 1-10 (common range)
    for (let level = 1; level <= 10; level++) {
      try {
        const results = await batchReadContract([
          { functionName: 'bonusLevels', args: [BigInt(level)] },
          ...(walletAddress ? [{ functionName: 'canClaim', args: [walletAddress, BigInt(level)] }] : []),
        ]);
        
        const levelData = results[0] as [bigint, bigint, boolean, bigint, bigint, boolean] | null;
        
        if (levelData && levelData[2]) { // Only include active levels
          levels.push({
            level,
            amountETH: levelData[0],
            amountUSDC: levelData[1],
            active: levelData[2],
            claimsRemaining: levelData[3],
            requiresNFT: levelData[5],
            canClaim: walletAddress ? (results[1] as boolean) ?? false : false,
          });
        }
      } catch {
        // Level doesn't exist or inactive, skip
      }
    }
    
    setBonusLevels(levels);
    return levels;
  }, []);

  // ============ CHECK IF OWNER ============
  const isOwner = useCallback((address: string): boolean => {
    if (!config?.owner || !address) return false;
    return config.owner.toLowerCase() === address.toLowerCase();
  }, [config?.owner]);

  // ============ INVALIDATE CACHE ============
  const invalidateWalletCache = useCallback((address?: string) => {
    if (address) {
      walletCache.delete(address.toLowerCase());
    } else {
      walletCache.clear();
    }
  }, []);

  const invalidateConfigCache = useCallback(() => {
    configCache.data = null;
    configCache.timestamp = 0;
  }, []);

  // ============ FORMATTED VALUES ============
  const getFormattedPrices = useCallback(() => {
    if (!config) return { eth: '0', usdc: '$0.00' };
    return {
      eth: formatEther(config.mintPriceETH),
      usdc: `$${formatUnits(config.mintPriceUSDC, USDC_DECIMALS)}`,
    };
  }, [config]);

  const getFormattedBonusPool = useCallback(() => {
    if (!config) return { eth: '0', usdc: '$0.00' };
    return {
      eth: formatEther(config.bonusPoolETH),
      usdc: `$${formatUnits(config.bonusPoolUSDC, USDC_DECIMALS)}`,
    };
  }, [config]);

  return {
    // State
    config,
    walletState,
    bonusLevels,
    isLoading,
    error,
    
    // Fetchers
    fetchContractConfig,
    fetchWalletState,
    fetchBonusLevels,
    
    // Utilities
    isOwner,
    invalidateWalletCache,
    invalidateConfigCache,
    getFormattedPrices,
    getFormattedBonusPool,
    
    // Constants
    contractAddress: NFT_CONTRACT_ADDRESS,
  };
}
