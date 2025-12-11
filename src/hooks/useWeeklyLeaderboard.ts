import { useState, useEffect, useCallback } from 'react';

export interface WeeklyLeaderboardEntry {
  id: string;
  walletAddress: string;
  displayName: string;
  time: number;
  score: number;
  moves: number;
  maxCombo: number;
  challengeId: string;
  date: string;
}

const STORAGE_KEY = 'memorymint_weekly_leaderboard';
const MAX_ENTRIES = 100;

const getWeekNumber = (date: Date): string => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  return `week_${weekNum}_${date.getFullYear()}`;
};

const truncateAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function useWeeklyLeaderboard() {
  const [entries, setEntries] = useState<WeeklyLeaderboardEntry[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    const weekId = getWeekNumber(new Date());
    setCurrentWeekId(weekId);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const allEntries: WeeklyLeaderboardEntry[] = JSON.parse(stored);
        // Filter to current week only
        const weekEntries = allEntries.filter(e => e.challengeId === weekId);
        setEntries(weekEntries);
      } catch (e) {
        console.error('Failed to parse weekly leaderboard:', e);
      }
    }
  }, []);

  const addEntry = useCallback((entry: {
    walletAddress: string;
    displayName?: string;
    time: number;
    score: number;
    moves: number;
    maxCombo: number;
  }) => {
    const weekId = getWeekNumber(new Date());
    
    const newEntry: WeeklyLeaderboardEntry = {
      id: crypto.randomUUID(),
      walletAddress: entry.walletAddress,
      displayName: entry.displayName || truncateAddress(entry.walletAddress),
      time: entry.time,
      score: entry.score,
      moves: entry.moves,
      maxCombo: entry.maxCombo,
      challengeId: weekId,
      date: new Date().toISOString(),
    };

    setEntries(prev => {
      // Check if this wallet already has an entry this week
      const existingIndex = prev.findIndex(
        e => e.walletAddress.toLowerCase() === entry.walletAddress.toLowerCase()
      );

      let updated: WeeklyLeaderboardEntry[];
      
      if (existingIndex >= 0) {
        // Only update if new time is better (faster)
        if (prev[existingIndex].time <= entry.time) {
          return prev; // Existing entry is better or equal
        }
        updated = [...prev];
        updated[existingIndex] = newEntry;
      } else {
        updated = [...prev, newEntry];
      }

      // Sort by time (fastest first), then by score (highest first)
      updated.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return b.score - a.score;
      });

      // Keep top N entries
      updated = updated.slice(0, MAX_ENTRIES);

      // Save all entries (including other weeks for history)
      const stored = localStorage.getItem(STORAGE_KEY);
      let allEntries: WeeklyLeaderboardEntry[] = [];
      if (stored) {
        try {
          allEntries = JSON.parse(stored);
          // Remove old entries for current week
          allEntries = allEntries.filter(e => e.challengeId !== weekId);
        } catch (e) {
          console.error('Failed to parse stored leaderboard:', e);
        }
      }
      allEntries = [...allEntries, ...updated];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));

      return updated;
    });

    return newEntry;
  }, []);

  const getTopEntries = useCallback((limit: number = 10) => {
    return entries.slice(0, limit);
  }, [entries]);

  const getPlayerRank = useCallback((walletAddress: string) => {
    const index = entries.findIndex(
      e => e.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
    return index >= 0 ? index + 1 : null;
  }, [entries]);

  const getPlayerEntry = useCallback((walletAddress: string) => {
    return entries.find(
      e => e.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  }, [entries]);

  return {
    entries,
    currentWeekId,
    addEntry,
    getTopEntries,
    getPlayerRank,
    getPlayerEntry,
  };
}
