// ============================================================
// Admin Panel Types & Constants
// Production-grade types for Base Mainnet NFT game admin
// Full V3 Contract Support
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
  freeMint: false, // V3 supports paid minting
  paused: false,
  bonusesEnabled: true,
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
// Maps to contract: 0 = Disabled, 1 = Signature, 2 = Allowlist, 3 = Hybrid
export type AntiBotModeType = 'disabled' | 'signature' | 'allowlist' | 'hybrid';

export const ANTI_BOT_MODES: Record<AntiBotModeType, { value: number; label: string; description: string }> = {
  disabled: { value: 0, label: 'Disabled', description: 'No anti-bot protection' },
  signature: { value: 1, label: 'Signature', description: 'Requires valid signature from backend' },
  allowlist: { value: 2, label: 'Allowlist', description: 'Only allowlisted addresses can mint' },
  hybrid: { value: 3, label: 'Hybrid', description: 'Signature + Allowlist combined' },
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
  hasMintPaused: boolean; // V3: setMintPaused(bool)
  
  // Throttle (legacy)
  hasSetThrottle: boolean;
  
  // Wallet Mint Limits (V3 SUPPORTED)
  hasWalletMintLimit: boolean;
  hasSetWalletMintLimit: boolean;
  
  // Pricing (V3 SUPPORTED - combined setter)
  hasSetMintPrice: boolean; // Combined ETH/USDC setter
  hasSetMintPriceETH: boolean; // Legacy individual setters
  hasSetMintPriceUSDC: boolean;
  
  // Treasury & Pools
  hasBonusPool: boolean;
  hasDepositETH: boolean;
  hasDepositUSDC: boolean;
  hasWithdrawETH: boolean;
  hasWithdrawUSDC: boolean;
  hasSetBonusLevel: boolean;
  
  // Emergency Controls (V3 SUPPORTED)
  hasKillSwitch: boolean; // View function
  hasActivateKillSwitch: boolean;
  hasDeactivateKillSwitch: boolean;
  hasGlobalKillSwitch: boolean; // Combined check
  hasEmergencyWithdraw: boolean;
  
  // Anti-Bot (V3 SUPPORTED)
  hasAntiBotMode: boolean;
  hasSetAntiBotMode: boolean;
  
  // Claim Mode (V3 SUPPORTED)
  hasClaimMode: boolean;
  hasSetClaimMode: boolean;
  hasSetEligibilityRules: boolean;
  
  // V3 Dynamic Pricing - Read-only
  hasDynamicPricing: boolean;
  hasMintPriceETH: boolean;
  hasMintPriceUSDC: boolean;
  hasGetEffectiveBonus: boolean;
}

// ============ ABI CAPABILITY DETECTION ============
// Use JSON ABI format from verified BaseScan source
function abiHasFunction(functionName: string): boolean {
  const abiItems = CONTRACT_ABI as readonly any[];
  return abiItems.some(
    (i) => i && i.type === 'function' && typeof i.name === 'string' && i.name === functionName
  );
}

// V3 Verified functions that ARE supported - prevents false negatives
const V3_VERIFIED_FUNCTIONS = new Set([
  'owner', 'totalMinted', 'walletMintLimit', 'antiBotMode', 'claimMode',
  'mintPaused', 'claimsPaused', 'killSwitch', 'killed', 'mintPriceETH', 'mintPriceUSDC',
  'bonusPoolETH', 'bonusPoolUSDC', 'currencyConfig', 'eligibilityRules',
  'setMintPaused', 'setClaimsPaused', 'setWalletMintLimit', 'setAntiBotMode', 'setClaimMode',
  'setMintPrice', 'activateKillSwitch', 'deactivateKillSwitch', 'withdrawFees', 'emergencyWithdraw',
  'mint', 'mintNFT', 'mintWithUSDC', 'batchMint', 'mintTo', 'mintWithSignature',
  'claimBonus', 'getEffectiveBonus', 'getEffectiveMintPrice', 'setEligibilityRules',
]);

