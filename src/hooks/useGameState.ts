import { useState, useCallback, useEffect, useRef } from 'react';
import { ANIMALS, AnimalData, isEmojiAnimal } from '@/data/animals';
import { LevelConfig, getLevel, LevelMechanic } from '@/data/levels';
import { autoCorrectDeck, validateDeck, CardData } from '@/utils/deckValidator';

export type { CardData } from '@/utils/deckValidator';

export interface MechanicState {
  shuffleTriggered: boolean;
  shuffleCount: number;
  mistakeCount: number;
  maxMistakes: number;
  fogEnabled: boolean;
  flashPreviewDone: boolean;
  decoyCards: number[];
  comboRequired: number;
  hiddenMatches: boolean;
  decayingCards: Set<number>;
  timerHidden: boolean;
  rotatedCards: Set<number>;
  oneChanceActive: boolean;
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
  mechanics: MechanicState;
  previewMode: boolean;
  isShuffling: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createValidatedCards(cols: number, rows?: number): CardData[] {
  const actualRows = rows || cols;
  const totalCards = cols * actualRows;
  const cards = autoCorrectDeck(totalCards);
  const pairsNeeded = totalCards / 2;
  const validation = validateDeck(cards, pairsNeeded);
  
  if (!validation.isValid) {
    console.error('Deck validation failed:', validation.errors);
  } else {
    console.log(`✓ Valid deck created: ${cards.length} cards, ${pairsNeeded} pairs`);
  }
  
  return cards;
}

function getInitialMechanicState(config: LevelConfig): MechanicState {
  const hasMechanic = (m: LevelMechanic) => config.mechanics.includes(m) || config.mechanics.includes('all_mechanics');
  
  return {
    shuffleTriggered: false,
    shuffleCount: hasMechanic('double_shuffle') ? 2 : hasMechanic('shuffle') ? 1 : 0,
    mistakeCount: 0,
    maxMistakes: hasMechanic('one_chance') ? 1 : hasMechanic('limited_mistakes') ? 3 : Infinity,
    fogEnabled: hasMechanic('fog'),
    flashPreviewDone: !hasMechanic('flash_preview'),
    decoyCards: [],
    comboRequired: hasMechanic('combo_required') ? 3 : 0,
    hiddenMatches: hasMechanic('hidden_matches'),
    decayingCards: new Set(),
    timerHidden: hasMechanic('no_timer_display'),
    rotatedCards: new Set(),
    oneChanceActive: hasMechanic('one_chance'),
  };
}

export function useGameState(level: number = 1) {
  const config: LevelConfig = getLevel(level);
  const gridSize = config.gridColumns;
  const gridRows = config.gridRows;
  const gameTime = config.time;
  const expectedPairs = (gridSize * gridRows) / 2;
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const cards = createValidatedCards(gridSize, gridRows);
    const hasMechanic = (m: LevelMechanic) => config.mechanics.includes(m) || config.mechanics.includes('all_mechanics');
    
    // Add decoy cards if mechanic active
    let decoyIndices: number[] = [];
    if (hasMechanic('decoys')) {
      // Add 2-4 decoy card indices
      const decoyCount = Math.min(4, Math.floor(cards.length * 0.1));
      decoyIndices = shuffleArray([...Array(cards.length).keys()]).slice(0, decoyCount);
    }
    
    return {
      cards,
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
      previewMode: hasMechanic('flash_preview'),
      isShuffling: false,
      mechanics: {
        ...getInitialMechanicState(config),
        decoyCards: decoyIndices,
      },
    };
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const shuffleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const decayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const totalPairs = gameState.cards.length / 2;
  
  const hasMechanic = useCallback((m: LevelMechanic) => 
    config.mechanics.includes(m) || config.mechanics.includes('all_mechanics'),
  [config.mechanics]);

  // Flash preview timer
  useEffect(() => {
    if (gameState.isPlaying && gameState.previewMode && !gameState.mechanics.flashPreviewDone) {
      // Show all cards for 2 seconds
      setGameState(prev => ({
        ...prev,
        cards: prev.cards.map(c => ({ ...c, isFlipped: true })),
      }));
      
      previewTimerRef.current = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          cards: prev.cards.map(c => ({ ...c, isFlipped: c.isMatched })),
          previewMode: false,
          mechanics: { ...prev.mechanics, flashPreviewDone: true },
        }));
      }, 2000);
    }
    
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [gameState.isPlaying, gameState.previewMode, gameState.mechanics.flashPreviewDone]);

  // Mid-game shuffle mechanic
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isGameOver && !gameState.isShuffling && gameState.mechanics.shuffleCount > 0 && !gameState.mechanics.shuffleTriggered) {
      const shuffleThreshold = hasMechanic('double_shuffle') ? 0.5 : 0.4;
      const progressRatio = gameState.matchedPairs / totalPairs;
      
      if (progressRatio >= shuffleThreshold) {
        // Start shuffle animation
        setGameState(prev => ({ ...prev, isShuffling: true }));
        
        shuffleTimerRef.current = setTimeout(() => {
          setGameState(prev => {
            const unmatchedCards = prev.cards.filter(c => !c.isMatched);
            const matchedCards = prev.cards.filter(c => c.isMatched);
            const unmatchedPositions = unmatchedCards.map(c => c.id);
            const shuffledPositions = shuffleArray([...unmatchedPositions]);
            
            const shuffledUnmatched = unmatchedCards.map((card, index) => ({
              ...card,
              id: shuffledPositions[index],
              isFlipped: false,
            }));
            
            const allCards = [...matchedCards, ...shuffledUnmatched].sort((a, b) => a.id - b.id);
            
            return {
              ...prev,
              cards: allCards,
              flippedCards: [],
              isShuffling: false,
              mechanics: {
                ...prev.mechanics,
                shuffleTriggered: true,
                shuffleCount: prev.mechanics.shuffleCount - 1,
              },
            };
          });
        }, 1500); // Animation duration
      }
    }
    
    return () => {
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
    };
  }, [gameState.matchedPairs, gameState.isPlaying, gameState.isGameOver, gameState.mechanics.shuffleCount, gameState.mechanics.shuffleTriggered, totalPairs, hasMechanic]);

  // Card decay mechanic
  useEffect(() => {
    if (gameState.isPlaying && hasMechanic('card_decay') && !gameState.isGameOver) {
      decayTimerRef.current = setInterval(() => {
        setGameState(prev => {
          const unmatchedCards = prev.cards.filter(c => !c.isMatched && !c.isFlipped);
          if (unmatchedCards.length === 0) return prev;
          
          // Randomly decay some cards (make them harder to see)
          const decayCount = Math.min(3, unmatchedCards.length);
          const toDecay = shuffleArray(unmatchedCards.map(c => c.id)).slice(0, decayCount);
          
          return {
            ...prev,
            mechanics: {
              ...prev.mechanics,
              decayingCards: new Set([...prev.mechanics.decayingCards, ...toDecay]),
            },
          };
        });
      }, 8000);
    }
    
    return () => {
      if (decayTimerRef.current) clearInterval(decayTimerRef.current);
    };
  }, [gameState.isPlaying, gameState.isGameOver, hasMechanic]);

  // Card rotation mechanic
  useEffect(() => {
    if (gameState.isPlaying && hasMechanic('card_rotation') && !gameState.isGameOver) {
      rotationTimerRef.current = setInterval(() => {
        setGameState(prev => {
          const unmatchedCards = prev.cards.filter(c => !c.isMatched);
          if (unmatchedCards.length === 0) return prev;
          
          const rotateCount = Math.min(6, unmatchedCards.length);
          const toRotate = shuffleArray(unmatchedCards.map(c => c.id)).slice(0, rotateCount);
          
          return {
            ...prev,
            mechanics: {
              ...prev.mechanics,
              rotatedCards: new Set(toRotate),
            },
          };
        });
      }, 5000);
    }
    
    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, [gameState.isPlaying, gameState.isGameOver, hasMechanic]);

  // Main game timer
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isGameOver && !gameState.isPaused && !gameState.previewMode) {
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.isPlaying, gameState.isGameOver, gameState.isPaused, gameState.previewMode]);

  const startGame = useCallback(() => {
    const validatedCards = createValidatedCards(gridSize, gridRows);
    const hasMechanicLocal = (m: LevelMechanic) => config.mechanics.includes(m) || config.mechanics.includes('all_mechanics');
    
    let decoyIndices: number[] = [];
    if (hasMechanicLocal('decoys')) {
      const decoyCount = Math.min(4, Math.floor(validatedCards.length * 0.1));
      decoyIndices = shuffleArray([...Array(validatedCards.length).keys()]).slice(0, decoyCount);
    }
    
    setGameState({
      cards: validatedCards,
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
      previewMode: hasMechanicLocal('flash_preview'),
      isShuffling: false,
      mechanics: {
        ...getInitialMechanicState(config),
        decoyCards: decoyIndices,
      },
    });
  }, [gridSize, gridRows, gameTime, config]);

  const pauseGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const addTime = useCallback((seconds: number) => {
    setGameState((prev) => ({ ...prev, timeRemaining: prev.timeRemaining + seconds }));
  }, []);

  const shuffleUnmatched = useCallback(() => {
    setGameState((prev) => {
      const unmatchedCards = prev.cards.filter(c => !c.isMatched);
      const matchedCards = prev.cards.filter(c => c.isMatched);
      const unmatchedPositions = unmatchedCards.map(c => c.id);
      const shuffledPositions = shuffleArray([...unmatchedPositions]);
      const shuffledUnmatched = unmatchedCards.map((card, index) => ({
        ...card,
        id: shuffledPositions[index],
        isFlipped: false,
      }));
      const allCards = [...matchedCards, ...shuffledUnmatched].sort((a, b) => a.id - b.id);
      
      return { ...prev, cards: allCards, flippedCards: [] };
    });
  }, []);

  const flipCard = useCallback((cardId: number) => {
    setGameState((prev) => {
      if (!prev.isPlaying || prev.flippedCards.length >= 2 || prev.isPaused || prev.previewMode) return prev;
      
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card || card.isFlipped || card.isMatched) return prev;
      
      // Check if this is a decoy card
      if (prev.mechanics.decoyCards.includes(cardId)) {
        // Decoy cards can be flipped but won't match anything
      }
      
      const newCards = prev.cards.map((c) =>
        c.id === cardId ? { ...c, isFlipped: true } : c
      );
      
      return {
        ...prev,
        cards: newCards,
        flippedCards: [...prev.flippedCards, cardId],
        // Clear decay on flipped card
        mechanics: {
          ...prev.mechanics,
          decayingCards: new Set([...prev.mechanics.decayingCards].filter(id => id !== cardId)),
        },
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
      
      // Check if either card is a decoy
      const isDecoyMatch = prev.mechanics.decoyCards.includes(firstId) || prev.mechanics.decoyCards.includes(secondId);
      const isMatch = !isDecoyMatch && firstCard.animalId === secondCard.animalId;
      const newMoves = prev.moves + 1;
      
      if (isMatch) {
        const newCombo = prev.combo + 1;
        const newMaxCombo = Math.max(prev.maxCombo, newCombo);
        const comboBonus = newCombo > 1 ? newCombo * 50 : 0;
        const timeBonus = Math.floor(prev.timeRemaining / 10) * 10;
        const matchScore = 100 + comboBonus + timeBonus;
        
        const newCards = prev.cards.map((c) =>
          c.id === firstId || c.id === secondId
            ? { ...c, isMatched: true, isFlipped: !prev.mechanics.hiddenMatches }
            : c
        );
        
        const newMatchedPairs = prev.matchedPairs + 1;
        const actualTotalPairs = prev.cards.length / 2;
        const isWin = newMatchedPairs >= actualTotalPairs;
        
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
        // Mismatch
        const newMistakeCount = prev.mechanics.mistakeCount + 1;
        const gameOverFromMistakes = newMistakeCount >= prev.mechanics.maxMistakes;
        
        // Check combo requirement
        const currentTotalPairs = prev.cards.length / 2;
        const lostRequiredCombo = prev.mechanics.comboRequired > 0 && prev.combo >= prev.mechanics.comboRequired;
        const gameOverFromCombo = lostRequiredCombo && prev.matchedPairs < currentTotalPairs / 2;
        
        const newCards = prev.cards.map((c) =>
          c.id === firstId || c.id === secondId
            ? { ...c, isFlipped: false }
            : c
        );
        
        if (gameOverFromMistakes || (prev.mechanics.oneChanceActive && newMistakeCount > 0)) {
          return {
            ...prev,
            cards: newCards,
            flippedCards: [],
            moves: newMoves,
            combo: 0,
            isGameOver: true,
            isWin: false,
            isPlaying: false,
            mechanics: { ...prev.mechanics, mistakeCount: newMistakeCount },
          };
        }
        
        return {
          ...prev,
          cards: newCards,
          flippedCards: [],
          moves: newMoves,
          combo: 0,
          mechanics: { ...prev.mechanics, mistakeCount: newMistakeCount },
        };
      }
    });
  }, []);

  // Get visible cards (for fog of war)
  const getVisibleCards = useCallback((lastFlippedId?: number) => {
    if (!gameState.mechanics.fogEnabled) return gameState.cards.map(c => c.id);
    
    // Only show cards near the last flipped card
    if (!lastFlippedId && gameState.flippedCards.length === 0) {
      // Show center cards initially
      const centerIdx = Math.floor(gameState.cards.length / 2);
      const visibleRange = 4;
      return gameState.cards
        .filter((_, i) => Math.abs(i - centerIdx) <= visibleRange)
        .map(c => c.id);
    }
    
    const baseId = lastFlippedId || gameState.flippedCards[0] || 0;
    const visibleRange = 3;
    
    return gameState.cards
      .filter(c => Math.abs(c.id - baseId) <= visibleRange || c.isMatched || c.isFlipped)
      .map(c => c.id);
  }, [gameState.cards, gameState.flippedCards, gameState.mechanics.fogEnabled]);

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
    gridRows,
    hasMechanic,
    getVisibleCards,
    config,
  };
}
