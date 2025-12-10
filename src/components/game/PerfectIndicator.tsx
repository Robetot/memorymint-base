import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface PerfectIndicatorProps {
  isPerfect: boolean;
  matchedPairs: number;
}

export function PerfectIndicator({ isPerfect, matchedPairs }: PerfectIndicatorProps) {
  if (!isPerfect || matchedPairs < 1) return null;

  return (
    <div className={cn(
      'fixed top-4 left-1/2 -translate-x-1/2 z-30',
      'flex items-center gap-2 px-4 py-2 rounded-full',
      'bg-gradient-to-r from-yellow-400/90 to-amber-500/90',
      'border-2 border-yellow-300 shadow-lg',
      'animate-pulse'
    )}>
      <Sparkles className="w-4 h-4 text-white" />
      <span className="text-sm font-display font-bold text-white">PERFECT!</span>
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  );
}
