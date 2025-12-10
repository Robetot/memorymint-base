// Level progression system - 10 levels with increasing difficulty

export interface LevelConfig {
  level: number;
  gridSize: number;
  time: number;
  label: string;
  description: string;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, gridSize: 1, time: 30, label: 'Level 1', description: '1x1 • Tutorial' },
  { level: 2, gridSize: 2, time: 30, label: 'Level 2', description: '2x2 • 2 pairs • 30s' },
  { level: 3, gridSize: 3, time: 45, label: 'Level 3', description: '3x3 • 4 pairs • 45s' },
  { level: 4, gridSize: 4, time: 60, label: 'Level 4', description: '4x4 • 8 pairs • 60s' },
  { level: 5, gridSize: 5, time: 90, label: 'Level 5', description: '5x5 • 12 pairs • 90s' },
  { level: 6, gridSize: 6, time: 120, label: 'Level 6', description: '6x6 • 18 pairs • 2 min' },
  { level: 7, gridSize: 7, time: 150, label: 'Level 7', description: '7x7 • 24 pairs • 2.5 min' },
  { level: 8, gridSize: 8, time: 180, label: 'Level 8', description: '8x8 • 32 pairs • 3 min' },
  { level: 9, gridSize: 9, time: 240, label: 'Level 9', description: '9x9 • 40 pairs • 4 min' },
  { level: 10, gridSize: 10, time: 300, label: 'Level 10', description: '10x10 • 50 pairs • 5 min' },
];

export const getLevel = (levelNumber: number): LevelConfig => {
  const level = LEVELS.find(l => l.level === levelNumber);
  return level || LEVELS[0];
};

export const getMaxLevel = (): number => LEVELS.length;

// Storage key for player progress
const PROGRESS_KEY = 'memorymint_level_progress';
const NFT_NAME_KEY = 'memorymint_nft_name';
const TUTORIAL_SHOWN_KEY = 'memorymint_level1_tutorial_shown';

export const getUnlockedLevel = (): number => {
  try {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? Math.min(parseInt(saved, 10), LEVELS.length) : 1;
  } catch {
    return 1;
  }
};

export const saveUnlockedLevel = (level: number): void => {
  try {
    const current = getUnlockedLevel();
    if (level > current) {
      localStorage.setItem(PROGRESS_KEY, String(level));
    }
  } catch {
    // Silently fail
  }
};

export const resetProgress = (): void => {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Silently fail
  }
};

// NFT name persistence
export const getSavedNFTName = (): string | null => {
  try {
    return localStorage.getItem(NFT_NAME_KEY);
  } catch {
    return null;
  }
};

export const saveNFTName = (name: string): void => {
  try {
    localStorage.setItem(NFT_NAME_KEY, name);
  } catch {
    // Silently fail
  }
};

// Level 1 tutorial shown flag
export const hasShownLevel1Tutorial = (): boolean => {
  try {
    return localStorage.getItem(TUTORIAL_SHOWN_KEY) === 'true';
  } catch {
    return false;
  }
};

export const markLevel1TutorialShown = (): void => {
  try {
    localStorage.setItem(TUTORIAL_SHOWN_KEY, 'true');
  } catch {
    // Silently fail
  }
};
