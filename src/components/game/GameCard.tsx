import { useEffect, useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { CardData } from '@/hooks/useGameState';
import cardBackImg from '@/assets/card-back.png';

interface GameCardProps {
  card: CardData;
  onClick: () => void;
  disabled: boolean;
  showMatchAnimation: boolean;
  isHinted?: boolean;
  gridSize?: number;
  isShaking?: boolean;
}

export const GameCard = forwardRef<HTMLButtonElement, GameCardProps>(
  ({ card, onClick, disabled, showMatchAnimation, isHinted = false, gridSize = 4, isShaking = false }, ref) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
      if (showMatchAnimation && card.isMatched) {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 400);
        return () => clearTimeout(timer);
      }
    }, [showMatchAnimation, card.isMatched]);

    const handleClick = () => {
      if (!disabled && !card.isFlipped && !card.isMatched) {
        onClick();
      }
    };

    // Adjust sizes based on grid
    const isExpertGrid = gridSize >= 8;
    const isLargeGrid = gridSize >= 6;

    return (
      <button
        ref={ref}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled || card.isFlipped || card.isMatched}
        className={cn(
          'relative w-full aspect-square perspective-1000 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background',
          'transition-all duration-200 ease-out',
          isExpertGrid ? 'rounded-sm md:rounded' : 'rounded-lg md:rounded-xl',
          !disabled && !card.isFlipped && !card.isMatched && 'hover:scale-105 hover:-translate-y-1 hover:z-10',
          disabled && 'cursor-not-allowed',
          card.isMatched && 'cursor-default',
          isHinted && !isExpertGrid && 'ring-4 ring-accent animate-pulse',
          isHinted && isExpertGrid && 'ring-2 ring-accent animate-pulse'
        )}
        style={{
          filter: isHovered && !card.isFlipped && !card.isMatched && !disabled 
            ? 'drop-shadow(0 8px 16px hsl(var(--primary) / 0.3))' 
            : undefined
        }}
      >
        <div
          className={cn(
            'card-flip w-full h-full',
            (card.isFlipped || card.isMatched) && 'flipped',
            isShaking && 'animate-shake'
          )}
        >
          {/* Card Back */}
          <div
            className={cn(
              'card-face card-back absolute inset-0 overflow-hidden shadow-lg transition-shadow duration-200',
              isExpertGrid ? 'rounded-sm md:rounded' : 'rounded-lg md:rounded-xl',
              isHinted && 'ring-4 ring-accent',
              isHovered && !disabled && 'shadow-xl'
            )}
          >
            <img 
              src={cardBackImg} 
              alt="Card back"
              className="w-full h-full object-cover"
            />
            {/* Hover glow overlay */}
            {isHovered && !disabled && !card.isFlipped && !card.isMatched && (
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
            )}
          </div>

          {/* Card Front - Animal Image */}
          <div
            className={cn(
              'card-face card-front absolute inset-0 overflow-hidden shadow-lg',
              isExpertGrid ? 'rounded-sm md:rounded border border-secondary/50' : 'rounded-lg md:rounded-xl border-2 md:border-4',
              !isExpertGrid && (card.isMatched ? 'border-success' : 'border-secondary/50'),
              isExpertGrid && card.isMatched && 'border-success',
              isAnimating && 'animate-match-burst',
              card.isMatched && !isExpertGrid && 'shadow-[0_0_20px_hsl(var(--success)/0.5)]'
            )}
          >
            <img 
              src={card.imageUrl} 
              alt={card.animalName}
              className="w-full h-full object-cover"
            />
            {/* Match celebration overlay */}
            {isAnimating && (
              <div className="absolute inset-0 bg-gradient-to-t from-success/30 via-transparent to-success/10 pointer-events-none animate-pulse" />
            )}
          </div>
        </div>
      </button>
    );
  }
);

GameCard.displayName = 'GameCard';
