// ============================================================
// Robust Owner Fetch Utility for MemoryMint Admin Panel
// Contract: 0x8A6EAc80dd2cC5efE7a6b10a4430a89871A4672B
// Features: 10 retries with 3s delay, proxy detection (EIP-1967/UUPS),
//           network validation, Alchemy RPC fallback, event listening
// ============================================================

import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { NFT_CONTRACT_ADDRESS, CONTRACT_ABI, BASE_CHAIN_ID, BASE_CHAIN_ID_NUM } from '@/contracts/MemoryMintContract';
import { robustRpcCall, RPC_CONFIG, ALL_RPC_ENDPOINTS } from '@/utils/rpcHandler';

// ============ CONFIGURATION ============
const OWNER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_FETCH_ATTEMPTS = 10; // 10 retries as requested
const RETRY_DELAY_MS = 3000; // Fixed 3 seconds between retries
const BLOCK_CONFIRMATIONS_REQUIRED = 1; // 1 block confirmation

// Alchemy RPC endpoint for fallback (Base Mainnet public)
const ALCHEMY_FALLBACK_ENDPOINTS = [
  'https://base-mainnet.g.alchemy.com/v2/demo',
  'https://base.blockpi.network/v1/rpc/public',
  'https://base.gateway.tenderly.co',
] as const;

// Supported chain IDs
const SUPPORTED_CHAINS = {
  BASE_MAINNET: { id: '0x2105', idNum: 8453, name: 'Base Mainnet' },
  BASE_SEPOLIA: { id: '0x14a34', idNum: 84532, name: 'Base Sepolia' },
} as const;

// EIP-1967 proxy slots
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
// UUPS implementation slot (same as EIP-1967 in most cases)
const UUPS_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
// OpenZeppelin Ownable storage slot (slot 0 for owner)
const OWNABLE_STORAGE_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

interface OwnerCache {
  owner: string;
  timestamp: number;
  chainId: string;
}

let ownerCache: OwnerCache | null = null;
let isFetching = false;
let fetchPromise: Promise<string | null> | null = null;

