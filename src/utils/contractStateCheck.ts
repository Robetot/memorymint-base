/**
 * Utility to check current on-chain admin configuration
 * Contract: 0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0
 * 
 * Uses Edge Function as primary source, with direct RPC fallback
 */

import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';

const NFT_CONTRACT_ADDRESS = '0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0';

// Edge function URL - primary source
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-admin-config`;

// Expanded RPC endpoints - more reliable order, avoiding rate-limited endpoints first
const RPC_ENDPOINTS = [
  'https://base.llamarpc.com',
  'https://base-mainnet.public.blastapi.io',
  'https://1rpc.io/base',
  'https://base.meowrpc.com',
  'https://base.drpc.org',
  'https://base-pokt.nodies.app',
  'https://mainnet.base.org', // Official often rate-limits, try last
];

const READ_ABI = parseAbi([
  'function isMintActive() view returns (bool)',
  'function mintPaused() view returns (bool)',
  'function freeMintActive() view returns (bool)',
  'function isFreeMint() view returns (bool)',
  'function mintCurrency() view returns (uint8)',
  'function killSwitch() view returns (bool)',
  'function isKillSwitchActive() view returns (bool)',
]);

export interface AdminConfigStatus {
  isMintActive: boolean;
  mintPaused: boolean;
  freeMintActive: boolean;
  isFreeMint: boolean;
  mintCurrency: number;
  mintCurrencyLabel: 'ETH' | 'USDC';
  killSwitch: boolean;
  isKillSwitchActive: boolean;
  // Derived values
  mintingAllowed: boolean;
  msgValueZeroShouldWorkForEthPath: boolean;
  // Meta
  source: 'edge-function' | 'direct-rpc' | 'fallback-defaults';
  error?: string;
}

// Try to fetch from Edge Function first
async function fetchFromEdgeFunction(): Promise<AdminConfigStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('[ContractStateCheck] Edge function returned non-2xx:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.reads) {
      console.warn('[ContractStateCheck] Edge function response missing reads');
      return null;
    }
    
    return {
      isMintActive: data.reads.isMintActive,
      mintPaused: data.reads.mintPaused,
      freeMintActive: data.reads.freeMintActive,
      isFreeMint: data.reads.isFreeMint,
      mintCurrency: data.reads.mintCurrency,
      mintCurrencyLabel: data.reads.mintCurrency === 0 ? 'ETH' : 'USDC',
      killSwitch: data.reads.killSwitch,
      isKillSwitchActive: data.reads.isKillSwitchActive,
      mintingAllowed: data.derived?.mintingAllowed ?? (data.reads.isMintActive && !data.reads.isKillSwitchActive),
      msgValueZeroShouldWorkForEthPath: data.derived?.msgValueZeroShouldWorkForEthPath ?? data.reads.isFreeMint,
      source: data.success === false ? 'fallback-defaults' : 'edge-function',
      error: data.error,
    };
  } catch (error) {
    console.warn('[ContractStateCheck] Edge function fetch failed:', error);
    return null;
  }
}

// Direct RPC call with retry logic
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const errors: string[] = [];
  
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint}: HTTP ${response.status}`);
        continue;
      }
      
      const json = await response.json();
      
      // Handle rate limiting
      if (json.error?.code === -32016 || json.error?.message?.includes('rate limit')) {
        errors.push(`${endpoint}: Rate limited`);
        continue;
      }
      
      if (json.result !== undefined && json.result !== '0x' && json.result.length >= 66) {
        return json.result;
      }
      
      if (json.error) {
        errors.push(`${endpoint}: ${json.error.message || 'RPC error'}`);
      } else {
        errors.push(`${endpoint}: Empty result`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      errors.push(`${endpoint}: ${msg}`);
    }
  }
  
  console.error('[RPC] All endpoints failed:', errors);
  throw new Error(`All RPC endpoints failed: ${errors.slice(-3).join('; ')}`);
}

async function readBool(functionName: 'isMintActive' | 'mintPaused' | 'freeMintActive' | 'isFreeMint' | 'killSwitch' | 'isKillSwitchActive'): Promise<boolean> {
  const data = encodeFunctionData({
    abi: READ_ABI,
    functionName,
    args: [],
  });
  
  const result = await rpcCall('eth_call', [
    { to: NFT_CONTRACT_ADDRESS, data },
    'latest',
  ]);
  
  const decoded = decodeFunctionResult({
    abi: READ_ABI,
    functionName,
    data: result as `0x${string}`,
  });
  
  return decoded as boolean;
}

