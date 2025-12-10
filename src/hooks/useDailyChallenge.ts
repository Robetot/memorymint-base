import { useState, useEffect, useCallback } from 'react';

export interface DailyChallenge {
  id: string;
  date: string;
  title: string;
  description: string;
  gridSize: number;
  timeLimit: number;
  modifier: 'speed' | 'memory' | 'chaos' | 'precision' | 'endurance';
  reward: string;
  completed: boolean;
}

const CHALLENGE_MODIFIERS = {
  speed: { name: 'Speed Run', description: 'Complete as fast as possible', timeMultiplier: 0.5 },
  memory: { name: 'Memory Master', description: 'Cards hide after 1 second preview', timeMultiplier: 1 },
  chaos: { name: 'Chaos Mode', description: 'Cards shuffle every 15 seconds', timeMultiplier: 1.5 },
  precision: { name: 'Perfect Only', description: 'No mistakes allowed', timeMultiplier: 1.2 },
  endurance: { name: 'Endurance', description: 'Extra large board', timeMultiplier: 2 },
};

const generateDailyChallenge = (date: string): DailyChallenge => {
  const seed = date.split('-').reduce((acc, val) => acc + parseInt(val), 0);
  const modifiers = Object.keys(CHALLENGE_MODIFIERS) as Array<keyof typeof CHALLENGE_MODIFIERS>;
  const modifierIndex = seed % modifiers.length;
  const modifier = modifiers[modifierIndex];
  const gridSizes = [4, 6, 6, 8];
  const gridSize = gridSizes[seed % gridSizes.length];
  const baseTime = gridSize === 4 ? 60 : gridSize === 6 ? 120 : 180;
  const timeLimit = Math.floor(baseTime * CHALLENGE_MODIFIERS[modifier].timeMultiplier);

  return {
    id: `daily-${date}`,
    date,
    title: CHALLENGE_MODIFIERS[modifier].name,
    description: CHALLENGE_MODIFIERS[modifier].description,
    gridSize,
    timeLimit,
    modifier,
    reward: modifier === 'endurance' ? '🏆 Legendary Badge' : modifier === 'precision' ? '💎 Perfection Badge' : '⭐ Daily Star',
    completed: false,
  };
};

const STORAGE_KEY = 'memorymint_daily_challenges';

export function useDailyChallenge() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [completedDates, setCompletedDates] = useState<string[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(STORAGE_KEY);
    const completed: string[] = stored ? JSON.parse(stored) : [];
    setCompletedDates(completed);

    const dailyChallenge = generateDailyChallenge(today);
    dailyChallenge.completed = completed.includes(today);
    setChallenge(dailyChallenge);
  }, []);

  const completeChallenge = useCallback(() => {
    if (!challenge) return;
    const today = new Date().toISOString().split('T')[0];
    const newCompleted = [...completedDates, today];
    setCompletedDates(newCompleted);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCompleted));
    setChallenge(prev => prev ? { ...prev, completed: true } : null);
  }, [challenge, completedDates]);

  const getStreak = useCallback(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      if (completedDates.includes(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }, [completedDates]);

  return {
    challenge,
    completedDates,
    completeChallenge,
    getStreak,
  };
}
