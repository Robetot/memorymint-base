import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Target, Zap, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameOverModalProps {
  isOpen: boolean;
  isWin: boolean;
  score: number;
  moves: number;
  timeRemaining: number;
  maxCombo: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

function Confetti() {
  const colors = ['#a855f7', '#06b6d4', '#fbbf24', '#22c55e', '#ec4899'];
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 10 + 5,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute top-0 animate-confetti"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
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
}: GameOverModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen && isWin) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isWin]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className={cn(
          'bg-card border-2 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-bounce-in',
          isWin ? 'border-success' : 'border-destructive'
        )}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className={cn(
              'w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4',
              isWin ? 'bg-success/20' : 'bg-destructive/20'
            )}>
              {isWin ? (
                <Trophy className="w-10 h-10 text-success" />
              ) : (
                <Clock className="w-10 h-10 text-destructive" />
              )}
            </div>
            <h2 className={cn(
              'text-3xl font-display font-bold mb-2',
              isWin ? 'text-success' : 'text-destructive'
            )}>
              {isWin ? 'Victory!' : 'Time\'s Up!'}
            </h2>
            <p className="text-muted-foreground font-body">
              {isWin
                ? 'Amazing memory skills! You matched all pairs!'
                : 'Don\'t give up! Try again to beat the clock!'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-display font-bold text-foreground">{score.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-body">Final Score</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-secondary" />
              <p className="text-2xl font-display font-bold text-foreground">{moves}</p>
              <p className="text-xs text-muted-foreground font-body">Total Moves</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-display font-bold text-foreground">{formatTime(120 - timeRemaining)}</p>
              <p className="text-xs text-muted-foreground font-body">Time Taken</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Zap className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-2xl font-display font-bold text-foreground">x{maxCombo}</p>
              <p className="text-xs text-muted-foreground font-body">Max Combo</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={onPlayAgain}
              size="lg"
              className="w-full text-lg font-display bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>

            {isWin && (
              <Button
                onClick={() => {}}
                size="lg"
                variant="outline"
                className="w-full text-lg font-display border-accent text-accent hover:bg-accent/10"
                disabled
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create NFT (Coming Soon)
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
    </>
  );
}
