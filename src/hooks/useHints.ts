import { useState, useCallback } from 'react';

export interface HintState {
  hintsRemaining: number;
  isHintActive: boolean;
  hintedCardIds: number[];
}

const getMaxHints = (levelOrDifficulty: number | string): number => {
  // Handle level numbers
  if (typeof levelOrDifficulty === 'number') {
    if (levelOrDifficulty <= 2) return 1; // 2x2 levels
    if (levelOrDifficulty <= 5) return 3; // 4x4 levels
    if (levelOrDifficulty <= 7) return 5; // 6x6 levels
    return 7; // 8x8 levels
  }
  // Handle difficulty strings for backwards compatibility
  const hints: Record<string, number> = {
    '2x2': 1, '4x4': 3, '6x6': 5, '8x8': 7,
  };
  return hints[levelOrDifficulty] || 3;
};

export function useHints(levelOrDifficulty: number | string) {
  const [hintsRemaining, setHintsRemaining] = useState(
    getMaxHints(levelOrDifficulty)
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

  const resetHints = useCallback((newLevelOrDifficulty: number | string) => {
    setHintsRemaining(getMaxHints(newLevelOrDifficulty));
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
