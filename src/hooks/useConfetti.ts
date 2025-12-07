import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const fireMatchConfetti = useCallback(() => {
    // Small burst for card match
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'],
      scalar: 0.8,
      gravity: 1.2,
    });
  }, []);

  const fireComboConfetti = useCallback((comboCount: number) => {
    // Bigger burst for combos
    const particleCount = Math.min(30 + comboCount * 15, 100);
    
    confetti({
      particleCount,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6', '#E74C3C'],
      scalar: 1,
      gravity: 0.8,
    });
  }, []);

  const fireWinConfetti = useCallback(() => {
    // Epic celebration for winning
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Fire from both sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#9B59B6'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#9B59B6'],
      });
    }, 250);

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'],
    });
  }, []);

  const fireStars = useCallback(() => {
    // Star-shaped confetti for special moments
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 20,
      shapes: ['star' as const],
      colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'],
    };

    confetti({
      ...defaults,
      particleCount: 20,
      scalar: 1.2,
      origin: { x: 0.5, y: 0.5 },
    });

    confetti({
      ...defaults,
      particleCount: 10,
      scalar: 0.75,
      origin: { x: 0.5, y: 0.5 },
    });
  }, []);

  return {
    fireMatchConfetti,
    fireComboConfetti,
    fireWinConfetti,
    fireStars,
  };
}
