import { useState, useEffect, useRef, useCallback } from 'react';

interface Card {
  id: number;
  value: string;
  isFlipped: boolean;
  isMatched: boolean;
  type: 'normal' | 'spark' | 'freeze' | 'multiplier';
}

export function useMemoryGame(gridSize: number, timeLimit: number) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [streak, setStreak] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Use refs for audio to avoid recreating on every render
  const audioRefs = useRef({
    spark: null as HTMLAudioElement | null,
    match: null as HTMLAudioElement | null,
    error: null as HTMLAudioElement | null
  });

  // Initialize audio once
  useEffect(() => {
    // Only create audio elements in browser environment
    if (typeof window !== 'undefined') {
      audioRefs.current = {
        spark: new Audio('/sounds/spark.mp3'),
        match: new Audio('/sounds/match.mp3'),
        error: new Audio('/sounds/error.mp3')
      };
    }

    return () => {
      // Cleanup audio
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  // Initialize cards
  useEffect(() => {
    const totalCards = gridSize * gridSize;

    // Ensure even number of cards
    if (totalCards % 2 !== 0) {
      console.warn('Grid size must produce even number of cards');
      return;
    }

    const pairCount = totalCards / 2;
    const baseValues = Array.from({ length: pairCount }, (_, i) => `card-${i}`);
    let pairedValues = [...baseValues, ...baseValues];

    // Shuffle array properly
    const shuffled: Card[] = pairedValues
      .map((value, index) => ({
        id: index,
        value,
        isFlipped: false,
        isMatched: false,
        type: 'normal' as const
      }))
      .sort(() => Math.random() - 0.5);

    // Add special cards (replace random normal cards)
    const specialCardCount = Math.min(3, Math.floor(pairCount / 3));
    const specialTypes: Array<'spark' | 'freeze' | 'multiplier'> = ['spark', 'freeze', 'multiplier'];

    specialTypes.slice(0, specialCardCount).forEach(type => {
      const randomIndex = Math.floor(Math.random() * shuffled.length);
      shuffled[randomIndex] = {
        ...shuffled[randomIndex],
        value: `special-${type}`,
        type: type
      };
    });

    setCards(shuffled);
    setTimeLeft(timeLimit);
    setStreak(0);
    setComboMultiplier(1);
    setFlippedCards([]);
    setMatchedPairs(0);
    setGameOver(false);
    setIsChecking(false);
  }, [gridSize, timeLimit]);

  // Timer with pause during checking
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
    if (matchedPairs === totalPairs && totalPairs > 0) {
      setGameOver(true);
    }
  }, [matchedPairs, gridSize]);

  // Play sound helper
  const playSound = useCallback((type: 'spark' | 'match' | 'error') => {
    const audio = audioRefs.current[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => console.warn('Audio play failed:', err));
    }
  }, []);

  // Match logic
  const checkMatch = useCallback((first: Card, second: Card) => {
    const isMatch = first.value === second.value;

    if (isMatch) {
      playSound('match');

      setCards(prev => prev.map(c =>
        (c.id === first.id || c.id === second.id)
          ? { ...c, isMatched: true }
          : c
      ));

      setMatchedPairs(prev => prev + 1);
      setStreak(prev => prev + 1);
      setComboMultiplier(prev => Math.min(prev + 0.1, 5)); // Cap at 5x

      // Handle special card effects
      [first, second].forEach(card => {
        if (card.type === 'spark') {
          playSound('spark');
        } else if (card.type === 'freeze') {
          setTimeLeft(t => t + 5);
        } else if (card.type === 'multiplier') {
          setComboMultiplier(m => Math.min(m * 2, 10)); // Cap at 10x
        }
      });
    } else {
      playSound('error');
      setStreak(0);
      setComboMultiplier(1);

      // Flip cards back
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          (c.id === first.id || c.id === second.id)
            ? { ...c, isFlipped: false }
            : c
        ));
      }, 400);
    }

    // Reset flipped cards and checking state
    setTimeout(() => {
      setFlippedCards([]);
      setIsChecking(false);
    }, isMatch ? 400 : 800);
  }, [playSound]);

  // Handle card flip
  const flipCard = useCallback((cardId: number) => {
    if (gameOver || isChecking) return;

    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.includes(cardId)) return;

    // Prevent flipping more than 2 cards
    if (flippedCards.length >= 2) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, isFlipped: true } : c
    ));

    // Check match when 2 cards are flipped
    if (newFlipped.length === 2) {
      setIsChecking(true);
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);

      if (firstCard && secondCard) {
        setTimeout(() => checkMatch(firstCard, secondCard), 600);
      }
    }
  }, [cards, flippedCards, gameOver, isChecking, checkMatch]);

  const resetGame = useCallback(() => {
    const totalCards = gridSize * gridSize;
    const pairCount = totalCards / 2;
    const baseValues = Array.from({ length: pairCount }, (_, i) => `card-${i}`);
    let pairedValues = [...baseValues, ...baseValues];

    const shuffled = pairedValues
      .map((value, index) => ({
        id: index,
        value,
        isFlipped: false,
        isMatched: false,
        type: 'normal' as const
      }))
      .sort(() => Math.random() - 0.5);

    setCards(shuffled);
    setTimeLeft(timeLimit);
    setStreak(0);
    setComboMultiplier(1);
    setFlippedCards([]);
    setMatchedPairs(0);
    setGameOver(false);
    setIsChecking(false);
  }, [gridSize, timeLimit]);

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
