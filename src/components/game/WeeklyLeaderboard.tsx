import { useWeeklyLeaderboard } from '@/hooks/useWeeklyLeaderboard';
import { useWeeklyChallenge } from '@/hooks/useWeeklyChallenge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Clock, Target, Zap, Crown, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyLeaderboardProps {
  onBack: () => void;
  currentWallet?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-gray-300" />;
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm text-muted-foreground">{rank}</span>;
  }
};

const getRankBg = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50';
    case 2:
      return 'bg-gradient-to-r from-gray-400/20 to-gray-300/20 border-gray-400/50';
    case 3:
      return 'bg-gradient-to-r from-amber-600/20 to-orange-500/20 border-amber-600/50';
    default:
      return 'bg-secondary/30 border-border/50';
  }
};

export function WeeklyLeaderboard({ onBack, currentWallet }: WeeklyLeaderboardProps) {
  const { entries, getPlayerRank, getPlayerEntry } = useWeeklyLeaderboard();
  const { challenge, getTimeRemaining } = useWeeklyChallenge();

  const playerRank = currentWallet ? getPlayerRank(currentWallet) : null;
  const playerEntry = currentWallet ? getPlayerEntry(currentWallet) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-accent" />
              Weekly Leaderboard
            </h1>
            {challenge && (
              <p className="text-sm text-muted-foreground">
                {challenge.name} • {getTimeRemaining()}
              </p>
            )}
          </div>
        </div>

        {/* Challenge Info */}
        {challenge && (
          <div className="bg-secondary/30 rounded-xl p-4 mb-6 border border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex gap-1">
                {challenge.modifiers.map(mod => (
                  <span key={mod.id} className="text-lg" title={mod.name}>
                    {mod.icon}
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium">{challenge.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{challenge.description}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-accent/20 rounded text-accent">
                🏆 {challenge.nftReward.rarity} NFT
              </span>
              <span className="text-muted-foreground">
                {challenge.nftReward.style} style
              </span>
            </div>
          </div>
        )}

        {/* Player Stats */}
        {playerRank && playerEntry && (
          <div className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  {getRankIcon(playerRank)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Rank</p>
                  <p className="text-lg font-bold">#{playerRank}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Best Time</p>
                <p className="text-lg font-bold">{formatTime(playerEntry.time)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard List */}
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No entries yet this week</p>
              <p className="text-sm">Complete the weekly challenge to be the first!</p>
            </div>
          ) : (
            entries.slice(0, 50).map((entry, index) => {
              const rank = index + 1;
              const isCurrentPlayer = currentWallet?.toLowerCase() === entry.walletAddress.toLowerCase();

              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    getRankBg(rank),
                    isCurrentPlayer && 'ring-2 ring-primary'
                  )}
                >
                  {/* Rank */}
                  <div className="w-8 flex justify-center">
                    {getRankIcon(rank)}
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'font-medium truncate',
                      isCurrentPlayer && 'text-primary'
                    )}>
                      {entry.displayName}
                      {isCurrentPlayer && ' (You)'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {entry.moves} moves
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        x{entry.maxCombo}
                      </span>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-bold">
                      <Clock className="w-4 h-4 text-accent" />
                      {formatTime(entry.time)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.score.toLocaleString()} pts
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}