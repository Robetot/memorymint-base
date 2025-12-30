import { useState, useEffect, useCallback } from 'react';
import { encodeFunctionData, formatEther, formatUnits, parseEther, parseUnits, maxUint256 } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Shield, 
  Coins, 
  Settings2, 
  Users, 
  Gift, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Wallet,
  DollarSign,
} from 'lucide-react';
import { useContractReads } from '@/hooks/useContractReads';
import {
  NFT_CONTRACT_ADDRESS,
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  CONTRACT_ABI,
  ERC20_ABI,
  USDC_DECIMALS,
  ClaimModeEnum,
  AntiBotModeEnum,
  PaymentCurrencyEnum,
} from '@/contracts/MemoryMintContract';

interface AdminPanelProps {
  walletAddress: string;
  onClose?: () => void;
}

export function AdminPanel({ walletAddress, onClose }: AdminPanelProps) {
  const { config, fetchContractConfig, isOwner, invalidateConfigCache } = useContractReads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Form states
  const [mintPriceETH, setMintPriceETH] = useState('');
  const [mintPriceUSDC, setMintPriceUSDC] = useState('');
  const [depositETH, setDepositETH] = useState('');
  const [depositUSDC, setDepositUSDC] = useState('');
  const [withdrawETH, setWithdrawETH] = useState('');
  const [withdrawUSDC, setWithdrawUSDC] = useState('');
  const [bonusLevel, setBonusLevel] = useState('1');
  const [bonusAmountETH, setBonusAmountETH] = useState('');
  const [bonusAmountUSDC, setBonusAmountUSDC] = useState('');
  const [bonusClaims, setBonusClaims] = useState('100');
  
  // Load config on mount
  useEffect(() => {
    fetchContractConfig(true);
  }, [fetchContractConfig]);

  // Check if user is owner
  const userIsOwner = isOwner(walletAddress);

  // ============ SEND TRANSACTION HELPER ============
  const sendAdminTx = useCallback(async (
    functionName: string,
    args: unknown[],
    value?: bigint
  ): Promise<boolean> => {
    if (!window.ethereum) {
      toast.error('Wallet not connected');
      return false;
    }
    
    setIsSubmitting(true);
    
    try {
      const ethereum = window.ethereum as any;
      
      // Verify chain
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      if (chainId.toLowerCase() !== BASE_CHAIN_ID.toLowerCase()) {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID }],
        });
      }
      
      const data = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: functionName as any,
        args: args as any,
      });
      
      const txParams: any = {
        from: walletAddress,
        to: NFT_CONTRACT_ADDRESS,
        data,
      };
      
      if (value && value > 0n) {
        txParams.value = `0x${value.toString(16)}`;
      }
      
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
      
      toast.success('Transaction submitted', { description: `Hash: ${txHash.slice(0, 10)}...` });
      
      // Wait for confirmation
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        receipt = await ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        if (receipt) break;
      }
      
      if (receipt?.status === '0x1') {
        toast.success('Transaction confirmed');
        invalidateConfigCache();
        await fetchContractConfig(true);
        return true;
      } else {
        toast.error('Transaction failed');
        return false;
      }
    } catch (error: any) {
      if (error?.code === 4001) {
        toast.error('Transaction rejected');
      } else {
        toast.error(error?.message?.slice(0, 100) || 'Transaction failed');
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAddress, invalidateConfigCache, fetchContractConfig]);

  // ============ APPROVE USDC FOR DEPOSIT ============
  const approveUSDCDeposit = useCallback(async (amount: bigint): Promise<boolean> => {
    if (!window.ethereum) return false;
    
    try {
      const ethereum = window.ethereum as any;
      
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [NFT_CONTRACT_ADDRESS, maxUint256],
      });
      
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: BASE_USDC_ADDRESS,
          data,
        }],
      });
      
      // Wait for confirmation
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        receipt = await ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        if (receipt) break;
      }
      
      return receipt?.status === '0x1';
    } catch {
      return false;
    }
  }, [walletAddress]);

  if (!userIsOwner) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Access Denied
          </CardTitle>
          <CardDescription>
            Only the contract owner can access admin functions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Admin Panel
        </h2>
        <Button variant="outline" size="sm" onClick={() => fetchContractConfig(true)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="minting">Minting</TabsTrigger>
          <TabsTrigger value="bonus">Bonus Pool</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        {/* ============ OVERVIEW TAB ============ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Supply</CardDescription>
                <CardTitle>{config?.totalSupply?.toString() || '0'}</CardTitle>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Minting</CardDescription>
                <CardTitle>
                  <Badge variant={config?.mintEnabled ? 'default' : 'destructive'}>
                    {config?.mintEnabled ? 'Enabled' : 'Paused'}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Claiming</CardDescription>
                <CardTitle>
                  <Badge variant={config?.claimEnabled ? 'default' : 'destructive'}>
                    {config?.claimEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Currency</CardDescription>
                <CardTitle>{config?.activeMintCurrency || 'ETH'}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Bonus Pool Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>ETH Balance</Label>
                <p className="text-2xl font-bold">
                  {config ? formatEther(config.bonusPoolETH) : '0'} ETH
                </p>
              </div>
              <div>
                <Label>USDC Balance</Label>
                <p className="text-2xl font-bold">
                  ${config ? formatUnits(config.bonusPoolUSDC, USDC_DECIMALS) : '0'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ============ MINTING TAB ============ */}
        <TabsContent value="minting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Minting Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Minting Enabled</Label>
                <Switch
                  checked={config?.mintEnabled}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => sendAdminTx('pauseMinting', [!checked])}
                />
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ETH Mint Price</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={config ? formatEther(config.mintPriceETH) : '0'}
                      value={mintPriceETH}
                      onChange={(e) => setMintPriceETH(e.target.value)}
                    />
                    <Button
                      disabled={isSubmitting || !mintPriceETH}
                      onClick={() => sendAdminTx('setMintPriceETH', [parseEther(mintPriceETH)])}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>USDC Mint Price</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={config ? formatUnits(config.mintPriceUSDC, USDC_DECIMALS) : '0'}
                      value={mintPriceUSDC}
                      onChange={(e) => setMintPriceUSDC(e.target.value)}
                    />
                    <Button
                      disabled={isSubmitting || !mintPriceUSDC}
                      onClick={() => sendAdminTx('setMintPriceUSDC', [parseUnits(mintPriceUSDC, USDC_DECIMALS)])}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                    </Button>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Active Mint Currency</Label>
                <Select
                  value={config?.activeMintCurrency || 'ETH'}
                  onValueChange={(value) => sendAdminTx('setActiveMintCurrency', [value === 'USDC' ? 1 : 0])}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ============ BONUS POOL TAB ============ */}
        <TabsContent value="bonus" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Deposit Bonus Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deposit ETH</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="0.1"
                      value={depositETH}
                      onChange={(e) => setDepositETH(e.target.value)}
                    />
                    <Button
                      disabled={isSubmitting || !depositETH}
                      onClick={() => sendAdminTx('depositBonusFundsETH', [], parseEther(depositETH))}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Deposit USDC</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="100"
                      value={depositUSDC}
                      onChange={(e) => setDepositUSDC(e.target.value)}
                    />
                    <Button
                      disabled={isSubmitting || !depositUSDC}
                      onClick={async () => {
                        const amount = parseUnits(depositUSDC, USDC_DECIMALS);
                        toast.info('Approving USDC...');
                        const approved = await approveUSDCDeposit(amount);
                        if (approved) {
                          await sendAdminTx('depositBonusFundsUSDC', [amount]);
                        } else {
                          toast.error('USDC approval failed');
                        }
                      }}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
                    </Button>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Withdraw ETH</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="0.1"
                      value={withdrawETH}
                      onChange={(e) => setWithdrawETH(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={isSubmitting || !withdrawETH}
                      onClick={() => sendAdminTx('withdrawBonusFundsETH', [parseEther(withdrawETH)])}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw'}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Withdraw USDC</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="100"
                      value={withdrawUSDC}
                      onChange={(e) => setWithdrawUSDC(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={isSubmitting || !withdrawUSDC}
                      onClick={() => sendAdminTx('withdrawBonusFundsUSDC', [parseUnits(withdrawUSDC, USDC_DECIMALS)])}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Configure Bonus Level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bonusLevel}
                    onChange={(e) => setBonusLevel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ETH Amount</Label>
                  <Input
                    placeholder="0.01"
                    value={bonusAmountETH}
                    onChange={(e) => setBonusAmountETH(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>USDC Amount</Label>
                  <Input
                    placeholder="10"
                    value={bonusAmountUSDC}
                    onChange={(e) => setBonusAmountUSDC(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Claims Available</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bonusClaims}
                    onChange={(e) => setBonusClaims(e.target.value)}
                  />
                </div>
              </div>
              
              <Button
                className="w-full"
                disabled={isSubmitting || !bonusAmountETH || !bonusAmountUSDC}
                onClick={() => sendAdminTx('configureBonusLevel', [
                  BigInt(bonusLevel),
                  parseEther(bonusAmountETH || '0'),
                  parseUnits(bonusAmountUSDC || '0', USDC_DECIMALS),
                  true, // active
                  BigInt(bonusClaims),
                  false, // requiresNFT
                ])}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Configure Level {bonusLevel}
              </Button>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <Label>Claiming Enabled</Label>
                <Switch
                  checked={config?.claimEnabled}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => sendAdminTx('setClaimMode', [checked ? ClaimModeEnum.UNLIMITED : ClaimModeEnum.DISABLED])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ============ SECURITY TAB ============ */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Anti-Bot Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Anti-Bot Mode</Label>
                <Select
                  value={config?.antiBotMode?.toString() || '2'}
                  onValueChange={(value) => sendAdminTx('setAntiBotMode', [parseInt(value)])}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Disabled</SelectItem>
                    <SelectItem value="1">Soft</SelectItem>
                    <SelectItem value="2">Moderate</SelectItem>
                    <SelectItem value="3">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Signature Required</Label>
                <Switch
                  checked={config?.signatureRequired}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => sendAdminTx('setSignatureRequired', [checked])}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Wallet Mint Limit</Label>
                  <p className="font-mono">{config?.walletMintLimit?.toString() || '10'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cooldown Blocks</Label>
                  <p className="font-mono">{config?.mintCooldownBlocks?.toString() || '2'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Emergency Actions
              </CardTitle>
              <CardDescription>
                These actions are irreversible. Use with caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="destructive"
                disabled={isSubmitting}
                onClick={() => {
                  if (window.confirm('Are you sure you want to withdraw ALL contract funds?')) {
                    sendAdminTx('emergencyWithdrawAll', []);
                  }
                }}
              >
                Emergency Withdraw All
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
