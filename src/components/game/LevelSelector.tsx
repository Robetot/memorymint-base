import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Lock, Star, Trophy, Crown, Sparkles, Gift } from 'lucide-react';
import { 
  LEVELS, 
  LevelConfig, 
  getUnlockedLevel, 
  NFT_RARITY_STYLES, 
  MECHANIC_INFO,
  TIER_REWARDS,
  NFTRarityTier 
} from '@/data/levels';
import { cn } from '@/lib/utils';

interface LevelSelectorProps {
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

const getTierIcon = (tier: number) => {
  switch (tier) {
    case 1: return <Star className="w-5 h-5" />;
    case 2: return <Star className="w-5 h-5" />;
    case 3: return <Trophy className="w-5 h-5" />;
    case 4: return <Crown className="w-5 h-5" />;
    case 5: return <Sparkles className="w-5 h-5" />;
    default: return <Star className="w-5 h-5" />;
  }
};

const getTierColor = (tier: number): string => {
  switch (tier) {
    case 1: return 'from-slate-400/20 to-slate-500/10 border-slate-400/40';
    case 2: return 'from-emerald-400/20 to-emerald-500/10 border-emerald-400/40';
    case 3: return 'from-blue-400/20 to-blue-500/10 border-blue-400/40';
    case 4: return 'from-purple-400/20 to-purple-500/10 border-purple-400/40';
    case 5: return 'from-amber-400/20 via-rose-400/20 to-purple-400/10 border-amber-400/40';
    default: return 'from-muted/20 to-muted/10 border-border';
  }
};

const getTierName = (tier: number): string => {
  switch (tier) {
    case 1: return 'Onboarding';
    case 2: return 'Core Skill';
    case 3: return 'Advanced';
    case 4: return 'Mastery';
    case 5: return 'Endgame';
    default: return 'Unknown';
  }
};

export function LevelSelector({ onSelectLevel, onBack }: LevelSelectorProps) {
  const unlockedLevel = getUnlockedLevel();

  // Group levels by tier
  const tiers = [1, 2, 3, 4, 5].map(tier => ({
    tier,
    name: getTierName(tier),
    levels: LEVELS.filter(l => l.tier === tier),
    reward: TIER_REWARDS[tier],
  }));

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-12 pb-20 bg-gradient-to-br from-background via-muted/30 to-background overflow-y-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="absolute top-4 left-4 rounded-full z-10"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
          Select Level
        </h1>
        <p className="text-muted-foreground font-body text-sm max-w-md mx-auto">
          Master each tier to unlock NFT rewards. Higher tiers = rarer NFTs!
        </p>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        {tiers.map(({ tier, name, levels, reward }) => {
          const tierUnlocked = levels.some(l => l.level <= unlockedLevel);
          const tierCompleted = levels.every(l => l.level <= unlockedLevel);
          const rarityStyle = NFT_RARITY_STYLES[reward.rarity];

          return (
            <div key={tier} className="space-y-3">
              {/* Tier Header */}
              <div className={cn(
                'flex items-center justify-between p-3 rounded-xl bg-gradient-to-r border',
                getTierColor(tier),
                !tierUnlocked && 'opacity-50'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-card/50', rarityStyle.color)}>
                    {getTierIcon(tier)}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm">
                      Tier {tier}: {name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Levels {levels[0].level}-{levels[levels.length - 1].level}
                    </p>
                  </div>
                </div>
                
                {/* NFT Reward Badge */}
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
                  `bg-gradient-to-r ${rarityStyle.bgGradient}`,
                  rarityStyle.color
                )}>
                  <Gift className="w-3.5 h-3.5" />
                  <span>{rarityStyle.icon} {reward.rarity}</span>
                  {tierCompleted && <span className="text-success">✓</span>}
                </div>
              </div>

              {/* Level Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {levels.map((levelConfig) => {
                  const isUnlocked = levelConfig.level <= unlockedLevel;
                  const isCompleted = levelConfig.level < unlockedLevel;
                  const levelRarityStyle = NFT_RARITY_STYLES[levelConfig.nftRarity];

                  return (
                    <Card
                      key={levelConfig.level}
                      className={cn(
                        'transition-all border cursor-pointer',
                        isUnlocked ? 'hover:scale-105 hover:shadow-lg' : 'opacity-50 cursor-not-allowed',
                        isUnlocked && `bg-gradient-to-br ${levelRarityStyle.bgGradient} ${levelRarityStyle.border}`,
                        !isUnlocked && 'bg-muted/30 border-muted'
                      )}
                      onClick={() => isUnlocked && onSelectLevel(levelConfig.level)}
                    >
                      <CardHeader className="p-3 pb-1">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-display flex items-center gap-1.5">
                            {!isUnlocked ? (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : isCompleted ? (
                              <span className="text-success">✓</span>
                            ) : null}
                            {levelConfig.level}
                          </CardTitle>
                          <span className="text-[10px]">
                            {levelConfig.gridColumns}×{levelConfig.gridRows}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-1">
                        {/* Mechanics Icons */}
                        <div className="flex flex-wrap gap-0.5">
                          {levelConfig.mechanics.slice(0, 3).map((mechanic) => (
                            <span
                              key={mechanic}
                              className="text-xs"
                              title={MECHANIC_INFO[mechanic].name}
                            >
                              {MECHANIC_INFO[mechanic].icon}
                            </span>
                          ))}
                          {levelConfig.mechanics.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{levelConfig.mechanics.length - 3}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {levelConfig.description.split('•')[0].trim()}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom hint */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground font-body flex items-center gap-2 justify-center">
          <Sparkles className="w-4 h-4 text-accent" />
          Complete Level 20 for Mythic NFT
        </p>
      </div>
    </div>
  );
}
