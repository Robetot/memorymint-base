import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, Star, Target, Zap, ArrowLeft } from "lucide-react";

/* -------------------- Difficulty Config -------------------- */
const DIFFICULTY_CONFIGS = {
  easy: { gridSize: 4, timeLimit: 90, name: "Easy" },
  medium: { gridSize: 4, timeLimit: 60, name: "Medium" },
  hard: { gridSize: 6, timeLimit: 90, name: "Hard" },
  extreme: { gridSize: 8, timeLimit: 120, name: "Extreme" }
} as const;

type Difficulty = keyof typeof DIFFICULTY_CONFIGS;

/* -------------------- Animal Pool -------------------- */
const ANIMAL_EMOJIS = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
  "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔",
  "🦄","🦋","🐝","🐞","🦖","🦕","🐢","🐙",
  "🦎","🐍","🐊","🦈","🐳","🐬","🦭","🐟"
];

interface Card {
  id: number;
  value: string;
  isFlipped: boolean;
  isMatched: boolean;
}

/* -------------------- Simple Particle System -------------------- */
interface Particle {
  id: number;
  x: number;
  y: number;
}

const useGameParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  const spawnParticles = useCallback((x: number, y: number, count = 6) => {
    const newParticles = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i,
      x: x + Math.random() * 20 - 10,
      y: y + Math.random() * 20 - 10
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.slice(newParticles.length));
    }, 500);
  }, []);

  return { particles, spawnParticles };
};

const ParticleLayer: React.FC<{ particles: Particle[] }> = ({ particles }) => (
  <>
    {particles.map(p => (
      <motion.div
        key={p.id}
        className="fixed w-2 h-2 bg-yellow-400 rounded-full z-50 pointer-events-none"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0 }}
        transition={{ duration: 0.5 }}
        style={{ left: p.x, top: p.y }}
      />
    ))}
  </>
);

/* -------------------- Props -------------------- */
interface MemoryGameProps {
  onBack?: () => void;
}