async function readUint8(functionName: 'mintCurrency'): Promise<number> {
  const data = encodeFunctionData({
    abi: READ_ABI,
    functionName,
    args: [],
  });
  
  const result = await rpcCall('eth_call', [
    { to: NFT_CONTRACT_ADDRESS, data },
    'latest',
  ]);
  
  const decoded = decodeFunctionResult({
    abi: READ_ABI,
    functionName,
    data: result as `0x${string}`,
  });
  
  return Number(decoded);
}

async function fetchFromDirectRPC(): Promise<AdminConfigStatus | null> {
  console.log('[ContractStateCheck] Falling back to direct RPC...');
  
  try {
    const [
      isMintActive,
      mintPaused,
      freeMintActive,
      isFreeMint,
      mintCurrency,
      killSwitch,
      isKillSwitchActive,
    ] = await Promise.all([
      readBool('isMintActive'),
      readBool('mintPaused'),
      readBool('freeMintActive'),
      readBool('isFreeMint'),
      readUint8('mintCurrency'),
      readBool('killSwitch'),
      readBool('isKillSwitchActive'),
    ]);
    
    return {
      isMintActive,
      mintPaused,
      freeMintActive,
      isFreeMint,
      mintCurrency,
      mintCurrencyLabel: mintCurrency === 0 ? 'ETH' : 'USDC',
      killSwitch,
      isKillSwitchActive,
      mintingAllowed: isMintActive && !isKillSwitchActive,
      msgValueZeroShouldWorkForEthPath: isFreeMint,
      source: 'direct-rpc',
    };
  } catch (error) {
    console.error('[ContractStateCheck] Direct RPC failed:', error);
    return null;
  }
}

// Get permissive defaults for fail-open behavior
function getPermissiveDefaults(): AdminConfigStatus {
  return {
    isMintActive: true,
    mintPaused: false,
    freeMintActive: true,
    isFreeMint: true,
    mintCurrency: 0,
    mintCurrencyLabel: 'ETH',
    killSwitch: false,
    isKillSwitchActive: false,
    mintingAllowed: true,
    msgValueZeroShouldWorkForEthPath: true,
    source: 'fallback-defaults',
    error: 'All RPC sources failed - using permissive defaults. Contract will enforce actual state.',
  };
}

export async function checkAdminConfig(): Promise<AdminConfigStatus> {
  console.log('[ContractStateCheck] Fetching on-chain admin configuration...');
  console.log('[ContractStateCheck] Contract:', NFT_CONTRACT_ADDRESS);
  
  // Try Edge Function first (most reliable)
  let status = await fetchFromEdgeFunction();
  
  // If Edge Function fails, try direct RPC
  if (!status) {
    status = await fetchFromDirectRPC();
  }
  
  // If all else fails, return permissive defaults (fail-open)
  if (!status) {
    console.warn('[ContractStateCheck] All sources failed - using permissive defaults');
    status = getPermissiveDefaults();
  }
  
  // Log results
  console.log('[ContractStateCheck] === ADMIN CONFIG STATUS ===');
  console.log(`  • Source: ${status.source}`);
  console.log(`  • Mint Active: ${status.isMintActive ? 'ON ✅' : 'OFF ❌'}`);
  console.log(`  • Mint Paused: ${status.mintPaused ? 'true ⛔' : 'false ✅'}`);
  console.log(`  • Free Mint Active: ${status.freeMintActive ? 'ON ✅' : 'OFF ❌'}`);
  console.log(`  • Is Free Mint: ${status.isFreeMint ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  • Mint Currency: ${status.mintCurrencyLabel}`);
  console.log(`  • Kill Switch: ${status.killSwitch ? 'ACTIVE ⛔' : 'INACTIVE ✅'}`);
  console.log(`  • Minting Allowed: ${status.mintingAllowed ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  • msg.value=0 OK for ETH: ${status.msgValueZeroShouldWorkForEthPath ? 'YES ✅' : 'NO ❌'}`);
  if (status.error) {
    console.warn(`  • Error: ${status.error}`);
  }
  console.log('[ContractStateCheck] ===========================');
  
  return status;
}

// Expose globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).checkAdminConfig = checkAdminConfig;
}
