import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FloatingScoreProps {
  score: number;
  x: number;
  y: number;
  combo?: number;
  onComplete: () => void;
}

export function FloatingScore({ score, x, y, combo = 0, onComplete }: FloatingScoreProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed pointer-events-none z-50 font-display font-bold',
        'animate-float-up',
        combo >= 5 ? 'text-4xl' : combo >= 3 ? 'text-3xl' : 'text-2xl',
        combo >= 5 ? 'text-accent' : combo >= 3 ? 'text-success' : 'text-primary'
      )}
      style={{ left: x, top: y }}
    >
      <span className="drop-shadow-lg">+{score}</span>
      {combo >= 2 && (
        <span className="ml-1 text-lg opacity-80">x{combo}</span>
      )}
    </div>
  );
}
