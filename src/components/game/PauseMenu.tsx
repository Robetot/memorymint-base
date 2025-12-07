import { Button } from '@/components/ui/button';
import { X, Play, RotateCcw, Home, Lightbulb } from 'lucide-react';

interface PauseMenuProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onUseHint: () => void;
  hintsRemaining: number;
}

export function PauseMenu({
  isOpen,
  onResume,
  onRestart,
  onQuit,
  onUseHint,
  hintsRemaining,
}: PauseMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border-2 border-border rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">
            Game Paused
          </h2>
          <p className="text-muted-foreground font-body">
            Take a breather! 🧘
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onResume}
            size="lg"
            className="w-full text-lg font-display bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
          >
            <Play className="w-5 h-5 mr-2" />
            Resume
          </Button>

          <Button
            onClick={onUseHint}
            size="lg"
            variant="outline"
            disabled={hintsRemaining <= 0}
            className="w-full text-lg font-display border-accent text-accent hover:bg-accent/10"
          >
            <Lightbulb className="w-5 h-5 mr-2" />
            Use Hint ({hintsRemaining} left)
          </Button>

          <Button
            onClick={onRestart}
            size="lg"
            variant="outline"
            className="w-full font-display"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Restart Game
          </Button>

          <Button
            onClick={onQuit}
            variant="ghost"
            className="w-full font-body text-muted-foreground hover:text-destructive"
          >
            <Home className="w-5 h-5 mr-2" />
            Quit to Menu
          </Button>
        </div>
      </div>
    </div>
  );
}