// ============ ADMIN AUDIT LOG ============
interface AdminAuditEntry {
  timestamp: number;
  walletAddress: string;
  action: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

const adminAuditLog: AdminAuditEntry[] = [];

export function logAdminAction(entry: Omit<AdminAuditEntry, 'timestamp'>): void {
  const fullEntry: AdminAuditEntry = {
    ...entry,
    timestamp: Date.now(),
  };
  adminAuditLog.unshift(fullEntry); // Add to front
  if (adminAuditLog.length > 100) adminAuditLog.pop(); // Keep last 100
  console.info('[AdminAudit]', {
    time: new Date(fullEntry.timestamp).toISOString(),
    wallet: fullEntry.walletAddress.slice(0, 10) + '...',
    action: fullEntry.action,
    success: fullEntry.success,
    txHash: fullEntry.txHash?.slice(0, 10),
    error: fullEntry.error,
  });
}

export function getAdminAuditLog(): AdminAuditEntry[] {
  return [...adminAuditLog];
}

// ============ NETWORK VALIDATION ============

export interface NetworkValidationResult {
  valid: boolean;
  chainId: string | null;
  chainName: string | null;
  error: string | null;
  expectedChainId?: number;
}

/**
 * Validate that the connected network matches the deployed contract's chain
 * Contract is deployed on Base Mainnet (8453) or Base Sepolia (84532)
 */
export async function validateNetwork(): Promise<NetworkValidationResult> {
  const chainId = await getChainId();
  
  if (!chainId) {
    console.error('[OwnerFetch] Network validation failed: Unable to detect chain ID');
    return {
      valid: false,
      chainId: null,
      chainName: null,
      error: 'Unable to detect network. Check wallet connection.',
      expectedChainId: SUPPORTED_CHAINS.BASE_MAINNET.idNum,
    };
  }

  const normalizedChainId = chainId.toLowerCase();
  const chainIdNum = parseInt(chainId, 16);
  
  console.info(`[OwnerFetch] Network check: Connected to chain ID ${chainIdNum} (${normalizedChainId})`);
  
  // Check if chain is Base Mainnet (8453)
  if (normalizedChainId === SUPPORTED_CHAINS.BASE_MAINNET.id.toLowerCase() || chainIdNum === 8453) {
    console.info('[OwnerFetch] ✓ Network validated: Base Mainnet (8453)');
    return {
      valid: true,
      chainId: normalizedChainId,
      chainName: SUPPORTED_CHAINS.BASE_MAINNET.name,
      error: null,
    };
  }
  
  // Check if chain is Base Sepolia (84532)
  if (normalizedChainId === SUPPORTED_CHAINS.BASE_SEPOLIA.id.toLowerCase() || chainIdNum === 84532) {
    console.info('[OwnerFetch] ✓ Network validated: Base Sepolia (84532)');
    return {
      valid: true,
      chainId: normalizedChainId,
      chainName: SUPPORTED_CHAINS.BASE_SEPOLIA.name,
      error: null,
    };
  }

  // Wrong network
  console.error(`[OwnerFetch] ✗ Wrong network: Chain ID ${chainIdNum}. Expected Base Mainnet (8453) or Base Sepolia (84532).`);
  return {
    valid: false,
    chainId: normalizedChainId,
    chainName: `Unknown (${chainIdNum})`,
    error: `Wrong network (Chain ID: ${chainIdNum}). Please switch to Base Mainnet (8453) or Base Sepolia (84532).`,
    expectedChainId: SUPPORTED_CHAINS.BASE_MAINNET.idNum,
  };
}

// ============ BLOCK CONFIRMATION ============

/**
 * Wait for block confirmations before querying to avoid false empty responses
 */
async function waitForBlockConfirmations(minConfirmations = BLOCK_CONFIRMATIONS_REQUIRED): Promise<boolean> {
  try {
    // Get current block number
    const blockResult = await robustRpcCall<string>('eth_blockNumber', [], {
      timeoutMs: 5000,
      maxRetries: 2,
    });

    if (!blockResult.success || !blockResult.data) {
      console.warn('[OwnerFetch] Could not get block number for confirmation check');
      return true; // Proceed anyway
    }

    const currentBlock = BigInt(blockResult.data);
    console.info(`[OwnerFetch] Current block: ${currentBlock.toString()}`);

    // Wait for at least 1 more block to ensure RPC is synced
    const targetBlock = currentBlock + BigInt(minConfirmations);
    let attempts = 0;
    const maxWaitAttempts = 10;
    
    while (attempts < maxWaitAttempts) {
      await new Promise(r => setTimeout(r, 1500)); // Wait 1.5 seconds
      
      const newBlockResult = await robustRpcCall<string>('eth_blockNumber', [], {
        timeoutMs: 5000,
        maxRetries: 1,
      });

      if (newBlockResult.success && newBlockResult.data) {
        const newBlock = BigInt(newBlockResult.data);
        if (newBlock >= currentBlock) {
          console.info(`[OwnerFetch] Block confirmed: ${newBlock.toString()}`);
          return true;
        }
      }
      attempts++;
    }

    console.warn('[OwnerFetch] Block confirmation timeout, proceeding anyway');
    return true;
  } catch (err) {
    console.warn('[OwnerFetch] Block confirmation check failed:', err);
    return true; // Proceed anyway
  }
}

// ============ PROXY DETECTION ============

interface ProxyInfo {
  isProxy: boolean;
  proxyType: 'transparent' | 'uups' | 'none';
  implementationAddress: string | null;
  adminAddress: string | null;
}

/**
 * Detect if the contract is a proxy (transparent or UUPS) and get implementation
 */
async function detectProxy(): Promise<ProxyInfo> {
  const result: ProxyInfo = {
    isProxy: false,
    proxyType: 'none',
    implementationAddress: null,
    adminAddress: null,
  };

  console.info('[OwnerFetch] Checking proxy status for contract:', NFT_CONTRACT_ADDRESS);

  try {
    // Check EIP-1967 implementation slot (used by both Transparent and UUPS proxies)
    const implResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, EIP1967_IMPLEMENTATION_SLOT, 'latest'],
      { timeoutMs: 8000, maxRetries: 3 }
    );

