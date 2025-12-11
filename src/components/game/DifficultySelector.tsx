import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Zap, Brain, Target, Trophy } from 'lucide-react';
import { Difficulty, DIFFICULTY_CONFIG } from '@/data/animals';

interface DifficultySelectorProps {
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onBack: () => void;
}

const difficultyIcons: Record<Difficulty, React.ReactNode> = {
  '2x2': <Zap className="w-8 h-8" />,
  '4x4': <Brain className="w-8 h-8" />,
  '6x6': <Target className="w-8 h-8" />,
};

const difficultyColors: Record<Difficulty, string> = {
  '2x2': 'from-success/20 to-success/5 border-success/30 hover:border-success',
  '4x4': 'from-primary/20 to-primary/5 border-primary/30 hover:border-primary',
  '6x6': 'from-secondary/20 to-secondary/5 border-secondary/30 hover:border-secondary',
};

export function DifficultySelector({ onSelectDifficulty, onBack }: DifficultySelectorProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted to-background">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="absolute top-6 left-6 rounded-full"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4">
          Select Difficulty
        </h1>
        <p className="text-muted-foreground font-body max-w-md mx-auto">
          Choose your challenge level. Higher difficulty = better NFT rarity potential!
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
        {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((difficulty) => {
          const config = DIFFICULTY_CONFIG[difficulty];
          return (
            <Card
              key={difficulty}
              className={`cursor-pointer transition-all hover:scale-105 bg-gradient-to-br ${difficultyColors[difficulty]} border-2`}
              onClick={() => onSelectDifficulty(difficulty)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 text-foreground">
                  {difficultyIcons[difficulty]}
                </div>
                <CardTitle className="text-xl font-display">{config.label}</CardTitle>
                <CardDescription className="font-body text-xs">
                  {difficulty} Grid
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <p className="text-xs text-muted-foreground font-body">
                  {config.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rarity hint */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground font-body flex items-center gap-2 justify-center">
          <Trophy className="w-4 h-4 text-accent" />
          Expert mode unlocks Mythic rarity potential
        </p>
      </div>
    </div>
  );
}
