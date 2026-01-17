// ============================================================
// Admin Panel Types & Constants
// Production-grade types for Base Mainnet NFT game admin
// ============================================================

import { CONTRACT_ABI } from '@/contracts/MemoryMintContract';

// ============ ENFORCEMENT TYPES ============
export type EnforcementType = 'onchain' | 'admin' | 'future';

export const ENFORCEMENT_LABELS: Record<EnforcementType, { icon: string; label: string }> = {
  onchain: { icon: '🔗', label: 'On-chain enforced' },
  admin: { icon: '🧠', label: 'Admin-controlled' },
  future: { icon: '⏳', label: 'Future / planned' },
};

// ============ SAFE DEFAULTS (ABSOLUTE) ============
export const SAFE_DEFAULTS = {
  mintEnabled: true,
  freeMint: true,
  paused: false,
  bonusesEnabled: false,
  antiBotEnabled: true,
  throttleEnabled: true,
} as const;

// ============ BONUS LEVELS ============
export const BONUS_LEVELS = [4, 8, 12, 16, 20] as const;
export type BonusLevel = (typeof BONUS_LEVELS)[number];

export interface BonusLevelConfig {
  level: BonusLevel;
  enabled: boolean;
  currency: 'ETH' | 'USDC';
  amount: string;
  enforcement: EnforcementType;
}

// ============ ANTI-BOT MODES ============
export type AntiBotModeType = 'soft' | 'hard';

export const ANTI_BOT_MODES: Record<AntiBotModeType, { label: string; description: string }> = {
  soft: { label: 'Soft', description: 'Cooldown / throttle between mints' },
  hard: { label: 'Hard', description: 'Wallet mint limits enforced' },
};

// ============ POOL STATUS ============
export type PoolStatus = 'sufficient' | 'low' | 'empty';

export interface PoolBalance {
  eth: bigint;
  usdc: bigint;
  ethStatus: PoolStatus;
  usdcStatus: PoolStatus;
}

// ============ ADMIN ACTION LOG ============
export interface AdminAction {
  id: string;
  timestamp: number;
  wallet: string;
  action: string;
  details?: string;
  txHash?: string;
}

// ============ CONTRACT CAPABILITIES ============
export interface ContractCapabilities {
  // Core (always required)
  hasOwner: boolean;
  hasTotalSupply: boolean;
  
  // Pause controls
  hasPause: boolean;
  hasUnpause: boolean;
  
  // Throttle
  hasSetThrottle: boolean;
  
  // Advanced (may not exist in simple contracts)
  hasSetWalletMintLimit: boolean;
  hasSetMintPriceETH: boolean;
  hasSetMintPriceUSDC: boolean;
  hasBonusPool: boolean;
  hasDepositETH: boolean;
  hasDepositUSDC: boolean;
  hasWithdrawETH: boolean;
  hasWithdrawUSDC: boolean;
  hasSetBonusLevel: boolean;
  hasGlobalKillSwitch: boolean;
  hasEmergencyWithdraw: boolean;
  
  // V3 specific - read-only pricing (dynamic, not settable)
  hasDynamicPricing: boolean;
  hasMintPriceETH: boolean;
  hasMintPriceUSDC: boolean;
}

// ============ ABI CAPABILITY DETECTION ============
function abiHasFunction(functionName: string): boolean {
  const abiItems = CONTRACT_ABI as unknown as readonly any[];
  return abiItems.some(
    (i) => i && i.type === 'function' && typeof i.name === 'string' && i.name === functionName
  );
}

export function detectContractCapabilities(): ContractCapabilities {
  return {
    hasOwner: abiHasFunction('owner'),
    // V3 uses totalMinted instead of totalSupply
    hasTotalSupply: abiHasFunction('totalSupply') || abiHasFunction('totalMinted'),
    hasPause: abiHasFunction('pause'),
    hasUnpause: abiHasFunction('unpause'),
    hasSetThrottle: abiHasFunction('setThrottle'),
    // V3 doesn't have setter functions - pricing is dynamic/read-only
    hasSetWalletMintLimit: abiHasFunction('setWalletMintLimit'),
    hasSetMintPriceETH: abiHasFunction('setMintPriceETH'),
    hasSetMintPriceUSDC: abiHasFunction('setMintPriceUSDC'),
    hasBonusPool: abiHasFunction('bonusPoolETH') || abiHasFunction('getBonusPoolBalance'),
    hasDepositETH: abiHasFunction('depositBonusPoolETH') || abiHasFunction('depositETH') || abiHasFunction('deposit'),
    hasDepositUSDC: abiHasFunction('depositBonusPoolUSDC') || abiHasFunction('depositUSDC'),
    hasWithdrawETH: abiHasFunction('withdrawBonusPoolETH') || abiHasFunction('withdrawETH') || abiHasFunction('withdraw'),
    hasWithdrawUSDC: abiHasFunction('withdrawBonusPoolUSDC') || abiHasFunction('withdrawUSDC'),
    hasSetBonusLevel: abiHasFunction('setBonusLevel') || abiHasFunction('configureBonusLevel'),
    hasGlobalKillSwitch: abiHasFunction('emergencyStop') || abiHasFunction('killSwitch'),
    hasEmergencyWithdraw: abiHasFunction('emergencyWithdraw'),
    // V3 read-only dynamic pricing
    hasDynamicPricing: abiHasFunction('currentSupplyTier') || abiHasFunction('getSupplyTier'),
    hasMintPriceETH: abiHasFunction('mintPriceETH') || abiHasFunction('getMintPriceETH'),
    hasMintPriceUSDC: abiHasFunction('mintPriceUSDC') || abiHasFunction('getMintPriceUSDC'),
  };
}