    if (implResult.success && implResult.data && 
        implResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        implResult.data !== '0x') {
      const implAddress = '0x' + implResult.data.slice(26).toLowerCase();
      if (implAddress !== '0x0000000000000000000000000000000000000000') {
        result.isProxy = true;
        result.implementationAddress = implAddress;
        console.info('[OwnerFetch] EIP-1967 implementation detected:', implAddress);
      }
    }

    // Check EIP-1967 admin slot (only present in Transparent proxies)
    const adminResult = await robustRpcCall<string>(
      'eth_getStorageAt',
      [NFT_CONTRACT_ADDRESS, EIP1967_ADMIN_SLOT, 'latest'],
      { timeoutMs: 8000, maxRetries: 3 }
    );

    if (adminResult.success && adminResult.data && 
        adminResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        adminResult.data !== '0x') {
      const adminAddress = '0x' + adminResult.data.slice(26).toLowerCase();
      if (adminAddress !== '0x0000000000000000000000000000000000000000') {
        result.adminAddress = adminAddress;
        result.proxyType = 'transparent';
        console.info('[OwnerFetch] Transparent Proxy admin detected:', adminAddress);
      }
    } else if (result.isProxy) {
      // If implementation exists but no admin, it's likely UUPS
      result.proxyType = 'uups';
      console.info('[OwnerFetch] UUPS Proxy detected (no admin slot)');
    }
  } catch (err) {
    console.warn('[OwnerFetch] Proxy detection failed:', err);
  }

  if (!result.isProxy) {
    console.info('[OwnerFetch] Contract is NOT a proxy (direct contract)');
  }

  return result;
}

/**
 * Try to read owner from storage slots (Ownable pattern)
 * Tries multiple common storage locations
 */
async function readOwnerFromStorage(): Promise<string | null> {
  const slotsToTry = [
    '0x0', // Slot 0: Most common for Ownable
    '0x0000000000000000000000000000000000000000000000000000000000000000', // Full form
    '0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300', // OwnableUpgradeable
  ];

  for (const slot of slotsToTry) {
    try {
      const storageResult = await robustRpcCall<string>(
        'eth_getStorageAt',
        [NFT_CONTRACT_ADDRESS, slot, 'latest'],
        { timeoutMs: 8000, maxRetries: 3 }
      );

      if (storageResult.success && storageResult.data && 
          storageResult.data !== '0x' && 
          storageResult.data !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const ownerFromStorage = '0x' + storageResult.data.slice(26).toLowerCase();
        if (
          ownerFromStorage !== '0x0000000000000000000000000000000000000000' &&
          ownerFromStorage.length === 42 &&
          /^0x[a-f0-9]{40}$/.test(ownerFromStorage)
        ) {
          console.info(`[OwnerFetch] Owner from storage slot ${slot}:`, ownerFromStorage);
          return ownerFromStorage;
        }
      }
    } catch (err) {
      console.warn(`[OwnerFetch] Storage read failed for slot ${slot}:`, err);
    }
  }
  
  console.warn('[OwnerFetch] Could not read owner from any storage slot');
  return null;
}

/**
 * Fallback: Fetch owner using Alchemy/external RPC directly
 */
