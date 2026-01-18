import { useState, useCallback, useRef } from 'react';
import { encodeFunctionData, decodeFunctionResult } from 'viem';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_USDC_ADDRESS,
  CONTRACT_ABI,
  ERC20_ABI,
  CONFIG_CACHE_TTL,
  BALANCE_CACHE_TTL,
  PaymentCurrency,
} from '@/contracts/MemoryMintContract';
import {
  robustRpcCall,
  verifyContractWithCache,
  RPC_CONFIG,
  clearContractCodeCache,
} from '@/utils/rpcHandler';
import {
  fetchOwnerRobust,
  getCachedOwner,
  invalidateOwnerCache,
  subscribeToOwnershipEvents,
} from './useOwnerFetch';

// ============ TYPES ============
export interface ContractConfig {
  // Core state
  owner: string;
  paused: boolean;
  throttleEnabled: boolean;
  totalSupply: bigint;
  nextTokenId: bigint;
  
  // V3 Pause / Kill Switch (EXPLICITLY READ)
  mintPaused: boolean;
  killSwitch: boolean;
  
  // V3 Dynamic Pricing
  mintPriceETH: bigint;
  mintPriceUSDC: bigint;
  currentSupplyTier: number;
  maxSupply: bigint;
  maxBatchSize: bigint;
  
  // V3 Bonus Pools
  bonusPoolETH: bigint;
  bonusPoolUSDC: bigint;
  currentBonusTier: number;
  
  // V3 Fees
  totalFeesCollectedETH: bigint;
  totalFeesCollectedUSDC: bigint;
  
  // V3 Wallet Limits (EXPLICITLY READ)
  walletMintLimit: bigint;
  
  // V3 Anti-Bot Mode (EXPLICITLY READ) - 0=Disabled, 1=Signature, 2=Allowlist, 3=Hybrid
  antiBotMode: number;
  
  // V3 Claim Mode (EXPLICITLY READ) - 0=Disabled, 1=FCFS, 2=Unlimited, 3=OneTime, 4=Custom
  claimMode: number;
  
  // Compatibility fields
  mintEnabled: boolean;
  claimEnabled: boolean;
  ethEnabled: boolean;
  usdcEnabled: boolean;
  activeMintCurrency: PaymentCurrency;
  activeBonusCurrency: PaymentCurrency;
  mintCooldownBlocks: bigint;
  signatureRequired: boolean;
  
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
  mintCount: bigint;
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
  minMints: bigint;
  allowlistOnly: boolean;
}

export interface SupplyTierInfo {
  tier: number;
  threshold: bigint;
  priceETH: bigint;
  priceUSDC: bigint;
}

export interface BonusTierInfo {
  tier: number;
  threshold: bigint;
  multiplierBps: bigint;
}

// ============ CACHE ============
const configCache: { data: ContractConfig | null; timestamp: number } = { data: null, timestamp: 0 };
const walletCache: Map<string, { data: WalletState; timestamp: number }> = new Map();
let contractVerified = false;

// ============ ABI HELPERS ============
// Check if function exists in the verified BaseScan ABI
function abiHasFunction(functionName: string): boolean {
  const abiItems = CONTRACT_ABI as readonly any[];
  return abiItems.some(
    (i) => i && i.type === 'function' && typeof i.name === 'string' && i.name === functionName
  );
}

// List of ALL V3 functions that ARE supported (verified from BaseScan)
// Used to prevent false negatives in feature detection
const V3_SUPPORTED_FUNCTIONS = new Set([
  'owner', 'totalMinted', 'walletMintLimit', 'antiBotMode', 'claimMode',
  'mintPaused', 'claimsPaused', 'killSwitch', 'killed', 'mintPriceETH', 'mintPriceUSDC',
  'bonusPoolETH', 'bonusPoolUSDC', 'currencyConfig', 'eligibilityRules',
  'setMintPaused', 'setClaimsPaused', 'setWalletMintLimit', 'setAntiBotMode', 'setClaimMode',
  'setMintPrice', 'activateKillSwitch', 'deactivateKillSwitch', 'withdrawFees', 'emergencyWithdraw',
  'mint', 'mintNFT', 'mintWithUSDC', 'batchMint', 'mintTo', 'mintWithSignature',
  'claimBonus', 'getEffectiveBonus', 'getEffectiveMintPrice',
]);

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

  const result = await verifyContractWithCache(NFT_CONTRACT_ADDRESS);
  
  if (!result.exists) {
    console.error('[ContractReads] PREFLIGHT FAILED:', result.error, {
      address: NFT_CONTRACT_ADDRESS,
      chainId: await getConnectedChainId(),
    });
    throw new Error(
      result.error || `No contract found at ${NFT_CONTRACT_ADDRESS}. Verify the address is deployed on Base Mainnet (chainId 8453).`
    );
  }

  contractVerified = true;
  console.info('[ContractReads] Preflight passed: contract exists', {
    address: NFT_CONTRACT_ADDRESS,
    codeLength: result.code?.length,
  });
}

