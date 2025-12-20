import { useEffect, useRef, useState, useCallback } from 'react';
import { GameCard } from './GameCard';
import { CardData } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';
import { FloatingScore } from './FloatingScore';
import { MatchParticles, ComboParticles } from './MatchParticles';
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
  const gridSizeCategory = maxDimension <= 2 ? 'tiny' : maxDimension <= 4 ? 'small' : maxDimension <= 6 ? 'medium' : maxDimension <= 8 ? 'large' : 'xlarge';

  // Calculate optimal card size based on grid dimensions
  const getCardSize = () => {
    if (maxDimension <= 2) return 'w-24 h-24 md:w-28 md:h-28';
    if (maxDimension <= 3) return 'w-20 h-20 md:w-24 md:h-24';
    if (maxDimension <= 4) return 'w-16 h-16 md:w-20 md:h-20';
    if (maxDimension <= 5) return 'w-14 h-14 md:w-16 md:h-16';
    if (maxDimension <= 6) return 'w-12 h-12 md:w-14 md:h-14';
    if (maxDimension <= 7) return 'w-10 h-10 md:w-12 md:h-12';
    if (maxDimension <= 8) return 'w-9 h-9 md:w-11 md:h-11';
    return 'w-8 h-8 md:w-10 md:h-10';
  };

  return (
    <div 
      ref={boardRef}
      className={cn(
        'w-full mx-auto p-2 md:p-4 relative',
        gridSizeCategory === 'xlarge' ? 'max-w-[100vw] md:max-w-5xl' :
        gridSizeCategory === 'large' ? 'max-w-[98vw] md:max-w-4xl' : 
        gridSizeCategory === 'medium' ? 'max-w-[95vw] md:max-w-2xl' : 
        'max-w-lg'
      )}
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
        <MatchParticles
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
        className={cn(
          "grid mx-auto justify-center items-center",
          maxDimension <= 4 ? "gap-2 md:gap-3" : maxDimension <= 6 ? "gap-1.5 md:gap-2" : "gap-1"
        )}
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, auto))`,
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
