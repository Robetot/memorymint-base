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

  // Size categories
  const isTinyGrid = gridSize >= 9;
  const isVerySmallGrid = gridSize >= 7;
  const isSmallGrid = gridSize >= 5;
  const isMediumGrid = gridSize >= 4;

  // Get border radius based on grid size
  const getBorderRadius = () => {
    if (isTinyGrid) return 'rounded-[2px] md:rounded-sm';
    if (isVerySmallGrid) return 'rounded-sm md:rounded';
    if (isSmallGrid) return 'rounded md:rounded-lg';
    return 'rounded-lg md:rounded-xl';
  };

  // Get icon size for card back
  const getIconSize = () => {
    if (isTinyGrid) return 'w-2 h-2 text-[6px]';
    if (isVerySmallGrid) return 'w-3 h-3 text-[8px]';
    if (isSmallGrid) return 'w-5 h-5 text-xs';
    if (isMediumGrid) return 'w-8 h-8 text-base';
    return 'w-10 h-10 md:w-14 md:h-14 text-xl md:text-2xl';
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || card.isFlipped || card.isMatched}
      className={cn(
        'relative w-full aspect-square perspective-1000 cursor-pointer transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background',
        getBorderRadius(),
        !disabled && !card.isFlipped && !card.isMatched && 'hover:scale-105',
        disabled && 'cursor-not-allowed',
        card.isMatched && 'cursor-default',
        isHinted && !isTinyGrid && 'ring-4 ring-accent animate-pulse',
        isHinted && isTinyGrid && 'ring-1 ring-accent animate-pulse'
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
            getBorderRadius(),
            isTinyGrid ? 'border border-primary/30' : isVerySmallGrid ? 'border border-primary/30' : 'border-2 md:border-4 border-primary/30',
            'pattern-card hover:border-primary/60 transition-colors',
            isHinted && 'border-accent'
          )}
        >
          <div className={cn(
            'bg-primary/90 flex items-center justify-center shadow-md',
            getBorderRadius(),
            getIconSize()
          )}>
            <span>🎴</span>
          </div>
        </div>

        {/* Card Front - Animal Image */}
        <div
          className={cn(
            'card-face card-front absolute inset-0 overflow-hidden shadow-lg',
            getBorderRadius(),
            isTinyGrid ? 'border border-secondary/50' : 'border-2 md:border-4',
            !isTinyGrid && (card.isMatched ? 'border-success glow-success' : 'border-secondary/50'),
            isTinyGrid && card.isMatched && 'border-success',
            isAnimating && 'animate-match-pop'
          )}
        >
          <img 
            src={card.imageUrl} 
            alt={card.animalName}
            className="w-full h-full object-cover"
          />
          {/* Only show name label for larger grids */}
          {gridSize <= 6 && (
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
