import { useEffect, useState, forwardRef, useMemo } from 'react';
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
  fogOpacity?: number; // 0 = fully visible, 1 = fully hidden
  isDecaying?: boolean;
  cardSize?: number; // explicit size in pixels
}

export const GameCard = forwardRef<HTMLButtonElement, GameCardProps>(
  ({ 
    card, 
    onClick, 
    disabled, 
    showMatchAnimation, 
    isHinted = false, 
    gridSize = 4, 
    isShaking = false,
    fogOpacity = 0,
    isDecaying = false,
    cardSize = 64,
  }, ref) => {
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
      if (!disabled && !card.isFlipped && !card.isMatched && fogOpacity < 0.8) {
        onClick();
      }
    };

    // Adjust sizes based on grid
    const isExpertGrid = gridSize >= 8;
    const isLargeGrid = gridSize >= 6;

    // Calculate fog effect styles
    const fogStyles = useMemo(() => {
      if (fogOpacity <= 0 || card.isFlipped || card.isMatched) {
        return {};
      }
      return {
        opacity: Math.max(0.3, 1 - fogOpacity * 0.7),
        filter: fogOpacity > 0.3 ? `blur(${fogOpacity * 3}px) grayscale(${fogOpacity * 50}%)` : 'none',
        transform: fogOpacity > 0.5 ? `scale(${1 - fogOpacity * 0.1})` : 'none',
      };
    }, [fogOpacity, card.isFlipped, card.isMatched]);

    const isFogged = fogOpacity > 0.5 && !card.isFlipped && !card.isMatched;

    return (
      <button
        ref={ref}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled || card.isFlipped || card.isMatched || isFogged}
        aria-label={
          card.isMatched 
            ? `Matched card: ${card.animalName}` 
            : card.isFlipped 
              ? `Revealed card: ${card.animalName}` 
              : isFogged
                ? 'Hidden card in fog'
                : `Card ${card.id + 1}. Click to flip`
        }
        aria-pressed={card.isFlipped || card.isMatched}
        className={cn(
          'relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background',
          'transition-all duration-300 ease-out',
          isExpertGrid ? 'rounded-sm md:rounded' : 'rounded-lg md:rounded-xl',
          !disabled && !card.isFlipped && !card.isMatched && !isFogged && 'hover:scale-105 hover:-translate-y-1 hover:z-10',
          disabled && 'cursor-not-allowed',
          card.isMatched && 'cursor-default',
          isHinted && !isExpertGrid && 'ring-4 ring-accent animate-pulse',
          isHinted && isExpertGrid && 'ring-2 ring-accent animate-pulse',
          isDecaying && 'animate-pulse ring-2 ring-destructive/50'
        )}
        style={{
          width: cardSize,
          height: cardSize,
          perspective: 1000,
          ...fogStyles,
          filter: isHovered && !card.isFlipped && !card.isMatched && !disabled && !isFogged
            ? 'drop-shadow(0 8px 16px hsl(var(--primary) / 0.3))' 
            : fogStyles.filter || undefined,
        }}
      >
        <div
          className={cn(
            'card-flip',
            (card.isFlipped || card.isMatched) && 'flipped',
            isShaking && 'animate-shake'
          )}
        >
          {/* Card Back */}
          <div
            className={cn(
              'card-face card-back overflow-hidden shadow-lg transition-all duration-300',
              isExpertGrid ? 'rounded-sm md:rounded' : 'rounded-lg md:rounded-xl',
              isHinted && 'ring-4 ring-accent',
              isHovered && !disabled && !isFogged && 'shadow-xl',
              isFogged && 'opacity-50'
            )}
          >
            <img 
              src={cardBackImg} 
              alt="Card back"
              className={cn(
                "w-full h-full object-cover transition-all duration-300",
                isFogged && "brightness-50"
              )}
              loading="eager"
              decoding="async"
              width={128}
              height={128}
            />
            {/* Fog overlay on card */}
            {fogOpacity > 0 && !card.isFlipped && !card.isMatched && (
              <div 
                className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/50 to-transparent pointer-events-none transition-opacity duration-500"
                style={{ opacity: fogOpacity }}
              />
            )}
            {/* Hover glow overlay */}
            {isHovered && !disabled && !card.isFlipped && !card.isMatched && !isFogged && (
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
            )}
          </div>

          {/* Card Front - Animal Image */}
          <div
            className={cn(
              'card-face card-front overflow-hidden shadow-lg',
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
              loading="lazy"
              decoding="async"
              width={128}
              height={128}
            />
            {/* Match celebration overlay */}
            {isAnimating && (
              <div className="absolute inset-0 bg-gradient-to-t from-success/30 via-transparent to-success/10 pointer-events-none animate-pulse" />
            )}
          </div>
        </div>

        {/* Decay effect indicator */}
        {isDecaying && !card.isMatched && !card.isFlipped && (
          <div className="absolute inset-0 rounded-lg pointer-events-none border-2 border-destructive/40 animate-pulse" />
        )}
      </button>
    );
  }
);

GameCard.displayName = 'GameCard';
