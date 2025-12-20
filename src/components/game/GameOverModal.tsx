import { Button } from '@/components/ui/button';
import { Trophy, Clock, Target, RotateCcw, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RarityDisplay } from './RarityDisplay';
import { RarityResult } from '@/utils/rarityCalculator';
interface GameOverModalProps {
  isOpen: boolean;
  isWin: boolean;
  score: number;
  moves: number;
  timeRemaining: number;
  maxCombo: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  onCreateArt?: () => void;
  onNextLevel?: () => void;
  gameTime: number;
  rarity?: RarityResult | null;
  currentLevel?: number;
}

export function GameOverModal({
  isOpen,
  isWin,
  score,
  moves,
  timeRemaining,
  maxCombo,
  onPlayAgain,
  onBackToMenu,
  onCreateArt,
  onNextLevel,
  gameTime,
  rarity,
  currentLevel,
}: GameOverModalProps) {
  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeTaken = gameTime - timeRemaining;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 overflow-y-auto">
        <div className={cn(
          'bg-card border-2 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-bounce-in my-4',
          isWin ? 'border-success' : 'border-destructive'
        )}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className={cn(
              'w-16 h-16 md:w-20 md:h-20 mx-auto rounded-full flex items-center justify-center mb-4',
              isWin ? 'bg-success/20' : 'bg-destructive/20'
            )}>
              {isWin ? (
                <Trophy className="w-8 h-8 md:w-10 md:h-10 text-success" />
              ) : (
                <Clock className="w-8 h-8 md:w-10 md:h-10 text-destructive" />
              )}
            </div>
            <h2 className={cn(
              'text-2xl md:text-3xl font-display font-bold mb-2',
              isWin ? 'text-success' : 'text-destructive'
            )}>
              {isWin ? 'Victory!' : 'Time\'s Up!'}
            </h2>
            <p className="text-muted-foreground font-body text-sm">
              {isWin
                ? currentLevel 
                  ? `Level ${currentLevel} complete! Amazing memory skills!`
                  : 'Amazing memory skills! You matched all pairs!'
                : 'Don\'t give up! Try again to beat the clock!'}
            </p>
          </div>

          {/* Rarity Display (for wins) */}
          {isWin && rarity && (
            <div className="mb-6">
              <RarityDisplay rarity={rarity} />
            </div>
          )}

          {/* Quick Stats (for losses) */}
          {!isWin && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xl font-display font-bold text-foreground">{score.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground font-body">Score</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-secondary" />
                <p className="text-xl font-display font-bold text-foreground">{moves}</p>
                <p className="text-xs text-muted-foreground font-body">Moves</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {/* Next Level button (primary for wins with more levels) */}
            {isWin && onNextLevel && (
              <Button
                onClick={onNextLevel}
                size="lg"
                className="w-full text-lg font-display bg-gradient-to-r from-success to-primary hover:from-success/90 hover:to-primary/90"
              >
                Next Level
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            )}

            <Button
              onClick={onPlayAgain}
              size="lg"
              className={cn(
                'w-full text-lg font-display',
                isWin && onNextLevel
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90'
              )}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              {isWin && onNextLevel ? 'Replay Level' : 'Play Again'}
            </Button>

            {isWin && onCreateArt && (
              <Button
                onClick={onCreateArt}
                size="lg"
                variant="outline"
                className="w-full text-lg font-display border-accent text-accent hover:bg-accent/10"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create NFT Art
              </Button>
            )}


            <Button
              onClick={onBackToMenu}
              variant="ghost"
              className="w-full font-body text-muted-foreground"
            >
              Back to Menu
            </Button>
          </div>
        </div>
      </div>
  );
}
