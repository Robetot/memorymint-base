import { useEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import { CardData } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  cards: CardData[];
  flippedCards: number[];
  onCardClick: (cardId: number) => void;
  onCheckMatch: () => void;
  onAnimalRevealed: (animalId: string, cardId: number) => void;
  onCardFlippedBack?: (cardId: number) => void;
  onMatch: () => void;
  onNoMatch: () => void;
  disabled: boolean;
  hintedCardIds?: number[];
}

export function GameBoard({
  cards,
  flippedCards,
  onCardClick,
  onCheckMatch,
  onAnimalRevealed,
  onCardFlippedBack,
  onMatch,
  onNoMatch,
  disabled,
  hintedCardIds = [],
}: GameBoardProps) {
  const [matchedCardIds, setMatchedCardIds] = useState<Set<number>>(new Set());
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const prevFlippedRef = useRef<number[]>([]);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle card flip sounds - play on flip, stop on flip back
  useEffect(() => {
    const prevFlipped = prevFlippedRef.current;
    
    // Cards that were flipped and are now hidden (flipped back)
    if (onCardFlippedBack) {
      const flippedBack = prevFlipped.filter(id => !flippedCards.includes(id));
      flippedBack.forEach(cardId => {
        onCardFlippedBack(cardId);
      });
    }
    
    // New cards that were just flipped
    if (flippedCards.length > prevFlipped.length) {
      const newCardId = flippedCards[flippedCards.length - 1];
      const card = cards.find((c) => c.id === newCardId);
      if (card) {
        onAnimalRevealed(card.animalId, card.id);
      }
    }
    
    prevFlippedRef.current = flippedCards;
  }, [flippedCards, cards, onAnimalRevealed, onCardFlippedBack]);

  // Handle match checking
  useEffect(() => {
    if (flippedCards.length === 2) {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }

      const [firstId, secondId] = flippedCards;
      const firstCard = cards.find((c) => c.id === firstId);
      const secondCard = cards.find((c) => c.id === secondId);

      if (firstCard && secondCard) {
        const isMatch = firstCard.animalId === secondCard.animalId;

        checkTimeoutRef.current = setTimeout(() => {
          if (isMatch) {
            setMatchedCardIds((prev) => new Set([...prev, firstId, secondId]));
            setShowMatchAnimation(true);
            onMatch();
            setTimeout(() => setShowMatchAnimation(false), 300);
          } else {
            onNoMatch();
          }
          onCheckMatch();
        }, isMatch ? 500 : 1000);
      }
    }

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [flippedCards, cards, onCheckMatch, onMatch, onNoMatch]);

  // Calculate grid size, accounting for odd grids that have an extra center card
  const totalCards = cards.length;
  const gridSize = Math.round(Math.sqrt(totalCards));

  // Get grid container max-width based on grid size
  const getContainerClass = () => {
    if (gridSize >= 9) return 'max-w-[98vw] md:max-w-4xl';
    if (gridSize === 8) return 'max-w-[95vw] md:max-w-3xl';
    if (gridSize >= 6) return 'max-w-[90vw] md:max-w-2xl';
    if (gridSize >= 4) return 'max-w-lg';
    return 'max-w-xs';
  };

  // Get grid columns class
  const getGridClass = () => {
    switch (gridSize) {
      case 1: return 'grid-cols-1 max-w-[120px] mx-auto gap-4';
      case 2: return 'grid-cols-2 max-w-[200px] mx-auto gap-3';
      case 3: return 'grid-cols-3 max-w-[280px] mx-auto gap-2';
      case 4: return 'grid-cols-4 gap-2 md:gap-3';
      case 5: return 'grid-cols-5 gap-1.5 md:gap-2';
      case 6: return 'grid-cols-6 gap-1 md:gap-2';
      case 7: return 'grid-cols-7 gap-1 md:gap-1.5';
      case 8: return 'grid-cols-8 gap-[2px] md:gap-1';
      case 9: return 'grid-cols-9 gap-[2px] md:gap-1';
      case 10: return 'grid-cols-10 gap-[1px] md:gap-[2px]';
      default: return 'grid-cols-4 gap-2';
    }
  };

  return (
    <div className={cn('w-full mx-auto p-2 md:p-4', getContainerClass())}>
      <div className={cn('grid', getGridClass())}>
        {cards.map((card) => (
          <GameCard
            key={card.id}
            card={card}
            onClick={() => onCardClick(card.id)}
            disabled={disabled || flippedCards.length >= 2}
            showMatchAnimation={showMatchAnimation && matchedCardIds.has(card.id)}
            isHinted={hintedCardIds.includes(card.id)}
            gridSize={gridSize}
          />
        ))}
      </div>
    </div>
  );
}