// ============ UNSUPPORTED FEATURES ============
export interface UnsupportedFeature {
  name: string;
  missingFunctions: string[];
  reason: string;
}

export function getUnsupportedFeatures(caps: ContractCapabilities): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  
  // For V3 contracts with dynamic pricing, setWalletMintLimit is optional
  if (!caps.hasSetWalletMintLimit) {
    features.push({
      name: 'Wallet Mint Limits',
      missingFunctions: ['setWalletMintLimit'],
      reason: 'Contract uses dynamic pricing without settable wallet limits',
    });
  }
  
  // V3 uses read-only dynamic pricing, so setMintPrice functions are not needed
  if (!caps.hasSetMintPriceETH && !caps.hasSetMintPriceUSDC && !caps.hasDynamicPricing && !caps.hasMintPriceETH) {
    features.push({
      name: 'Paid Minting',
      missingFunctions: ['setMintPriceETH', 'setMintPriceUSDC', 'mintPriceETH', 'mintPriceUSDC'],
      reason: 'Contract is free-mint only, no pricing support',
    });
  }
  
  if (!caps.hasBonusPool && !caps.hasSetBonusLevel) {
    features.push({
      name: 'Bonus System',
      missingFunctions: ['bonusPoolETH', 'setBonusLevel', 'configureBonusLevel'],
      reason: 'Contract does not have bonus pool functionality',
    });
  }
  
  if (!caps.hasDepositETH && !caps.hasDepositUSDC) {
    features.push({
      name: 'Pool Deposits',
      missingFunctions: ['depositETH', 'depositUSDC', 'deposit'],
      reason: 'Contract does not support pool deposits',
    });
  }
  
  if (!caps.hasWithdrawETH && !caps.hasWithdrawUSDC) {
    features.push({
      name: 'Pool Withdrawals',
      missingFunctions: ['withdrawETH', 'withdrawUSDC'],
      reason: 'Contract does not support pool withdrawals',
    });
  }
  
  if (!caps.hasGlobalKillSwitch) {
    features.push({
      name: 'Global Kill Switch',
      missingFunctions: ['emergencyStop', 'killSwitch'],
      reason: 'Contract does not have global kill switch',
    });
  }
  
  return features;
}

// ============ BONUS PRESETS ============
export interface BonusPreset {
  id: string;
  name: string;
  description: string;
  levels: Record<BonusLevel, { eth: string; usdc: string }>;
}

export const BONUS_PRESETS: BonusPreset[] = [
  {
    id: 'test',
    name: 'Test Mode',
    description: 'Minimal amounts for testing',
    levels: {
      4: { eth: '0.0001', usdc: '0.10' },
      8: { eth: '0.0002', usdc: '0.25' },
      12: { eth: '0.0005', usdc: '0.50' },
      16: { eth: '0.001', usdc: '1.00' },
      20: { eth: '0.002', usdc: '2.00' },
    },
  },
  {
    id: 'low',
    name: 'Low Rewards',
    description: 'Conservative reward structure',
    levels: {
      4: { eth: '0.001', usdc: '1.00' },
      8: { eth: '0.002', usdc: '2.50' },
      12: { eth: '0.005', usdc: '5.00' },
      16: { eth: '0.01', usdc: '10.00' },
      20: { eth: '0.02', usdc: '25.00' },
    },
  },
  {
    id: 'standard',
    name: 'Standard Rewards',
    description: 'Balanced reward structure',
    levels: {
      4: { eth: '0.005', usdc: '5.00' },
      8: { eth: '0.01', usdc: '10.00' },
      12: { eth: '0.025', usdc: '25.00' },
      16: { eth: '0.05', usdc: '50.00' },
      20: { eth: '0.1', usdc: '100.00' },
    },
  },
  {
    id: 'high',
    name: 'High Rewards',
    description: 'Generous reward structure',
    levels: {
      4: { eth: '0.01', usdc: '10.00' },
      8: { eth: '0.025', usdc: '25.00' },
      12: { eth: '0.05', usdc: '50.00' },
      16: { eth: '0.1', usdc: '100.00' },
      20: { eth: '0.25', usdc: '250.00' },
    },
  },
];

// ============ LOCAL STORAGE KEYS ============
export const ADMIN_STORAGE_KEYS = {
  auditLog: 'memorymint_admin_audit_log',
  localConfig: 'memorymint_admin_local_config',
  previewMode: 'memorymint_admin_preview_mode',
} as const;

// ============ VALIDATION ============
export function validateETHAmount(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return false;
  // Check decimals (max 18)
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > 18) return false;
  return true;
}

export function validateUSDCAmount(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return false;
  // Check decimals (max 6)
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > 6) return false;
  return true;
}
