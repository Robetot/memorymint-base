import { cn } from '@/lib/utils';
import { RarityResult, getRarityDescription } from '@/utils/rarityCalculator';
import { Star, Zap, Clock, Target, Award } from 'lucide-react';

interface RarityDisplayProps {
  rarity: RarityResult;
  className?: string;
}

export function RarityDisplay({ rarity, className }: RarityDisplayProps) {
  const tierIcons: Record<string, string> = {
    Mythic: '🌟',
    Legendary: '👑',
    Epic: '💎',
    Rare: '⭐',
    Common: '🔵',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Rarity Badge */}
      <div className="text-center">
        <div
          className={cn(
            'inline-flex items-center gap-2 px-6 py-3 rounded-full font-display font-bold text-xl',
            'bg-gradient-to-r shadow-lg animate-pulse-glow',
            rarity.tier === 'Mythic' && 'from-purple-500 to-pink-500 text-white',
            rarity.tier === 'Legendary' && 'from-amber-400 to-orange-500 text-white',
            rarity.tier === 'Epic' && 'from-violet-500 to-purple-600 text-white',
            rarity.tier === 'Rare' && 'from-blue-400 to-cyan-500 text-white',
            rarity.tier === 'Common' && 'from-gray-400 to-gray-500 text-white'
          )}
        >
          <span className="text-2xl">{tierIcons[rarity.tier]}</span>
          {rarity.tier}
        </div>
        <p className="text-sm text-muted-foreground mt-2 font-body">
          {getRarityDescription(rarity.tier)}
        </p>
      </div>

      {/* Score Breakdown */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <h4 className="font-display font-semibold text-foreground text-center mb-3">
          Score Breakdown
        </h4>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-secondary" />
            <span className="text-muted-foreground">Base Score:</span>
            <span className="font-bold text-foreground ml-auto">
              {rarity.breakdown.baseScore}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Time Bonus:</span>
            <span className="font-bold text-foreground ml-auto">
              +{rarity.breakdown.timeBonus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Combo Bonus:</span>
            <span className="font-bold text-foreground ml-auto">
              +{rarity.breakdown.comboBonus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">Perfect:</span>
            <span className="font-bold text-foreground ml-auto">
              +{rarity.breakdown.perfectBonus}
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">
              Difficulty (×{rarity.breakdown.difficultyMultiplier}):
            </span>
          </div>
          <span className="font-display font-bold text-lg text-primary">
            {rarity.score.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
