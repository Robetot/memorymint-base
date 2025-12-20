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

// Shuffle animation overlay - enhanced with flying cards and screen shake
export function ShuffleOverlay({ isShuffling }: { isShuffling: boolean }) {
  return (
    <AnimatePresence>
      {isShuffling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            // Screen shake effect
            x: [0, -5, 5, -5, 5, -3, 3, 0],
            y: [0, 3, -3, 3, -3, 2, -2, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{ 
            opacity: { duration: 0.3 },
            x: { duration: 0.5, repeat: 2, ease: "easeInOut" },
            y: { duration: 0.5, repeat: 2, ease: "easeInOut" },
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md"
        >
          {/* Flying cards background effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={`flying-card-${i}`}
                initial={{
                  x: `${Math.random() * 100}%`,
                  y: '110%',
                  rotate: Math.random() * 360,
                  scale: 0.5 + Math.random() * 0.5,
                }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: '-10%',
                  rotate: Math.random() * 720 - 360,
                }}
                transition={{
                  duration: 1 + Math.random() * 0.5,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeOut",
                }}
                className="absolute w-12 h-16 rounded-lg shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--primary) / 0.8), hsl(var(--secondary) / 0.6))`,
                  boxShadow: '0 10px 30px hsl(var(--primary) / 0.3)',
                }}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center gap-6 z-10">
            {/* Pulsing glow rings */}
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={`glow-ring-${ring}`}
                animate={{
                  scale: [1, 2, 1],
                  opacity: [0.4, 0, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: ring * 0.3,
                  ease: "easeOut",
                }}
                className="absolute rounded-full bg-primary/20"
                style={{
                  width: `${80 + ring * 40}px`,
                  height: `${80 + ring * 40}px`,
                }}
              />
            ))}
            
            {/* Main shuffle icon with dramatic rotation */}
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.3, 1],
              }}
              transition={{
                rotate: { duration: 0.8, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.4, repeat: Infinity, ease: "easeInOut" },
              }}
              className="relative z-10 p-8 rounded-full bg-gradient-to-br from-primary via-primary/80 to-secondary shadow-2xl"
              style={{
                boxShadow: '0 0 60px hsl(var(--primary) / 0.6), 0 0 100px hsl(var(--primary) / 0.3)',
              }}
            >
              <span className="text-6xl drop-shadow-lg">🔀</span>
            </motion.div>
            
            {/* Text with wave effect */}
            <motion.div className="flex gap-1 mt-4">
              {"SHUFFLING".split('').map((char, i) => (
                <motion.span
                  key={`shuffle-char-${i}-${char}`}
                  animate={{
                    y: [0, -10, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.05,
                    ease: "easeInOut",
                  }}
                  className="text-3xl font-bold text-foreground drop-shadow-lg"
                >
                  {char}
                </motion.span>
              ))}
            </motion.div>
            
            {/* Orbiting card particles */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={`orbit-container-${i}`}
                  animate={{
                    rotate: 360,
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transformOrigin: '0 0',
                  }}
                >
                  <motion.div
                    key={`orbit-particle-${i}`}
                    animate={{
                      scale: [0.8, 1.2, 0.8],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                    className="w-6 h-8 rounded-md bg-gradient-to-br from-accent to-accent/50 shadow-lg"
                    style={{
                      transform: `translateX(${80 + i * 10}px) translateY(-4px)`,
                    }}
                  />
                </motion.div>
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