// High Score Management Utility for Memory Game

export interface ScoreData {
  score: number;
  matches: number;
  streak: number;
  date: string;
}

const STORAGE_KEY_PREFIX = 'memorymint_highscore_';

/**
 * Calculate the final score based on game performance
 */
export function calculateScore(
  matches: number,
  timeLeft: number,
  streak: number,
  comboMultiplier: number
): number {
  const baseScore = matches * 100;
  const timeBonus = timeLeft * 5;
  const streakBonus = streak * 50;
  const comboBonus = Math.floor(comboMultiplier * 25);
  
  return Math.floor((baseScore + timeBonus + streakBonus + comboBonus) * Math.max(comboMultiplier, 1));
}

/**
 * Get the high score for a specific game mode/difficulty
 */
export function getHighScore(key: string): number {
  if (typeof window === 'undefined') return 0;
  
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!data) return 0;
    
    const parsed: ScoreData = JSON.parse(data);
    return parsed.score || 0;
  } catch {
    return 0;
  }
}

/**
 * Get full high score data for a specific game mode/difficulty
 */
export function getHighScoreData(key: string): ScoreData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!data) return null;
    
    return JSON.parse(data) as ScoreData;
  } catch {
    return null;
  }
}

/**
 * Set the high score if it's a new record
 * Returns true if it's a new high score
 */
export function setHighScore(
  key: string,
  score: number,
  matches: number,
  streak: number
): boolean {
  if (typeof window === 'undefined') return false;
  
  const currentHigh = getHighScore(key);
  
  if (score > currentHigh) {
    const scoreData: ScoreData = {
      score,
      matches,
      streak,
      date: new Date().toISOString()
    };
    
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(scoreData));
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Clear high score for a specific key
 */
export function clearHighScore(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch {
    // Silently fail
  }
}

/**
 * Get all high scores
 */
export function getAllHighScores(): Record<string, ScoreData> {
  if (typeof window === 'undefined') return {};
  
  const scores: Record<string, ScoreData> = {};
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const scoreKey = key.replace(STORAGE_KEY_PREFIX, '');
          scores[scoreKey] = JSON.parse(data);
        }
      }
    }
  } catch {
    // Return whatever we have
  }
  
  return scores;
}
