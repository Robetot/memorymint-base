// MemoryMint Level System - 20 Skill-Based Levels
// Each level introduces new mechanics, no repeated "same grid + less time"

export type LevelMechanic = 
  | 'tutorial'
  | 'hints'
  | 'no_hints'
  | 'pressure'
  | 'shuffle'
  | 'limited_mistakes'
  | 'no_preview'
  | 'fog'
  | 'flash_preview'
  | 'decoys'
  | 'combo_required'
  | 'double_shuffle'
  | 'hidden_matches'
  | 'card_decay'
  | 'no_timer_display'
  | 'card_rotation'
  | 'one_chance'
  | 'all_mechanics';

export type NFTRarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export interface LevelConfig {
  level: number;
  gridSize: number;
  gridColumns: number;
  gridRows: number;
  time: number;
  label: string;
  description: string;
  mechanics: LevelMechanic[];
  tier: 1 | 2 | 3 | 4 | 5;
  nftRarity: NFTRarityTier;
  tierName: string;
}

// NFT Rarity Colors and Styles
export const NFT_RARITY_STYLES: Record<NFTRarityTier, {
  color: string;
  bgGradient: string;
  glow: string;
  border: string;
  icon: string;
}> = {
  Common: {
    color: 'text-slate-400',
    bgGradient: 'from-slate-200/20 to-slate-400/10',
    glow: 'shadow-slate-400/30',
    border: 'border-slate-400/50',
    icon: '⚪',
  },
  Uncommon: {
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-400/20 to-emerald-600/10',
    glow: 'shadow-emerald-400/40',
    border: 'border-emerald-400/50',
    icon: '🟢',
  },
  Rare: {
    color: 'text-blue-400',
    bgGradient: 'from-blue-400/20 to-blue-600/10',
    glow: 'shadow-blue-400/50',
    border: 'border-blue-400/50',
    icon: '🔵',
  },
  Epic: {
    color: 'text-purple-400',
    bgGradient: 'from-purple-400/20 to-purple-600/10',
    glow: 'shadow-purple-400/60',
    border: 'border-purple-400/50',
    icon: '🟣',
  },
  Legendary: {
    color: 'text-amber-400',
    bgGradient: 'from-amber-400/20 to-orange-500/10',
    glow: 'shadow-amber-400/70',
    border: 'border-amber-400/50',
    icon: '🟠',
  },
  Mythic: {
    color: 'text-rose-400',
    bgGradient: 'from-rose-400/20 via-purple-500/20 to-cyan-400/10',
    glow: 'shadow-rose-400/80',
    border: 'border-rose-400/50',
    icon: '🌈',
  },
};

// Mechanic descriptions for UI
export const MECHANIC_INFO: Record<LevelMechanic, { icon: string; name: string; description: string }> = {
  tutorial: { icon: '📖', name: 'Tutorial', description: 'Learn the basics with guided hints' },
  hints: { icon: '💡', name: 'Hints ON', description: 'Hints available to help you' },
  no_hints: { icon: '🚫', name: 'No Hints', description: 'Play without any hints' },
  pressure: { icon: '⏱️', name: 'Time Pressure', description: 'Reduced time limit' },
  shuffle: { icon: '🔀', name: 'Mid-Game Shuffle', description: 'Cards shuffle during play' },
  limited_mistakes: { icon: '❌', name: 'Limited Mistakes', description: 'Only 3 wrong matches allowed' },
  no_preview: { icon: '👁️', name: 'No Preview', description: 'Cards start face-down immediately' },
  fog: { icon: '🌫️', name: 'Fog of War', description: 'Only see nearby cards' },
  flash_preview: { icon: '⚡', name: 'Flash Preview', description: '2 second preview only' },
  decoys: { icon: '🎭', name: 'Decoy Cards', description: 'Some cards have no match' },
  combo_required: { icon: '🔥', name: 'Combo Required', description: 'Must maintain combo streaks' },
  double_shuffle: { icon: '🔄', name: 'Double Shuffle', description: 'Cards shuffle twice' },
  hidden_matches: { icon: '🔮', name: 'Hidden Matches', description: 'Matched pairs stay hidden' },
  card_decay: { icon: '⏳', name: 'Card Decay', description: 'Unmatched cards fade over time' },
  no_timer_display: { icon: '❓', name: 'No Timer', description: 'Timer is hidden' },
  card_rotation: { icon: '🔃', name: 'Card Rotation', description: 'Cards rotate periodically' },
  one_chance: { icon: '💀', name: 'One Chance', description: 'One mistake ends the game' },
  all_mechanics: { icon: '🏆', name: 'Ultimate', description: 'All mechanics combined' },
};

// TIER 1: ONBOARDING (Levels 1-4) - Common NFT
// TIER 2: CORE SKILL (Levels 5-8) - Uncommon NFT
// TIER 3: ADVANCED (Levels 9-12) - Rare NFT
// TIER 4: MASTERY (Levels 13-16) - Epic NFT
// TIER 5: MYTHIC ENDGAME (Levels 17-20) - Legendary → Mythic NFT

