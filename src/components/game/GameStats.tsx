import { Timer, Zap, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameStatsProps {
  timeRemaining: number;
  moves: number;
  matchedPairs: number;
  totalPairs: number;
  combo: number;
  score: number;
}

export function GameStats({
  timeRemaining,
  moves,
  matchedPairs,
  totalPairs,
  combo,
  score,
}: GameStatsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining <= 30;

  return (
    <div className="w-full max-w-lg mx-auto px-4 mb-6">
      {/* Main stats bar */}
      <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Timer */}
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-xl transition-all',
            isLowTime ? 'bg-destructive/20 animate-pulse' : 'bg-muted/50'
          )}>
            <Timer className={cn(
              'w-5 h-5',
              isLowTime ? 'text-destructive' : 'text-primary'
            )} />
            <div>
              <p className="text-xs text-muted-foreground font-body">Time</p>
              <p className={cn(
                'text-lg font-display font-bold',
                isLowTime ? 'text-destructive' : 'text-foreground'
              )}>
                {formatTime(timeRemaining)}
              </p>
            </div>
          </div>

          {/* Moves */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
            <Target className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-xs text-muted-foreground font-body">Moves</p>
              <p className="text-lg font-display font-bold text-foreground">{moves}</p>
            </div>
          </div>

          {/* Pairs */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
            <Trophy className="w-5 h-5 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground font-body">Pairs</p>
              <p className="text-lg font-display font-bold text-foreground">
                {matchedPairs}/{totalPairs}
              </p>
            </div>
          </div>

          {/* Combo */}
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-xl transition-all',
            combo > 1 ? 'bg-success/20 glow-success' : 'bg-muted/50'
          )}>
            <Zap className={cn(
              'w-5 h-5',
              combo > 1 ? 'text-success' : 'text-muted-foreground'
            )} />
            <div>
              <p className="text-xs text-muted-foreground font-body">Combo</p>
              <p className={cn(
                'text-lg font-display font-bold',
                combo > 1 ? 'text-success' : 'text-foreground'
              )}>
                x{combo}
              </p>
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-body">Score</span>
          <span className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {score.toLocaleString()}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
            style={{ width: `${(matchedPairs / totalPairs) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
