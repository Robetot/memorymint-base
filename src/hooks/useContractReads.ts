import { useState, useCallback, useRef } from 'react';
import { encodeFunctionData, decodeFunctionResult } from 'viem';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_USDC_ADDRESS,
  RPC_ENDPOINTS,
  CONTRACT_ABI,
  ERC20_ABI,
  CONFIG_CACHE_TTL,
  BALANCE_CACHE_TTL,
  PaymentCurrency,
} from '@/contracts/MemoryMintContract';

// ============ TYPES ============
export interface ContractConfig {
  // Core state
  owner: string;
  paused: boolean;
  throttleEnabled: boolean;
  totalSupply: bigint;
  nextTokenId: bigint;
  
  // Compatibility fields (not used in MemoryMintUltra, but kept for UI)
  mintEnabled: boolean; // derived from !paused
  claimEnabled: boolean; // always false for this contract
  ethEnabled: boolean;
  usdcEnabled: boolean;
  activeMintCurrency: PaymentCurrency;
  activeBonusCurrency: PaymentCurrency;
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  antiBotMode: number;
  walletMintLimit: bigint;
  mintCooldownBlocks: bigint;
  signatureRequired: boolean;
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
let contractVerified = false;

// ============ TIMEOUT HELPER ============
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  return (Promise.race([promise, timeoutPromise]) as Promise<T>).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

// ============ ABI HELPERS ============
function abiHasFunction(functionName: string): boolean {
  const abiItems = CONTRACT_ABI as unknown as readonly any[];
  return abiItems.some(
    (i) => i && i.type === 'function' && typeof i.name === 'string' && i.name === functionName
  );
}

function assertAbiHasFunction(functionName: string): void {
  if (!abiHasFunction(functionName)) {
    throw new Error(`ABI missing function "${functionName}". Re-export ABI from deployed build.`);
  }
}

// ============ RPC HELPER ============
async function rpcCall(method: string, params: unknown[], timeoutMs = 4000): Promise<unknown> {
  const errors: string[] = [];
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 250));
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
        const msg = err instanceof Error ? err.message : 'Unknown';
        errors.push(`${endpoint}: ${msg}`);
        continue;
      }
    }

    throw new Error(`All RPCs failed: ${errors.join(', ')}`);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`RPC ${method} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// ============ NETWORK GUARD ============
async function getConnectedChainId(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    return await (window.ethereum as any).request({ method: 'eth_chainId' });
  } catch {
    return null;
  }
}

async function assertConnectedToBase(): Promise<void> {
  const chainId = await getConnectedChainId();
  if (!chainId) return;
  if (chainId.toLowerCase() !== '0x2105') {
    throw new Error(`Wrong network: expected Base Mainnet (8453), got ${chainId}`);
  }
}

// ============ CONTRACT PREFLIGHT CHECK ============
async function verifyContractExists(requireConnectedBaseNetwork: boolean): Promise<void> {
  if (contractVerified) return;

  if (requireConnectedBaseNetwork) {
    await assertConnectedToBase();
  }

  console.info('[ContractReads] Preflight: verifying contract exists at', NFT_CONTRACT_ADDRESS);

  const code = (await withTimeout(
    rpcCall('eth_getCode', [NFT_CONTRACT_ADDRESS, 'latest'], 2800) as Promise<string>,
    3000,
    'eth_getCode timed out'
  )) as string;

  if (!code || code === '0x' || code === '0x0') {
    console.error('[ContractReads] PREFLIGHT FAILED: No contract at address', {
      address: NFT_CONTRACT_ADDRESS,
      code,
      chainId: await getConnectedChainId(),
    });
    throw new Error(
      `No contract found at ${NFT_CONTRACT_ADDRESS}. Verify the address is deployed on Base Mainnet (chainId 8453).`
    );
  }

  contractVerified = true;
  console.info('[ContractReads] Preflight passed: contract exists', {
    address: NFT_CONTRACT_ADDRESS,
    codeLength: code.length,
  });
}

export function resetContractVerification(): void {
  contractVerified = false;
}

// ============ SINGLE ENTRYPOINT FOR NFT CONTRACT READS ============
async function readNft(functionName: string, args: unknown[] = []): Promise<unknown> {
  if (!contractVerified) {
    throw new Error(`Contract preflight not verified; refusing to call ${functionName}`);
  }

  assertAbiHasFunction(functionName);

  console.info(`[AdminInit] Reading ${functionName}`);

  const data = encodeFunctionData({
    abi: CONTRACT_ABI as any,
    functionName: functionName as any,
    args: args as any[],
  });

  const result = (await withTimeout(
    rpcCall('eth_call', [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'], 2800) as Promise<string>,
    3000,
    `${functionName} timed out`
  )) as string;

  if (!result || result === '0x' || result === '') {
    throw new Error(`${functionName} returned empty result`);
  }

  try {
    return decodeFunctionResult({
      abi: CONTRACT_ABI as any,
      functionName: functionName as any,
      data: result as `0x${string}`,
    });
  } catch {
    throw new Error(`${functionName} decode failed (ABI mismatch?)`);
  }
}

// ============ SINGLE ENTRYPOINT FOR ERC20 READS (USDC) ============
async function readErc20(functionName: 'balanceOf' | 'allowance', args: unknown[]): Promise<bigint> {
  console.info(`[ContractReads] Reading USDC ${functionName}`);

  const data = encodeFunctionData({
    abi: ERC20_ABI as any,
    functionName,
    args: args as any[],
  });

  const result = (await withTimeout(
    rpcCall('eth_call', [{ to: BASE_USDC_ADDRESS, data }, 'latest'], 2800) as Promise<string>,
    3000,
    `USDC ${functionName} timed out`
  )) as string;

  if (!result || result === '0x' || result === '') return 0n;

  try {
    return decodeFunctionResult({
      abi: ERC20_ABI,
      functionName,
      data: result as `0x${string}`,
    }) as bigint;
  } catch {
    throw new Error(`USDC ${functionName} decode failed`);
  }
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

  // ============ FETCH CONTRACT CONFIG (SEQUENTIAL, FAIL-FAST) ============
  const fetchContractConfig = useCallback(async (force = false): Promise<ContractConfig | null> => {
    const now = Date.now();

    // Check cache
    if (!force && configCache.data && now - configCache.timestamp < CONFIG_CACHE_TTL) {
      setConfig(configCache.data);
      return configCache.data;
    }

    if (isFetchingConfigRef.current) {
      if (force && !configCache.data) {
        const e = new Error('Config fetch already in progress and no cached config available');
        setError(e.message);
        throw e;
      }
      return configCache.data;
    }

    isFetchingConfigRef.current = true;
    setIsLoading(true);

    const deadline = performance.now() + 4500;
    const chainId = await getConnectedChainId();

    const readStep = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      if (performance.now() > deadline) {
        throw new Error(`Config read budget exceeded before ${label}`);
      }

      try {
        return await fn();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[AdminInit][FAIL DETAIL]', {
          chainId,
          contractAddress: NFT_CONTRACT_ADDRESS,
          abiHasMethod: abiHasFunction(label.replace(/\(\)$/, '')),
          failingStep: label,
          error: message,
        });
        throw new Error(`Config read failed at ${label}: ${message}`);
      }
    };

    try {
      // Preflight + hard gate
      await readStep('preflight', async () => {
        await verifyContractExists(force);
        if (!contractVerified) throw new Error('contractVerified=false after preflight');
      });

      // Verify required methods exist in ABI
      const requiredMethods = ['owner', 'paused', 'throttleEnabled', 'totalSupply', 'nextTokenId'];
      for (const fn of requiredMethods) {
        if (!abiHasFunction(fn)) {
          throw new Error(`ABI missing function "${fn}"`);
        }
      }

      // Sequential reads - only functions that exist in MemoryMintUltra
      const owner = (await readStep('owner()', async () => readNft('owner'))) as string;
      if (!owner || typeof owner !== 'string' || !owner.startsWith('0x') || owner.length !== 42) {
        throw new Error(`invalid owner() result: ${String(owner)}`);
      }

      const paused = (await readStep('paused()', async () => readNft('paused'))) as boolean;
      const throttleEnabled = (await readStep('throttleEnabled()', async () => readNft('throttleEnabled'))) as boolean;
      const totalSupply = (await readStep('totalSupply()', async () => readNft('totalSupply'))) as bigint;
      const nextTokenId = (await readStep('nextTokenId()', async () => readNft('nextTokenId'))) as bigint;

      // Build config with compatibility fields for UI
      const configData: ContractConfig = {
        owner,
        paused: paused ?? false,
        throttleEnabled: throttleEnabled ?? false,
        totalSupply: totalSupply ?? 0n,
        nextTokenId: nextTokenId ?? 1n,
        
        // Derived/compatibility fields
        mintEnabled: !paused, // mintEnabled = not paused
        claimEnabled: false, // no claim in this contract
        ethEnabled: true, // free minting, no currency needed
        usdcEnabled: false,
        activeMintCurrency: 'ETH',
        activeBonusCurrency: 'ETH',
        mintPriceETH: 0n, // FREE minting
        mintPriceUSDC: 0n,
        antiBotMode: throttleEnabled ? 1 : 0,
        walletMintLimit: 0n, // no limit
        mintCooldownBlocks: throttleEnabled ? 1n : 0n,
        signatureRequired: false,
        claimMode: 0,
        bonusPoolETH: 0n,
        bonusPoolUSDC: 0n,
        
        lastFetched: now,
        isLoaded: true,
      };

      configCache.data = configData;
      configCache.timestamp = now;
      setConfig(configData);
      setError(null);

      return configData;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to fetch config');
      setError(e.message);
      console.error('[ContractReads] Config fetch failed:', e);

      if (force) throw e;
      return null;
    } finally {
      isFetchingConfigRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // ============ FETCH WALLET STATE ============
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
      await verifyContractExists(true);

      // Read NFT balance
      const nftBalance = (await readNft('balanceOf', [address])) as bigint;

      // Get ETH balance
      const ethBalanceHex = (await withTimeout(
        rpcCall('eth_getBalance', [address, 'latest'], 2800) as Promise<string>,
        3000,
        'eth_getBalance timed out'
      )) as string;
      const ethBalance = BigInt(ethBalanceHex || '0');

      // Get USDC balance (optional, for compatibility)
      const usdcBalance = await readErc20('balanceOf', [address as `0x${string}`]);
      const usdcAllowance = await readErc20('allowance', [address as `0x${string}`, NFT_CONTRACT_ADDRESS]);

      const state: WalletState = {
        address,
        canMint: true, // anyone can mint (free, no restrictions unless paused)
        nftBalance: nftBalance ?? 0n,
        nonce: 0n, // no nonce in this contract
        isOnAllowlist: true, // no allowlist
        isOnDenylist: false, // no denylist
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

  // ============ FETCH BONUS LEVELS (Not supported in this contract) ============
  const fetchBonusLevels = useCallback(async (_walletAddress?: string): Promise<BonusLevelInfo[]> => {
    // MemoryMintUltra has no bonus levels
    setBonusLevels([]);
    return [];
  }, []);

  // ============ INVALIDATE CACHE ============
  const invalidateCache = useCallback(() => {
    configCache.data = null;
    configCache.timestamp = 0;
    walletCache.clear();
    contractVerified = false;
  }, []);

  // Invalidate specific caches (compatibility)
  const invalidateConfigCache = useCallback(() => {
    configCache.data = null;
    configCache.timestamp = 0;
    contractVerified = false;
  }, []);

  const invalidateWalletCache = useCallback((address?: string) => {
    if (address) {
      walletCache.delete(address.toLowerCase());
    } else {
      walletCache.clear();
    }
  }, []);

  // Format bonus pool (compatibility - returns 0 for this contract)
  const getFormattedBonusPool = useCallback(() => {
    return { eth: '0.00', usdc: '0.00' };
  }, []);

  // Check if connected wallet is owner (compatibility)
  const isOwner = useCallback((address?: string) => {
    if (!address || !config?.owner) return false;
    return address.toLowerCase() === config.owner.toLowerCase();
  }, [config?.owner]);

  return {
    config,
    walletState,
    bonusLevels,
    isLoading,
    error,
    fetchContractConfig,
    fetchWalletState,
    fetchBonusLevels,
    invalidateCache,
    invalidateConfigCache,
    invalidateWalletCache,
    getFormattedBonusPool,
    isOwner,
  };
}
