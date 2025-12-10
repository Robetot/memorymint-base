import { DailyChallenge } from '@/hooks/useDailyChallenge';
import { Calendar, Clock, Trophy, Flame } from 'lucide-react';

interface DailyChallengeCardProps {
  challenge: DailyChallenge | null;
  streak: number;
  onStart: () => void;
}

export function DailyChallengeCard({ challenge, streak, onStart }: DailyChallengeCardProps) {
  if (!challenge) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 border border-primary/30 p-4 mb-4">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.1),transparent_70%)] animate-pulse" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">Daily Challenge</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-full">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-orange-500">{streak} day streak!</span>
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold text-foreground mb-1">{challenge.title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{challenge.description}</p>

        <div className="flex items-center gap-4 mb-3 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>🎯</span>
            <span>{challenge.gridSize}x{challenge.gridSize} grid</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(challenge.timeLimit)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-foreground">{challenge.reward}</span>
          </div>
          
          {challenge.completed ? (
            <div className="px-4 py-2 bg-green-500/20 text-green-500 rounded-lg font-bold text-sm flex items-center gap-2">
              <span>✓</span> Completed!
            </div>
          ) : (
            <button
              onClick={onStart}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors transform hover:scale-105"
            >
              Play Challenge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
