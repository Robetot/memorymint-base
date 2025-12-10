import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX, Music, Music2, Pause, Lightbulb } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { GameStats } from './GameStats';
import { GameOverModal } from './GameOverModal';
import { ScoreSubmitModal } from './ScoreSubmitModal';
import { PauseMenu } from './PauseMenu';
import { Level1Tutorial } from './Level1Tutorial';
import { useGameState } from '@/hooks/useGameState';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useConfetti } from '@/hooks/useConfetti';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useHints } from '@/hooks/useHints';
import { getLevel, saveUnlockedLevel, getMaxLevel, hasShownLevel1Tutorial, markLevel1TutorialShown } from '@/data/levels';
import { calculateRarity, RarityResult } from '@/utils/rarityCalculator';
import { cn } from '@/lib/utils';

interface GameScreenProps {
  onBackToMenu: () => void;
  level: number;
  onCreateArt?: (score: number, rarity: RarityResult) => void;
  onNextLevel?: (nextLevel: number) => void;
  nftName?: string | null;
  onNFTNameSet?: (name: string) => void;
}

export function GameScreen({ onBackToMenu, level, onCreateArt, onNextLevel, nftName, onNFTNameSet }: GameScreenProps) {
  const { gameState, startGame, flipCard, checkMatch, totalPairs, pauseGame, resumeGame, gridSize } = useGameState(level);
  const config = getLevel(level);
  const {
    playAnimalSound,
    stopAnimalSound,
    playFlipSound,
    playMatchSound,
    playNoMatchSound,
    playWinSound,
    playLoseSound,
    playClickSound,
    playComboSound,
    setMuted,
  } = useSoundEffects();
  const { fireMatchConfetti, fireComboConfetti, fireWinConfetti } = useConfetti();
  const { isPlaying: isMusicPlaying, toggle: toggleMusic } = useBackgroundMusic();
  const { addEntry, getTopScore } = useLeaderboard();
  const { hintsRemaining, hintedCardIds, useHint, resetHints } = useHints(level);

  const [isMuted, setIsMuted] = useState(false);
  const [showScoreSubmit, setShowScoreSubmit] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rarity, setRarity] = useState<RarityResult | null>(null);
  const [perfectGame, setPerfectGame] = useState(true);
  const [showLevel1Tutorial, setShowLevel1Tutorial] = useState(false);

  // Show level 1 tutorial once
  useEffect(() => {
    if (level === 1 && !hasShownLevel1Tutorial()) {
      setShowLevel1Tutorial(true);
    }
  }, [level]);

  // Track perfect game (no wrong matches)
  useEffect(() => {
    if (gameState.combo === 0 && gameState.moves > 0 && gameState.matchedPairs < totalPairs) {
      setPerfectGame(false);
    }
  }, [gameState.combo, gameState.moves, gameState.matchedPairs, totalPairs]);

  // Start game on mount
  useEffect(() => {
    startGame();
    setPerfectGame(true);
    resetHints(level);
  }, [startGame, resetHints, level]);

  // Handle level 1 (1x1 grid) - auto-complete when card is flipped
  useEffect(() => {
    if (level === 1 && gridSize === 1 && gameState.cards.length === 1) {
      const card = gameState.cards[0];
      if (card.isFlipped && !gameState.isGameOver) {
        // Auto-complete level 1 after a short delay
        const timer = setTimeout(() => {
          playWinSound();
          fireWinConfetti();
          saveUnlockedLevel(2);
          
          // Calculate simple rarity for level 1
          const rarityResult = calculateRarity(
            '2x2',
            gameState.timeRemaining,
            config.time,
            1,
            1,
            1,
            true
          );
          setRarity(rarityResult);
          
          // Check if need to ask for NFT name
          if (!nftName) {
            setShowScoreSubmit(true);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [level, gridSize, gameState.cards, gameState.isGameOver, playWinSound, fireWinConfetti, config.time, gameState.timeRemaining, nftName]);

  // Play win/lose sounds and calculate rarity
  useEffect(() => {
    if (gameState.isGameOver && level > 1) {
      if (gameState.isWin) {
        playWinSound();
        fireWinConfetti();
        
        // Unlock next level
        const nextLevel = Math.min(level + 1, getMaxLevel());
        saveUnlockedLevel(nextLevel);
        
        // Calculate rarity based on level
        const difficultyMap: Record<number, '2x2' | '4x4' | '6x6' | '8x8'> = {
          2: '2x2', 3: '2x2', 4: '4x4', 5: '4x4', 6: '6x6', 7: '6x6', 8: '8x8', 9: '8x8', 10: '8x8'
        };
        const difficulty = difficultyMap[config.gridSize] || '4x4';
        
        const rarityResult = calculateRarity(
          difficulty,
          gameState.timeRemaining,
          config.time,
          gameState.moves,
          totalPairs,
          gameState.maxCombo,
          perfectGame
        );
        setRarity(rarityResult);
        
        // Check if it's a high score (only show if we have NFT name)
        const topScore = getTopScore(level);
        if ((gameState.score > topScore || topScore === 0) && !nftName) {
          setShowScoreSubmit(true);
        }
      } else {
        playLoseSound();
      }
    }
  }, [gameState.isGameOver, gameState.isWin, playWinSound, playLoseSound, fireWinConfetti, gameState.score, getTopScore, level, gameState.timeRemaining, config.time, config.gridSize, gameState.moves, totalPairs, gameState.maxCombo, perfectGame, nftName]);

  const handleCardClick = useCallback((cardId: number) => {
    playFlipSound();
    flipCard(cardId);
  }, [flipCard, playFlipSound]);

  const handleAnimalRevealed = useCallback((animalId: string, cardId: number) => {
    playAnimalSound(animalId, `card_${cardId}`);
  }, [playAnimalSound]);

  const handleCardFlippedBack = useCallback((cardId: number) => {
    stopAnimalSound(`card_${cardId}`);
  }, [stopAnimalSound]);

  const handleMatch = useCallback(() => {
    playMatchSound();
    if (gameState.combo > 0) {
      playComboSound();
      fireComboConfetti(gameState.combo);
    } else {
      fireMatchConfetti();
    }
  }, [playMatchSound, playComboSound, gameState.combo, fireMatchConfetti, fireComboConfetti]);

  const handleNoMatch = useCallback(() => {
    playNoMatchSound();
  }, [playNoMatchSound]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMuted(newMuted);
    playClickSound();
  };

  const handlePlayAgain = () => {
    playClickSound();
    startGame();
    setPerfectGame(true);
    setRarity(null);
    resetHints(level);
  };

  const handleBackToMenu = () => {
    playClickSound();
    onBackToMenu();
  };

  const handleScoreSubmit = (name: string) => {
    // Save NFT name for future levels
    if (onNFTNameSet) {
      onNFTNameSet(name);
    }
    
    addEntry({
      playerName: name,
      score: gameState.score,
      moves: gameState.moves,
      time: config.time - gameState.timeRemaining,
      difficulty: `Level ${level}`,
      maxCombo: gameState.maxCombo,
    });
    setShowScoreSubmit(false);
  };

  const handleScoreSkip = () => {
    setShowScoreSubmit(false);
  };

  const handleCreateArt = () => {
    if (onCreateArt && rarity) {
      onCreateArt(gameState.score, rarity);
    }
  };

  const handleNextLevel = () => {
    if (onNextLevel && level < getMaxLevel()) {
      playClickSound();
      onNextLevel(level + 1);
    }
  };

  const handlePause = () => {
    if (gameState.isPlaying) {
      pauseGame();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    resumeGame();
    setIsPaused(false);
  };

  const handleRestart = () => {
    setIsPaused(false);
    handlePlayAgain();
  };

  const handleUseHint = () => {
    const hinted = useHint(gameState.cards);
    if (hinted.length > 0) {
      playClickSound();
    }
    setIsPaused(false);
    resumeGame();
  };

  const handleLevel1TutorialDismiss = () => {
    setShowLevel1Tutorial(false);
    markLevel1TutorialShown();
  };

  // Check if level 1 is completed (card flipped)
  const isLevel1Complete = level === 1 && gridSize === 1 && gameState.cards[0]?.isFlipped;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-4 px-2 md:py-6 md:px-4">
      {/* Level 1 Tutorial Overlay */}
      {showLevel1Tutorial && (
        <Level1Tutorial onDismiss={handleLevel1TutorialDismiss} />
      )}

      {/* Header */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBackToMenu}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            MemoryMint
          </h1>
          <p className="text-xs text-muted-foreground">{config.label} • {config.gridSize}x{config.gridSize}</p>
        </div>

        <div className="flex gap-1">
          {/* Hint Button - hide for level 1 */}
          {level > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                handlePause();
                setIsPaused(true);
              }}
              disabled={!gameState.isPlaying || hintsRemaining <= 0}
              className={cn(
                'rounded-full',
                hintsRemaining > 0 && 'text-accent'
              )}
            >
              <Lightbulb className="w-5 h-5" />
            </Button>
          )}
          
          {/* Pause Button - hide for level 1 */}
          {level > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePause}
              disabled={!gameState.isPlaying}
              className="rounded-full"
            >
              <Pause className="w-5 h-5" />
            </Button>
          )}
          
          {/* Music Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMusic}
            className="rounded-full"
          >
            {isMusicPlaying ? (
              <Music className="w-5 h-5 text-primary" />
            ) : (
              <Music2 className="w-5 h-5" />
            )}
          </Button>
          
          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="rounded-full"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Stats - simplified for level 1 */}
      {level > 1 && (
        <GameStats
          timeRemaining={gameState.timeRemaining}
          moves={gameState.moves}
          matchedPairs={gameState.matchedPairs}
          totalPairs={totalPairs}
          combo={gameState.combo}
          score={gameState.score}
        />
      )}

      {/* Game Board */}
      <GameBoard
        cards={gameState.cards}
        flippedCards={gameState.flippedCards}
        onCardClick={handleCardClick}
        onCheckMatch={checkMatch}
        onAnimalRevealed={handleAnimalRevealed}
        onCardFlippedBack={handleCardFlippedBack}
        onMatch={handleMatch}
        onNoMatch={handleNoMatch}
        disabled={!gameState.isPlaying || isPaused || showLevel1Tutorial}
        hintedCardIds={hintedCardIds}
      />

      {/* Pause Menu */}
      <PauseMenu
        isOpen={isPaused}
        onResume={handleResume}
        onRestart={handleRestart}
        onQuit={handleBackToMenu}
        onUseHint={handleUseHint}
        hintsRemaining={hintsRemaining}
      />

      {/* Score Submit Modal - For NFT name on level 1, or high score */}
      <ScoreSubmitModal
        isOpen={showScoreSubmit}
        score={gameState.score}
        onSubmit={handleScoreSubmit}
        onSkip={handleScoreSkip}
        isNFTNamePrompt={level === 1}
      />

      {/* Game Over Modal - for levels 2+ or level 1 after NFT name */}
      {!showScoreSubmit && (level > 1 ? gameState.isGameOver : isLevel1Complete) && (
        <GameOverModal
          isOpen={true}
          isWin={level === 1 ? true : gameState.isWin}
          score={gameState.score}
          moves={gameState.moves}
          timeRemaining={gameState.timeRemaining}
          maxCombo={gameState.maxCombo}
          onPlayAgain={handlePlayAgain}
          onBackToMenu={handleBackToMenu}
          onCreateArt={(level === 1 || gameState.isWin) ? handleCreateArt : undefined}
          onNextLevel={(level === 1 || gameState.isWin) && level < getMaxLevel() ? handleNextLevel : undefined}
          gameTime={config.time}
          rarity={rarity}
          currentLevel={level}
        />
      )}
    </div>
  );
}
