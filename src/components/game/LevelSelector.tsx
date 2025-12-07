import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Lock, Star, Trophy } from 'lucide-react';
import { LEVELS, LevelConfig, getUnlockedLevel } from '@/data/levels';
import { cn } from '@/lib/utils';

interface LevelSelectorProps {
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

const getLevelIcon = (level: number, isUnlocked: boolean) => {
  if (!isUnlocked) return <Lock className="w-6 h-6 text-muted-foreground" />;
  if (level >= 8) return <Trophy className="w-6 h-6 text-accent" />;
  if (level >= 5) return <Star className="w-6 h-6 text-secondary" />;
  return <Star className="w-6 h-6 text-primary" />;
};

const getLevelColor = (level: number, isUnlocked: boolean): string => {
  if (!isUnlocked) return 'bg-muted/50 border-muted cursor-not-allowed opacity-60';
  if (level >= 8) return 'from-accent/20 to-accent/5 border-accent/30 hover:border-accent cursor-pointer';
  if (level >= 5) return 'from-secondary/20 to-secondary/5 border-secondary/30 hover:border-secondary cursor-pointer';
  return 'from-primary/20 to-primary/5 border-primary/30 hover:border-primary cursor-pointer';
};

export function LevelSelector({ onSelectLevel, onBack }: LevelSelectorProps) {
  const unlockedLevel = getUnlockedLevel();

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pt-16 bg-gradient-to-br from-background via-muted to-background overflow-y-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="absolute top-4 left-4 rounded-full"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
          Select Level
        </h1>
        <p className="text-muted-foreground font-body text-sm max-w-md mx-auto">
          Complete levels to unlock the next. Higher levels = harder challenges!
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full max-w-3xl">
        {LEVELS.map((levelConfig) => {
          const isUnlocked = levelConfig.level <= unlockedLevel;
          return (
            <Card
              key={levelConfig.level}
              className={cn(
                'transition-all border-2',
                isUnlocked && 'hover:scale-105 bg-gradient-to-br',
                getLevelColor(levelConfig.level, isUnlocked)
              )}
              onClick={() => isUnlocked && onSelectLevel(levelConfig.level)}
            >
              <CardHeader className="text-center p-3 pb-1">
                <div className="mx-auto mb-1">
                  {getLevelIcon(levelConfig.level, isUnlocked)}
                </div>
                <CardTitle className="text-base font-display">
                  {levelConfig.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center p-2 pt-0">
                <CardDescription className="font-body text-[10px] leading-tight">
                  {levelConfig.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Progress hint */}
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground font-body flex items-center gap-2 justify-center">
          <Trophy className="w-4 h-4 text-accent" />
          Level 10 unlocks Mythic rarity potential
        </p>
      </div>
    </div>
  );
}
