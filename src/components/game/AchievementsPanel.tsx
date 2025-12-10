import React from 'react';
import { Achievement } from '@/hooks/useAchievements';
import { AchievementBadge } from './AchievementBadge';
import { X, Trophy } from 'lucide-react';

interface AchievementsPanelProps {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
  onClose: () => void;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  achievements,
  unlockedCount,
  totalCount,
  onClose,
}) => {
  const categories = ['combo', 'perfect', 'speed', 'progress', 'special'] as const;
  const categoryNames = {
    combo: '🔥 Combo',
    perfect: '⭐ Perfect',
    speed: '⚡ Speed',
    progress: '🎯 Progress',
    special: '🏆 Special',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Achievements</h2>
              <p className="text-sm text-muted-foreground">
                {unlockedCount}/{totalCount} unlocked
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Progress bar */}
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
              style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
            />
          </div>

          {categories.map(category => {
            const categoryAchievements = achievements.filter(a => a.category === category);
            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-foreground/80 mb-3">
                  {categoryNames[category]}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {categoryAchievements.map(achievement => (
                    <AchievementBadge key={achievement.id} achievement={achievement} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
