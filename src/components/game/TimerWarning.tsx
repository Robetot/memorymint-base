import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TimerWarningProps {
  timeRemaining: number;
  isPlaying: boolean;
  onTickSound?: () => void;
  onCriticalSound?: () => void;
}

export function TimerWarning({ timeRemaining, isPlaying, onTickSound, onCriticalSound }: TimerWarningProps) {
  const lastSecondRef = useRef<number>(timeRemaining);

  // Play timer sounds when time changes
  useEffect(() => {
    if (!isPlaying || timeRemaining > 10) {
      lastSecondRef.current = timeRemaining;
      return;
    }

    // Only play sound when second changes (not on every render)
    if (Math.floor(timeRemaining) !== Math.floor(lastSecondRef.current)) {
      const isCritical = timeRemaining <= 5;
      if (isCritical && onCriticalSound) {
        onCriticalSound();
      } else if (onTickSound) {
        onTickSound();
      }
    }
    lastSecondRef.current = timeRemaining;
  }, [timeRemaining, isPlaying, onTickSound, onCriticalSound]);

  if (!isPlaying || timeRemaining > 10) return null;

  const isCritical = timeRemaining <= 5;

  return (
    <>
      {/* Screen border warning */}
      <div
        className={cn(
          'fixed inset-0 pointer-events-none z-20 border-4 rounded-lg',
          isCritical ? 'border-destructive animate-pulse-fast' : 'border-orange-500/50 animate-pulse'
        )}
      />
      
      {/* Countdown overlay */}
      {isCritical && (
        <div className="fixed inset-0 pointer-events-none z-20 bg-destructive/10 animate-pulse-fast" />
      )}
    </>
  );
}