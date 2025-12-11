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
  const pairsNeeded = (gridSize * gridSize) / 2;
  const shuffledAnimals = shuffleArray(ANIMALS);
  
  // Ensure we only use unique animals (no duplicates)
  const uniqueAnimals = shuffledAnimals.filter((animal, index, self) => 
    self.findIndex(a => a.id === animal.id) === index
  );
  
  // Only take as many unique animals as we need for pairs
  const selectedAnimals = uniqueAnimals.slice(0, Math.min(pairsNeeded, uniqueAnimals.length));
  
  // If we don't have enough unique animals, we cannot proceed properly
  // This creates exactly one pair per animal
  const cards: CardData[] = [];
  let cardId = 0;
  
  selectedAnimals.forEach((animal: AnimalData) => {
    // Create exactly 2 cards (one pair) per animal
    cards.push({
      id: cardId++,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
    cards.push({
      id: cardId++,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
  });
  
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
  const totalPairs = (gridSize * gridSize) / 2;

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

  const addTime = useCallback((seconds: number) => {
    setGameState((prev) => ({
      ...prev,
      timeRemaining: prev.timeRemaining + seconds,
    }));
  }, []);

  const shuffleUnmatched = useCallback(() => {
    setGameState((prev) => {
      const unmatchedCards = prev.cards.filter(c => !c.isMatched);
      const matchedCards = prev.cards.filter(c => c.isMatched);
      
      // Get positions and shuffle them
      const unmatchedPositions = unmatchedCards.map(c => c.id);
      const shuffledPositions = shuffleArray([...unmatchedPositions]);
      
      // Reassign positions
      const shuffledUnmatched = unmatchedCards.map((card, index) => ({
        ...card,
        id: shuffledPositions[index],
        isFlipped: false,
      }));
      
      // Combine and sort by id
      const allCards = [...matchedCards, ...shuffledUnmatched].sort((a, b) => a.id - b.id);
      
      return {
        ...prev,
        cards: allCards,
        flippedCards: [],
      };
    });
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
    addTime,
    shuffleUnmatched,
    totalPairs,
    gridSize,
  };
}