/* -------------------- Memory Game Component -------------------- */
export function MemoryGame({ onBack }: MemoryGameProps) {
  const { particles, spawnParticles } = useGameParticles();

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [gameStarted, setGameStarted] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(DIFFICULTY_CONFIGS.medium.timeLimit);
  const [isChecking, setIsChecking] = useState(false);
  const [highScores, setHighScores] = useState<Record<Difficulty, number>>({
    easy: 0,
    medium: 0,
    hard: 0,
    extreme: 0
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentConfig = DIFFICULTY_CONFIGS[difficulty];

  /* -------------------- Load High Scores -------------------- */
  useEffect(() => {
    const scores: Record<Difficulty, number> = {
      easy: 0, medium: 0, hard: 0, extreme: 0
    };
    (Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).forEach(diff => {
      const saved = localStorage.getItem(`memorymint_highscore_${diff}`);
      if (saved) scores[diff] = parseInt(saved, 10);
    });
    setHighScores(scores);
  }, []);

  /* -------------------- Init Game -------------------- */
  const initializeGame = useCallback(() => {
    const totalCards = currentConfig.gridSize ** 2;
    const totalPairs = totalCards / 2;
    const selected = ANIMAL_EMOJIS.slice(0, totalPairs);
    const paired = [...selected, ...selected]
      .sort(() => Math.random() - 0.5)
      .map((value, index) => ({
        id: index,
        value,
        isFlipped: false,
        isMatched: false
      }));
    setCards(paired);
    setFlippedIndices([]);
    setMatchedPairs(0);
    setScore(0);
    setStreak(0);
    setTimeLeft(currentConfig.timeLimit);
    setIsChecking(false);
  }, [currentConfig]);

  useEffect(() => {
    if (gameStarted) initializeGame();
  }, [gameStarted, initializeGame]);

  /* -------------------- Timer -------------------- */
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted]);

  /* -------------------- Win Condition -------------------- */
  useEffect(() => {
    const totalPairs = (currentConfig.gridSize ** 2) / 2;
    if (matchedPairs === totalPairs && totalPairs > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (score > highScores[difficulty]) {
        const newScores = { ...highScores, [difficulty]: score };
        setHighScores(newScores);
        localStorage.setItem(`memorymint_highscore_${difficulty}`, score.toString());
      }
    }
  }, [matchedPairs, score, difficulty, highScores, currentConfig]);

  /* -------------------- Handle Card Click -------------------- */
  const handleCardClick = (index: number, e: React.MouseEvent) => {
    if (
      !gameStarted ||
      timeLeft <= 0 ||
      isChecking ||
      cards[index].isFlipped ||
      cards[index].isMatched ||
      flippedIndices.length >= 2
    ) return;

    spawnParticles(e.clientX, e.clientY);

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setIsChecking(true);
      const [a, b] = newFlipped;
      if (cards[a].value === cards[b].value) {
        setTimeout(() => {
          const updated = [...newCards];
          updated[a].isMatched = true;
          updated[b].isMatched = true;
          setCards(updated);
          setMatchedPairs(p => p + 1);
          setStreak(prev => {
            const newStreak = prev + 1;
            const bonus = newStreak * 50 + timeLeft * 2 + 100;
            setScore(s => s + bonus);
            return newStreak;
          });
          setFlippedIndices([]);
          setIsChecking(false);
        }, 600);
      } else {
        setStreak(0);
        setTimeout(() => {
          const updated = [...newCards];
          updated[a].isFlipped = false;
          updated[b].isFlipped = false;
          setCards(updated);
          setFlippedIndices([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  };

  const totalPairs = (currentConfig.gridSize ** 2) / 2;
  const isWon = matchedPairs === totalPairs && totalPairs > 0;
  const isLost = timeLeft === 0 && matchedPairs < totalPairs;

  /* -------------------- Start Screen -------------------- */
  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white p-4">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        
        <motion.h1 
          className="text-5xl md:text-6xl font-bold text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🎮 MemoryMint
        </motion.h1>
        
        <motion.p
          className="text-xl opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.2 }}
        >
          Select difficulty to start
        </motion.p>

        <div className="grid grid-cols-2 gap-4 max-w-md w-full">
          {(Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).map((diff, index) => {
            const cfg = DIFFICULTY_CONFIGS[diff];
            return (
              <motion.button
                key={diff}
                onClick={() => { setDifficulty(diff); setGameStarted(true); }}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-4 transition-all hover:scale-105"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <div className="font-bold text-lg">{cfg.name}</div>
                <div className="text-sm opacity-80">{cfg.gridSize}×{cfg.gridSize} • {cfg.timeLimit}s</div>
                {highScores[diff] > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-yellow-300">
                    <Trophy className="w-4 h-4" />
                    <span>{highScores[diff]}</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  /* -------------------- Game UI -------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {/* Stats Header */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-md px-4 py-2">
          <Star className="w-5 h-5 text-yellow-500" />
          <span className="font-bold">{score}</span>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-md px-4 py-2">
          <Zap className="w-5 h-5 text-orange-500" />
          <span className="font-bold">{streak}</span>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg shadow-md px-4 py-2">
          <Target className="w-5 h-5 text-green-500" />
          <span className="font-bold">{matchedPairs}/{totalPairs}</span>
        </div>
        <motion.div 
          className={`flex items-center gap-2 bg-white rounded-lg shadow-md px-4 py-2 ${timeLeft <= 10 ? 'text-red-500' : ''}`}
          animate={{ scale: timeLeft <= 10 ? [1, 1.05, 1] : 1 }}
          transition={{ repeat: timeLeft <= 10 ? Infinity : 0, duration: 0.5 }}
        >
          <span className="text-lg">⏱️</span>
          <span className="font-bold">{timeLeft}s</span>
        </motion.div>
      </div>

      {/* Game Board */}
      <div
        className="grid gap-2 md:gap-3 mb-6"
        style={{ 
          gridTemplateColumns: `repeat(${currentConfig.gridSize}, minmax(0, 1fr))`,
          maxWidth: currentConfig.gridSize <= 4 ? '400px' : currentConfig.gridSize <= 6 ? '500px' : '600px',
          width: '100%'
        }}
      >
        {cards.map((card, i) => (
          <motion.button
            key={card.id}
            onClick={(e) => handleCardClick(i, e)}
            className={`
              aspect-square text-2xl md:text-3xl rounded-xl shadow-lg
              flex items-center justify-center
              border-2 transition-all duration-200
              ${card.isMatched 
                ? "bg-green-400 border-green-500 cursor-default" 
                : card.isFlipped 
                  ? "bg-white border-gray-300" 
                  : "bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-700 hover:from-indigo-600 hover:to-purple-700 cursor-pointer"}
            `}
            whileHover={!card.isMatched && !card.isFlipped ? { scale: 1.05 } : {}}
            whileTap={!card.isMatched && !card.isFlipped ? { scale: 0.95 } : {}}
            disabled={isChecking || card.isMatched}
          >
            <motion.span
              initial={false}
              animate={{ rotateY: card.isFlipped || card.isMatched ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              {card.isFlipped || card.isMatched ? card.value : "❓"}
            </motion.span>
          </motion.button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button 
          onClick={initializeGame}
          className="flex items-center gap-2 bg-white hover:bg-gray-100 rounded-lg shadow-md px-4 py-2 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Restart</span>
        </button>
        <button 
          onClick={() => setGameStarted(false)}
          className="flex items-center gap-2 bg-white hover:bg-gray-100 rounded-lg shadow-md px-4 py-2 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Change</span>
        </button>
      </div>

      {/* Particles */}
      <ParticleLayer particles={particles} />

      {/* Game Over Modal */}
      <AnimatePresence>
        {(isWon || isLost) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className={`
                ${isWon ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-red-400 to-orange-600'}
                text-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full
              `}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5 }}
              >
                {isWon ? (
                  <Trophy className="w-16 h-16 mx-auto mb-4" />
                ) : (
                  <span className="text-6xl block mb-4">⏰</span>
                )}
              </motion.div>

              <h2 className="text-3xl font-bold mb-4">
                {isWon ? "🎉 You Won!" : "Time's Up!"}
              </h2>

              <div className="space-y-2 mb-6">
                <p className="text-2xl font-bold">Score: {score}</p>
                <p className="opacity-80">Matches: {matchedPairs}/{totalPairs}</p>
                <p className="opacity-80">Best Streak: {streak}</p>
                {score >= highScores[difficulty] && isWon && (
                  <p className="text-yellow-300 font-bold">🏆 New High Score!</p>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={initializeGame}
                  className="bg-white text-gray-800 px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={() => setGameStarted(false)}
                  className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg font-bold transition-colors"
                >
                  Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MemoryGame;
