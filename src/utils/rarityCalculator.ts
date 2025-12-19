// MemoryMint NFT Rarity & Performance Trait System
// Dynamic traits based on player performance, not randomness

import { NFTRarityTier, getLevel, NFT_RARITY_STYLES } from '@/data/levels';

// Performance trait types
export type SpeedTrait = 'Sluggish' | 'Steady' | 'Swift' | 'Lightning' | 'Instant';
export type PrecisionTrait = 'Fumbling' | 'Careful' | 'Accurate' | 'Precise' | 'Flawless';
export type FocusTrait = 'Scattered' | 'Attentive' | 'Focused' | 'Zoned' | 'Transcendent';

export interface PerformanceTraits {
  speed: SpeedTrait;
  speedScore: number;
  precision: PrecisionTrait;
  precisionScore: number;
  focus: FocusTrait;
  focusScore: number;
  legendaryGlow: boolean;
  perfectRun: boolean;
}

export interface RarityResult {
  tier: NFTRarityTier;
  score: number;
  breakdown: {
    baseScore: number;
    timeBonus: number;
    comboBonus: number;
    perfectBonus: number;
    levelMultiplier: number;
    tierMultiplier: number;
  };
  color: string;
  glow: string;
  bgGradient: string;
  border: string;
  traits: PerformanceTraits;
}

// Level-based multipliers (higher levels = more points)
const LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 0.3, 2: 0.4, 3: 0.5, 4: 0.6,
  5: 0.7, 6: 0.8, 7: 0.9, 8: 1.0,
  9: 1.1, 10: 1.2, 11: 1.3, 12: 1.4,
  13: 1.5, 14: 1.6, 15: 1.7, 16: 1.8,
  17: 2.0, 18: 2.2, 19: 2.5, 20: 3.0,
};

// Tier multipliers
const TIER_MULTIPLIERS: Record<number, number> = {
  1: 0.5,  // Onboarding
  2: 1.0,  // Core Skill
  3: 1.5,  // Advanced
  4: 2.0,  // Mastery
  5: 2.5,  // Endgame
};

// Score thresholds for each rarity (after multipliers)
const RARITY_THRESHOLDS: Record<NFTRarityTier, number> = {
  Mythic: 8000,
  Legendary: 5500,
  Epic: 3500,
  Rare: 2000,
  Uncommon: 1000,
  Common: 0,
};

// Calculate speed trait based on time efficiency
function calculateSpeedTrait(timeRemaining: number, totalTime: number): { trait: SpeedTrait; score: number } {
  const efficiency = timeRemaining / totalTime;
  
  if (efficiency >= 0.7) return { trait: 'Instant', score: 100 };
  if (efficiency >= 0.5) return { trait: 'Lightning', score: 80 };
  if (efficiency >= 0.35) return { trait: 'Swift', score: 60 };
  if (efficiency >= 0.2) return { trait: 'Steady', score: 40 };
  return { trait: 'Sluggish', score: 20 };
}

// Calculate precision trait based on move efficiency
function calculatePrecisionTrait(moves: number, optimalMoves: number): { trait: PrecisionTrait; score: number } {
  const efficiency = optimalMoves / moves;
  
  if (efficiency >= 1.0) return { trait: 'Flawless', score: 100 };
  if (efficiency >= 0.85) return { trait: 'Precise', score: 80 };
  if (efficiency >= 0.65) return { trait: 'Accurate', score: 60 };
  if (efficiency >= 0.45) return { trait: 'Careful', score: 40 };
  return { trait: 'Fumbling', score: 20 };
}

// Calculate focus trait based on combo performance
function calculateFocusTrait(maxCombo: number, totalPairs: number): { trait: FocusTrait; score: number } {
  const comboRatio = maxCombo / totalPairs;
  
  if (comboRatio >= 0.9) return { trait: 'Transcendent', score: 100 };
  if (comboRatio >= 0.7) return { trait: 'Zoned', score: 80 };
  if (comboRatio >= 0.5) return { trait: 'Focused', score: 60 };
  if (comboRatio >= 0.3) return { trait: 'Attentive', score: 40 };
  return { trait: 'Scattered', score: 20 };
}

