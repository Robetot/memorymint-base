import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CardData } from '@/hooks/useGameState';

interface GameCardProps {
  card: CardData;
  onClick: () => void;
  disabled: boolean;
  showMatchAnimation: boolean;
}

export function GameCard({ card, onClick, disabled, showMatchAnimation }: GameCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (showMatchAnimation && card.isMatched) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [showMatchAnimation, card.isMatched]);

  const handleClick = () => {
    if (!disabled && !card.isFlipped && !card.isMatched) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || card.isFlipped || card.isMatched}
      className={cn(
        'relative w-full aspect-square perspective-1000 cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-xl',
        disabled && 'cursor-not-allowed hover:scale-100',
        card.isMatched && 'cursor-default hover:scale-100'
      )}
    >
      <div
        className={cn(
          'card-flip w-full h-full',
          (card.isFlipped || card.isMatched) && 'flipped'
        )}
      >
        {/* Card Back - MemoryMint Pattern */}
        <div
          className={cn(
            'card-face card-back absolute inset-0 rounded-xl flex items-center justify-center shadow-lg',
            'pattern-card border-4 border-primary/30',
            'hover:border-primary/60 transition-colors'
          )}
        >
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/90 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-2xl md:text-3xl">🎴</span>
          </div>
        </div>

        {/* Card Front - Animal */}
        <div
          className={cn(
            'card-face card-front absolute inset-0 rounded-xl flex items-center justify-center shadow-lg',
            'bg-card border-4',
            card.isMatched ? 'border-success glow-success' : 'border-secondary/50',
            isAnimating && 'animate-match-pop'
          )}
        >
          <span className="text-4xl md:text-6xl">{card.imageUrl}</span>
          <span className="absolute bottom-2 text-xs md:text-sm font-body text-muted-foreground">
            {card.animalName}
          </span>
        </div>
      </div>
    </button>
  );
}
