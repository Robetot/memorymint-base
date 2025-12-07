import { useState, useCallback } from 'react';

export interface HintState {
  hintsRemaining: number;
  isHintActive: boolean;
  hintedCardIds: number[];
}

const MAX_HINTS_BY_DIFFICULTY: Record<string, number> = {
  '2x2': 1,
  '4x4': 3,
  '6x6': 5,
  '8x8': 7,
};

export function useHints(difficulty: string) {
  const [hintsRemaining, setHintsRemaining] = useState(
    MAX_HINTS_BY_DIFFICULTY[difficulty] || 3
  );
  const [isHintActive, setIsHintActive] = useState(false);
  const [hintedCardIds, setHintedCardIds] = useState<number[]>([]);

  const useHint = useCallback((cards: Array<{ id: number; animalId: string; isMatched: boolean }>) => {
    if (hintsRemaining <= 0 || isHintActive) return [];

    // Find an unmatched pair
    const unmatchedCards = cards.filter(c => !c.isMatched);
    const pairMap = new Map<string, number[]>();
    
    unmatchedCards.forEach(card => {
      const existing = pairMap.get(card.animalId) || [];
      pairMap.set(card.animalId, [...existing, card.id]);
    });

    // Get first complete pair
    for (const [, cardIds] of pairMap) {
      if (cardIds.length >= 2) {
        setHintsRemaining(prev => prev - 1);
        setIsHintActive(true);
        setHintedCardIds(cardIds.slice(0, 2));
        
        // Clear hint after 1.5 seconds
        setTimeout(() => {
          setIsHintActive(false);
          setHintedCardIds([]);
        }, 1500);
        
        return cardIds.slice(0, 2);
      }
    }

    return [];
  }, [hintsRemaining, isHintActive]);

  const resetHints = useCallback((newDifficulty: string) => {
    setHintsRemaining(MAX_HINTS_BY_DIFFICULTY[newDifficulty] || 3);
    setIsHintActive(false);
    setHintedCardIds([]);
  }, []);

  return {
    hintsRemaining,
    isHintActive,
    hintedCardIds,
    useHint,
    resetHints,
  };
}
