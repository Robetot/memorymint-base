import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Target, Clock, Zap, Trash2 } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Difficulty, DIFFICULTY_CONFIG } from '@/data/animals';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LeaderboardProps {
  onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
  const { getEntriesByDifficulty, clearLeaderboard } = useLeaderboard();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('4x4');

  const entries = getEntriesByDifficulty(selectedDifficulty);
  const difficulties: Difficulty[] = ['2x2', '4x4', '6x6', '8x8'];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearLeaderboard}
            className="rounded-full text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Difficulty Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {difficulties.map((diff) => (
            <Button
              key={diff}
              variant={selectedDifficulty === diff ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDifficulty(diff)}
              className={cn(
                'font-display whitespace-nowrap',
                selectedDifficulty === diff && 'bg-gradient-to-r from-primary to-secondary'
              )}
            >
              {DIFFICULTY_CONFIG[diff].label}
            </Button>
          ))}
        </div>

        {/* Leaderboard List */}
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground font-body">No scores yet!</p>
            <p className="text-sm text-muted-foreground/70 font-body">
              Play a game to get on the leaderboard
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  'bg-card border rounded-xl p-4 flex items-center gap-4',
                  index === 0 && 'border-accent bg-accent/5',
                  index === 1 && 'border-muted-foreground/50',
                  index === 2 && 'border-orange-400/50'
                )}
              >
                {/* Rank */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg',
                    index === 0 && 'bg-accent text-accent-foreground',
                    index === 1 && 'bg-muted-foreground/20 text-muted-foreground',
                    index === 2 && 'bg-orange-400/20 text-orange-400',
                    index > 2 && 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-foreground truncate">
                    {entry.playerName}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    {formatDate(entry.date)}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Target className="w-4 h-4" />
                    <span>{entry.moves}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(entry.time)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-success">
                    <Zap className="w-4 h-4" />
                    <span>x{entry.maxCombo}</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="font-display font-bold text-lg text-primary">
                    {entry.score.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
