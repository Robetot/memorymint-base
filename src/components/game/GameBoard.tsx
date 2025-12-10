import { useEffect, useRef, useState, useCallback } from 'react';
import { GameCard } from './GameCard';
import { CardData } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';
import { FloatingScore } from './FloatingScore';

interface FloatingScoreData {
  id: string;
  score: number;
  x: number;
  y: number;
  combo: number;
}

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
  combo?: number;
  onScorePopup?: (x: number, y: number) => void;
  revealAll?: boolean;
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
  combo = 0,
  revealAll = false,
}: GameBoardProps) {
  const [matchedCardIds, setMatchedCardIds] = useState<Set<number>>(new Set());
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [shakingCardIds, setShakingCardIds] = useState<Set<number>>(new Set());
  const [floatingScores, setFloatingScores] = useState<FloatingScoreData[]>([]);
  const prevFlippedRef = useRef<number[]>([]);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const removeFloatingScore = useCallback((id: string) => {
    setFloatingScores(prev => prev.filter(s => s.id !== id));
  }, []);

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

  // Handle match checking with floating scores and shake effects
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
            
            // Add floating score at the center of the matched cards
            if (boardRef.current) {
              const rect = boardRef.current.getBoundingClientRect();
              const baseScore = 100 * (combo + 1);
              setFloatingScores(prev => [...prev, {
                id: `${Date.now()}`,
                score: baseScore,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 3,
                combo: combo,
              }]);
            }
            
            onMatch();
            setTimeout(() => setShowMatchAnimation(false), 300);
          } else {
            // Shake cards on wrong match
            setShakingCardIds(new Set([firstId, secondId]));
            setTimeout(() => setShakingCardIds(new Set()), 500);
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
  }, [flippedCards, cards, onCheckMatch, onMatch, onNoMatch, combo]);

  const gridSize = Math.sqrt(cards.length);

  return (
    <div 
      ref={boardRef}
      className={cn(
        'w-full mx-auto p-2 md:p-4 relative',
        gridSize === 8 ? 'max-w-[95vw] md:max-w-2xl' : 'max-w-lg'
      )}
    >
      {/* Floating Scores */}
      {floatingScores.map(score => (
        <FloatingScore
          key={score.id}
          score={score.score}
          x={score.x}
          y={score.y}
          combo={score.combo}
          onComplete={() => removeFloatingScore(score.id)}
        />
      ))}

      <div
        className={cn(
          'grid',
          gridSize === 2 && 'grid-cols-2 max-w-[200px] mx-auto gap-3',
          gridSize === 4 && 'grid-cols-4 gap-2 md:gap-3',
          gridSize === 6 && 'grid-cols-6 gap-1 md:gap-2',
          gridSize === 8 && 'grid-cols-8 gap-[2px] md:gap-1'
        )}
      >
        {cards.map((card) => (
          <GameCard
            key={card.id}
            card={revealAll ? { ...card, isFlipped: true } : card}
            onClick={() => onCardClick(card.id)}
            disabled={disabled || flippedCards.length >= 2 || revealAll}
            showMatchAnimation={showMatchAnimation && matchedCardIds.has(card.id)}
            isHinted={hintedCardIds.includes(card.id)}
            gridSize={gridSize}
            isShaking={shakingCardIds.has(card.id)}
          />
        ))}
      </div>
    </div>
  );
}
