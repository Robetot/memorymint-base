import { useCallback, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isRunningRef.current = false;
      confetti.reset();
    };
  }, []);

  const resetConfetti = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isRunningRef.current = false;
    confetti.reset();
  }, []);

  const fireMatchConfetti = useCallback(() => {
    // Small burst for card match - limited particles
    confetti({
      particleCount: 20,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'],
      scalar: 0.7,
      gravity: 1.5,
      ticks: 100,
      disableForReducedMotion: true,
    });
  }, []);

  const fireComboConfetti = useCallback((comboCount: number) => {
    // Limit combo confetti
    const particleCount = Math.min(15 + comboCount * 5, 50);
    
    confetti({
      particleCount,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6', '#E74C3C'],
      scalar: 0.8,
      gravity: 1.2,
      ticks: 100,
      disableForReducedMotion: true,
    });
  }, []);

  const fireWinConfetti = useCallback(() => {
    // Prevent multiple simultaneous win confetti
    if (isRunningRef.current) {
      return;
    }
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    isRunningRef.current = true;
    
    const duration = 2000; // Reduced from 3000
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    // Initial burst
    confetti({
      particleCount: 50, // Reduced from 100
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'],
      ticks: 150,
      gravity: 1,
      disableForReducedMotion: true,
    });

    // Interval-based confetti with proper cleanup
    intervalRef.current = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        isRunningRef.current = false;
        return;
      }

      const particleCount = Math.max(10, 25 * (timeLeft / duration));

      // Fire from one side at a time (alternating) to reduce load
      confetti({
        particleCount: Math.floor(particleCount),
        startVelocity: 25,
        spread: 60,
        origin: { x: randomInRange(0.2, 0.8), y: randomInRange(-0.1, 0.3) },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#9B59B6'],
        ticks: 100,
        gravity: 1.2,
        disableForReducedMotion: true,
      });
    }, 400); // Increased from 250ms to 400ms
  }, []);

  const fireStars = useCallback(() => {
    confetti({
      spread: 360,
      ticks: 50,
      gravity: 0.5,
      decay: 0.94,
      startVelocity: 15,
      particleCount: 15,
      scalar: 1,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'],
      disableForReducedMotion: true,
    });
  }, []);

  return {
    fireMatchConfetti,
    fireComboConfetti,
    fireWinConfetti,
    fireStars,
    resetConfetti,
  };
}
