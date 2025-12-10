import React from 'react';
import { Achievement } from '@/hooks/useAchievements';

interface AchievementBadgeProps {
  achievement: Achievement;
  showProgress?: boolean;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement, showProgress = true }) => {
  const progressPercent = Math.min(100, (achievement.progress / achievement.requirement) * 100);

  return (
    <div
      className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-300 ${
        achievement.unlocked
          ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/20'
          : 'bg-card/50 border-border/30 opacity-60 grayscale'
      }`}
    >
      <div
        className={`text-3xl mb-1 ${
          achievement.unlocked ? 'animate-bounce' : ''
        }`}
        style={{ animationDuration: '2s' }}
      >
        {achievement.icon}
      </div>
      <span className="text-xs font-bold text-center text-foreground/90 line-clamp-1">
        {achievement.name}
      </span>
      <span className="text-[10px] text-muted-foreground text-center line-clamp-2 mt-0.5">
        {achievement.description}
      </span>
      
      {showProgress && !achievement.unlocked && (
        <div className="w-full mt-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-yellow-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground mt-0.5 block text-center">
            {achievement.progress}/{achievement.requirement}
          </span>
        </div>
      )}
      
      {achievement.unlocked && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </div>
  );
};
