/**
 * Utility to check current on-chain admin configuration
 * Contract: 0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0
 */

import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';

const NFT_CONTRACT_ADDRESS = '0x9FaB0dFce96D1861725Ba8C75AA0759fEd923af0';

const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.meowrpc.com',
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

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });
      const json = await response.json();
      if (json.result !== undefined) {
        return json.result;
      }
      if (json.error) {
        console.warn(`[RPC] ${endpoint} error:`, json.error);
      }
    } catch (e) {
      console.warn(`[RPC] ${endpoint} failed:`, e);
    }
  }
  throw new Error('All RPC endpoints failed');
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

export interface AdminConfigStatus {
  isMintActive: boolean;
  mintPaused: boolean;
  freeMintActive: boolean;
  isFreeMint: boolean;
  mintCurrency: number;
  mintCurrencyLabel: 'ETH' | 'USDC';
  killSwitch: boolean;
  isKillSwitchActive: boolean;
}

export async function checkAdminConfig(): Promise<AdminConfigStatus> {
  console.log('[ContractStateCheck] Fetching on-chain admin configuration...');
  console.log('[ContractStateCheck] Contract:', NFT_CONTRACT_ADDRESS);
  
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
  
  const status: AdminConfigStatus = {
    isMintActive,
    mintPaused,
    freeMintActive,
    isFreeMint,
    mintCurrency,
    mintCurrencyLabel: mintCurrency === 0 ? 'ETH' : 'USDC',
    killSwitch,
    isKillSwitchActive,
  };
  
  console.log('[ContractStateCheck] === ADMIN CONFIG STATUS ===');
  console.log(`  • Mint Active: ${isMintActive ? 'ON ✅' : 'OFF ❌'}`);
  console.log(`  • Mint Paused: ${mintPaused ? 'true ⛔' : 'false ✅'}`);
  console.log(`  • Free Mint Active: ${freeMintActive ? 'ON ✅' : 'OFF ❌'}`);
  console.log(`  • Is Free Mint: ${isFreeMint ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  • Mint Currency: ${status.mintCurrencyLabel}`);
  console.log(`  • Kill Switch: ${killSwitch ? 'ACTIVE ⛔' : 'INACTIVE ✅'}`);
  console.log('[ContractStateCheck] ===========================');
  
  return status;
}

// Expose globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).checkAdminConfig = checkAdminConfig;
  // Auto-run on load for debugging
  checkAdminConfig().catch(console.error);
}
