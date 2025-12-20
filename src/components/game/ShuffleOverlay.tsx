import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle } from 'lucide-react';

interface ShuffleOverlayProps {
  isShuffling: boolean;
}

const ShuffleOverlay = ({ isShuffling }: ShuffleOverlayProps) => {
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
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ 
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
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
                className="absolute inset-0 rounded-full bg-primary/30 blur-xl"
                style={{ width: '120px', height: '120px', margin: '-20px' }}
              />
              
              {/* Main shuffle icon */}
              <motion.div
                animate={{
                  rotate: 360,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="relative z-10 p-6 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-2xl"
              >
                <Shuffle className="w-16 h-16 text-primary-foreground" />
              </motion.div>
            </div>
            
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
                  className="absolute w-8 h-10 rounded-md bg-gradient-to-br from-accent to-accent/50 shadow-lg"
                  style={{
                    left: '-16px',
                    top: '-20px',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShuffleOverlay;