export const LEVELS: LevelConfig[] = [
  // TIER 1: ONBOARDING (Common)
  {
    level: 1,
    gridSize: 2,
    gridColumns: 2,
    gridRows: 2,
    time: 60,
    label: 'Level 1',
    description: 'Tutorial • 2×2 grid',
    mechanics: ['tutorial', 'hints'],
    tier: 1,
    nftRarity: 'Common',
    tierName: 'Onboarding',
  },
  {
    level: 2,
    gridSize: 3,
    gridColumns: 3,
    gridRows: 2,
    time: 45,
    label: 'Level 2',
    description: 'Basic memory • 3×2 grid',
    mechanics: ['hints'],
    tier: 1,
    nftRarity: 'Common',
    tierName: 'Onboarding',
  },
  {
    level: 3,
    gridSize: 4,
    gridColumns: 4,
    gridRows: 3,
    time: 60,
    label: 'Level 3',
    description: 'No hints • 4×3 grid',
    mechanics: ['no_hints'],
    tier: 1,
    nftRarity: 'Common',
    tierName: 'Onboarding',
  },
  {
    level: 4,
    gridSize: 4,
    gridColumns: 4,
    gridRows: 3,
    time: 45,
    label: 'Level 4',
    description: 'First pressure • 4×3 grid',
    mechanics: ['no_hints', 'pressure'],
    tier: 1,
    nftRarity: 'Common',
    tierName: 'Onboarding',
  },

  // TIER 2: CORE SKILL (Uncommon)
  {
    level: 5,
    gridSize: 4,
    gridColumns: 4,
    gridRows: 4,
    time: 90,
    label: 'Level 5',
    description: 'Standard play • 4×4 grid',
    mechanics: ['no_hints'],
    tier: 2,
    nftRarity: 'Uncommon',
    tierName: 'Core Skill',
  },
  {
    level: 6,
    gridSize: 4,
    gridColumns: 4,
    gridRows: 4,
    time: 90,
    label: 'Level 6',
    description: 'Mid-game shuffle • 4×4 grid',
    mechanics: ['shuffle'],
    tier: 2,
    nftRarity: 'Uncommon',
    tierName: 'Core Skill',
  },
  {
    level: 7,
    gridSize: 5,
    gridColumns: 5,
    gridRows: 4,
    time: 100,
    label: 'Level 7',
    description: 'Limited mistakes • 5×4 grid',
    mechanics: ['limited_mistakes'],
    tier: 2,
    nftRarity: 'Uncommon',
    tierName: 'Core Skill',
  },
  {
    level: 8,
    gridSize: 5,
    gridColumns: 5,
    gridRows: 5,
    time: 120,
    label: 'Level 8',
    description: 'No preview • 5×5 grid',
    mechanics: ['no_preview'],
    tier: 2,
    nftRarity: 'Uncommon',
    tierName: 'Core Skill',
  },

  // TIER 3: ADVANCED MEMORY (Rare)
  {
    level: 9,
    gridSize: 5,
    gridColumns: 5,
    gridRows: 5,
    time: 120,
    label: 'Level 9',
    description: 'Fog of war • 5×5 grid',
    mechanics: ['fog'],
    tier: 3,
    nftRarity: 'Rare',
    tierName: 'Advanced',
  },
  {
    level: 10,
    gridSize: 6,
    gridColumns: 6,
    gridRows: 4,
    time: 100,
    label: 'Level 10',
    description: 'Flash preview • 6×4 grid',
    mechanics: ['flash_preview'],
    tier: 3,
    nftRarity: 'Rare',
    tierName: 'Advanced',
  },
  {
    level: 11,
    gridSize: 6,
    gridColumns: 6,
    gridRows: 5,
    time: 130,
    label: 'Level 11',
    description: 'Decoy cards • 6×5 grid',
    mechanics: ['decoys'],
    tier: 3,
    nftRarity: 'Rare',
    tierName: 'Advanced',
  },
  {
    level: 12,
    gridSize: 6,
    gridColumns: 6,
    gridRows: 6,
    time: 150,
    label: 'Level 12',
    description: 'Combo required • 6×6 grid',
    mechanics: ['combo_required'],
    tier: 3,
    nftRarity: 'Rare',
    tierName: 'Advanced',
  },

  // TIER 4: MASTERY (Epic)
  {
    level: 13,
    gridSize: 6,
    gridColumns: 6,
    gridRows: 6,
    time: 140,
    label: 'Level 13',
    description: 'Limited mistakes • 6×6 grid',
    mechanics: ['limited_mistakes', 'no_preview'],
    tier: 4,
    nftRarity: 'Epic',
    tierName: 'Mastery',
  },
  {
    level: 14,
    gridSize: 7,
    gridColumns: 7,
    gridRows: 6,
    time: 160,
    label: 'Level 14',
    description: 'Double shuffle • 7×6 grid',
    mechanics: ['double_shuffle'],
    tier: 4,
    nftRarity: 'Epic',
    tierName: 'Mastery',
  },
  {
    level: 15,
    gridSize: 7,
    gridColumns: 7,
    gridRows: 7,
    time: 180,
    label: 'Level 15',
    description: 'Hidden matches • 7×7 grid',
    mechanics: ['hidden_matches'],
    tier: 4,
    nftRarity: 'Epic',
    tierName: 'Mastery',
  },
  {
    level: 16,
    gridSize: 8,
    gridColumns: 8,
    gridRows: 6,
    time: 170,
    label: 'Level 16',
    description: 'Card decay • 8×6 grid',
    mechanics: ['card_decay'],
    tier: 4,
    nftRarity: 'Epic',
    tierName: 'Mastery',
  },

  // TIER 5: MYTHIC ENDGAME (Legendary → Mythic)
  {
    level: 17,
    gridSize: 8,
    gridColumns: 8,
    gridRows: 7,
    time: 200,
    label: 'Level 17',
    description: 'No visible timer • 8×7 grid',
    mechanics: ['no_timer_display', 'shuffle'],
    tier: 5,
    nftRarity: 'Legendary',
    tierName: 'Endgame',
  },
  {
    level: 18,
    gridSize: 8,
    gridColumns: 8,
    gridRows: 8,
    time: 220,
    label: 'Level 18',
    description: 'Card rotation • 8×8 grid',
    mechanics: ['card_rotation', 'limited_mistakes'],
    tier: 5,
    nftRarity: 'Legendary',
    tierName: 'Endgame',
  },
  {
    level: 19,
    gridSize: 9,
    gridColumns: 9,
    gridRows: 8,
    time: 240,
    label: 'Level 19',
    description: 'One-chance mode • 9×8 grid',
    mechanics: ['one_chance'],
    tier: 5,
    nftRarity: 'Legendary',
    tierName: 'Endgame',
  },
  {
    level: 20,
    gridSize: 9,
    gridColumns: 9,
    gridRows: 9,
    time: 300,
    label: 'Level 20',
    description: 'Ultimate challenge • 9×9 grid',
    mechanics: ['all_mechanics'],
    tier: 5,
    nftRarity: 'Mythic',
    tierName: 'Mythic',
  },
];