export function resetContractVerification(): void {
  contractVerified = false;
  clearContractCodeCache(NFT_CONTRACT_ADDRESS);
}

// ============ SINGLE ENTRYPOINT FOR NFT CONTRACT READS ============
async function readNft(functionName: string, args: unknown[] = [], optional = false): Promise<unknown> {
  if (!contractVerified) {
    throw new Error(`Contract preflight not verified; refusing to call ${functionName}`);
  }

  // Check if function exists in ABI
  if (!abiHasFunction(functionName)) {
    if (optional) {
      console.warn(`[ContractReads] ${functionName}() not in ABI — skipping (optional)`);
      return null;
    }
    throw new Error(`ABI missing function "${functionName}". Re-export ABI from deployed build.`);
  }

  console.info(`[ContractReads] Reading ${functionName}`);

  const data = encodeFunctionData({
    abi: CONTRACT_ABI as any,
    functionName: functionName as any,
    args: args as any[],
  });

  const result = await robustRpcCall<string>(
    'eth_call',
    [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
    { timeoutMs: RPC_CONFIG.defaultTimeoutMs }
  );

  if (!result.success) {
    if (optional) {
      console.warn(`[ContractReads] ${functionName}() failed — defaulting to null (optional):`, result.error);
      return null;
    }
    throw new Error(`${functionName} RPC failed: ${result.error}`);
  }

  // Handle empty result
  if (!result.data || result.data === '0x' || result.data === '') {
    if (optional) {
      console.warn(`[ContractReads] ${functionName}() returned empty — defaulting to null (optional)`);
      return null;
    }
    throw new Error(`${functionName} returned empty result`);
  }

  try {
    return decodeFunctionResult({
      abi: CONTRACT_ABI as any,
      functionName: functionName as any,
      data: result.data as `0x${string}`,
    });
  } catch (decodeErr) {
    if (optional) {
      console.warn(`[ContractReads] ${functionName}() decode failed — defaulting to null (optional)`);
      return null;
    }
    throw new Error(`${functionName} decode failed (ABI mismatch?)`);
  }
}

// ============ SAFE OPTIONAL READ HELPERS (NEVER THROW) ============
async function safeReadBoolean(fn: string, fallback: boolean): Promise<boolean> {
  if (!abiHasFunction(fn)) return fallback;
  try {
    const res = await readNft(fn, [], true);
    if (typeof res === 'boolean') return res;
    return fallback;
  } catch {
    return fallback;
  }
}

async function safeReadBigInt(fn: string, fallback: bigint, args: unknown[] = []): Promise<bigint> {
  if (!abiHasFunction(fn)) return fallback;
  try {
    const res = await readNft(fn, args, true);
    if (typeof res === 'bigint') return res;
    return fallback;
  } catch {
    return fallback;
  }
}

async function safeReadNumber(fn: string, fallback: number): Promise<number> {
  if (!abiHasFunction(fn)) return fallback;
  try {
    const res = await readNft(fn, [], true);
    if (typeof res === 'number') return res;
    if (typeof res === 'bigint') return Number(res);
    return fallback;
  } catch {
    return fallback;
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

  const result = await robustRpcCall<string>(
    'eth_call',
    [{ to: BASE_USDC_ADDRESS, data }, 'latest'],
    { timeoutMs: RPC_CONFIG.defaultTimeoutMs }
  );

  if (!result.success || !result.data || result.data === '0x' || result.data === '') {
    return 0n;
  }

  try {
    return decodeFunctionResult({
      abi: ERC20_ABI,
      functionName,
      data: result.data as `0x${string}`,
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
  const [supplyTiers, setSupplyTiers] = useState<SupplyTierInfo[]>([]);
  const [bonusTiers, setBonusTiers] = useState<BonusTierInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingConfigRef = useRef(false);
  const isFetchingWalletRef = useRef(false);

  // ============ FETCH CONTRACT CONFIG ============
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

    const chainId = await getConnectedChainId();

    const readStep = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
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

      // Verify only REQUIRED methods exist in ABI - V3 uses totalMinted not totalSupply
      const requiredMethods = ['owner', 'totalMinted'];
      for (const fn of requiredMethods) {
        if (!abiHasFunction(fn)) {
          throw new Error(`ABI missing required function "${fn}"`);
        }
      }

      // Use the robust owner fetch utility with caching and retry logic
      console.info('[ContractReads] Fetching owner using robust utility...');
      const ownerResult = await fetchOwnerRobust({
        forceRefresh: force,
        onAttempt: (attempt, max) => {
          console.info(`[ContractReads] owner() attempt ${attempt}/${max}`);
        },
        onError: (error, attempt) => {
          console.warn(`[ContractReads] owner() attempt ${attempt} error:`, error);
        },
      });
      
      if (!ownerResult.owner) {
        throw new Error(`owner() returned empty after ${ownerResult.attempts} attempts: ${ownerResult.error}`);
      }
      
      const owner = ownerResult.owner;
      console.info('[ContractReads] Owner fetched successfully:', owner.slice(0, 10) + '...');

      const totalSupply = (await readStep('totalMinted()', async () => readNft('totalMinted'))) as bigint;

      // OPTIONAL reads in parallel - EXPLICITLY READ ALL V3 FIELDS
      // V3 has: mintPaused, killSwitch, walletMintLimit, antiBotMode, claimMode
      const [
        mintPausedRes,
        killSwitchRes,
        mintPriceETHRes,
        mintPriceUSDCRes,
        currentSupplyTierRes,
        bonusPoolETHRes,
        bonusPoolUSDCRes,
        currentBonusTierRes,
        totalFeesETHRes,
        totalFeesUSDCRes,
        // V3 EXPLICIT READS
        walletMintLimitRes,
        antiBotModeRes,
        claimModeRes,
      ] = await Promise.allSettled([
        safeReadBoolean('mintPaused', false),
        safeReadBoolean('killSwitch', false),
        safeReadBigInt('mintPriceETH', 0n),
        safeReadBigInt('mintPriceUSDC', 0n),
        safeReadNumber('currentSupplyTier', 0),
        safeReadBigInt('bonusPoolETH', 0n),
        safeReadBigInt('bonusPoolUSDC', 0n),
        safeReadNumber('currentBonusTier', 0),
        safeReadBigInt('totalFeesCollectedETH', 0n),
        safeReadBigInt('totalFeesCollectedUSDC', 0n),
        // V3 EXPLICIT READS
        safeReadBigInt('walletMintLimit', 0n),
        safeReadNumber('antiBotMode', 0),
        safeReadNumber('claimMode', 0),
      ]);

      const mintPaused = mintPausedRes.status === 'fulfilled' ? mintPausedRes.value : false;
      const killSwitch = killSwitchRes.status === 'fulfilled' ? killSwitchRes.value : false;
      const mintPriceETH = mintPriceETHRes.status === 'fulfilled' ? mintPriceETHRes.value : 0n;
      const mintPriceUSDC = mintPriceUSDCRes.status === 'fulfilled' ? mintPriceUSDCRes.value : 0n;
      const currentSupplyTier = currentSupplyTierRes.status === 'fulfilled' ? currentSupplyTierRes.value : 0;
      const bonusPoolETH = bonusPoolETHRes.status === 'fulfilled' ? bonusPoolETHRes.value : 0n;
      const bonusPoolUSDC = bonusPoolUSDCRes.status === 'fulfilled' ? bonusPoolUSDCRes.value : 0n;
      const currentBonusTier = currentBonusTierRes.status === 'fulfilled' ? currentBonusTierRes.value : 0;
      const totalFeesCollectedETH = totalFeesETHRes.status === 'fulfilled' ? totalFeesETHRes.value : 0n;
      const totalFeesCollectedUSDC = totalFeesUSDCRes.status === 'fulfilled' ? totalFeesUSDCRes.value : 0n;
      // V3 EXPLICIT FIELDS
      const walletMintLimit = walletMintLimitRes.status === 'fulfilled' ? walletMintLimitRes.value : 0n;
      const antiBotMode = antiBotModeRes.status === 'fulfilled' ? antiBotModeRes.value : 0;
      const claimMode = claimModeRes.status === 'fulfilled' ? claimModeRes.value : 0;

      const paused = mintPaused || killSwitch;
      const isFreeMint = mintPriceETH === 0n && mintPriceUSDC === 0n;

      console.info('[ContractReads] V3 fields read:', {
        mintPaused,
        killSwitch,
        walletMintLimit: walletMintLimit.toString(),
        antiBotMode,
        claimMode,
      });

      // Build config - V3 FULL FEATURED
      const configData: ContractConfig = {
        owner,
        paused,
        throttleEnabled: antiBotMode > 0,
        totalSupply,
        nextTokenId: totalSupply + 1n,
        
        // V3 Pause / Kill Switch (EXPLICIT)
        mintPaused,
        killSwitch,
        
        // V3 Dynamic Pricing
        mintPriceETH,
        mintPriceUSDC,
        currentSupplyTier,
        maxSupply: 0n, // Unlimited in V3
        maxBatchSize: 50n, // MAX_BATCH_SIZE constant in V3
        
        // V3 Bonus Pools
        bonusPoolETH,
        bonusPoolUSDC,
        currentBonusTier,
        
        // V3 Fees
        totalFeesCollectedETH,
        totalFeesCollectedUSDC,
        
        // V3 Wallet Limits (EXPLICIT)
        walletMintLimit,
        
        // V3 Anti-Bot Mode (EXPLICIT)
        antiBotMode,
        
        // V3 Claim Mode (EXPLICIT)
        claimMode,
        
        // Compatibility fields
        mintEnabled: !paused,
        claimEnabled: bonusPoolETH > 0n || bonusPoolUSDC > 0n || claimMode > 0,
        ethEnabled: true,
        usdcEnabled: true, // V3 always supports USDC
        activeMintCurrency: 'ETH',
        activeBonusCurrency: 'ETH',
        mintCooldownBlocks: 0n,
        signatureRequired: antiBotMode === 1 || antiBotMode === 3, // Signature or Hybrid mode
        
        lastFetched: now,
        isLoaded: true,
      };

      console.info('[ContractReads] Config built', {
        owner,
        totalSupply: totalSupply.toString(),
        mintPriceETH: mintPriceETH.toString(),
        bonusPoolETH: bonusPoolETH.toString(),
        isFreeMint,
      });

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

  // ============ FETCH SUPPLY TIERS ============
  const fetchSupplyTiers = useCallback(async (): Promise<SupplyTierInfo[]> => {
    if (!abiHasFunction('supplyTierCount') || !abiHasFunction('getSupplyTier')) {
      return [];
    }

    try {
      await verifyContractExists(false);
      const tierCount = await safeReadNumber('supplyTierCount', 0);
      
      const tiers: SupplyTierInfo[] = [];
      for (let i = 0; i < tierCount; i++) {
        try {
          const tierData = await readNft('getSupplyTier', [i], true) as [bigint, bigint, bigint] | null;
          if (tierData) {
            tiers.push({
              tier: i,
              threshold: tierData[0],
              priceETH: tierData[1],
              priceUSDC: tierData[2],
            });
          }
        } catch {
          console.warn(`[ContractReads] Failed to fetch supply tier ${i}`);
        }
      }

      setSupplyTiers(tiers);
      return tiers;
    } catch (err) {
      console.error('[ContractReads] Failed to fetch supply tiers:', err);
      return [];
    }
  }, []);

  // ============ FETCH BONUS TIERS ============
  const fetchBonusTiers = useCallback(async (): Promise<BonusTierInfo[]> => {
    if (!abiHasFunction('getBonusTier')) {
      return [];
    }

    try {
      await verifyContractExists(false);
      
      const tiers: BonusTierInfo[] = [];
      // Fetch up to 10 tiers
      for (let i = 0; i < 10; i++) {
        try {
          const tierData = await readNft('getBonusTier', [i], true) as [bigint, bigint] | null;
          if (tierData && tierData[0] > 0n) {
            tiers.push({
              tier: i,
              threshold: tierData[0],
              multiplierBps: tierData[1],
            });
          } else {
            break; // No more tiers
          }
        } catch {
          break;
        }
      }

      setBonusTiers(tiers);
      return tiers;
    } catch (err) {
      console.error('[ContractReads] Failed to fetch bonus tiers:', err);
      return [];
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

      // Get ETH balance using robust RPC
      const ethBalanceResult = await robustRpcCall<string>(
        'eth_getBalance',
        [address, 'latest'],
        { timeoutMs: RPC_CONFIG.defaultTimeoutMs }
      );
      const ethBalance = ethBalanceResult.success ? BigInt(ethBalanceResult.data || '0') : 0n;

      // Get USDC balance
      const usdcBalance = await readErc20('balanceOf', [address as `0x${string}`]);
      const usdcAllowance = await readErc20('allowance', [address as `0x${string}`, NFT_CONTRACT_ADDRESS]);

      // Get mint count if available
      const mintCount = await safeReadBigInt('walletMintCount', 0n, [address]);

      // Check allowlist status if available
      const isOnAllowlist = abiHasFunction('isAllowlisted') 
        ? await safeReadBoolean('isAllowlisted', true)
        : true;

      const state: WalletState = {
        address,
        canMint: true,
        nftBalance: nftBalance ?? 0n,
        nonce: 0n,
        isOnAllowlist,
        isOnDenylist: false,
        ethBalance,
        usdcBalance,
        usdcAllowance,
        mintCount,
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
    if (!abiHasFunction('getBonusLevel')) {
      setBonusLevels([]);
      return [];
    }

    try {
      await verifyContractExists(false);
      
      const levels: BonusLevelInfo[] = [];
      // Fetch levels 1-20 (typical game levels)
      for (let i = 1; i <= 20; i++) {
        try {
          const levelData = await readNft('getBonusLevel', [i], true) as [bigint, boolean, bigint, bigint, boolean] | null;
          if (levelData) {
            const [minMints, active, baseAmountETH, baseAmountUSDC, allowlistOnly] = levelData;
            
            // Get dynamic amounts
            const amountETH = await safeReadBigInt('getBonusAmountETH', baseAmountETH, [i]);
            const amountUSDC = await safeReadBigInt('getBonusAmountUSDC', baseAmountUSDC, [i]);
            
            // Check eligibility if wallet provided
            let canClaim = false;
            if (walletAddress && abiHasFunction('canClaimBonus')) {
              try {
                const eligibility = await readNft('canClaimBonus', [walletAddress, i], true) as [boolean, string] | null;
                canClaim = eligibility?.[0] ?? false;
              } catch {
                canClaim = false;
              }
            }

            levels.push({
              level: i,
              amountETH,
              amountUSDC,
              active,
              claimsRemaining: 0n, // Not tracked per-level
              requiresNFT: minMints > 0n,
              canClaim,
              minMints,
              allowlistOnly,
            });
          }
        } catch {
          // Level doesn't exist, continue
        }
      }

      setBonusLevels(levels);
      return levels;
    } catch (err) {
      console.error('[ContractReads] Failed to fetch bonus levels:', err);
      return [];
    }
  }, []);

  // ============ INVALIDATE CACHE ============
  const invalidateCache = useCallback(() => {
    configCache.data = null;
    configCache.timestamp = 0;
    walletCache.clear();
    contractVerified = false;
    clearContractCodeCache();
  }, []);

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

  // Format bonus pool
  const getFormattedBonusPool = useCallback(() => {
    if (!config) return { eth: '0.00', usdc: '0.00' };
    const ethValue = Number(config.bonusPoolETH) / 1e18;
    const usdcValue = Number(config.bonusPoolUSDC) / 1e6;
    return {
      eth: ethValue.toFixed(4),
      usdc: usdcValue.toFixed(2),
    };
  }, [config]);

  // Format fees collected
  const getFormattedFees = useCallback(() => {
    if (!config) return { eth: '0.00', usdc: '0.00' };
    const ethValue = Number(config.totalFeesCollectedETH) / 1e18;
    const usdcValue = Number(config.totalFeesCollectedUSDC) / 1e6;
    return {
      eth: ethValue.toFixed(4),
      usdc: usdcValue.toFixed(2),
    };
  }, [config]);

  // Check if connected wallet is owner
  const isOwner = useCallback((address?: string) => {
    if (!address || !config?.owner) return false;
    return address.toLowerCase() === config.owner.toLowerCase();
  }, [config?.owner]);

  return {
    config,
    walletState,
    bonusLevels,
    supplyTiers,
    bonusTiers,
    isLoading,
    error,
    fetchContractConfig,
    fetchWalletState,
    fetchBonusLevels,
    fetchSupplyTiers,
    fetchBonusTiers,
    invalidateCache,
    invalidateConfigCache,
    invalidateWalletCache,
    getFormattedBonusPool,
    getFormattedFees,
    isOwner,
  };
}
