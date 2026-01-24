import { useEffect, useRef, useState, useCallback } from 'react';
import { useMemoryGame } from '@/hooks/useMemoryGame';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Zap, Target, Star } from 'lucide-react';
import { MatchParticles, useParticles } from '@/components/game/MatchParticles';
import { getHighScore, setHighScore, calculateScore } from '@/utils/highScore';

interface MemoryBoardProps {
  gridSize: number;
  timeLimit: number;
  enableSpecialCards?: boolean;
  gameMode?: string;
  difficulty?: string;
}

const ANIMAL_EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🦄', '🦋', '🐝', '🐞', '🦖', '🦕', '🐢', '🐙'
];

export function MemoryBoard({ 
  gridSize, 
  timeLimit, 
  enableSpecialCards = false,
  gameMode = 'classic',
  difficulty = 'medium'
}: MemoryBoardProps) {
  const {
    cards,
    flipCard,
    streak,
    comboMultiplier,
    timeLeft,
    gameOver,
    matchedPairs,
    totalPairs,
    resetGame,
    isChecking
  } = useMemoryGame(gridSize, timeLimit, enableSpecialCards);

  const [score, setScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const { particles, spawnParticles } = useParticles();
  const prevMatchedPairs = useRef(0);

  const scoreKey = `${gameMode}-${difficulty}`;
  const highScore = getHighScore(scoreKey);

  // Audio system
  const soundsRef = useRef<{
    match: HTMLAudioElement | null;
    spark: HTMLAudioElement | null;
    error: HTMLAudioElement | null;
  }>({
    match: null,
    spark: null,
    error: null
  });

  // Initialize audio
  useEffect(() => {
    if (typeof window === 'undefined') return;

    soundsRef.current = {
      match: new Audio('/sounds/match.mp3'),
      spark: new Audio('/sounds/spark.mp3'),
      error: new Audio('/sounds/error.mp3')
    };

    Object.values(soundsRef.current).forEach(audio => {
      if (audio) audio.volume = 0.5;
    });

    return () => {
      Object.values(soundsRef.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  const playSound = useCallback((type: keyof typeof soundsRef.current) => {
    const audio = soundsRef.current[type];
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  // Update score when matches change
  useEffect(() => {
    if (matchedPairs > prevMatchedPairs.current) {
      const newScore = calculateScore(matchedPairs, timeLeft, streak, comboMultiplier);
      setScore(newScore);
      playSound('match');
      prevMatchedPairs.current = matchedPairs;
    }
  }, [matchedPairs, timeLeft, streak, comboMultiplier, playSound]);

  // Handle game over
  useEffect(() => {
    if (gameOver && matchedPairs === totalPairs) {
      const finalScore = calculateScore(matchedPairs, timeLeft, streak, comboMultiplier);
      const isNew = setHighScore(scoreKey, finalScore, matchedPairs, streak);
      setIsNewHighScore(isNew);
    }
  }, [gameOver, matchedPairs, totalPairs, scoreKey, timeLeft, streak, comboMultiplier]);

  // Reset score state on game reset
  useEffect(() => {
    if (!gameOver && matchedPairs === 0) {
      setScore(0);
      setIsNewHighScore(false);
      prevMatchedPairs.current = 0;
    }
  }, [gameOver, matchedPairs]);

  const isWon = gameOver && matchedPairs === totalPairs;
  const isLost = gameOver && !isWon;

  const getCardContent = (card: typeof cards[0]) => {
    if (!card.isFlipped && !card.isMatched) return '❓';

    if (enableSpecialCards) {
      switch (card.type) {
        case 'spark':
          return '✨';
        case 'freeze':
          return '⏱️';
        case 'multiplier':
          return '🔥';
      }
    }

    const num = parseInt(card.value.split('-')[1]);
    return ANIMAL_EMOJIS[num % ANIMAL_EMOJIS.length];
  };

  const getCardStyle = (card: typeof cards[0]) => {
    if (card.isMatched) {
      if (enableSpecialCards) {
        if (card.type === 'spark') return 'bg-accent border-accent/80';
        if (card.type === 'freeze') return 'bg-secondary border-secondary/80';
        if (card.type === 'multiplier') return 'bg-destructive border-destructive/80';
      }
      return 'bg-primary border-primary/80';
    }
    if (card.isFlipped) {
      return 'bg-card border-border shadow-lg';
    }
    return 'bg-gradient-to-br from-primary to-primary/70 border-primary/50 hover:from-primary/90 hover:to-primary/60';
  };

  const handleCardClick = (card: typeof cards[0], event: React.MouseEvent<HTMLButtonElement>) => {
    if (!card.isMatched && !card.isFlipped) {
      spawnParticles(event.currentTarget, 6, enableSpecialCards);
    }
    flipCard(card.id);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* Stats Header */}
      <div className="w-full max-w-2xl grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-accent" />
          <div>
            <div className="text-xs text-muted-foreground">Score</div>
            <div className="font-bold text-foreground">{score}</div>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">Best</div>
            <div className="font-bold text-primary">{highScore}</div>
          </div>
        </div>

        <motion.div
          className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2"
          animate={{ scale: timeLeft <= 10 ? [1, 1.05, 1] : 1 }}
          transition={{ repeat: timeLeft <= 10 ? Infinity : 0, duration: 0.5 }}
        >
          <Clock className={`w-5 h-5 ${timeLeft <= 10 ? 'text-destructive' : 'text-primary'}`} />
          <div>
            <div className="text-xs text-muted-foreground">Time</div>
            <div className={`font-bold ${timeLeft <= 10 ? 'text-destructive' : 'text-foreground'}`}>
              {timeLeft}s
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2"
          animate={{ scale: streak > 0 ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Zap className="w-5 h-5 text-accent" />
          <div>
            <div className="text-xs text-muted-foreground">Streak</div>
            <div className="font-bold text-foreground">{streak}</div>
          </div>
        </motion.div>

        <div className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">Matched</div>
            <div className="font-bold text-foreground">
              {matchedPairs}/{totalPairs}
            </div>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div
        className="grid gap-2 md:gap-3"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          maxWidth: `${gridSize * 80 + (gridSize - 1) * 12}px`
        }}
      >
        {cards.map((card) => (
          <motion.button
            key={card.id}
            className={`
              aspect-square rounded-xl shadow-lg 
              flex items-center justify-center 
              text-3xl md:text-4xl font-bold
              border-2 transition-all duration-300
              ${getCardStyle(card)}
              ${card.isMatched ? 'cursor-default opacity-80' : 'cursor-pointer hover:shadow-xl'}
              ${isChecking && !card.isFlipped ? 'pointer-events-none' : ''}
            `}
            style={{
              minWidth: '60px',
              minHeight: '60px'
            }}
            whileHover={!card.isMatched ? { scale: 1.05, y: -2 } : {}}
            whileTap={!card.isMatched ? { scale: 0.95 } : {}}
            animate={{
              scale: card.isMatched ? 0.95 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20
            }}
            onClick={(e) => handleCardClick(card, e)}
            disabled={gameOver || card.isMatched}
            aria-label={`Card ${card.id + 1}`}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {getCardContent(card)}
            </motion.span>
          </motion.button>
        ))}
      </div>

      {/* Particle Effects */}
      <MatchParticles particles={particles} useEmoji={enableSpecialCards} />

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={resetGame}
          >
            <motion.div
              className={`
                ${isWon ? 'bg-gradient-to-br from-primary to-primary/70' : 'bg-gradient-to-br from-destructive to-destructive/70'}
                text-primary-foreground rounded-2xl shadow-2xl p-8 md:p-12 text-center max-w-md w-full
              `}
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{
                  rotate: isWon ? [0, 10, -10, 0] : 0,
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 0.5 }}
              >
                {isWon ? (
                  <Trophy className="w-20 h-20 mx-auto mb-4" />
                ) : (
                  <Clock className="w-20 h-20 mx-auto mb-4" />
                )}
              </motion.div>

              <h2 className="text-4xl font-bold mb-4">
                {isWon ? (isNewHighScore ? '🏆 New High Score!' : '🎉 You Won!') : "⏰ Time's Up!"}
              </h2>

              <div className="space-y-2 mb-6 text-lg">
                <p className="text-2xl font-bold">Score: {score}</p>
                {isNewHighScore && <p className="text-sm opacity-80">Previous Best: {highScore}</p>}
                <p>Matches: {matchedPairs}/{totalPairs}</p>
                <p>Best Streak: {streak}</p>
                {enableSpecialCards && <p>Max Combo: x{comboMultiplier.toFixed(1)}</p>}
              </div>

              <button
                onClick={resetGame}
                className="bg-card text-foreground px-8 py-3 rounded-lg font-bold text-lg hover:bg-muted transition-colors shadow-lg"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
