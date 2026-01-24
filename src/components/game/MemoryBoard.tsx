import { useMemoryGame } from '@/hooks/useMemoryGame';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Zap, Target } from 'lucide-react';

interface MemoryBoardProps {
  gridSize: number;
  timeLimit: number;
  enableSpecialCards?: boolean;
}

export function MemoryBoard({ gridSize, timeLimit, enableSpecialCards = false }: MemoryBoardProps) {
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

  const isWon = gameOver && matchedPairs === totalPairs;
  const isLost = gameOver && !isWon;

  // Get card display content
  const getCardContent = (card: typeof cards[0]) => {
    if (!card.isFlipped && !card.isMatched) return '❓';

    switch (card.type) {
      case 'spark':
        return '✨';
      case 'freeze':
        return '⏱️';
      case 'multiplier':
        return '🔥';
      default:
        // Extract number from card value (e.g., "card-5" -> "5")
        const num = parseInt(card.value.split('-')[1]);
        const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'];
        return emojis[num % emojis.length];
    }
  };

  // Get card background color based on type and state
  const getCardStyle = (card: typeof cards[0]) => {
    if (card.isMatched) {
      if (card.type === 'spark') return 'bg-accent border-accent/80';
      if (card.type === 'freeze') return 'bg-secondary border-secondary/80';
      if (card.type === 'multiplier') return 'bg-destructive border-destructive/80';
      return 'bg-primary border-primary/80';
    }
    if (card.isFlipped) {
      return 'bg-card border-border';
    }
    return 'bg-gradient-to-br from-primary to-primary/70 border-primary/50';
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* Stats Header */}
      <div className="w-full max-w-2xl grid grid-cols-2 md:grid-cols-4 gap-3">
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

        <motion.div
          className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2"
          animate={{
            scale: comboMultiplier > 1 ? [1, 1.15, 1] : 1,
            rotate: comboMultiplier > 2 ? [0, 5, -5, 0] : 0
          }}
          transition={{ duration: 0.4 }}
        >
          <Target className="w-5 h-5 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">Combo</div>
            <div className="font-bold text-primary">
              x{comboMultiplier.toFixed(1)}
            </div>
          </div>
        </motion.div>

        <div className="bg-card rounded-lg shadow-md p-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
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
              text-2xl md:text-3xl font-bold
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
              rotateY: card.isFlipped || card.isMatched ? 0 : 0,
              scale: card.isMatched ? 0.95 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20
            }}
            onClick={() => flipCard(card.id)}
            disabled={gameOver || card.isMatched}
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

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={resetGame}
          >
            <motion.div
              className={`
                ${isWon ? 'bg-gradient-to-br from-primary to-primary/70' : 'bg-gradient-to-br from-destructive to-destructive/70'}
                text-primary-foreground rounded-2xl shadow-2xl p-8 md:p-12 text-center max-w-md mx-4
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
                {isWon ? '🎉 You Won!' : "⏰ Time's Up!"}
              </h2>

              <div className="space-y-2 mb-6 text-lg">
                <p>Matches: {matchedPairs}/{totalPairs}</p>
                <p>Best Streak: {streak}</p>
                <p>Max Combo: x{comboMultiplier.toFixed(1)}</p>
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
