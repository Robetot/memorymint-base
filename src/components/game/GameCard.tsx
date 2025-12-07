import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CardData } from '@/hooks/useGameState';

interface GameCardProps {
  card: CardData;
  onClick: () => void;
  disabled: boolean;
  showMatchAnimation: boolean;
  isHinted?: boolean;
  gridSize?: number;
}

export function GameCard({ card, onClick, disabled, showMatchAnimation, isHinted = false, gridSize = 4 }: GameCardProps) {
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

  // Adjust sizes based on grid
  const isSmallGrid = gridSize >= 6;
  const isVerySmallGrid = gridSize >= 8;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || card.isFlipped || card.isMatched}
      className={cn(
        'relative w-full aspect-square perspective-1000 cursor-pointer transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background rounded-lg md:rounded-xl',
        !disabled && !card.isFlipped && !card.isMatched && 'hover:scale-105',
        disabled && 'cursor-not-allowed',
        card.isMatched && 'cursor-default',
        isHinted && 'ring-4 ring-accent animate-pulse'
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
            'card-face card-back absolute inset-0 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg',
            'pattern-card border-2 md:border-4 border-primary/30',
            'hover:border-primary/60 transition-colors',
            isHinted && 'border-accent'
          )}
        >
          <div className={cn(
            'bg-primary/90 rounded-lg md:rounded-xl flex items-center justify-center shadow-md',
            isVerySmallGrid ? 'w-6 h-6' : isSmallGrid ? 'w-8 h-8' : 'w-10 h-10 md:w-14 md:h-14'
          )}>
            <span className={cn(
              isVerySmallGrid ? 'text-sm' : isSmallGrid ? 'text-base' : 'text-xl md:text-2xl'
            )}>🎴</span>
          </div>
        </div>

        {/* Card Front - Animal Image */}
        <div
          className={cn(
            'card-face card-front absolute inset-0 rounded-lg md:rounded-xl overflow-hidden shadow-lg',
            'border-2 md:border-4',
            card.isMatched ? 'border-success glow-success' : 'border-secondary/50',
            isAnimating && 'animate-match-pop'
          )}
        >
          <img 
            src={card.imageUrl} 
            alt={card.animalName}
            className="w-full h-full object-cover"
          />
          {!isVerySmallGrid && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1 md:p-2">
              <span className={cn(
                'font-body text-white drop-shadow-md',
                isSmallGrid ? 'text-[8px]' : 'text-xs md:text-sm'
              )}>
                {card.animalName}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
