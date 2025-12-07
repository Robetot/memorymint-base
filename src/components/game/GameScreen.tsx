import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { GameStats } from './GameStats';
import { GameOverModal } from './GameOverModal';
import { useGameState } from '@/hooks/useGameState';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useState } from 'react';
import { Difficulty, DIFFICULTY_CONFIG } from '@/data/animals';

interface GameScreenProps {
  onBackToMenu: () => void;
  difficulty: Difficulty;
}

export function GameScreen({ onBackToMenu, difficulty }: GameScreenProps) {
  const { gameState, startGame, flipCard, checkMatch, totalPairs, gridSize } = useGameState(difficulty);
  const {
    playAnimalSound,
    playFlipSound,
    playMatchSound,
    playNoMatchSound,
    playWinSound,
    playLoseSound,
    playClickSound,
    playComboSound,
    setMuted,
  } = useSoundEffects();

  const [isMuted, setIsMuted] = useState(false);
  const config = DIFFICULTY_CONFIG[difficulty];

  // Start game on mount
  useEffect(() => {
    startGame();
  }, [startGame]);

  // Play win/lose sounds
  useEffect(() => {
    if (gameState.isGameOver) {
      if (gameState.isWin) {
        playWinSound();
      } else {
        playLoseSound();
      }
    }
  }, [gameState.isGameOver, gameState.isWin, playWinSound, playLoseSound]);

  const handleCardClick = useCallback((cardId: number) => {
    playFlipSound();
    flipCard(cardId);
  }, [flipCard, playFlipSound]);

  const handleAnimalRevealed = useCallback((animalId: string) => {
    playAnimalSound(animalId);
  }, [playAnimalSound]);

  const handleMatch = useCallback(() => {
    playMatchSound();
    if (gameState.combo > 0) {
      playComboSound();
    }
  }, [playMatchSound, playComboSound, gameState.combo]);

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
  };

  const handleBackToMenu = () => {
    playClickSound();
    onBackToMenu();
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
          <p className="text-xs text-muted-foreground">{config.label} • {difficulty}</p>
        </div>

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

      {/* Stats */}
      <GameStats
        timeRemaining={gameState.timeRemaining}
        moves={gameState.moves}
        matchedPairs={gameState.matchedPairs}
        totalPairs={totalPairs}
        combo={gameState.combo}
        score={gameState.score}
      />

      {/* Game Board */}
      <GameBoard
        cards={gameState.cards}
        flippedCards={gameState.flippedCards}
        onCardClick={handleCardClick}
        onCheckMatch={checkMatch}
        onAnimalRevealed={handleAnimalRevealed}
        onMatch={handleMatch}
        onNoMatch={handleNoMatch}
        disabled={!gameState.isPlaying}
        gridSize={gridSize}
      />

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameState.isGameOver}
        isWin={gameState.isWin}
        score={gameState.score}
        moves={gameState.moves}
        timeRemaining={gameState.timeRemaining}
        maxCombo={gameState.maxCombo}
        onPlayAgain={handlePlayAgain}
        onBackToMenu={handleBackToMenu}
      />
    </div>
  );
}