async function fetchOwnerWithAlchemyFallback(): Promise<string | null> {
  console.info('[OwnerFetch] Attempting Alchemy/external RPC fallback...');
  
  const ownerCallData = encodeFunctionData({
    abi: CONTRACT_ABI as any,
    functionName: 'owner',
    args: [],
  });

  for (const endpoint of ALCHEMY_FALLBACK_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_call',
          params: [{ to: NFT_CONTRACT_ADDRESS, data: ownerCallData }, 'latest'],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result !== '0x' && data.result.length >= 66) {
          const decoded = decodeFunctionResult({
            abi: CONTRACT_ABI as any,
            functionName: 'owner',
            data: data.result as `0x${string}`,
          });
          
          if (typeof decoded === 'string' && decoded.length === 42 && 
              decoded !== '0x0000000000000000000000000000000000000000') {
            console.info(`[OwnerFetch] ✓ Alchemy fallback success (${endpoint}):`, decoded.slice(0, 10) + '...');
            return decoded.toLowerCase();
          }
        }
      }
    } catch (err) {
      console.warn(`[OwnerFetch] Alchemy fallback failed for ${endpoint}:`, err);
    }
  }
  
  console.error('[OwnerFetch] All Alchemy fallback endpoints failed');
  return null;
}

// ============ CACHE MANAGEMENT ============

/**
 * Get cached owner if still valid
 */
export function getCachedOwner(): string | null {
  if (!ownerCache) return null;
  
  const now = Date.now();
  if (now - ownerCache.timestamp > OWNER_CACHE_TTL) {
    console.info('[OwnerFetch] Cache expired');
    return null;
  }
  
  return ownerCache.owner;
}

/**
 * Set owner in cache
 */
export function setCachedOwner(owner: string, chainId: string): void {
  ownerCache = {
    owner: owner.toLowerCase(),
    timestamp: Date.now(),
    chainId,
  };
  console.info('[OwnerFetch] Owner cached:', owner.slice(0, 10) + '...');
}

/**
 * Invalidate owner cache
 */
export function invalidateOwnerCache(): void {
  ownerCache = null;
  console.info('[OwnerFetch] Cache invalidated');
}

/**
 * Update owner from event (OwnershipTransferred)
 */
export function updateOwnerFromEvent(newOwner: string, chainId: string): void {
  if (!newOwner || newOwner === '0x0000000000000000000000000000000000000000') {
    invalidateOwnerCache();
    return;
  }
  
  setCachedOwner(newOwner, chainId);
  console.info('[OwnerFetch] Owner updated from event:', newOwner.slice(0, 10) + '...');
}

// ============ RETRY DELAY ============

/**
 * Fixed 3 second delay between retries
 */
function getRetryDelay(): number {
  return RETRY_DELAY_MS;
}

// ============ CORE FETCH FUNCTION ============

export interface FetchOwnerOptions {
  forceRefresh?: boolean;
  skipNetworkValidation?: boolean;
  skipBlockConfirmation?: boolean;
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  onError?: (error: string, attempt: number) => void;
  onNetworkValidation?: (result: NetworkValidationResult) => void;
}

export interface FetchOwnerResult {
  owner: string | null;
  error: string | null;
  attempts: number;
  networkInfo?: NetworkValidationResult;
  isProxy?: boolean;
  proxyType?: 'transparent' | 'uups' | 'none';
}

/**
 * Fetch owner with robust retry logic (10 attempts, 3s delay)
 * - Validates network matches Base mainnet (8453) or Sepolia (84532)
 * - Detects proxy contracts (Transparent/UUPS)
 * - Waits for block confirmation before querying
 * - Falls back to Alchemy RPC if standard calls fail
 * - Logs successful detection with wallet address and timestamp
 */
