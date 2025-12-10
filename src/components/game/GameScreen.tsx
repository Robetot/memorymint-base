import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX, Music, Music2, Pause, Lightbulb } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { GameStats } from './GameStats';
import { GameOverModal } from './GameOverModal';
import { ScoreSubmitModal } from './ScoreSubmitModal';
import { PauseMenu } from './PauseMenu';
import { ComboDisplay } from './ComboDisplay';
import { PerfectIndicator } from './PerfectIndicator';
import { TimerWarning } from './TimerWarning';
import { useGameState } from '@/hooks/useGameState';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useConfetti } from '@/hooks/useConfetti';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useHints } from '@/hooks/useHints';
import { getLevel, saveUnlockedLevel, getMaxLevel } from '@/data/levels';
import { calculateRarity, RarityResult } from '@/utils/rarityCalculator';
import { cn } from '@/lib/utils';

interface GameScreenProps {
  onBackToMenu: () => void;
  level: number;
  onCreateArt?: (score: number, rarity: RarityResult) => void;
  onNextLevel?: (nextLevel: number) => void;
}

export function GameScreen({ onBackToMenu, level, onCreateArt, onNextLevel }: GameScreenProps) {
  const { gameState, startGame, flipCard, checkMatch, totalPairs, pauseGame, resumeGame } = useGameState(level);
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

  // Play win/lose sounds and calculate rarity
  useEffect(() => {
    if (gameState.isGameOver) {
      if (gameState.isWin) {
        playWinSound();
        fireWinConfetti();
        
        // Unlock next level
        const nextLevel = Math.min(level + 1, getMaxLevel());
        saveUnlockedLevel(nextLevel);
        
        // Calculate rarity based on level
        const difficultyMap: Record<number, '2x2' | '4x4' | '6x6' | '8x8'> = {
          2: '2x2', 4: '4x4', 6: '6x6', 8: '8x8'
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
        
        // Check if it's a high score
        const topScore = getTopScore(level);
        if (gameState.score > topScore || topScore === 0) {
          setShowScoreSubmit(true);
        }
      } else {
        playLoseSound();
      }
    }
  }, [gameState.isGameOver, gameState.isWin, playWinSound, playLoseSound, fireWinConfetti, gameState.score, getTopScore, level, gameState.timeRemaining, config.time, config.gridSize, gameState.moves, totalPairs, gameState.maxCombo, perfectGame]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-4 px-2 md:py-6 md:px-4">
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
          {/* Hint Button */}
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
          
          {/* Pause Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePause}
            disabled={!gameState.isPlaying}
            className="rounded-full"
          >
            <Pause className="w-5 h-5" />
          </Button>
          
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

      {/* Stats */}
      <GameStats
        timeRemaining={gameState.timeRemaining}
        moves={gameState.moves}
        matchedPairs={gameState.matchedPairs}
        totalPairs={totalPairs}
        combo={gameState.combo}
        score={gameState.score}
      />

      {/* Timer Warning Effect */}
      <TimerWarning 
        timeRemaining={gameState.timeRemaining} 
        isPlaying={gameState.isPlaying && !isPaused} 
      />

      {/* Perfect Game Indicator */}
      <PerfectIndicator 
        isPerfect={perfectGame} 
        matchedPairs={gameState.matchedPairs} 
      />

      {/* Combo Display */}
      <ComboDisplay 
        combo={gameState.combo} 
        maxCombo={gameState.maxCombo} 
      />

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
        disabled={!gameState.isPlaying || isPaused}
        hintedCardIds={hintedCardIds}
        combo={gameState.combo}
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

      {/* Score Submit Modal */}
      <ScoreSubmitModal
        isOpen={showScoreSubmit}
        score={gameState.score}
        onSubmit={handleScoreSubmit}
        onSkip={handleScoreSkip}
      />

      {/* Game Over Modal */}
      {!showScoreSubmit && (
        <GameOverModal
          isOpen={gameState.isGameOver}
          isWin={gameState.isWin}
          score={gameState.score}
          moves={gameState.moves}
          timeRemaining={gameState.timeRemaining}
          maxCombo={gameState.maxCombo}
          onPlayAgain={handlePlayAgain}
          onBackToMenu={handleBackToMenu}
          onCreateArt={gameState.isWin ? handleCreateArt : undefined}
          onNextLevel={gameState.isWin && level < getMaxLevel() ? handleNextLevel : undefined}
          gameTime={config.time}
          rarity={rarity}
          currentLevel={level}
        />
      )}
    </div>
  );
}
