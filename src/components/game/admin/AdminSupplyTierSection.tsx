import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Loader2,
  Save,
  Plus,
  Trash2,
  Coins,
  DollarSign,
  Gift,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { ContractConfig } from '@/hooks/useContractReads';
import { parseEther, parseUnits } from 'viem';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResolutionPriorityEnum } from '@/contracts/MemoryMintContract';

interface AdminSupplyTierSectionProps {
  config: ContractConfig | null;
  isPending: boolean;
  isPreviewMode: boolean;
  onSetSupplyPriceTier: (tierIndex: number, minSupply: bigint, maxSupply: bigint, priceETH: bigint, priceUSDC: bigint, enabled: boolean) => Promise<boolean>;
  onSetSupplyBonusTier: (tierIndex: number, minSupply: bigint, maxSupply: bigint, bonusETH: bigint, bonusUSDC: bigint, enabled: boolean) => Promise<boolean>;
  onSetDynamicPricingResolution: (priority: number) => Promise<boolean>;
  onSetDynamicBonusResolution: (priority: number) => Promise<boolean>;
}

interface SupplyTierConfig {
  tierIndex: number;
  minSupply: string;
  maxSupply: string;
  priceETH: string;
  priceUSDC: string;
  bonusETH: string;
  bonusUSDC: string;
  priceEnabled: boolean;
  bonusEnabled: boolean;
}

const MAX_TIERS = 10;

const RESOLUTION_OPTIONS = [
  { value: ResolutionPriorityEnum.LEVEL_FIRST, label: 'Level First', description: 'Check level config, then supply tiers' },
  { value: ResolutionPriorityEnum.SUPPLY_FIRST, label: 'Supply First', description: 'Check supply tiers, then level config' },
  { value: ResolutionPriorityEnum.LEVEL_ONLY, label: 'Level Only', description: 'Only use level-based pricing/bonuses' },
  { value: ResolutionPriorityEnum.SUPPLY_ONLY, label: 'Supply Only', description: 'Only use supply-based pricing/bonuses' },
];

