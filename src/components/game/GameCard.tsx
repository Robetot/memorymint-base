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

  // Adjust sizes based on grid - make 8x8 much smaller
  const isSmallGrid = gridSize >= 6;
  const isVerySmallGrid = gridSize >= 8;
  const isExpertGrid = gridSize >= 8;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || card.isFlipped || card.isMatched}
      className={cn(
        'relative w-full aspect-square perspective-1000 cursor-pointer transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background',
        isExpertGrid ? 'rounded-sm md:rounded' : 'rounded-lg md:rounded-xl',
        !disabled && !card.isFlipped && !card.isMatched && 'hover:scale-105',
        disabled && 'cursor-not-allowed',
        card.isMatched && 'cursor-default',
        isHinted && !isExpertGrid && 'ring-4 ring-accent animate-pulse',
        isHinted && isExpertGrid && 'ring-2 ring-accent animate-pulse'
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
            'card-face card-back absolute inset-0 flex items-center justify-center shadow-lg',
            isExpertGrid ? 'rounded-sm md:rounded border border-primary/30' : 'rounded-lg md:rounded-xl border-2 md:border-4 border-primary/30',
            'pattern-card hover:border-primary/60 transition-colors',
            isHinted && 'border-accent'
          )}
        >
          <div className={cn(
            'bg-primary/90 flex items-center justify-center shadow-md',
            isExpertGrid ? 'w-4 h-4 rounded-sm' : isSmallGrid ? 'w-8 h-8 rounded-lg md:rounded-xl' : 'w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl'
          )}>
            <span className={cn(
              isExpertGrid ? 'text-[8px]' : isSmallGrid ? 'text-base' : 'text-xl md:text-2xl'
            )}>🎴</span>
          </div>
        </div>

        {/* Card Front - Animal Image */}
        <div
          className={cn(
            'card-face card-front absolute inset-0 overflow-hidden shadow-lg',
            isExpertGrid ? 'rounded-sm md:rounded border border-secondary/50' : 'rounded-lg md:rounded-xl border-2 md:border-4',
            !isExpertGrid && (card.isMatched ? 'border-success glow-success' : 'border-secondary/50'),
            isExpertGrid && card.isMatched && 'border-success',
            isAnimating && 'animate-match-pop'
          )}
        >
          <img 
            src={card.imageUrl} 
            alt={card.animalName}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </button>
  );
}
