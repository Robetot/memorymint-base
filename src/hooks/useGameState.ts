import { useState, useCallback, useEffect, useRef } from 'react';
import { ANIMALS, AnimalData } from '@/data/animals';
import { LevelConfig, getLevel } from '@/data/levels';

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
  isPaused: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createCards(gridSize: number): CardData[] {
  const totalCards = gridSize * gridSize;
  
  // Special case: 1x1 grid (tutorial level) - single card that auto-completes
  if (gridSize === 1) {
    const animal = shuffleArray(ANIMALS)[0];
    return [{
      id: 0,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    }];
  }
  
  // For odd grids (3x3, 5x5, 7x7, 9x9), we need (n²-1)/2 pairs + 1 single card
  // But for simplicity, we'll use (n² - 1) cards with one "joker" that matches itself
  // Actually, better approach: for odd grids, remove center card from play
  const isOddGrid = gridSize % 2 === 1;
  const pairsNeeded = isOddGrid 
    ? Math.floor(totalCards / 2)  // (9-1)/2 = 4 pairs for 3x3
    : totalCards / 2;
  
  const shuffledAnimals = shuffleArray(ANIMALS);
  const selectedAnimals = shuffledAnimals.slice(0, pairsNeeded);
  
  const cards: CardData[] = [];
  let cardId = 0;
  
  selectedAnimals.forEach((animal: AnimalData) => {
    for (let i = 0; i < 2; i++) {
      cards.push({
        id: cardId++,
        animalId: animal.id,
        animalName: animal.name,
        imageUrl: animal.image,
        isFlipped: false,
        isMatched: false,
      });
    }
  });
  
  // For odd grids, add a center card that's pre-matched (shown but not playable)
  if (isOddGrid) {
    const centerAnimal = shuffledAnimals[pairsNeeded] || shuffledAnimals[0];
    cards.push({
      id: cardId++,
      animalId: 'center_' + centerAnimal.id,
      animalName: centerAnimal.name,
      imageUrl: centerAnimal.image,
      isFlipped: true,
      isMatched: true, // Pre-matched so it's always visible
    });
  }
  
  return shuffleArray(cards);
}

export function useGameState(level: number = 1) {
  const config: LevelConfig = getLevel(level);
  const gridSize = config.gridSize;
  const gameTime = config.time;
  
  const [gameState, setGameState] = useState<GameState>(() => ({
    cards: createCards(gridSize),
    flippedCards: [],
    matchedPairs: 0,
    moves: 0,
    combo: 0,
    maxCombo: 0,
    timeRemaining: gameTime,
    isPlaying: false,
    isGameOver: false,
    isWin: false,
    score: 0,
    isPaused: false,
  }));
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate total pairs based on grid size
  // For 1x1: 0 pairs (tutorial), for odd grids: (n²-1)/2 pairs
  const calculateTotalPairs = () => {
    if (gridSize === 1) return 0; // Tutorial level
    const totalCards = gridSize * gridSize;
    const isOddGrid = gridSize % 2 === 1;
    return isOddGrid ? Math.floor(totalCards / 2) : totalCards / 2;
  };
  const totalPairs = calculateTotalPairs();

  useEffect(() => {
    if (gameState.isPlaying && !gameState.isGameOver && !gameState.isPaused) {
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
  }, [gameState.isPlaying, gameState.isGameOver, gameState.isPaused]);

  const startGame = useCallback(() => {
    setGameState({
      cards: createCards(gridSize),
      flippedCards: [],
      matchedPairs: 0,
      moves: 0,
      combo: 0,
      maxCombo: 0,
      timeRemaining: gameTime,
      isPlaying: true,
      isGameOver: false,
      isWin: false,
      score: 0,
      isPaused: false,
    });
  }, [gridSize, gameTime]);

  const pauseGame = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      isPaused: true,
    }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      isPaused: false,
    }));
  }, []);

  const flipCard = useCallback((cardId: number) => {
    setGameState((prev) => {
      if (!prev.isPlaying || prev.flippedCards.length >= 2 || prev.isPaused) return prev;
      
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
    pauseGame,
    resumeGame,
    totalPairs,
    gridSize,
  };
}
