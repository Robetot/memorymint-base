import { Difficulty } from '@/data/animals';

export type RarityTier = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export interface RarityResult {
  tier: RarityTier;
  score: number;
  breakdown: {
    baseScore: number;
    timeBonus: number;
    comboBonus: number;
    perfectBonus: number;
    difficultyMultiplier: number;
  };
  color: string;
  glow: string;
}

const RARITY_THRESHOLDS: Record<RarityTier, number> = {
  Mythic: 5000,
  Legendary: 3500,
  Epic: 2000,
  Rare: 1000,
  Common: 0,
};

const RARITY_COLORS: Record<RarityTier, { color: string; glow: string }> = {
  Mythic: { color: 'text-purple-400', glow: 'shadow-purple-500/50' },
  Legendary: { color: 'text-amber-400', glow: 'shadow-amber-500/50' },
  Epic: { color: 'text-violet-400', glow: 'shadow-violet-500/50' },
  Rare: { color: 'text-blue-400', glow: 'shadow-blue-500/50' },
  Common: { color: 'text-gray-400', glow: 'shadow-gray-500/50' },
};

const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  '2x2': 0.5,
  '4x4': 1.0,
  '6x6': 1.5,
  '8x8': 2.0,
};

export function calculateRarity(
  difficulty: Difficulty,
  timeRemaining: number,
  totalTime: number,
  moves: number,
  totalPairs: number,
  maxCombo: number,
  perfectGame: boolean
): RarityResult {
  // Base score from moves efficiency
  const optimalMoves = totalPairs; // Perfect would be matching every pair first try
  const moveEfficiency = Math.max(0, 1 - (moves - optimalMoves) / (optimalMoves * 2));
  const baseScore = Math.floor(moveEfficiency * 1000);

  // Time bonus (faster = better)
  const timeEfficiency = timeRemaining / totalTime;
  const timeBonus = Math.floor(timeEfficiency * 500);

  // Combo bonus
  const comboBonus = maxCombo * 100;

  // Perfect game bonus (no mistakes)
  const perfectBonus = perfectGame ? 500 : 0;

  // Difficulty multiplier
  const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty];

  // Calculate total score
  const rawScore = baseScore + timeBonus + comboBonus + perfectBonus;
  const finalScore = Math.floor(rawScore * difficultyMultiplier);

  // Determine rarity tier
  let tier: RarityTier = 'Common';
  for (const [rarityTier, threshold] of Object.entries(RARITY_THRESHOLDS) as [RarityTier, number][]) {
    if (finalScore >= threshold) {
      tier = rarityTier;
      break;
    }
  }

  return {
    tier,
    score: finalScore,
    breakdown: {
      baseScore,
      timeBonus,
      comboBonus,
      perfectBonus,
      difficultyMultiplier,
    },
    color: RARITY_COLORS[tier].color,
    glow: RARITY_COLORS[tier].glow,
  };
}

export function getRarityDescription(tier: RarityTier): string {
  switch (tier) {
    case 'Mythic':
      return 'Legendary mastery! Your skills are unmatched.';
    case 'Legendary':
      return 'Exceptional performance! A true memory champion.';
    case 'Epic':
      return 'Impressive skills! You\'re becoming a master.';
    case 'Rare':
      return 'Great job! Your memory is getting sharper.';
    case 'Common':
      return 'Good effort! Keep practicing to improve.';
  }
}
