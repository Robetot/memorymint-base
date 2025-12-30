import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Gift, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Edit2, 
  Eye,
  Coins,
  Target,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { BonusLevelInfo } from '@/hooks/useContractReads';
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';
import { USDC_DECIMALS } from '@/contracts/MemoryMintContract';

interface AdminRewardTiersProps {
  bonusLevels: BonusLevelInfo[];
  isPreviewMode: boolean;
  onConfigureTier: (
    level: number,
    amountETH: string,
    amountUSDC: string,
    active: boolean,
    maxClaims: string
  ) => Promise<boolean>;
  isPending: boolean;
}

interface EditTierData {
  level: number;
  amountETH: string;
  amountUSDC: string;
  maxClaims: string;
  enabled: boolean;
}

export function AdminRewardTiers({ 
  bonusLevels, 
  isPreviewMode,
  onConfigureTier,
  isPending,
}: AdminRewardTiersProps) {
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<EditTierData | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTierData, setNewTierData] = useState<EditTierData>({
    level: bonusLevels.length + 1,
    amountETH: '0.01',
    amountUSDC: '10',
    maxClaims: '100',
    enabled: true,
  });

  const toggleLevel = (level: number) => {
    const newSet = new Set(expandedLevels);
    if (newSet.has(level)) {
      newSet.delete(level);
    } else {
      newSet.add(level);
    }
    setExpandedLevels(newSet);
  };

  const handleEditClick = (tier: BonusLevelInfo) => {
    setEditData({
      level: tier.level,
      amountETH: formatEther(tier.amountETH),
      amountUSDC: formatUnits(tier.amountUSDC, USDC_DECIMALS),
      maxClaims: tier.claimsRemaining.toString(),
      enabled: tier.active,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    
    const success = await onConfigureTier(
      editData.level,
      editData.amountETH,
      editData.amountUSDC,
      editData.enabled,
      editData.maxClaims
    );
    
    if (success) {
      setIsEditModalOpen(false);
      setEditData(null);
    }
  };

  const handleAddTier = async () => {
    const success = await onConfigureTier(
      newTierData.level,
      newTierData.amountETH,
      newTierData.amountUSDC,
      newTierData.enabled,
      newTierData.maxClaims
    );
    
    if (success) {
      setIsAddModalOpen(false);
      setNewTierData({
        level: bonusLevels.length + 2,
        amountETH: '0.01',
        amountUSDC: '10',
        maxClaims: '100',
        enabled: true,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Reward Tiers
        </h3>
        <Button 
          size="sm" 
          onClick={() => setIsAddModalOpen(true)}
          disabled={isPreviewMode}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Tier
        </Button>
      </div>

      {bonusLevels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No reward tiers configured</p>
            <p className="text-sm">Add a tier to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bonusLevels.map((tier) => (
            <Collapsible
              key={tier.level}
              open={expandedLevels.has(tier.level)}
              onOpenChange={() => toggleLevel(tier.level)}
            >
              <Card className="border-border/50">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{tier.level}</span>
                        </div>
                        <div>
                          <CardTitle className="text-base">Level {tier.level}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {formatEther(tier.amountETH)} ETH / ${formatUnits(tier.amountUSDC, USDC_DECIMALS)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={tier.active ? "default" : "secondary"}
                          className={tier.active 
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                            : ""
                          }
                        >
                          {tier.active ? 'Active' : 'Disabled'}
                        </Badge>
                        {expandedLevels.has(tier.level) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">ETH Reward:</span>
                        <span className="font-medium">{formatEther(tier.amountETH)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">USDC Reward:</span>
                        <span className="font-medium">${formatUnits(tier.amountUSDC, USDC_DECIMALS)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Claims Left:</span>
                        <span className="font-medium">{tier.claimsRemaining.toString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {tier.requiresNFT ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-muted-foreground">Requires NFT:</span>
                        <span className="font-medium">{tier.requiresNFT ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditClick(tier)}
                        disabled={isPreviewMode}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Edit Tier Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tier {editData?.level}</DialogTitle>
            <DialogDescription>
              Update the reward configuration for this tier.
            </DialogDescription>
          </DialogHeader>
          
          {editData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ETH Amount</Label>
                  <Input
                    type="text"
                    value={editData.amountETH}
                    onChange={(e) => setEditData({ ...editData, amountETH: e.target.value })}
                    placeholder="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>USDC Amount</Label>
                  <Input
                    type="text"
                    value={editData.amountUSDC}
                    onChange={(e) => setEditData({ ...editData, amountUSDC: e.target.value })}
                    placeholder="10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Max Claims</Label>
                <Input
                  type="number"
                  value={editData.maxClaims}
                  onChange={(e) => setEditData({ ...editData, maxClaims: e.target.value })}
                  min="1"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch
                  checked={editData.enabled}
                  onCheckedChange={(checked) => setEditData({ ...editData, enabled: checked })}
                />
              </div>
              
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
                On-chain change (gas required)
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tier Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Tier</DialogTitle>
            <DialogDescription>
              Configure a new reward tier for players.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tier Level</Label>
              <Input
                type="number"
                value={newTierData.level}
                onChange={(e) => setNewTierData({ ...newTierData, level: parseInt(e.target.value) || 1 })}
                min="1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ETH Amount</Label>
                <Input
                  type="text"
                  value={newTierData.amountETH}
                  onChange={(e) => setNewTierData({ ...newTierData, amountETH: e.target.value })}
                  placeholder="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>USDC Amount</Label>
                <Input
                  type="text"
                  value={newTierData.amountUSDC}
                  onChange={(e) => setNewTierData({ ...newTierData, amountUSDC: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Max Claims</Label>
              <Input
                type="number"
                value={newTierData.maxClaims}
                onChange={(e) => setNewTierData({ ...newTierData, maxClaims: e.target.value })}
                min="1"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={newTierData.enabled}
                onCheckedChange={(checked) => setNewTierData({ ...newTierData, enabled: checked })}
              />
            </div>
            
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
              On-chain change (gas required)
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTier} disabled={isPending}>
              Add Tier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