// Tier unlock rewards
export const TIER_REWARDS: Record<number, { rarity: NFTRarityTier; description: string; unlockLevel: number }> = {
  1: { rarity: 'Common', description: 'Static, soulbound NFT', unlockLevel: 4 },
  2: { rarity: 'Uncommon', description: 'Animated, tradable NFT', unlockLevel: 8 },
  3: { rarity: 'Rare', description: 'Animated + upgradable NFT', unlockLevel: 12 },
  4: { rarity: 'Epic', description: 'Evolving art NFT', unlockLevel: 16 },
  5: { rarity: 'Mythic', description: 'Fully animated scene NFT', unlockLevel: 20 },
};

// Helper functions
export function getLevel(levelNumber: number): LevelConfig {
  const level = LEVELS.find((l) => l.level === levelNumber);
  return level || LEVELS[0];
}

export function getMaxLevel(): number {
  return LEVELS.length;
}

export function getTierForLevel(levelNumber: number): number {
  const level = getLevel(levelNumber);
  return level.tier;
}

export function getNFTRarityForLevel(levelNumber: number): NFTRarityTier {
  const level = getLevel(levelNumber);
  return level.nftRarity;
}

export function getLevelsInTier(tier: number): LevelConfig[] {
  return LEVELS.filter((l) => l.tier === tier);
}

export function getTierProgress(currentLevel: number): { completed: number; total: number; tier: number } {
  const level = getLevel(currentLevel);
  const tierLevels = getLevelsInTier(level.tier);
  const completedInTier = tierLevels.filter((l) => l.level < currentLevel).length;
  return {
    completed: completedInTier,
    total: tierLevels.length,
    tier: level.tier,
  };
}

// Local storage for progress
const PROGRESS_KEY = 'memorymint_unlocked_level';

export function getUnlockedLevel(): number {
  // TODO: Remove this override after testing - unlocks all levels
  return 20;
  // try {
  //   const saved = localStorage.getItem(PROGRESS_KEY);
  //   return saved ? parseInt(saved, 10) : 1;
  // } catch {
  //   return 1;
  // }
}

export function saveUnlockedLevel(level: number): void {
  try {
    const current = getUnlockedLevel();
    if (level > current) {
      localStorage.setItem(PROGRESS_KEY, level.toString());
    }
  } catch {
    // Ignore storage errors
  }
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Ignore storage errors
  }
}
