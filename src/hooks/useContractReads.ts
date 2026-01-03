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
let contractVerified = false; // Track if contract existence has been verified

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
    throw new Error(`ABI missing function \"${functionName}\". Re-export ABI from deployed build.`);
  }
}

// ============ RPC HELPER (HARD OVERALL TIMEOUT) ============
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
          // brief backoff; still bounded by the overall AbortController timeout
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

// ============ NETWORK GUARD (ADMIN/WALLET CALLS ONLY) ============
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
  if (!chainId) return; // no wallet context available
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

// Reset verification on network change (call this from useAdminState)
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

    // If a fetch is already in-flight, never silently return null on a forced read
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

    const deadline = performance.now() + 4500; // ensure we fail before the 5s admin init timeout
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
        await verifyContractExists(force); // enforce connected network only on forced/admin reads
        if (!contractVerified) throw new Error('contractVerified=false after preflight');
      });

      // Required methods
      ['owner', 'mintEnabled', 'claimEnabled', 'totalSupply', 'currencyConfig', 'mintPriceETH', 'mintPriceUSDC', 'antiBotMode', 'walletMintLimit', 'mintCooldownBlocks', 'signatureRequired', 'claimMode', 'bonusPoolBalanceETH', 'bonusPoolBalanceUSDC'].forEach(
        (fn) => {
          if (!abiHasFunction(fn)) {
            throw new Error(`ABI missing function \"${fn}\"`);
          }
        }
      );

      const owner = (await readStep('owner()', async () => readNft('owner'))) as string;
      if (!owner || typeof owner !== 'string' || !owner.startsWith('0x') || owner.length !== 42) {
        throw new Error(`invalid owner() result: ${String(owner)}`);
      }

      const mintEnabled = (await readStep('mintEnabled()', async () => readNft('mintEnabled'))) as boolean;
      const claimEnabled = (await readStep('claimEnabled()', async () => readNft('claimEnabled'))) as boolean;
      const totalSupply = (await readStep('totalSupply()', async () => readNft('totalSupply'))) as bigint;

      const currencyConfig = (await readStep('currencyConfig()', async () => readNft('currencyConfig'))) as
        | [boolean, boolean, number, number]
        | null;

      const mintPriceETH = (await readStep('mintPriceETH()', async () => readNft('mintPriceETH'))) as bigint;
      const mintPriceUSDC = (await readStep('mintPriceUSDC()', async () => readNft('mintPriceUSDC'))) as bigint;

      const antiBotMode = (await readStep('antiBotMode()', async () => readNft('antiBotMode'))) as number;
      const walletMintLimit = (await readStep('walletMintLimit()', async () => readNft('walletMintLimit'))) as bigint;
      const mintCooldownBlocks = (await readStep('mintCooldownBlocks()', async () => readNft('mintCooldownBlocks'))) as bigint;
      const signatureRequired = (await readStep('signatureRequired()', async () => readNft('signatureRequired'))) as boolean;

      const claimMode = (await readStep('claimMode()', async () => readNft('claimMode'))) as number;
      const bonusPoolETH = (await readStep('bonusPoolBalanceETH()', async () => readNft('bonusPoolBalanceETH'))) as bigint;
      const bonusPoolUSDC = (await readStep('bonusPoolBalanceUSDC()', async () => readNft('bonusPoolBalanceUSDC'))) as bigint;

      const configData: ContractConfig = {
        owner,
        mintEnabled: mintEnabled ?? false,
        claimEnabled: claimEnabled ?? false,
        totalSupply: totalSupply ?? 0n,
        ethEnabled: currencyConfig?.[0] ?? true,
        usdcEnabled: currencyConfig?.[1] ?? false,
        activeMintCurrency: currencyConfig?.[2] === 1 ? 'USDC' : 'ETH',
        activeBonusCurrency: currencyConfig?.[3] === 1 ? 'USDC' : 'ETH',
        mintPriceETH: mintPriceETH ?? 0n,
        mintPriceUSDC: mintPriceUSDC ?? 0n,
        antiBotMode: antiBotMode ?? 2,
        walletMintLimit: walletMintLimit ?? 10n,
        mintCooldownBlocks: mintCooldownBlocks ?? 2n,
        signatureRequired: signatureRequired ?? true,
        claimMode: claimMode ?? 0,
        bonusPoolETH: bonusPoolETH ?? 0n,
        bonusPoolUSDC: bonusPoolUSDC ?? 0n,
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

  // ============ FETCH WALLET STATE (SEQUENTIAL, TIME-BOUNDED) ============
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
      // Wallet-driven reads should enforce connected network + preflight
      await verifyContractExists(true);

      const canMint = (await readNft('canMint', [address])) as boolean;
      const nftBalance = (await readNft('balanceOf', [address])) as bigint;
      const nonce = (await readNft('getNonce', [address])) as bigint;
      const isOnAllowlist = (await readNft('allowlist', [address])) as boolean;
      const isOnDenylist = (await readNft('denylist', [address])) as boolean;

      const ethBalanceHex = (await withTimeout(
        rpcCall('eth_getBalance', [address, 'latest'], 2800) as Promise<string>,
        3000,
        'eth_getBalance timed out'
      )) as string;
      const ethBalance = BigInt(ethBalanceHex || '0');

      const usdcBalance = await readErc20('balanceOf', [address as `0x${string}`]);
      const usdcAllowance = await readErc20('allowance', [address as `0x${string}`, NFT_CONTRACT_ADDRESS]);

      const state: WalletState = {
        address,
        canMint: canMint ?? false,
        nftBalance: nftBalance ?? 0n,
        nonce: nonce ?? 0n,
        isOnAllowlist: isOnAllowlist ?? false,
        isOnDenylist: isOnDenylist ?? false,
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

  // ============ FETCH BONUS LEVELS (SEQUENTIAL, NO HANGS) ============
  const fetchBonusLevels = useCallback(async (walletAddress?: string): Promise<BonusLevelInfo[]> => {
    const levels: BonusLevelInfo[] = [];
    let hadFailures = false;

    try {
      await verifyContractExists(Boolean(walletAddress));
    } catch (e) {
      console.error('[ContractReads] Bonus levels preflight failed:', e);
      setBonusLevels([]);
      return [];
    }

    // Fetch levels 1-10 (common range)
    for (let level = 1; level <= 10; level++) {
      try {
        const levelData = (await readNft('bonusLevels', [BigInt(level)])) as
          | [bigint, bigint, boolean, bigint, bigint, boolean]
          | null;

        if (levelData && levelData[2]) {
          // Only include active levels
          let canClaim = false;
          if (walletAddress) {
            canClaim = ((await readNft('canClaim', [walletAddress, BigInt(level)])) as boolean) ?? false;
          }

          levels.push({
            level,
            amountETH: levelData[0],
            amountUSDC: levelData[1],
            active: levelData[2],
            claimsRemaining: levelData[3],
            requiresNFT: levelData[5],
            canClaim,
          });
        }
      } catch (err) {
        hadFailures = true;
        console.error('[ContractReads] Bonus level read failed:', { level, err });
        // Non-fatal: keep rendering partial UI.
      }
    }

    if (hadFailures) {
      console.warn('[ContractReads] Some bonus level reads failed');
    }

    setBonusLevels(levels);
    return levels;
  }, []);

  // ============ CHECK IF OWNER ============
  // HARDCODED ADMIN ADDRESS - This is the sole gate for admin access
  // Do NOT rely on contract.owner() for authorization to prevent false negatives
  const ADMIN_ADDRESS = '0x830f4c15480aa516a0cc4826902443936f9596cf';
  
  const isOwner = useCallback((address: string): boolean => {
    if (!address) return false;
    // Case-insensitive comparison against hardcoded admin address
    return address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  }, []);

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
