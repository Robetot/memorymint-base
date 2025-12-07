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
          <div className="w-10 h-10 md:w-14 md:h-14 bg-primary/90 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-xl md:text-2xl">🎴</span>
          </div>
        </div>

        {/* Card Front - Animal Image */}
        <div
          className={cn(
            'card-face card-front absolute inset-0 rounded-xl overflow-hidden shadow-lg',
            'border-4',
            card.isMatched ? 'border-success glow-success' : 'border-secondary/50',
            isAnimating && 'animate-match-pop'
          )}
        >
          <img 
            src={card.imageUrl} 
            alt={card.animalName}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span className="text-xs md:text-sm font-body text-white drop-shadow-md">
              {card.animalName}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
