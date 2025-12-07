import { useEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import { CardData } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  cards: CardData[];
  flippedCards: number[];
  onCardClick: (cardId: number) => void;
  onCheckMatch: () => void;
  onAnimalRevealed: (animalId: string) => void;
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
  onMatch,
  onNoMatch,
  disabled,
  hintedCardIds = [],
}: GameBoardProps) {
  const [matchedCardIds, setMatchedCardIds] = useState<Set<number>>(new Set());
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const prevFlippedRef = useRef<number[]>([]);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle card flip sounds
  useEffect(() => {
    if (flippedCards.length > prevFlippedRef.current.length) {
      const newCardId = flippedCards[flippedCards.length - 1];
      const card = cards.find((c) => c.id === newCardId);
      if (card) {
        onAnimalRevealed(card.animalId);
      }
    }
    prevFlippedRef.current = flippedCards;
  }, [flippedCards, cards, onAnimalRevealed]);

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

  const gridSize = Math.sqrt(cards.length);

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <div
        className={cn(
          'grid gap-2 md:gap-3',
          gridSize === 2 && 'grid-cols-2 max-w-[200px] mx-auto',
          gridSize === 4 && 'grid-cols-4',
          gridSize === 6 && 'grid-cols-6 gap-1 md:gap-2',
          gridSize === 8 && 'grid-cols-8 gap-1'
        )}
      >
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
