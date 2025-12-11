import { useState, useEffect, useCallback } from 'react';

export interface WeeklyChallenge {
  id: string;
  name: string;
  description: string;
  modifiers: ChallengeModifier[];
  gridSize: number;
  timeLimit: number;
  flipLimit: number;
  nftReward: {
    style: string;
    rarity: string;
    bonus: string;
  };
  startDate: Date;
  endDate: Date;
}

export interface ChallengeModifier {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const MODIFIERS: ChallengeModifier[] = [
  { id: 'fog', name: 'Fog of War', description: 'Cards fade after being revealed', icon: '🌫️' },
  { id: 'mirror', name: 'Mirror Mode', description: 'Board flips horizontally mid-game', icon: '🪞' },
  { id: 'speed', name: 'Speed Demon', description: '50% less time', icon: '⚡' },
  { id: 'limited', name: 'Limited Flips', description: '30% fewer flips allowed', icon: '🎯' },
  { id: 'chaos', name: 'Chaos Shuffle', description: 'Unmatched cards shuffle every 10s', icon: '🌀' },
  { id: 'blind', name: 'Blind Start', description: 'No preview at start', icon: '🙈' },
  { id: 'decay', name: 'Time Decay', description: 'Timer speeds up over time', icon: '⏳' },
  { id: 'pressure', name: 'Under Pressure', description: 'Mistakes remove 5 seconds', icon: '💀' },
];

// Weekly themes limited to 6x6 max (18 pairs with 21 available animals)
const WEEKLY_THEMES = [
  { name: 'Speed Trial', modifiers: ['speed', 'limited'], gridSize: 6, timeMult: 0.5, flipMult: 0.7 },
  { name: 'Chaos Master', modifiers: ['chaos', 'mirror'], gridSize: 4, timeMult: 1.2, flipMult: 1 },
  { name: 'Fog Challenge', modifiers: ['fog', 'blind'], gridSize: 6, timeMult: 1.5, flipMult: 1 },
  { name: 'Pressure Cooker', modifiers: ['pressure', 'decay'], gridSize: 6, timeMult: 0.8, flipMult: 0.9 },
  { name: 'Ultimate Test', modifiers: ['speed', 'chaos', 'pressure'], gridSize: 6, timeMult: 0.6, flipMult: 0.8 },
];

const NFT_REWARDS = [
  { style: 'Mythic Fantasy', rarity: 'Legendary', bonus: '+50% XP for a week' },
  { style: 'Cyberpunk Neon', rarity: 'Epic', bonus: 'Exclusive border' },
  { style: 'Dark Gothic', rarity: 'Legendary', bonus: 'Animated background' },
  { style: '3D Sculpt', rarity: 'Mythic', bonus: 'Holographic effect' },
  { style: 'Anime', rarity: 'Epic', bonus: 'Special particle trail' },
];

const STORAGE_KEY = 'memorymint_weekly_challenge';

const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekEnd = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const useWeeklyChallenge = () => {
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const weekNum = getWeekNumber(now);
    const themeIndex = weekNum % WEEKLY_THEMES.length;
    const rewardIndex = weekNum % NFT_REWARDS.length;
    const theme = WEEKLY_THEMES[themeIndex];
    const reward = NFT_REWARDS[rewardIndex];

    const startDate = getWeekStart(now);
    const endDate = getWeekEnd(startDate);

    const baseTime = theme.gridSize === 6 ? 120 : 180;
    const baseFlips = theme.gridSize === 6 ? 50 : 80;

    const weeklyChallenge: WeeklyChallenge = {
      id: `week_${weekNum}_${now.getFullYear()}`,
      name: theme.name,
      description: `Complete the ${theme.gridSize}x${theme.gridSize} board with special modifiers`,
      modifiers: theme.modifiers.map(id => MODIFIERS.find(m => m.id === id)!),
      gridSize: theme.gridSize,
      timeLimit: Math.floor(baseTime * theme.timeMult),
      flipLimit: Math.floor(baseFlips * theme.flipMult),
      nftReward: reward,
      startDate,
      endDate,
    };

    setChallenge(weeklyChallenge);

    // Check stored completion
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.challengeId === weeklyChallenge.id) {
        setIsCompleted(data.completed);
        setBestTime(data.bestTime);
      }
    }
  }, []);

  const completeChallenge = useCallback((time: number) => {
    if (!challenge) return;
    
    const newBest = bestTime === null ? time : Math.min(bestTime, time);
    setIsCompleted(true);
    setBestTime(newBest);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      challengeId: challenge.id,
      completed: true,
      bestTime: newBest,
    }));
  }, [challenge, bestTime]);

  const getTimeRemaining = useCallback(() => {
    if (!challenge) return '';
    const now = new Date();
    const diff = challenge.endDate.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}d ${hours}h remaining`;
  }, [challenge]);

  return {
    challenge,
    isCompleted,
    bestTime,
    completeChallenge,
    getTimeRemaining,
  };
};