export function AdminSupplyTierSection({
  config,
  isPending,
  isPreviewMode,
  onSetSupplyPriceTier,
  onSetSupplyBonusTier,
  onSetDynamicPricingResolution,
  onSetDynamicBonusResolution,
}: AdminSupplyTierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tiers, setTiers] = useState<SupplyTierConfig[]>([
    { tierIndex: 0, minSupply: '0', maxSupply: '100', priceETH: '0', priceUSDC: '0', bonusETH: '0', bonusUSDC: '0', priceEnabled: false, bonusEnabled: false },
    { tierIndex: 1, minSupply: '101', maxSupply: '500', priceETH: '0', priceUSDC: '0', bonusETH: '0', bonusUSDC: '0', priceEnabled: false, bonusEnabled: false },
    { tierIndex: 2, minSupply: '501', maxSupply: '1000', priceETH: '0', priceUSDC: '0', bonusETH: '0', bonusUSDC: '0', priceEnabled: false, bonusEnabled: false },
  ]);
  const [pendingTier, setPendingTier] = useState<number | null>(null);
  const [pricingResolution, setPricingResolution] = useState<number>(ResolutionPriorityEnum.LEVEL_FIRST);
  const [bonusResolution, setBonusResolution] = useState<number>(ResolutionPriorityEnum.LEVEL_FIRST);

  const updateTier = (index: number, field: keyof SupplyTierConfig, value: string | boolean) => {
    setTiers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTier = () => {
    const nextIndex = tiers.length;
    if (nextIndex < MAX_TIERS) {
      const lastTier = tiers[tiers.length - 1];
      const newMinSupply = lastTier ? (parseInt(lastTier.maxSupply) + 1).toString() : '0';
      const newMaxSupply = (parseInt(newMinSupply) + 499).toString();
      
      setTiers(prev => [...prev, {
        tierIndex: nextIndex,
        minSupply: newMinSupply,
        maxSupply: newMaxSupply,
        priceETH: '0',
        priceUSDC: '0',
        bonusETH: '0',
        bonusUSDC: '0',
        priceEnabled: false,
        bonusEnabled: false,
      }]);
    }
  };

  const removeTier = (index: number) => {
    setTiers(prev => prev.filter((_, i) => i !== index).map((tier, i) => ({ ...tier, tierIndex: i })));
  };

  const handleSaveSupplyPriceTier = async (tierConfig: SupplyTierConfig) => {
    try {
      setPendingTier(tierConfig.tierIndex);
      const minSupply = BigInt(tierConfig.minSupply || '0');
      const maxSupply = BigInt(tierConfig.maxSupply || '0');
      const ethWei = tierConfig.priceETH ? parseEther(tierConfig.priceETH) : 0n;
      const usdcUnits = tierConfig.priceUSDC ? parseUnits(tierConfig.priceUSDC, 6) : 0n;
      await onSetSupplyPriceTier(tierConfig.tierIndex, minSupply, maxSupply, ethWei, usdcUnits, tierConfig.priceEnabled);
    } catch (err) {
      console.error('Failed to save supply price tier:', err);
    } finally {
      setPendingTier(null);
    }
  };

  const handleSaveSupplyBonusTier = async (tierConfig: SupplyTierConfig) => {
    try {
      setPendingTier(tierConfig.tierIndex);
      const minSupply = BigInt(tierConfig.minSupply || '0');
      const maxSupply = BigInt(tierConfig.maxSupply || '0');
      const ethWei = tierConfig.bonusETH ? parseEther(tierConfig.bonusETH) : 0n;
      const usdcUnits = tierConfig.bonusUSDC ? parseUnits(tierConfig.bonusUSDC, 6) : 0n;
      await onSetSupplyBonusTier(tierConfig.tierIndex, minSupply, maxSupply, ethWei, usdcUnits, tierConfig.bonusEnabled);
    } catch (err) {
      console.error('Failed to save supply bonus tier:', err);
    } finally {
      setPendingTier(null);
    }
  };

  const handleSetPricingResolution = async (value: string) => {
    const priority = parseInt(value);
    const success = await onSetDynamicPricingResolution(priority);
    if (success) setPricingResolution(priority);
  };

  const handleSetBonusResolution = async (value: string) => {
    const priority = parseInt(value);
    const success = await onSetDynamicBonusResolution(priority);
    if (success) setBonusResolution(priority);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-amber-500" />
          Supply-Based Tiers
        </h3>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
          {tiers.length} Tiers
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure pricing and bonuses based on total supply. Early minters can get better rates or higher rewards.
      </p>

      {/* Resolution Priority */}
      <Card className="border-amber-500/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1">
                <Coins className="h-3 w-3" /> Pricing Resolution
              </Label>
              <Select
                value={pricingResolution.toString()}
                onValueChange={handleSetPricingResolution}
                disabled={isPreviewMode || isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      <div>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1">
                <Gift className="h-3 w-3" /> Bonus Resolution
              </Label>
              <Select
                value={bonusResolution.toString()}
                onValueChange={handleSetBonusResolution}
                disabled={isPreviewMode || isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      <div>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supply Tier Configuration */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Configure {tiers.length} Supply Tiers
            </span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {tiers.map((tierConfig, index) => (
            <Card key={tierConfig.tierIndex} className="border-border/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Tier {tierConfig.tierIndex}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Supply {tierConfig.minSupply} - {tierConfig.maxSupply}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {tiers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTier(index)}
                        disabled={isPreviewMode || isPending}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                {/* Supply Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Min Supply</Label>
                    <Input
                      type="number"
                      value={tierConfig.minSupply}
                      onChange={(e) => updateTier(index, 'minSupply', e.target.value)}
                      disabled={isPreviewMode || isPending}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Max Supply</Label>
                    <Input
                      type="number"
                      value={tierConfig.maxSupply}
                      onChange={(e) => updateTier(index, 'maxSupply', e.target.value)}
                      disabled={isPreviewMode || isPending}
                      className="text-sm"
                    />
                  </div>
                </div>

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
                        value={tierConfig.priceETH}
                        onChange={(e) => updateTier(index, 'priceETH', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">ETH</span>
                    </div>
                    <div>
                      <Input
                        type="text"
                        placeholder="USDC"
                        value={tierConfig.priceUSDC}
                        onChange={(e) => updateTier(index, 'priceUSDC', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">USDC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tierConfig.priceEnabled}
                        onCheckedChange={(checked) => updateTier(index, 'priceEnabled', checked)}
                        disabled={isPreviewMode || isPending}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveSupplyPriceTier(tierConfig)}
                        disabled={isPreviewMode || isPending || pendingTier === tierConfig.tierIndex}
                        className="h-8"
                      >
                        {pendingTier === tierConfig.tierIndex ? (
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
                        value={tierConfig.bonusETH}
                        onChange={(e) => updateTier(index, 'bonusETH', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">ETH</span>
                    </div>
                    <div>
                      <Input
                        type="text"
                        placeholder="USDC"
                        value={tierConfig.bonusUSDC}
                        onChange={(e) => updateTier(index, 'bonusUSDC', e.target.value)}
                        disabled={isPreviewMode || isPending}
                        className="text-sm"
                      />
                      <span className="text-xs text-muted-foreground">USDC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tierConfig.bonusEnabled}
                        onCheckedChange={(checked) => updateTier(index, 'bonusEnabled', checked)}
                        disabled={isPreviewMode || isPending}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveSupplyBonusTier(tierConfig)}
                        disabled={isPreviewMode || isPending || pendingTier === tierConfig.tierIndex}
                        className="h-8"
                      >
                        {pendingTier === tierConfig.tierIndex ? (
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

          {tiers.length < MAX_TIERS && (
            <Button
              variant="outline"
              onClick={addTier}
              className="w-full"
              disabled={isPreviewMode || isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Supply Tier
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}