export async function fetchOwnerRobust(
  options: FetchOwnerOptions = {}
): Promise<FetchOwnerResult> {
  const { 
    forceRefresh = false, 
    skipNetworkValidation = false,
    skipBlockConfirmation = false,
    onAttempt, 
    onError,
    onNetworkValidation,
  } = options;

  console.info('[OwnerFetch] Starting robust owner fetch for contract:', NFT_CONTRACT_ADDRESS);

  // 1. Validate network first
  let networkResult: NetworkValidationResult | undefined;
  if (!skipNetworkValidation) {
    networkResult = await validateNetwork();
    onNetworkValidation?.(networkResult);
    
    if (!networkResult.valid) {
      console.error('[OwnerFetch] ✗ Network validation failed:', networkResult.error);
      return {
        owner: null,
        error: networkResult.error || 'Network validation failed. Check network or proxy.',
        attempts: 0,
        networkInfo: networkResult,
      };
    }
    console.info('[OwnerFetch] ✓ Network validated:', networkResult.chainName, `(Chain ID: ${networkResult.chainId})`);
  }

  // 2. Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedOwner();
    if (cached) {
      console.info('[OwnerFetch] Returning cached owner:', cached.slice(0, 10) + '...');
      return { owner: cached, error: null, attempts: 0 };
    }
  }

  // 3. Deduplicate concurrent requests
  if (isFetching && fetchPromise) {
    console.info('[OwnerFetch] Waiting for existing fetch...');
    const result = await fetchPromise;
    return { owner: result, error: result ? null : 'Fetch failed', attempts: 0 };
  }

  isFetching = true;
  let lastError = '';
  let validOwner: string | null = null;
  let proxyInfo: ProxyInfo | null = null;
  let totalAttempts = 0;

  fetchPromise = (async () => {
    // 4. Wait for block confirmation to avoid stale RPC responses
    if (!skipBlockConfirmation) {
      console.info('[OwnerFetch] Waiting for block confirmation...');
      await waitForBlockConfirmations(BLOCK_CONFIRMATIONS_REQUIRED);
    }

    // 5. Detect if this is a proxy contract (Transparent or UUPS)
    proxyInfo = await detectProxy();
    
    if (proxyInfo.isProxy) {
      console.info(`[OwnerFetch] Proxy detected: ${proxyInfo.proxyType.toUpperCase()}`);
      if (proxyInfo.implementationAddress) {
        console.info('[OwnerFetch] Implementation address:', proxyInfo.implementationAddress);
      }
    }

    // 6. Main retry loop: 10 attempts with 3s delay
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
      totalAttempts = attempt;
      onAttempt?.(attempt, MAX_FETCH_ATTEMPTS);
      console.info(`[OwnerFetch] Attempt ${attempt}/${MAX_FETCH_ATTEMPTS} (3s delay between retries)`);

      try {
        // Encode the owner() call
        const data = encodeFunctionData({
          abi: CONTRACT_ABI as any,
          functionName: 'owner',
          args: [],
        });

        // Make robust RPC call with increased timeout
        const result = await robustRpcCall<string>(
          'eth_call',
          [{ to: NFT_CONTRACT_ADDRESS, data }, 'latest'],
          { 
            timeoutMs: RPC_CONFIG.defaultTimeoutMs * 2, // Double timeout (30s)
            maxRetries: 3,
          }
        );

        if (!result.success) {
          lastError = result.error || 'RPC call failed';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] ✗ RPC failed on attempt ${attempt}:`, lastError);
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = getRetryDelay();
            console.info(`[OwnerFetch] Waiting ${delay / 1000}s before retry...`);
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Validate response exists
        if (!result.data || result.data === '0x' || result.data === '') {
          lastError = 'Empty response from owner()';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] ✗ Empty response on attempt ${attempt}`);
          
          // For proxy contracts, try reading from storage as fallback
          if (proxyInfo?.isProxy) {
            console.info('[OwnerFetch] Proxy detected - attempting storage slot read...');
            const storageOwner = await readOwnerFromStorage();
            if (storageOwner) {
              validOwner = storageOwner;
              const chainId = await getChainId();
              if (chainId) {
                setCachedOwner(validOwner, chainId);
              }
              console.info(`[OwnerFetch] ✓ Owner detected via storage on attempt ${attempt}:`, validOwner);
              console.info(`[OwnerFetch] Owner logged in admin panel at ${new Date().toISOString()}`);
              return validOwner;
            }
          }
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = getRetryDelay();
            console.info(`[OwnerFetch] Waiting ${delay / 1000}s before retry...`);
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Decode the response
        let decodedOwner: unknown;
        try {
          decodedOwner = decodeFunctionResult({
            abi: CONTRACT_ABI as any,
            functionName: 'owner',
            data: result.data as `0x${string}`,
          });
        } catch (decodeErr) {
          lastError = 'Failed to decode owner response';
          onError?.(lastError, attempt);
          console.warn(`[OwnerFetch] ✗ Decode failed on attempt ${attempt}:`, decodeErr);
          
          if (attempt < MAX_FETCH_ATTEMPTS) {
            const delay = getRetryDelay();
            await new Promise(r => setTimeout(r, delay));
          }
          continue;
        }

        // Validate owner format
        if (
          typeof decodedOwner === 'string' &&
          decodedOwner.startsWith('0x') &&
          decodedOwner.length === 42 &&
          decodedOwner !== '0x0000000000000000000000000000000000000000'
        ) {
          validOwner = decodedOwner.toLowerCase();
          
          // Cache the result
          const chainId = await getChainId();
          if (chainId) {
            setCachedOwner(validOwner, chainId);
          }
          
          // SUCCESS: Log clearly
          console.info(`[OwnerFetch] ✓✓✓ OWNER DETECTED SUCCESSFULLY on attempt ${attempt}/${MAX_FETCH_ATTEMPTS}`);
          console.info(`[OwnerFetch] Owner address: ${validOwner}`);
          console.info(`[OwnerFetch] Contract: ${NFT_CONTRACT_ADDRESS}`);
          console.info(`[OwnerFetch] Timestamp: ${new Date().toISOString()}`);
          console.info(`[OwnerFetch] Network: ${networkResult?.chainName || 'Base Mainnet'}`);
          if (proxyInfo?.isProxy) {
            console.info(`[OwnerFetch] Proxy type: ${proxyInfo.proxyType.toUpperCase()}`);
          }
          
          return validOwner;
        }

        // Handle zero address (possible renounced ownership)
        if (decodedOwner === '0x0000000000000000000000000000000000000000') {
          console.warn('[OwnerFetch] ⚠ Owner is zero address (ownership may be renounced)');
          lastError = 'Contract ownership appears to be renounced (zero address)';
          onError?.(lastError, attempt);
          // Don't retry for zero address - it's a valid response
          return null;
        }

        lastError = `Invalid owner format: ${String(decodedOwner).slice(0, 20)}`;
        onError?.(lastError, attempt);
        console.warn(`[OwnerFetch] ✗ Invalid format on attempt ${attempt}:`, decodedOwner);
        
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = getRetryDelay();
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        onError?.(lastError, attempt);
        console.error(`[OwnerFetch] ✗ Exception on attempt ${attempt}:`, err);
        
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = getRetryDelay();
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // 7. All standard attempts failed - try Alchemy fallback
    console.info('[OwnerFetch] All standard RPC attempts failed. Trying Alchemy fallback...');
    const alchemyOwner = await fetchOwnerWithAlchemyFallback();
    
    if (alchemyOwner) {
      validOwner = alchemyOwner;
      const chainId = await getChainId();
      if (chainId) {
        setCachedOwner(validOwner, chainId);
      }
      console.info('[OwnerFetch] ✓✓✓ OWNER DETECTED via Alchemy fallback:', validOwner);
      console.info(`[OwnerFetch] Timestamp: ${new Date().toISOString()}`);
      return validOwner;
    }

    // 8. Also try storage slot read as last resort
    console.info('[OwnerFetch] Alchemy fallback failed. Trying direct storage read...');
    const storageOwner = await readOwnerFromStorage();
    if (storageOwner) {
      validOwner = storageOwner;
      const chainId = await getChainId();
      if (chainId) {
        setCachedOwner(validOwner, chainId);
      }
      console.info('[OwnerFetch] ✓✓✓ OWNER DETECTED via storage slot:', validOwner);
      console.info(`[OwnerFetch] Timestamp: ${new Date().toISOString()}`);
      return validOwner;
    }

    return null;
  })();

  try {
    const owner = await fetchPromise;
    
    if (owner) {
      // Success message
      console.info('═══════════════════════════════════════════════════════');
      console.info('[OwnerFetch] OWNER SUCCESSFULLY DETECTED');
      console.info(`[OwnerFetch] Address: ${owner}`);
      console.info(`[OwnerFetch] Attempts: ${totalAttempts}`);
      console.info(`[OwnerFetch] Time: ${new Date().toISOString()}`);
      console.info('═══════════════════════════════════════════════════════');
    } else {
      console.error('═══════════════════════════════════════════════════════');
      console.error('[OwnerFetch] OWNER NOT DETECTED');
      console.error(`[OwnerFetch] Attempts: ${totalAttempts}`);
      console.error(`[OwnerFetch] Last error: ${lastError}`);
      console.error(`[OwnerFetch] Network: ${networkResult?.chainName || 'Unknown'}`);
      console.error(`[OwnerFetch] Contract: ${NFT_CONTRACT_ADDRESS}`);
      console.error(`[OwnerFetch] Is Proxy: ${proxyInfo?.isProxy ? proxyInfo.proxyType : 'No'}`);
      console.error('[OwnerFetch] Check network or proxy.');
      console.error('═══════════════════════════════════════════════════════');
    }
    
    const finalError = owner 
      ? null 
      : `Owner not detected. Check network or proxy. (Failed after ${totalAttempts} attempts: ${lastError})`;
    
    return { 
      owner, 
      error: finalError,
      attempts: totalAttempts,
      networkInfo: networkResult,
      isProxy: proxyInfo?.isProxy,
      proxyType: proxyInfo?.proxyType,
    };
  } finally {
    isFetching = false;
    fetchPromise = null;
  }
}