export function calculateRarity(
  level: number,
  timeRemaining: number,
  totalTime: number,
  moves: number,
  totalPairs: number,
  maxCombo: number,
  perfectGame: boolean
): RarityResult {
  const levelConfig = getLevel(level);
  const optimalMoves = totalPairs; // Perfect would be matching every pair first try

  // Calculate performance traits
  const speedResult = calculateSpeedTrait(timeRemaining, totalTime);
  const precisionResult = calculatePrecisionTrait(moves, optimalMoves);
  const focusResult = calculateFocusTrait(maxCombo, totalPairs);

  // Legendary glow: all traits are top-tier
  const legendaryGlow = speedResult.score >= 80 && precisionResult.score >= 80 && focusResult.score >= 80;

  const traits: PerformanceTraits = {
    speed: speedResult.trait,
    speedScore: speedResult.score,
    precision: precisionResult.trait,
    precisionScore: precisionResult.score,
    focus: focusResult.trait,
    focusScore: focusResult.score,
    legendaryGlow,
    perfectRun: perfectGame,
  };

  // Base score from move efficiency
  const moveEfficiency = Math.max(0, 1 - (moves - optimalMoves) / (optimalMoves * 2));
  const baseScore = Math.floor(moveEfficiency * 1000);

  // Time bonus (faster = better)
  const timeEfficiency = timeRemaining / totalTime;
  const timeBonus = Math.floor(timeEfficiency * 600);

  // Combo bonus
  const comboBonus = maxCombo * 120;

  // Perfect game bonus (no mistakes)
  const perfectBonus = perfectGame ? 800 : 0;

  // Multipliers
  const levelMultiplier = LEVEL_MULTIPLIERS[level] || 1.0;
  const tierMultiplier = TIER_MULTIPLIERS[levelConfig.tier] || 1.0;

  // Calculate total score
  const rawScore = baseScore + timeBonus + comboBonus + perfectBonus;
  const finalScore = Math.floor(rawScore * levelMultiplier * tierMultiplier);

  // Determine rarity tier - but cap based on level tier
  const maxRarityByTier: Record<number, NFTRarityTier> = {
    1: 'Common',
    2: 'Uncommon',
    3: 'Rare',
    4: 'Epic',
    5: 'Mythic',
  };

  const maxAllowedRarity = maxRarityByTier[levelConfig.tier];
  const rarityOrder: NFTRarityTier[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const maxRarityIndex = rarityOrder.indexOf(maxAllowedRarity);

  // Find achieved rarity based on score
  let achievedTier: NFTRarityTier = 'Common';
  for (const [rarityTier, threshold] of Object.entries(RARITY_THRESHOLDS) as [NFTRarityTier, number][]) {
    if (finalScore >= threshold) {
      achievedTier = rarityTier;
      break;
    }
  }

  // Cap rarity at max allowed for tier
  const achievedIndex = rarityOrder.indexOf(achievedTier);
  const finalTier = achievedIndex <= maxRarityIndex ? achievedTier : maxAllowedRarity;

  const styles = NFT_RARITY_STYLES[finalTier];

  return {
    tier: finalTier,
    score: finalScore,
    breakdown: {
      baseScore,
      timeBonus,
      comboBonus,
      perfectBonus,
      levelMultiplier,
      tierMultiplier,
    },
    color: styles.color,
    glow: styles.glow,
    bgGradient: styles.bgGradient,
    border: styles.border,
    traits,
  };
}

export function getRarityDescription(tier: NFTRarityTier): string {
  switch (tier) {
    case 'Mythic':
      return 'Legendary mastery! The ultimate achievement. Your NFT is fully animated with color-shifting aura.';
    case 'Legendary':
      return 'Exceptional performance! Your NFT features intense glow and animated backgrounds.';
    case 'Epic':
      return 'Impressive skills! Your NFT has reactive animations tied to your performance traits.';
    case 'Rare':
      return 'Great job! Your NFT features multi-layer gradients and floating glyphs.';
    case 'Uncommon':
      return 'Making progress! Your NFT has gentle gradients and subtle animations.';
    case 'Common':
      return 'Good start! Your NFT has a clean, static design. Keep practicing!';
  }
}

export function getTraitDescription(traits: PerformanceTraits): string {
  const parts: string[] = [];
  
  if (traits.perfectRun) {
    parts.push('🏆 Perfect Run!');
  }
  
  if (traits.legendaryGlow) {
    parts.push('✨ Legendary Glow Active');
  }
  
  parts.push(`⚡ Speed: ${traits.speed}`);
  parts.push(`🎯 Precision: ${traits.precision}`);
  parts.push(`🔥 Focus: ${traits.focus}`);
  
  return parts.join(' • ');
}

// Export for backward compatibility
export type { NFTRarityTier as RarityTier };
