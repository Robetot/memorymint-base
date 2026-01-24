import { useState, useEffect, useRef, useCallback } from 'react';

export type CardType = 'normal' | 'spark' | 'freeze' | 'multiplier';

export interface Card {
  id: number;
  value: string;
  isFlipped: boolean;
  isMatched: boolean;
  type: CardType;
}

export function useMemoryGame(gridSize: number, timeLimit: number, enableSpecialCards: boolean = false) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [streak, setStreak] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const audioRefs = useRef<{ [key in 'spark' | 'match' | 'error']: HTMLAudioElement | null }>({
    spark: null,
    match: null,
    error: null
  });

  // Initialize audio once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRefs.current = {
        spark: new Audio('/sounds/spark.mp3'),
        match: new Audio('/sounds/match.mp3'),
        error: new Audio('/sounds/error.mp3')
      };
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) audio.volume = 0.5;
      });
    }

    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  // Initialize cards - FIXED: Proper recreation logic
  const initializeGame = useCallback(() => {
    const totalCards = gridSize * gridSize;
    if (totalCards % 2 !== 0) {
      console.warn('Grid size must produce even number of cards');
      return;
    }

    const pairCount = totalCards / 2;
    const baseValues = Array.from({ length: pairCount }, (_, i) => `card-${i}`);
    const pairedValues = [...baseValues, ...baseValues];

    const shuffled: Card[] = pairedValues.map((value, index) => ({
      id: index,
      value,
      isFlipped: false,
      isMatched: false,
      type: 'normal' as CardType
    })).sort(() => Math.random() - 0.5);

    // Add special cards if enabled
    if (enableSpecialCards) {
      const specialTypes: CardType[] = ['spark', 'freeze', 'multiplier'];
      const specialCardCount = Math.min(3, Math.floor(pairCount / 4));

      specialTypes.slice(0, specialCardCount).forEach(type => {
        const normalIndices = shuffled
          .map((c, idx) => ({ c, idx }))
          .filter(({ c }) => c.type === 'normal')
          .map(({ idx }) => idx);

        if (normalIndices.length >= 2) {
          const idx1 = normalIndices[Math.floor(Math.random() * normalIndices.length)];
          const remainingIndices = normalIndices.filter(i => i !== idx1);
          const idx2 = remainingIndices[Math.floor(Math.random() * remainingIndices.length)];
          const specialValue = `special-${type}`;
          shuffled[idx1] = { ...shuffled[idx1], type, value: specialValue };
          shuffled[idx2] = { ...shuffled[idx2], type, value: specialValue };
        }
      });
    }

    setCards(shuffled);
    setTimeLeft(timeLimit);
    setStreak(0);
    setComboMultiplier(1);
    setFlippedCards([]);
    setMatchedPairs(0);
    setGameOver(false);
    setIsChecking(false);
  }, [gridSize, timeLimit, enableSpecialCards]);

  // Initialize on mount and when settings change
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Timer
  useEffect(() => {
    if (gameOver || isChecking) return;
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameOver, isChecking]);

  // Check for win condition
  useEffect(() => {
    const totalPairs = (gridSize * gridSize) / 2;
    if (matchedPairs > 0 && matchedPairs === totalPairs) {
      setGameOver(true);
    }
  }, [matchedPairs, gridSize]);

  const playSound = useCallback((type: 'spark' | 'match' | 'error') => {
    const audio = audioRefs.current[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }, []);

  const checkMatch = useCallback((first: Card, second: Card) => {
    const isMatch = first.value === second.value;

    if (isMatch) {
      playSound('match');
      setCards(prev => prev.map(c =>
        (c.id === first.id || c.id === second.id) ? { ...c, isMatched: true } : c
      ));
      setMatchedPairs(prev => prev + 1);
      setStreak(prev => prev + 1);
      setComboMultiplier(prev => Math.min(prev + 0.1, 5));

      if (enableSpecialCards) {
        [first, second].forEach(card => {
          if (card.type === 'spark') playSound('spark');
          if (card.type === 'freeze') setTimeLeft(t => t + 5);
          if (card.type === 'multiplier') setComboMultiplier(m => Math.min(m * 2, 10));
        });
      }
    } else {
      playSound('error');
      setStreak(0);
      setComboMultiplier(1);
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          (c.id === first.id || c.id === second.id) ? { ...c, isFlipped: false } : c
        ));
      }, 400);
    }

    setTimeout(() => {
      setFlippedCards([]);
      setIsChecking(false);
    }, isMatch ? 400 : 800);
  }, [playSound, enableSpecialCards]);

  const flipCard = useCallback((cardId: number) => {
    if (gameOver || isChecking) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.includes(cardId)) return;
    if (flippedCards.length >= 2) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));

    if (newFlipped.length === 2) {
      setIsChecking(true);
      const [fId, sId] = newFlipped;
      const fCard = cards.find(c => c.id === fId);
      const sCard = cards.find(c => c.id === sId);
      if (fCard && sCard) setTimeout(() => checkMatch(fCard, sCard), 600);
    }
  }, [cards, flippedCards, gameOver, isChecking, checkMatch]);

  const resetGame = useCallback(() => {
    initializeGame();
  }, [initializeGame]);

  return {
    cards,
    flipCard,
    streak,
    comboMultiplier,
    timeLeft,
    gameOver,
    matchedPairs,
    totalPairs: (gridSize * gridSize) / 2,
    resetGame,
    isChecking
  };
}