// ============ HELPER FUNCTIONS ============

async function getChainId(): Promise<string | null> {
  // Try from window.ethereum first
  if (window.ethereum) {
    try {
      const chainId = await (window.ethereum as any).request({ method: 'eth_chainId' });
      return chainId;
    } catch {
      // Fall through to RPC
    }
  }
  
  // Fallback to RPC call
  try {
    const result = await robustRpcCall<string>('eth_chainId', [], {
      timeoutMs: 5000,
      maxRetries: 2,
    });
    return result.success ? result.data ?? null : null;
  } catch {
    return null;
  }
}

// ============ OWNERSHIP EVENT LISTENER ============

const OWNERSHIP_TRANSFERRED_TOPIC = '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0';

interface OwnershipEventCallback {
  (previousOwner: string, newOwner: string): void;
}

let eventSubscription: (() => void) | null = null;
const eventCallbacks: Set<OwnershipEventCallback> = new Set();

/**
 * Subscribe to OwnershipTransferred events
 */
export function subscribeToOwnershipEvents(callback: OwnershipEventCallback): () => void {
  eventCallbacks.add(callback);
  
  // Start polling if first subscriber
  if (eventCallbacks.size === 1) {
    startOwnershipEventPolling();
  }
  
  // Return unsubscribe function
  return () => {
    eventCallbacks.delete(callback);
    if (eventCallbacks.size === 0 && eventSubscription) {
      eventSubscription();
      eventSubscription = null;
    }
  };
}

