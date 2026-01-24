import { useState } from 'react';
import { MemoryBoard } from './MemoryBoard';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Sparkles, Zap, ArrowLeft, Layers } from 'lucide-react';

type GameMode = 'classic' | 'special';
type Difficulty = 'easy' | 'medium' | 'hard';

interface GameSelectorProps {
  onBack?: () => void;
  onPlayClassic?: () => void;
}

const difficultySettings = {
  easy: { gridSize: 4, timeLimit: 90 },
  medium: { gridSize: 4, timeLimit: 60 },
  hard: { gridSize: 6, timeLimit: 90 }
};

export function GameSelector({ onBack, onPlayClassic }: GameSelectorProps) {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  const startGame = (mode: GameMode, diff: Difficulty) => {
    setGameMode(mode);
    setDifficulty(diff);
    setGameStarted(true);
  };

  const goBack = () => {
    if (gameStarted) {
      setGameStarted(false);
    } else if (difficulty) {
      setDifficulty(null);
    } else if (gameMode) {
      setGameMode(null);
    } else if (onBack) {
      onBack();
    }
  };

  const resetToMenu = () => {
    setGameMode(null);
    setDifficulty(null);
    setGameStarted(false);
  };

  if (gameStarted && gameMode && difficulty) {
    const settings = difficultySettings[difficulty];
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={resetToMenu}
            className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Menu
          </button>
          <MemoryBoard
            gridSize={settings.gridSize}
            timeLimit={settings.timeLimit}
            enableSpecialCards={gameMode === 'special'}
            gameMode={gameMode}
            difficulty={difficulty}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <AnimatePresence mode="wait">
          {!gameMode ? (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </button>

              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-foreground mb-2">Memory Match</h1>
                <p className="text-muted-foreground">Choose your game mode</p>
              </div>

              {/* Option to play classic NFT game */}
              {onPlayClassic && (
                <motion.button
                  onClick={onPlayClassic}
                  className="w-full p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 hover:border-primary transition-all shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/20">
                      <Layers className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-semibold text-card-foreground">NFT Mode</h3>
                      <p className="text-muted-foreground text-sm">Play levels & mint NFTs</p>
                    </div>
                  </div>
                </motion.button>
              )}

              <motion.button
                onClick={() => setGameMode('classic')}
                className="w-full p-6 rounded-2xl bg-card border border-border hover:border-primary transition-all shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Gamepad2 className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-semibold text-card-foreground">Classic Mode</h3>
                    <p className="text-muted-foreground text-sm">Traditional memory matching</p>
                  </div>
                </div>
              </motion.button>

              <motion.button
                onClick={() => setGameMode('special')}
                className="w-full p-6 rounded-2xl bg-card border border-border hover:border-accent transition-all shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-accent/10">
                    <Sparkles className="w-8 h-8 text-accent" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-semibold text-card-foreground">Special Cards</h3>
                    <p className="text-muted-foreground text-sm">With power-ups & bonuses</p>
                  </div>
                </div>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="difficulty-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Select Difficulty</h2>
                <p className="text-muted-foreground">
                  {gameMode === 'classic' ? 'Classic Mode' : 'Special Cards Mode'}
                </p>
              </div>

              <div className="space-y-4">
                <motion.button
                  onClick={() => startGame(gameMode, 'easy')}
                  className="w-full p-5 rounded-xl bg-green-500/10 border border-green-500/30 hover:border-green-500 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">Easy</h3>
                      <p className="text-muted-foreground text-sm">4×4 grid • 90 seconds</p>
                    </div>
                    <Zap className="w-6 h-6 text-green-500" />
                  </div>
                </motion.button>

                <motion.button
                  onClick={() => startGame(gameMode, 'medium')}
                  className="w-full p-5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 hover:border-yellow-500 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Medium</h3>
                      <p className="text-muted-foreground text-sm">4×4 grid • 60 seconds</p>
                    </div>
                    <Zap className="w-6 h-6 text-yellow-500" />
                  </div>
                </motion.button>

                <motion.button
                  onClick={() => startGame(gameMode, 'hard')}
                  className="w-full p-5 rounded-xl bg-red-500/10 border border-red-500/30 hover:border-red-500 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Hard</h3>
                      <p className="text-muted-foreground text-sm">6×6 grid • 90 seconds</p>
                    </div>
                    <Zap className="w-6 h-6 text-red-500" />
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