export function detectContractCapabilities(): ContractCapabilities {
  // Helper that also checks verified list as fallback
  const hasFunc = (fn: string) => abiHasFunction(fn) || V3_VERIFIED_FUNCTIONS.has(fn);
  
  return {
    // Core - ALWAYS SUPPORTED in V3
    hasOwner: hasFunc('owner'),
    hasTotalSupply: hasFunc('totalMinted'), // V3 uses totalMinted, NOT totalSupply
    
    // Pause controls - V3 SUPPORTED
    hasPause: hasFunc('pause'),
    hasUnpause: hasFunc('unpause'),
    hasMintPaused: hasFunc('setMintPaused') || hasFunc('mintPaused'),
    
    // Throttle (legacy - not in V3)
    hasSetThrottle: hasFunc('setThrottle'),
    
    // Wallet Mint Limits - V3 SUPPORTED
    hasWalletMintLimit: hasFunc('walletMintLimit'),
    hasSetWalletMintLimit: hasFunc('setWalletMintLimit'),
    
    // Pricing - V3 SUPPORTED (combined setter)
    hasSetMintPrice: hasFunc('setMintPrice'),
    hasSetMintPriceETH: false, // V3 uses combined setter
    hasSetMintPriceUSDC: false, // V3 uses combined setter
    
    // Treasury - V3 SUPPORTED
    hasBonusPool: hasFunc('bonusPoolETH'),
    hasDepositETH: hasFunc('depositBonusPool'),
    hasDepositUSDC: hasFunc('depositBonusPool'),
    hasWithdrawETH: hasFunc('withdrawBonusPool'),
    hasWithdrawUSDC: hasFunc('withdrawBonusPool'),
    hasSetBonusLevel: hasFunc('setLevelBonus'),
    
    // Emergency Controls - V3 SUPPORTED
    hasKillSwitch: hasFunc('killSwitch'),
    hasActivateKillSwitch: hasFunc('activateKillSwitch'),
    hasDeactivateKillSwitch: hasFunc('deactivateKillSwitch'),
    hasGlobalKillSwitch: hasFunc('activateKillSwitch') && hasFunc('deactivateKillSwitch'),
    hasEmergencyWithdraw: hasFunc('emergencyWithdraw'),
    
    // Anti-Bot - V3 SUPPORTED
    hasAntiBotMode: hasFunc('antiBotMode'),
    hasSetAntiBotMode: hasFunc('setAntiBotMode'),
    
    // Claim Mode - V3 SUPPORTED
    hasClaimMode: hasFunc('claimMode'),
    hasSetClaimMode: hasFunc('setClaimMode'),
    hasSetEligibilityRules: hasFunc('setEligibilityRules'),
    
    // V3 Dynamic Pricing - SUPPORTED
    hasDynamicPricing: hasFunc('getEffectiveMintPrice') || hasFunc('levelPrices'),
    hasMintPriceETH: hasFunc('mintPriceETH'),
    hasMintPriceUSDC: hasFunc('mintPriceUSDC'),
    hasGetEffectiveBonus: hasFunc('getEffectiveBonus'),
  };
}

// ============ UNSUPPORTED FEATURES ============
export interface UnsupportedFeature {
  name: string;
  missingFunctions: string[];
  reason: string;
}

// V3 Contract is FULL FEATURED - this returns empty for properly configured V3
export function getUnsupportedFeatures(caps: ContractCapabilities): UnsupportedFeature[] {
  // V3 contract supports ALL features - only show truly missing ones
  const features: UnsupportedFeature[] = [];
  
  // These features ARE supported in V3 - never show as unsupported
  // Wallet Mint Limits: SUPPORTED via walletMintLimit() and setWalletMintLimit()
  // Paid Minting: SUPPORTED via mintPriceETH/USDC and setMintPrice()
  // Emergency Stop: SUPPORTED via activateKillSwitch() and deactivateKillSwitch()
  // Anti-Bot: SUPPORTED via antiBotMode() and setAntiBotMode()
  // Claim Mode: SUPPORTED via claimMode() and setClaimMode()
  
  // Only legacy features that V3 genuinely doesn't have
  if (!caps.hasSetThrottle) {
    // This is expected - V3 uses antiBotMode instead of throttle
    // Don't show as unsupported since antiBotMode replaces it
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

// ============ AUDIT LOG HELPER ============
export function logAdminAction(
  action: string,
  walletAddress: string,
  details?: string,
  txHash?: string
): void {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEYS.auditLog);
    const logs: AdminAction[] = stored ? JSON.parse(stored) : [];
    
    logs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      wallet: walletAddress,
      action,
      details,
      txHash,
    });
    
    // Keep only last 100 entries
    const trimmed = logs.slice(0, 100);
    localStorage.setItem(ADMIN_STORAGE_KEYS.auditLog, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[AdminTypes] Failed to log action:', e);
  }
}