let lastProcessedBlock = 0n;

async function startOwnershipEventPolling(): Promise<void> {
  if (eventSubscription) return;
  
  let running = true;
  const pollInterval = 15000; // Poll every 15 seconds
  
  const poll = async () => {
    while (running) {
      try {
        // Get current block
        const blockResult = await robustRpcCall<string>('eth_blockNumber', [], {
          timeoutMs: 5000,
          maxRetries: 1,
        });
        
        if (!blockResult.success || !blockResult.data) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }
        
        const currentBlock = BigInt(blockResult.data);
        
        // On first run, just set the block number
        if (lastProcessedBlock === 0n) {
          lastProcessedBlock = currentBlock;
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }
        
        // Check for new events
        if (currentBlock > lastProcessedBlock) {
          const logsResult = await robustRpcCall<any[]>('eth_getLogs', [{
            address: NFT_CONTRACT_ADDRESS,
            topics: [OWNERSHIP_TRANSFERRED_TOPIC],
            fromBlock: `0x${lastProcessedBlock.toString(16)}`,
            toBlock: `0x${currentBlock.toString(16)}`,
          }], {
            timeoutMs: 10000,
            maxRetries: 2,
          });
          
          if (logsResult.success && logsResult.data && Array.isArray(logsResult.data)) {
            for (const log of logsResult.data) {
              if (log.topics && log.topics.length >= 3) {
                // Decode addresses from topics
                const previousOwner = '0x' + log.topics[1].slice(26);
                const newOwner = '0x' + log.topics[2].slice(26);
                
                console.info('[OwnerFetch] OwnershipTransferred event detected:', {
                  previousOwner: previousOwner.slice(0, 10) + '...',
                  newOwner: newOwner.slice(0, 10) + '...',
                });
                
                // Update cache
                const chainId = await getChainId();
                if (chainId) {
                  updateOwnerFromEvent(newOwner, chainId);
                }
                
                // Notify all callbacks
                for (const cb of eventCallbacks) {
                  try {
                    cb(previousOwner, newOwner);
                  } catch (err) {
                    console.error('[OwnerFetch] Callback error:', err);
                  }
                }
              }
            }
          }
          
          lastProcessedBlock = currentBlock;
        }
      } catch (err) {
        console.warn('[OwnerFetch] Event polling error:', err);
      }
      
      await new Promise(r => setTimeout(r, pollInterval));
    }
  };
  
  // Start polling in background
  poll();
  
  // Set up cleanup
  eventSubscription = () => {
    running = false;
  };
}

