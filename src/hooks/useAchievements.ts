import { useState, useEffect, useCallback } from 'react';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'combo' | 'perfect' | 'speed' | 'progress' | 'special';
  requirement: number;
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number;
}

const ACHIEVEMENTS: Omit<Achievement, 'unlocked' | 'unlockedAt' | 'progress'>[] = [
  // Combo achievements
  { id: 'combo_starter', name: 'Combo Starter', description: 'Get a 3x combo', icon: '🔥', category: 'combo', requirement: 3 },
  { id: 'combo_master', name: 'Combo Master', description: 'Get a 5x combo', icon: '💥', category: 'combo', requirement: 5 },
  { id: 'combo_legend', name: 'Combo Legend', description: 'Get a 10x combo', icon: '⚡', category: 'combo', requirement: 10 },
  
  // Perfect game achievements
  { id: 'first_perfect', name: 'First Perfect', description: 'Complete a level with no mistakes', icon: '⭐', category: 'perfect', requirement: 1 },
  { id: 'perfect_streak', name: 'Perfect Streak', description: 'Get 5 perfect games', icon: '🌟', category: 'perfect', requirement: 5 },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Get 25 perfect games', icon: '✨', category: 'perfect', requirement: 25 },
  
  // Speed achievements
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a level in under 30 seconds', icon: '⚡', category: 'speed', requirement: 30 },
  { id: 'lightning_fast', name: 'Lightning Fast', description: 'Complete a level in under 15 seconds', icon: '🌩️', category: 'speed', requirement: 15 },
  
  // Progress achievements
  { id: 'first_win', name: 'First Victory', description: 'Complete your first level', icon: '🏆', category: 'progress', requirement: 1 },
  { id: 'dedicated', name: 'Dedicated Player', description: 'Complete 10 levels', icon: '🎯', category: 'progress', requirement: 10 },
  { id: 'veteran', name: 'Veteran', description: 'Complete 50 levels', icon: '🏅', category: 'progress', requirement: 50 },
  { id: 'master', name: 'Memory Master', description: 'Complete 100 levels', icon: '👑', category: 'progress', requirement: 100 },
  
  // Special achievements
  { id: 'daily_warrior', name: 'Daily Warrior', description: 'Complete 7 daily challenges', icon: '📅', category: 'special', requirement: 7 },
  { id: 'nft_collector', name: 'NFT Collector', description: 'Mint 5 NFTs', icon: '🎨', category: 'special', requirement: 5 },
  { id: 'power_user', name: 'Power User', description: 'Use 20 power-ups', icon: '💪', category: 'special', requirement: 20 },
];

const STORAGE_KEY = 'memorymint_achievements';

export const useAchievements = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newUnlock, setNewUnlock] = useState<Achievement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setAchievements(JSON.parse(stored));
    } else {
      const initial = ACHIEVEMENTS.map(a => ({ ...a, unlocked: false, progress: 0 }));
      setAchievements(initial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    }
  }, []);

  const saveAchievements = useCallback((updated: Achievement[]) => {
    setAchievements(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const checkAndUnlock = useCallback((id: string, currentValue: number) => {
    setAchievements(prev => {
      const updated = prev.map(a => {
        if (a.id === id) {
          const newProgress = Math.max(a.progress, currentValue);
          if (!a.unlocked && newProgress >= a.requirement) {
            const unlocked = { ...a, unlocked: true, unlockedAt: new Date(), progress: newProgress };
            setTimeout(() => setNewUnlock(unlocked), 100);
            return unlocked;
          }
          return { ...a, progress: newProgress };
        }
        return a;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const trackCombo = useCallback((combo: number) => {
    if (combo >= 3) checkAndUnlock('combo_starter', combo);
    if (combo >= 5) checkAndUnlock('combo_master', combo);
    if (combo >= 10) checkAndUnlock('combo_legend', combo);
  }, [checkAndUnlock]);

  const trackPerfectGame = useCallback(() => {
    const current = achievements.find(a => a.id === 'first_perfect')?.progress || 0;
    checkAndUnlock('first_perfect', current + 1);
    checkAndUnlock('perfect_streak', current + 1);
    checkAndUnlock('perfectionist', current + 1);
  }, [achievements, checkAndUnlock]);

  const trackSpeed = useCallback((seconds: number) => {
    if (seconds <= 30) checkAndUnlock('speed_demon', 30 - seconds);
    if (seconds <= 15) checkAndUnlock('lightning_fast', 15 - seconds);
  }, [checkAndUnlock]);

  const trackLevelComplete = useCallback(() => {
    const current = achievements.find(a => a.id === 'first_win')?.progress || 0;
    checkAndUnlock('first_win', current + 1);
    checkAndUnlock('dedicated', current + 1);
    checkAndUnlock('veteran', current + 1);
    checkAndUnlock('master', current + 1);
  }, [achievements, checkAndUnlock]);

  const trackDailyChallenge = useCallback(() => {
    const current = achievements.find(a => a.id === 'daily_warrior')?.progress || 0;
    checkAndUnlock('daily_warrior', current + 1);
  }, [achievements, checkAndUnlock]);

  const trackNFTMint = useCallback(() => {
    const current = achievements.find(a => a.id === 'nft_collector')?.progress || 0;
    checkAndUnlock('nft_collector', current + 1);
  }, [achievements, checkAndUnlock]);

  const trackPowerUp = useCallback(() => {
    const current = achievements.find(a => a.id === 'power_user')?.progress || 0;
    checkAndUnlock('power_user', current + 1);
  }, [achievements, checkAndUnlock]);

  const dismissNewUnlock = useCallback(() => setNewUnlock(null), []);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  return {
    achievements,
    newUnlock,
    dismissNewUnlock,
    trackCombo,
    trackPerfectGame,
    trackSpeed,
    trackLevelComplete,
    trackDailyChallenge,
    trackNFTMint,
    trackPowerUp,
    unlockedCount,
    totalCount,
  };
};
