import { useState, useCallback, useEffect, useRef } from 'react';

export interface CardData {
  id: number;
  animalId: string;
  animalName: string;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface GameState {
  cards: CardData[];
  flippedCards: number[];
  matchedPairs: number;
  moves: number;
  combo: number;
  maxCombo: number;
  timeRemaining: number;
  isPlaying: boolean;
  isGameOver: boolean;
  isWin: boolean;
  score: number;
}

const ANIMALS = [
  { id: 'duck', name: 'Duckling', emoji: '🦆' },
  { id: 'dog', name: 'Puppy', emoji: '🐕' },
  { id: 'cat', name: 'Kitten', emoji: '🐱' },
  { id: 'cow', name: 'Calf', emoji: '🐄' },
  { id: 'pig', name: 'Piglet', emoji: '🐷' },
  { id: 'chicken', name: 'Chick', emoji: '🐔' },
  { id: 'sheep', name: 'Lamb', emoji: '🐑' },
  { id: 'horse', name: 'Foal', emoji: '🐴' },
];

const GAME_TIME = 120; // 2 minutes

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createCards(gridSize: number = 4): CardData[] {
  const pairsNeeded = (gridSize * gridSize) / 2;
  const selectedAnimals = ANIMALS.slice(0, pairsNeeded);
  
  const cards: CardData[] = [];
  let cardId = 0;
  
  selectedAnimals.forEach((animal) => {
    // Create a pair
    for (let i = 0; i < 2; i++) {
      cards.push({
        id: cardId++,
        animalId: animal.id,
        animalName: animal.name,
        imageUrl: animal.emoji, // Using emoji as placeholder
        isFlipped: false,
        isMatched: false,
      });
    }
  });
  
  return shuffleArray(cards);
}

export function useGameState(gridSize: number = 4) {
  const [gameState, setGameState] = useState<GameState>(() => ({
    cards: createCards(gridSize),
    flippedCards: [],
    matchedPairs: 0,
    moves: 0,
    combo: 0,
    maxCombo: 0,
    timeRemaining: GAME_TIME,
    isPlaying: false,
    isGameOver: false,
    isWin: false,
    score: 0,
  }));
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalPairs = (gridSize * gridSize) / 2;

  // Timer effect
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isGameOver) {
      timerRef.current = setInterval(() => {
        setGameState((prev) => {
          if (prev.timeRemaining <= 1) {
            return {
              ...prev,
              timeRemaining: 0,
              isPlaying: false,
              isGameOver: true,
              isWin: false,
            };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.isGameOver]);

  const startGame = useCallback(() => {
    setGameState({
      cards: createCards(gridSize),
      flippedCards: [],
      matchedPairs: 0,
      moves: 0,
      combo: 0,
      maxCombo: 0,
      timeRemaining: GAME_TIME,
      isPlaying: true,
      isGameOver: false,
      isWin: false,
      score: 0,
    });
  }, [gridSize]);

  const flipCard = useCallback((cardId: number) => {
    setGameState((prev) => {
      // Can't flip if game not playing or already 2 cards flipped
      if (!prev.isPlaying || prev.flippedCards.length >= 2) return prev;
      
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card || card.isFlipped || card.isMatched) return prev;
      
      const newCards = prev.cards.map((c) =>
        c.id === cardId ? { ...c, isFlipped: true } : c
      );
      
      const newFlippedCards = [...prev.flippedCards, cardId];
      
      return {
        ...prev,
        cards: newCards,
        flippedCards: newFlippedCards,
      };
    });
  }, []);

  const checkMatch = useCallback(() => {
    setGameState((prev) => {
      if (prev.flippedCards.length !== 2) return prev;
      
      const [firstId, secondId] = prev.flippedCards;
      const firstCard = prev.cards.find((c) => c.id === firstId);
      const secondCard = prev.cards.find((c) => c.id === secondId);
      
      if (!firstCard || !secondCard) return prev;
      
      const isMatch = firstCard.animalId === secondCard.animalId;
      const newMoves = prev.moves + 1;
      
      if (isMatch) {
        const newCombo = prev.combo + 1;
        const newMaxCombo = Math.max(prev.maxCombo, newCombo);
        const comboBonus = newCombo > 1 ? newCombo * 50 : 0;
        const timeBonus = Math.floor(prev.timeRemaining / 10) * 10;
        const matchScore = 100 + comboBonus + timeBonus;
        
        const newCards = prev.cards.map((c) =>
          c.id === firstId || c.id === secondId
            ? { ...c, isMatched: true }
            : c
        );
        
        const newMatchedPairs = prev.matchedPairs + 1;
        const isWin = newMatchedPairs === totalPairs;
        
        return {
          ...prev,
          cards: newCards,
          flippedCards: [],
          matchedPairs: newMatchedPairs,
          moves: newMoves,
          combo: newCombo,
          maxCombo: newMaxCombo,
          score: prev.score + matchScore,
          isGameOver: isWin,
          isWin: isWin,
          isPlaying: !isWin,
        };
      } else {
        // No match - flip cards back after delay
        const newCards = prev.cards.map((c) =>
          c.id === firstId || c.id === secondId
            ? { ...c, isFlipped: false }
            : c
        );
        
        return {
          ...prev,
          cards: newCards,
          flippedCards: [],
          moves: newMoves,
          combo: 0,
        };
      }
    });
  }, [totalPairs]);

  return {
    gameState,
    startGame,
    flipCard,
    checkMatch,
    totalPairs,
  };
}
