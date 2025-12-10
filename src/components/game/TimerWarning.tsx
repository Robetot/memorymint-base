import { cn } from '@/lib/utils';

interface TimerWarningProps {
  timeRemaining: number;
  isPlaying: boolean;
}

export function TimerWarning({ timeRemaining, isPlaying }: TimerWarningProps) {
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
