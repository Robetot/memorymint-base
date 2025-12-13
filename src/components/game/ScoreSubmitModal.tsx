import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Send } from 'lucide-react';

interface ScoreSubmitModalProps {
  isOpen: boolean;
  score: number;
  savedName: string;
  onSubmit: (name: string) => void;
  onSkip: () => void;
}

export function ScoreSubmitModal({ isOpen, score, savedName, onSubmit, onSkip }: ScoreSubmitModalProps) {
  const [playerName, setPlayerName] = useState('');
  const hasAutoSubmittedRef = useRef(false);

  // Auto-submit if we already have a saved name (only once per modal open)
  useEffect(() => {
    if (isOpen && savedName && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      onSubmit(savedName);
    }
    // Reset the ref when modal closes
    if (!isOpen) {
      hasAutoSubmittedRef.current = false;
    }
  }, [isOpen, savedName, onSubmit]);

  // If saved name exists and we've auto-submitted, don't render
  if (!isOpen || (savedName && hasAutoSubmittedRef.current)) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onSubmit(playerName.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border-2 border-success rounded-3xl p-8 max-w-md w-full shadow-2xl animate-bounce-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            New High Score!
          </h2>
          <p className="text-3xl font-display font-bold text-primary">
            {score.toLocaleString()}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-display font-medium text-foreground mb-2">
              Enter Your Name
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name..."
              maxLength={20}
              className="text-center text-lg"
              autoFocus
            />
          </div>

          <Button
            type="submit"
            disabled={!playerName.trim()}
            size="lg"
            className="w-full font-display bg-gradient-to-r from-primary to-secondary"
          >
            <Send className="w-5 h-5 mr-2" />
            Submit Score
          </Button>

          <Button
            type="button"
            onClick={onSkip}
            variant="ghost"
            className="w-full font-body text-muted-foreground"
          >
            Skip
          </Button>
        </form>
      </div>
    </div>
  );
}
