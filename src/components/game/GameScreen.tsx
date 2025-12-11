import { useEffect, useCallback, useState, useRef } from 'react';
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
import { PowerUpsBar } from './PowerUpsBar';
import { useGameState } from '@/hooks/useGameState';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useConfetti } from '@/hooks/useConfetti';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useWeeklyLeaderboard } from '@/hooks/useWeeklyLeaderboard';
import { useHints } from '@/hooks/useHints';
import { usePowerUps } from '@/hooks/usePowerUps';
import { useAchievements } from '@/hooks/useAchievements';
import { usePowerUpSounds } from '@/hooks/usePowerUpSounds';
import { WeeklyChallenge, useWeeklyChallenge } from '@/hooks/useWeeklyChallenge';
import { getLevel, saveUnlockedLevel, getMaxLevel } from '@/data/levels';
import { calculateRarity, RarityResult } from '@/utils/rarityCalculator';
import { cn } from '@/lib/utils';

interface GameScreenProps {
  onBackToMenu: () => void;
  level: number;
  onCreateArt?: (score: number, rarity: RarityResult) => void;
  onNextLevel?: (nextLevel: number) => void;
  weeklyChallenge?: WeeklyChallenge | null;
}

export function GameScreen({ onBackToMenu, level, onCreateArt, onNextLevel, weeklyChallenge }: GameScreenProps) {
  const { gameState, startGame, flipCard, checkMatch, totalPairs, pauseGame, resumeGame, shuffleUnmatched, addTime } = useGameState(level);
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
  const { addEntry: addWeeklyEntry } = useWeeklyLeaderboard();
  const { hintsRemaining, hintedCardIds, useHint, resetHints } = useHints(level);
  const { powerUps, activeEffect, usePowerUp, clearActiveEffect, resetPowerUps } = usePowerUps();
  const { 
    trackCombo, 
    trackPerfectGame, 
    trackSpeed, 
    trackLevelComplete, 
    trackDailyChallenge, 
    trackWeeklyChallenge,
    trackPowerUp 
  } = useAchievements();
  const { playSound: playPowerUpSound } = usePowerUpSounds();
  const { completeChallenge: completeWeekly } = useWeeklyChallenge();

  const [isMuted, setIsMuted] = useState(false);
  const [showScoreSubmit, setShowScoreSubmit] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rarity, setRarity] = useState<RarityResult | null>(null);
  const [perfectGame, setPerfectGame] = useState(true);
  const [revealAll, setRevealAll] = useState(false);
  const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    resetPowerUps();
  }, [startGame, resetHints, resetPowerUps, level]);

  // Handle power-up effects
  useEffect(() => {
    if (activeEffect === 'freeze') {
      pauseGame();
      addTime(5);
      freezeTimeoutRef.current = setTimeout(() => {
        resumeGame();
        clearActiveEffect();
      }, 5000);
    } else if (activeEffect === 'reveal') {
      setRevealAll(true);
      setTimeout(() => {
        setRevealAll(false);
        clearActiveEffect();
      }, 2000);
    } else if (activeEffect === 'shuffle') {
      shuffleUnmatched();
      clearActiveEffect();
    }

    return () => {
      if (freezeTimeoutRef.current) {
        clearTimeout(freezeTimeoutRef.current);
      }
    };
  }, [activeEffect, pauseGame, resumeGame, addTime, shuffleUnmatched, clearActiveEffect]);

  const handleUsePowerUp = useCallback((id: string) => {
    if (usePowerUp(id)) {
      trackPowerUp();
      // Play power-up specific sounds
      if (id === 'freeze') playPowerUpSound('freeze');
      else if (id === 'reveal') playPowerUpSound('reveal');
      else if (id === 'shuffle') playPowerUpSound('shuffle');
    }
  }, [usePowerUp, trackPowerUp, playPowerUpSound]);

  // Track combo achievements
  useEffect(() => {
    if (gameState.combo > 1) {
      trackCombo(gameState.combo);
    }
  }, [gameState.combo, trackCombo]);

  // Play win/lose sounds and calculate rarity
  useEffect(() => {
    if (gameState.isGameOver) {
      if (gameState.isWin) {
        playWinSound();
        fireWinConfetti();
        
        // Track achievements
        trackLevelComplete();
        const completionTime = config.time - gameState.timeRemaining;
        trackSpeed(completionTime);
        if (perfectGame) {
          trackPerfectGame();
        }

        // Handle weekly challenge completion
        if (weeklyChallenge) {
          completeWeekly(completionTime);
          trackWeeklyChallenge();
          playPowerUpSound('weekly_complete');
          
          // Submit to weekly leaderboard
          const walletAddress = localStorage.getItem('wallet_address') || 'anonymous';
          addWeeklyEntry({
            walletAddress,
            time: completionTime,
            score: gameState.score,
            moves: gameState.moves,
            maxCombo: gameState.maxCombo,
          });
        } else {
          playPowerUpSound('daily_complete');
          trackDailyChallenge();
        }
        
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
  }, [gameState.isGameOver, gameState.isWin, playWinSound, playLoseSound, fireWinConfetti, gameState.score, getTopScore, level, gameState.timeRemaining, config.time, config.gridSize, gameState.moves, totalPairs, gameState.maxCombo, perfectGame, trackLevelComplete, trackSpeed, trackPerfectGame, trackDailyChallenge, trackWeeklyChallenge, weeklyChallenge, completeWeekly, playPowerUpSound]);

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
    resetPowerUps();
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

      {/* Power-ups Bar */}
      <PowerUpsBar
        powerUps={powerUps}
        onUsePowerUp={handleUsePowerUp}
        disabled={!gameState.isPlaying || isPaused || gameState.isGameOver}
      />

      {/* Freeze Effect Overlay */}
      {activeEffect === 'freeze' && (
        <div className="fixed inset-0 pointer-events-none z-40 border-4 border-cyan-400/50 animate-pulse">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-cyan-400 animate-bounce">
            ❄️ TIME FROZEN ❄️
          </div>
        </div>
      )}

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
        disabled={!gameState.isPlaying || isPaused || revealAll}
        hintedCardIds={hintedCardIds}
        combo={gameState.combo}
        revealAll={revealAll}
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
