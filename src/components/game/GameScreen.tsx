import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, VolumeX, Music, Music2 } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { GameStats } from './GameStats';
import { GameOverModal } from './GameOverModal';
import { ScoreSubmitModal } from './ScoreSubmitModal';
import { useGameState } from '@/hooks/useGameState';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useConfetti } from '@/hooks/useConfetti';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { Difficulty, DIFFICULTY_CONFIG } from '@/data/animals';

interface GameScreenProps {
  onBackToMenu: () => void;
  difficulty: Difficulty;
  onCreateArt?: (score: number) => void;
}

export function GameScreen({ onBackToMenu, difficulty, onCreateArt }: GameScreenProps) {
  const { gameState, startGame, flipCard, checkMatch, totalPairs } = useGameState(difficulty);
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
  const { fireMatchConfetti, fireComboConfetti, fireWinConfetti } = useConfetti();
  const { isPlaying: isMusicPlaying, toggle: toggleMusic } = useBackgroundMusic();
  const { addEntry, getTopScore } = useLeaderboard();

  const [isMuted, setIsMuted] = useState(false);
  const [showScoreSubmit, setShowScoreSubmit] = useState(false);
  const config = DIFFICULTY_CONFIG[difficulty];

  // Start game on mount
  useEffect(() => {
    startGame();
  }, [startGame]);

  // Play win/lose sounds and confetti
  useEffect(() => {
    if (gameState.isGameOver) {
      if (gameState.isWin) {
        playWinSound();
        fireWinConfetti();
        // Check if it's a high score
        const topScore = getTopScore(difficulty);
        if (gameState.score > topScore) {
          setShowScoreSubmit(true);
        }
      } else {
        playLoseSound();
      }
    }
  }, [gameState.isGameOver, gameState.isWin, playWinSound, playLoseSound, fireWinConfetti, gameState.score, getTopScore, difficulty]);

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
      difficulty,
      maxCombo: gameState.maxCombo,
    });
    setShowScoreSubmit(false);
  };

  const handleScoreSkip = () => {
    setShowScoreSubmit(false);
  };

  const handleCreateArt = () => {
    if (onCreateArt) {
      onCreateArt(gameState.score);
    }
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

        <div className="flex gap-1">
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
          gameTime={config.time}
        />
      )}
    </div>
  );
}
