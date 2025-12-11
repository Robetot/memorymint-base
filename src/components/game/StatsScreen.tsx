import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Clock, Target, Zap, Medal } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Difficulty, DIFFICULTY_CONFIG } from '@/data/animals';

interface StatsScreenProps {
  onBack: () => void;
}

export function StatsScreen({ onBack }: StatsScreenProps) {
  const { entries } = useLeaderboard();
  const difficulties: Difficulty[] = ['2x2', '4x4', '6x6'];

  // Calculate stats
  const totalGames = entries.length;
  const totalScore = entries.reduce((sum, e) => sum + e.score, 0);
  const bestScore = entries.length > 0 ? Math.max(...entries.map(e => e.score)) : 0;
  const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
  const bestCombo = entries.length > 0 ? Math.max(...entries.map(e => e.maxCombo)) : 0;
  const totalMoves = entries.reduce((sum, e) => sum + e.moves, 0);
  const totalTime = entries.reduce((sum, e) => sum + e.time, 0);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  // Games per difficulty
  const gamesByDifficulty = difficulties.map(diff => ({
    difficulty: diff,
    label: DIFFICULTY_CONFIG[diff].label,
    count: entries.filter(e => e.difficulty === diff).length,
    bestScore: Math.max(0, ...entries.filter(e => e.difficulty === diff).map(e => e.score)),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Statistics
          </h1>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-display font-bold text-foreground">{totalGames}</p>
            <p className="text-xs text-muted-foreground font-body">Games Played</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Medal className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-display font-bold text-foreground">{bestScore.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground font-body">Best Score</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-secondary" />
            <p className="text-2xl font-display font-bold text-foreground">{totalMoves}</p>
            <p className="text-xs text-muted-foreground font-body">Total Moves</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Zap className="w-8 h-8 mx-auto mb-2 text-success" />
            <p className="text-2xl font-display font-bold text-foreground">x{bestCombo}</p>
            <p className="text-xs text-muted-foreground font-body">Best Combo</p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="font-display font-semibold text-foreground mb-4">Overview</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-body">Average Score</span>
              <span className="font-display font-bold text-foreground">{avgScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-body">Total Score</span>
              <span className="font-display font-bold text-foreground">{totalScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-body flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Total Play Time
              </span>
              <span className="font-display font-bold text-foreground">{formatTime(totalTime)}</span>
            </div>
          </div>
        </div>

        {/* By Difficulty */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-display font-semibold text-foreground mb-4">By Difficulty</h2>
          <div className="space-y-3">
            {gamesByDifficulty.map(stat => (
              <div key={stat.difficulty} className="flex justify-between items-center">
                <div>
                  <span className="font-display font-medium text-foreground">{stat.label}</span>
                  <span className="text-muted-foreground text-sm ml-2">({stat.count} games)</span>
                </div>
                <span className="font-display font-bold text-primary">
                  {stat.bestScore > 0 ? stat.bestScore.toLocaleString() : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
