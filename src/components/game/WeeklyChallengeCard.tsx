import React from 'react';
import { WeeklyChallenge } from '@/hooks/useWeeklyChallenge';
import { Trophy, Clock, Zap, Gift, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeeklyChallengeCardProps {
  challenge: WeeklyChallenge;
  isCompleted: boolean;
  bestTime: number | null;
  timeRemaining: string;
  onStart: () => void;
}

export const WeeklyChallengeCard: React.FC<WeeklyChallengeCardProps> = ({
  challenge,
  isCompleted,
  bestTime,
  timeRemaining,
  onStart,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-pink-900/20 p-5">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-pink-500/5 animate-pulse" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-purple-400" />
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
              Weekly Challenge
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeRemaining}
          </span>
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">{challenge.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{challenge.description}</p>

        {/* Modifiers */}
        <div className="flex flex-wrap gap-2 mb-4">
          {challenge.modifiers.map(mod => (
            <div
              key={mod.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-xs"
              title={mod.description}
            >
              <span>{mod.icon}</span>
              <span className="text-red-300">{mod.name}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="p-2 rounded-lg bg-card/50">
            <span className="text-lg font-bold text-foreground">{challenge.gridSize}x{challenge.gridSize}</span>
            <span className="text-xs text-muted-foreground block">Grid</span>
          </div>
          <div className="p-2 rounded-lg bg-card/50">
            <span className="text-lg font-bold text-foreground">{challenge.timeLimit}s</span>
            <span className="text-xs text-muted-foreground block">Time</span>
          </div>
          <div className="p-2 rounded-lg bg-card/50">
            <span className="text-lg font-bold text-foreground">{challenge.flipLimit}</span>
            <span className="text-xs text-muted-foreground block">Flips</span>
          </div>
        </div>

        {/* NFT Reward */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-300">Exclusive NFT Reward</span>
          </div>
          <p className="text-xs text-foreground/80">
            <span className="text-yellow-400">{challenge.nftReward.rarity}</span> {challenge.nftReward.style} style
          </p>
          <p className="text-xs text-muted-foreground">{challenge.nftReward.bonus}</p>
        </div>

        {isCompleted ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/20 border border-green-500/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm font-semibold text-green-300">Completed!</span>
            </div>
            {bestTime && (
              <span className="text-xs text-green-300">Best: {bestTime}s</span>
            )}
          </div>
        ) : (
          <Button
            onClick={onStart}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
          >
            <Zap className="w-4 h-4 mr-2" />
            Start Weekly Challenge
          </Button>
        )}
      </div>
    </div>
  );
};
