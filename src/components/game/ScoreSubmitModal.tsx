import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Send, Sparkles } from 'lucide-react';

interface ScoreSubmitModalProps {
  isOpen: boolean;
  score: number;
  onSubmit: (name: string) => void;
  onSkip: () => void;
  isNFTNamePrompt?: boolean;
}

export function ScoreSubmitModal({ isOpen, score, onSubmit, onSkip, isNFTNamePrompt = false }: ScoreSubmitModalProps) {
  const [playerName, setPlayerName] = useState('');

  if (!isOpen) return null;

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
            {isNFTNamePrompt ? (
              <Sparkles className="w-8 h-8 text-accent" />
            ) : (
              <Trophy className="w-8 h-8 text-success" />
            )}
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            {isNFTNamePrompt ? 'Name Your NFT Collection' : 'New High Score!'}
          </h2>
          {!isNFTNamePrompt && (
            <p className="text-3xl font-display font-bold text-primary">
              {score.toLocaleString()}
            </p>
          )}
          {isNFTNamePrompt && (
            <p className="text-sm text-muted-foreground font-body">
              This name will be used for all your NFTs
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-display font-medium text-foreground mb-2">
              {isNFTNamePrompt ? 'Enter NFT Name' : 'Enter Your Name'}
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={isNFTNamePrompt ? 'My NFT Collection...' : 'Your name...'}
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
            {isNFTNamePrompt ? 'Continue' : 'Submit Score'}
          </Button>

          {!isNFTNamePrompt && (
            <Button
              type="button"
              onClick={onSkip}
              variant="ghost"
              className="w-full font-body text-muted-foreground"
            >
              Skip
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
