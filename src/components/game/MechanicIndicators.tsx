import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MECHANIC_INFO, LevelMechanic } from '@/data/levels';
import { MechanicState } from '@/hooks/useGameState';

interface MechanicIndicatorsProps {
  activeMechanics: LevelMechanic[];
  mechanicState: MechanicState;
  totalPairs: number;
}

export function MechanicIndicators({ activeMechanics, mechanicState, totalPairs }: MechanicIndicatorsProps) {
  // Filter out non-visual mechanics
  const visualMechanics = activeMechanics.filter(m => 
    !['tutorial', 'hints', 'no_hints', 'pressure', 'no_preview'].includes(m)
  );

  if (visualMechanics.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto px-4 mb-2">
      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence mode="popLayout">
          {/* Fog of War Indicator */}
          {mechanicState.fogEnabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-200 text-xs font-medium"
            >
              <span>🌫️</span>
              <span>Fog Active</span>
            </motion.div>
          )}

          {/* Limited Mistakes Counter */}
          {mechanicState.maxMistakes < Infinity && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                mechanicState.mistakeCount >= mechanicState.maxMistakes - 1
                  ? "bg-destructive/80 text-destructive-foreground animate-pulse"
                  : "bg-amber-600/80 text-amber-50"
              )}
            >
              <span>❌</span>
              <span>{mechanicState.maxMistakes - mechanicState.mistakeCount} left</span>
            </motion.div>
          )}

          {/* Shuffle Pending Indicator */}
          {mechanicState.shuffleCount > 0 && !mechanicState.shuffleTriggered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600/80 text-purple-50 text-xs font-medium"
            >
              <span>🔀</span>
              <span>Shuffle Soon</span>
            </motion.div>
          )}

          {/* Combo Required Indicator */}
          {mechanicState.comboRequired > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-600/80 text-orange-50 text-xs font-medium"
            >
              <span>🔥</span>
              <span>Combo x{mechanicState.comboRequired} req</span>
            </motion.div>
          )}

          {/* Hidden Matches Indicator */}
          {mechanicState.hiddenMatches && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/80 text-indigo-50 text-xs font-medium"
            >
              <span>🔮</span>
              <span>Hidden</span>
            </motion.div>
          )}

          {/* Card Decay Active */}
          {mechanicState.decayingCards.size > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/80 text-rose-50 text-xs font-medium animate-pulse"
            >
              <span>⏳</span>
              <span>{mechanicState.decayingCards.size} fading</span>
            </motion.div>
          )}

          {/* Timer Hidden Indicator */}
          {mechanicState.timerHidden && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-600/80 text-gray-50 text-xs font-medium"
            >
              <span>❓</span>
              <span>Timer Hidden</span>
            </motion.div>
          )}

          {/* Card Rotation Active */}
          {mechanicState.rotatedCards.size > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-600/80 text-cyan-50 text-xs font-medium"
            >
              <span>🔃</span>
              <span>Rotating</span>
            </motion.div>
          )}

          {/* One Chance Mode */}
          {mechanicState.oneChanceActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-700/90 text-red-50 text-xs font-bold animate-pulse"
            >
              <span>💀</span>
              <span>One Chance</span>
            </motion.div>
          )}

          {/* Decoys Present */}
          {mechanicState.decoyCards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-600/80 text-pink-50 text-xs font-medium"
            >
              <span>🎭</span>
              <span>Decoys</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Shuffle animation overlay - enhanced visual effect
export function ShuffleOverlay({ isShuffling }: { isShuffling: boolean }) {
  return (
    <AnimatePresence>
      {isShuffling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <div className="relative flex flex-col items-center gap-4">
            {/* Outer glow ring */}
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut"
              }}
              className="absolute w-32 h-32 rounded-full bg-primary/30 blur-xl"
            />
            
            {/* Main shuffle icon with rotation */}
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
              }}
              className="relative z-10 p-6 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-2xl"
            >
              <span className="text-5xl">🔀</span>
            </motion.div>
            
            <motion.p
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-2xl font-bold text-foreground mt-4"
            >
              Shuffling Cards...
            </motion.p>
            
            {/* Floating card particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: '50%',
                    y: '50%',
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    x: `${50 + Math.cos(i * (Math.PI / 4)) * 40}%`,
                    y: `${50 + Math.sin(i * (Math.PI / 4)) * 40}%`,
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut"
                  }}
                  className="absolute w-8 h-10 -ml-4 -mt-5 rounded-md bg-gradient-to-br from-accent to-accent/50 shadow-lg"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Fog overlay effect
export function FogOverlay({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-background/30 to-background/70" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjA1Ii8+PC9zdmc+')] opacity-50" />
    </div>
  );
}