import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Layers,
  Loader2,
  Save,
  Plus,
  Coins,
  DollarSign,
  Gift,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AdminLevelPricingSectionProps {
  config: ContractConfig | null;
  isPending: boolean;
  isPreviewMode: boolean;
  onSetLevelPrice: (level: number, priceETH: bigint, priceUSDC: bigint, active: boolean) => Promise<boolean>;
  onSetLevelBonus: (level: number, bonusETH: bigint, bonusUSDC: bigint, active: boolean) => Promise<boolean>;
  onSetDynamicPricingEnabled: (enabled: boolean) => Promise<boolean>;
  onSetDynamicBonusEnabled: (enabled: boolean) => Promise<boolean>;
}

interface LevelConfig {
  level: number;
  priceETH: string;
  priceUSDC: string;
  bonusETH: string;
  bonusUSDC: string;
  priceActive: boolean;
  bonusActive: boolean;
}

const MAX_LEVELS = 20;

export function AdminLevelPricingSection({
  config,
  isPending,
  isPreviewMode,
  onSetLevelPrice,
  onSetLevelBonus,
  onSetDynamicPricingEnabled,
  onSetDynamicBonusEnabled,
}: AdminLevelPricingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(false);
  const [dynamicBonusEnabled, setDynamicBonusEnabled] = useState(false);

  // Initialize with empty levels
  useEffect(() => {
    const initialLevels: LevelConfig[] = [];
    for (let i = 1; i <= 5; i++) {
      initialLevels.push({
        level: i,
        priceETH: '0',
        priceUSDC: '0',
        bonusETH: '0',
        bonusUSDC: '0',
        priceActive: false,
        bonusActive: false,
      });
    }
    setLevels(initialLevels);
  }, []);

  const updateLevel = (index: number, field: keyof LevelConfig, value: string | boolean) => {
    setLevels(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLevel = () => {
    const nextLevel = levels.length + 1;
    if (nextLevel <= MAX_LEVELS) {
      setLevels(prev => [...prev, {
        level: nextLevel,
        priceETH: '0',
        priceUSDC: '0',
        bonusETH: '0',
        bonusUSDC: '0',
        priceActive: false,
        bonusActive: false,
      }]);
    }
  };

  const handleSaveLevelPrice = async (levelConfig: LevelConfig) => {
    try {
      setPendingLevel(levelConfig.level);
      const ethWei = levelConfig.priceETH ? parseEther(levelConfig.priceETH) : 0n;
      const usdcUnits = levelConfig.priceUSDC ? parseUnits(levelConfig.priceUSDC, 6) : 0n;
      await onSetLevelPrice(levelConfig.level, ethWei, usdcUnits, levelConfig.priceActive);
    } catch (err) {
      console.error('Failed to save level price:', err);
    } finally {
      setPendingLevel(null);
    }
  };

  const handleSaveLevelBonus = async (levelConfig: LevelConfig) => {
    try {
      setPendingLevel(levelConfig.level);
      const ethWei = levelConfig.bonusETH ? parseEther(levelConfig.bonusETH) : 0n;
      const usdcUnits = levelConfig.bonusUSDC ? parseUnits(levelConfig.bonusUSDC, 6) : 0n;
      await onSetLevelBonus(levelConfig.level, ethWei, usdcUnits, levelConfig.bonusActive);
    } catch (err) {
      console.error('Failed to save level bonus:', err);
    } finally {
      setPendingLevel(null);
    }
  };

  const handleToggleDynamicPricing = async () => {
    const newValue = !dynamicPricingEnabled;
    const success = await onSetDynamicPricingEnabled(newValue);
    if (success) setDynamicPricingEnabled(newValue);
  };

  const handleToggleDynamicBonus = async () => {
    const newValue = !dynamicBonusEnabled;
    const success = await onSetDynamicBonusEnabled(newValue);
    if (success) setDynamicBonusEnabled(newValue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5 text-violet-500" />
          Level-Based Pricing & Bonuses
        </h3>
        <Badge variant="outline" className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30">
          Dynamic
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure different mint prices and bonuses for each game level. Higher levels can have premium pricing or better rewards.
      </p>

      {/* Master Toggles */}
      <Card className="border-violet-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center justify-between flex-1 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <div>
                <p className="text-sm font-medium">Dynamic Pricing</p>
                <p className="text-xs text-muted-foreground">Enable level-based mint prices</p>
              </div>
              <Switch
                checked={dynamicPricingEnabled}
                onCheckedChange={handleToggleDynamicPricing}
                disabled={isPreviewMode || isPending}
              />
            </div>
            <div className="flex items-center justify-between flex-1 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div>
                <p className="text-sm font-medium">Dynamic Bonuses</p>
                <p className="text-xs text-muted-foreground">Enable level-based rewards</p>
              </div>
              <Switch
                checked={dynamicBonusEnabled}
                onCheckedChange={handleToggleDynamicBonus}
                disabled={isPreviewMode || isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Configuration */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Configure {levels.length} Levels
            </span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {levels.map((levelConfig, index) => (
            <Card key={levelConfig.level} className="border-border/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Level {levelConfig.level}</Badge>
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={levelConfig.priceActive 
                        ? "bg-violet-500/10 text-violet-600 border-violet-500/30 text-xs" 
                        : "text-xs"
                      }
                    >
                      <Coins className="h-3 w-3 mr-1" />
                      {levelConfig.priceActive ? 'Price Active' : 'Price Off'}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={levelConfig.bonusActive 
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs" 
                        : "text-xs"
                      }
                    >
                      <Gift className="h-3 w-3 mr-1" />
                      {levelConfig.bonusActive ? 'Bonus Active' : 'Bonus Off'}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                {/* Price Configuration */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Mint Price
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Input
                        type="text"
                        placeholder="ETH"
                        value={levelConfig.priceETH}
                        onChange={(e) => updateLevel(index, 'priceETH', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">ETH</span>
                    </div>
                    <div>
                      <Input
                        type="text"
                        placeholder="USDC"
                        value={levelConfig.priceUSDC}
                        onChange={(e) => updateLevel(index, 'priceUSDC', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">USDC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={levelConfig.priceActive}
                        onCheckedChange={(checked) => updateLevel(index, 'priceActive', checked)}
                        disabled={isPreviewMode || isPending}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveLevelPrice(levelConfig)}
                        disabled={isPreviewMode || isPending || pendingLevel === levelConfig.level}
                        className="h-8"
                      >
                        {pendingLevel === levelConfig.level ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Bonus Configuration */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Gift className="h-3 w-3" /> Bonus Reward
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Input
                        type="text"
                        placeholder="ETH"
                        value={levelConfig.bonusETH}
                        onChange={(e) => updateLevel(index, 'bonusETH', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">ETH</span>
                    </div>
                    <div>
                      <Input
                        type="text"
                        placeholder="USDC"
                        value={levelConfig.bonusUSDC}
                        onChange={(e) => updateLevel(index, 'bonusUSDC', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">USDC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={levelConfig.bonusActive}
                        onCheckedChange={(checked) => updateLevel(index, 'bonusActive', checked)}
                        disabled={isPreviewMode || isPending}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveLevelBonus(levelConfig)}
                        disabled={isPreviewMode || isPending || pendingLevel === levelConfig.level}
                        className="h-8"
                      >
                        {pendingLevel === levelConfig.level ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {levels.length < MAX_LEVELS && (
            <Button
              variant="outline"
              onClick={addLevel}
              className="w-full"
              disabled={isPreviewMode || isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Level {levels.length + 1}
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}