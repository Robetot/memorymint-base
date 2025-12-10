import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Zap, Star, Crown } from 'lucide-react';

interface ComboDisplayProps {
  combo: number;
  maxCombo: number;
}

export function ComboDisplay({ combo, maxCombo }: ComboDisplayProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevCombo, setPrevCombo] = useState(combo);

  useEffect(() => {
    if (combo > prevCombo && combo >= 2) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
    setPrevCombo(combo);
  }, [combo, prevCombo]);

  if (combo < 2) return null;

  const getComboIcon = () => {
    if (combo >= 10) return <Crown className="w-8 h-8 text-accent" />;
    if (combo >= 7) return <Star className="w-7 h-7 text-yellow-400" />;
    if (combo >= 4) return <Flame className="w-6 h-6 text-orange-500" />;
    return <Zap className="w-5 h-5 text-success" />;
  };

  const getComboText = () => {
    if (combo >= 10) return 'LEGENDARY!';
    if (combo >= 7) return 'AMAZING!';
    if (combo >= 4) return 'ON FIRE!';
    if (combo >= 2) return 'COMBO!';
    return '';
  };

  return (
    <div
      className={cn(
        'fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40',
        'flex flex-col items-center gap-1 pointer-events-none',
        isAnimating && 'animate-combo-pop'
      )}
    >
      <div className={cn(
        'flex items-center gap-2 px-6 py-3 rounded-2xl',
        'bg-gradient-to-r shadow-2xl border-2',
        combo >= 10 ? 'from-accent/90 to-primary/90 border-accent' :
        combo >= 7 ? 'from-yellow-500/90 to-orange-500/90 border-yellow-400' :
        combo >= 4 ? 'from-orange-500/90 to-red-500/90 border-orange-400' :
        'from-success/90 to-primary/90 border-success'
      )}>
        {getComboIcon()}
        <div className="text-center">
          <p className="text-xs font-body text-white/80">{getComboText()}</p>
          <p className={cn(
            'font-display font-black text-white',
            combo >= 7 ? 'text-4xl' : combo >= 4 ? 'text-3xl' : 'text-2xl'
          )}>
            x{combo}
          </p>
        </div>
        {getComboIcon()}
      </div>
    </div>
  );
}
