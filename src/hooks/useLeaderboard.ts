import { useState, useEffect, useCallback } from 'react';
import { Difficulty } from '@/data/animals';

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  moves: number;
  time: number;
  difficulty: Difficulty;
  maxCombo: number;
  date: string;
}

const STORAGE_KEY = 'memorymint_leaderboard';
const MAX_ENTRIES_PER_DIFFICULTY = 10;

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setEntries(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse leaderboard:', e);
      }
    }
  }, []);

  // Save to localStorage whenever entries change
  const saveEntries = useCallback((newEntries: LeaderboardEntry[]) => {
    setEntries(newEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
  }, []);

  const addEntry = useCallback((entry: Omit<LeaderboardEntry, 'id' | 'date'>) => {
    const newEntry: LeaderboardEntry = {
      ...entry,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };

    setEntries((prev) => {
      // Add new entry and filter by difficulty
      const allEntries = [...prev, newEntry];
      
      // Group by difficulty, sort each group, keep top N
      const grouped = allEntries.reduce((acc, e) => {
        if (!acc[e.difficulty]) acc[e.difficulty] = [];
        acc[e.difficulty].push(e);
        return acc;
      }, {} as Record<Difficulty, LeaderboardEntry[]>);

      const result: LeaderboardEntry[] = [];
      Object.keys(grouped).forEach((diff) => {
        const sorted = grouped[diff as Difficulty]
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_ENTRIES_PER_DIFFICULTY);
        result.push(...sorted);
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      return result;
    });

    return newEntry;
  }, []);

  const getEntriesByDifficulty = useCallback((difficulty: Difficulty) => {
    return entries
      .filter((e) => e.difficulty === difficulty)
      .sort((a, b) => b.score - a.score);
  }, [entries]);

  const getTopScore = useCallback((difficulty: Difficulty) => {
    const diffEntries = getEntriesByDifficulty(difficulty);
    return diffEntries[0]?.score ?? 0;
  }, [getEntriesByDifficulty]);

  const clearLeaderboard = useCallback(() => {
    saveEntries([]);
  }, [saveEntries]);

  return {
    entries,
    addEntry,
    getEntriesByDifficulty,
    getTopScore,
    clearLeaderboard,
  };
}
