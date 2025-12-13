import { useEffect, useState, forwardRef } from 'react';
import { motion, Easing } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CardData } from '@/hooks/useGameState';
import cardBackImg from '@/assets/card-back.png';

interface AnimatedGameCardProps {
  card: CardData;
  onClick: () => void;
  disabled: boolean;
  showMatchAnimation: boolean;
  isHinted?: boolean;
  gridSize?: number;
  isShaking?: boolean;
  index?: number;
}

const easeOut: Easing = [0.25, 0.46, 0.45, 0.94];

export const AnimatedGameCard = forwardRef<HTMLButtonElement, AnimatedGameCardProps>(
  ({ card, onClick, disabled, showMatchAnimation, isHinted = false, gridSize = 4, isShaking = false, index = 0 }, ref) => {
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

    const isExpertGrid = gridSize >= 8;

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled || card.isFlipped || card.isMatched}
        initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
        animate={{ 
          opacity: 1, 
          scale: isAnimating ? [1, 1.15, 1] : 1, 
          rotateY: 0,
          x: isShaking ? [-3, 3, -3, 3, 0] : 0,
        }}
        transition={{
          delay: index * 0.03,
          duration: 0.4,
          ease: easeOut,
          scale: isAnimating ? { duration: 0.4, times: [0, 0.5, 1] } : undefined,
          x: isShaking ? { duration: 0.4 } : undefined,
        }}
        whileHover={!disabled && !card.isFlipped && !card.isMatched ? { scale: 1.05, y: -4 } : undefined}
        whileTap={!disabled && !card.isFlipped && !card.isMatched ? { scale: 0.98 } : undefined}
        className={cn(
          'relative w-full aspect-square perspective-1000 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background',
          'transition-shadow duration-200 ease-out',
          isExpertGrid ? 'rounded-sm md:rounded' : 'rounded-lg md:rounded-xl',
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
            {isHovered && !disabled && !card.isFlipped && !card.isMatched && (
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
            )}
          </div>

          {/* Card Front */}
          <div
            className={cn(
              'card-face card-front absolute inset-0 overflow-hidden shadow-lg',
              isExpertGrid ? 'rounded-sm md:rounded border border-secondary/50' : 'rounded-lg md:rounded-xl border-2 md:border-4',
              !isExpertGrid && (card.isMatched ? 'border-success' : 'border-secondary/50'),
              isExpertGrid && card.isMatched && 'border-success',
              card.isMatched && !isExpertGrid && 'shadow-[0_0_20px_hsl(var(--success)/0.5)]'
            )}
          >
            <img 
              src={card.imageUrl} 
              alt={card.animalName}
              className="w-full h-full object-cover"
            />
            {isAnimating && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-success/30 via-transparent to-success/10 pointer-events-none"
              />
            )}
          </div>
        </div>
      </motion.button>
    );
  }
);

AnimatedGameCard.displayName = 'AnimatedGameCard';
