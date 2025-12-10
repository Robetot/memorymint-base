import React, { useEffect } from 'react';
import { Achievement } from '@/hooks/useAchievements';

interface AchievementUnlockPopupProps {
  achievement: Achievement;
  onDismiss: () => void;
}

export const AchievementUnlockPopup: React.FC<AchievementUnlockPopupProps> = ({ achievement, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div 
        className="bg-gradient-to-br from-yellow-500/90 to-orange-600/90 backdrop-blur-md p-6 rounded-2xl shadow-2xl animate-achievement-unlock pointer-events-auto cursor-pointer border-2 border-yellow-300/50"
        onClick={onDismiss}
      >
        <div className="flex flex-col items-center text-white">
          <span className="text-xs uppercase tracking-widest mb-2 opacity-80">Achievement Unlocked!</span>
          <div className="text-5xl mb-3 animate-bounce">{achievement.icon}</div>
          <h3 className="text-xl font-bold mb-1">{achievement.name}</h3>
          <p className="text-sm opacity-80 text-center max-w-48">{achievement.description}</p>
        </div>
        
        {/* Sparkles */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-sparkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
