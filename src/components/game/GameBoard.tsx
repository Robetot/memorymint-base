import { useEffect, useRef, useState, useCallback } from 'react';
import { GameCard } from './GameCard';
import { CardData } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';
import { FloatingScore } from './FloatingScore';
import { LegacyMatchParticles, ComboParticles } from './MatchParticles';
import { useMatchSounds } from '@/hooks/useMatchSounds';

interface FloatingScoreData {
  id: string;
  score: number;
  x: number;
  y: number;
  combo: number;
}

interface ParticleData {
  id: string;
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
  gridColumns: number;
  gridRows: number;
  fogEnabled?: boolean;
  lastFlippedCardId?: number | null;
  decayingCards?: Set<number>;
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
  gridColumns,
  gridRows,
  fogEnabled = false,
  lastFlippedCardId = null,
  decayingCards = new Set(),
}: GameBoardProps) {
  const [matchedCardIds, setMatchedCardIds] = useState<Set<number>>(new Set());
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [shakingCardIds, setShakingCardIds] = useState<Set<number>>(new Set());
  const [floatingScores, setFloatingScores] = useState<FloatingScoreData[]>([]);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const prevFlippedRef = useRef<number[]>([]);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const { playMatchSound, playParticleExplosion } = useMatchSounds();

  const removeFloatingScore = useCallback((id: string) => {
    setFloatingScores(prev => prev.filter(s => s.id !== id));
  }, []);

  const removeParticle = useCallback((id: string) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  }, []);
  
  // Limit and auto-cleanup particles with timeout fallback
  useEffect(() => {
    // Remove excess particles (keep max 4)
    if (particles.length > 4) {
      setParticles(prev => prev.slice(-4));
    }
    
    // Auto-cleanup stale particles after 3 seconds
    if (particles.length > 0) {
      const timeout = setTimeout(() => {
        setParticles(prev => prev.length > 0 ? prev.slice(1) : prev);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [particles.length]);

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

  // Handle match checking with floating scores, particles, and shake effects
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
            
            // Play match sound
            playMatchSound(combo);
            
            // Add floating score and particles at the center of the matched cards
            if (boardRef.current) {
              const rect = boardRef.current.getBoundingClientRect();
              const baseScore = 100 * (combo + 1);
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 3;
              
              setFloatingScores(prev => [...prev, {
                id: `${Date.now()}`,
                score: baseScore,
                x: centerX,
                y: centerY,
                combo: combo,
              }]);

              // Add particles at center of board only (not both cards)
              const firstCardEl = cardRefs.current.get(firstId);
              
              if (firstCardEl) {
                const cardRect = firstCardEl.getBoundingClientRect();
                playParticleExplosion(combo);
                setParticles(prev => {
                  // Limit to max 2 active particle systems
                  const newParticles = prev.length >= 2 ? prev.slice(1) : prev;
                  return [...newParticles, {
                    id: `particle-${Date.now()}`,
                    x: cardRect.left + cardRect.width / 2,
                    y: cardRect.top + cardRect.height / 2,
                    combo: combo,
                  }];
                });
              }
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
  }, [flippedCards, cards, onCheckMatch, onMatch, onNoMatch, combo, playMatchSound, playParticleExplosion]);

  // Store card refs
  const setCardRef = useCallback((cardId: number, el: HTMLButtonElement | null) => {
    if (el) {
      cardRefs.current.set(cardId, el);
    } else {
      cardRefs.current.delete(cardId);
    }
  }, []);

  // Validate grid has correct number of cards
  const expectedCards = gridColumns * gridRows;
  if (cards.length !== expectedCards) {
    console.error(`Grid mismatch: expected ${expectedCards} cards (${gridColumns}x${gridRows}), got ${cards.length}`);
  }

  // Determine grid size category for responsive sizing
  const maxDimension = Math.max(gridColumns, gridRows);

  // Gap sizes based on grid complexity
  const getGapSize = () => {
    if (maxDimension <= 4) return { mobile: 8, desktop: 12 };
    if (maxDimension <= 6) return { mobile: 6, desktop: 8 };
    return { mobile: 4, desktop: 6 };
  };

  const gaps = getGapSize();

  return (
    <div 
      ref={boardRef}
      className="w-full h-full flex items-center justify-center p-1 sm:p-2 md:p-4 relative"
    >
      {/* Error overlay if grid is broken */}
      {cards.length !== expectedCards && cards.length > 0 && (
        <div className="absolute inset-0 bg-destructive/10 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl border-2 border-destructive">
          <div className="text-center p-4">
            <p className="text-destructive font-bold">Grid Error</p>
            <p className="text-sm text-muted-foreground">Expected {expectedCards} cards, got {cards.length}</p>
          </div>
        </div>
      )}

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

      {/* Match Particles */}
      {particles.map(particle => (
        <LegacyMatchParticles
          key={particle.id}
          x={particle.x}
          y={particle.y}
          combo={particle.combo}
          onComplete={() => removeParticle(particle.id)}
        />
      ))}

      {/* Combo Particles */}
      <ComboParticles combo={combo} />

      <div
        className="grid-board"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          gap: `${gaps.mobile}px`,
          width: '100%',
          maxWidth: 'min(95vw, 95vh, 600px)',
          aspectRatio: `${gridColumns} / ${gridRows}`,
        }}
      >
        {cards.map((card) => {
          // Calculate fog opacity based on distance from last flipped card
          let fogOpacity = 0;
          if (fogEnabled && lastFlippedCardId !== null && !card.isFlipped && !card.isMatched) {
            const lastCard = cards.find(c => c.id === lastFlippedCardId);
            if (lastCard) {
              const distance = Math.abs(card.id - lastCard.id);
              const fogRadius = 3;
              if (distance > fogRadius) {
                fogOpacity = Math.min(1, (distance - fogRadius) / 4);
              }
            }
          } else if (fogEnabled && lastFlippedCardId === null && !card.isFlipped && !card.isMatched) {
            // Initial fog - cards further from center are more fogged
            const centerIdx = Math.floor(cards.length / 2);
            const distance = Math.abs(card.id - centerIdx);
            fogOpacity = Math.min(0.6, distance / (cards.length / 3));
          }

          return (
            <GameCard
              key={card.id}
              ref={(el) => setCardRef(card.id, el)}
              card={revealAll ? { ...card, isFlipped: true } : card}
              onClick={() => onCardClick(card.id)}
              disabled={disabled || flippedCards.length >= 2 || revealAll}
              showMatchAnimation={showMatchAnimation && matchedCardIds.has(card.id)}
              isHinted={hintedCardIds.includes(card.id)}
              gridSize={maxDimension}
              isShaking={shakingCardIds.has(card.id)}
              fogOpacity={fogOpacity}
              isDecaying={decayingCards.has(card.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