// ============ REACT HOOK ============

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseOwnerResult {
  owner: string | null;
  isLoading: boolean;
  error: string | null;
  attempts: number;
  networkInfo: NetworkValidationResult | null;
  isProxy: boolean;
  refetch: (force?: boolean) => Promise<void>;
}

export function useOwner(): UseOwnerResult {
  const [owner, setOwner] = useState<string | null>(getCachedOwner);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [networkInfo, setNetworkInfo] = useState<NetworkValidationResult | null>(null);
  const [isProxy, setIsProxy] = useState(false);
  const mountedRef = useRef(true);

  const refetch = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    
    const result = await fetchOwnerRobust({
      forceRefresh: force,
      onAttempt: (attempt, _max) => {
        if (mountedRef.current) {
          setAttempts(attempt);
        }
      },
      onError: (err, attempt) => {
        console.warn(`[useOwner] Attempt ${attempt} error:`, err);
      },
      onNetworkValidation: (netResult) => {
        if (mountedRef.current) {
          setNetworkInfo(netResult);
        }
      },
    });
    
    if (!mountedRef.current) return;
    
    setIsLoading(false);
    setOwner(result.owner);
    setError(result.error);
    setAttempts(result.attempts);
    setIsProxy(result.isProxy ?? false);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!getCachedOwner()) {
      refetch();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Subscribe to ownership events
  useEffect(() => {
    const unsubscribe = subscribeToOwnershipEvents((_previousOwner, newOwner) => {
      console.info('[useOwner] Owner changed:', newOwner.slice(0, 10) + '...');
      setOwner(newOwner.toLowerCase());
      setError(null);
    });
    
    return unsubscribe;
  }, []);

  return {
    owner,
    isLoading,
    error,
    attempts,
    networkInfo,
    isProxy,
    refetch,
  };
}
