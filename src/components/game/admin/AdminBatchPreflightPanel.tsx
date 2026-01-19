/**
 * AdminBatchPreflightPanel
 * 
 * Allows admins to input multiple tokenURIs for batch mint simulation.
 * Navigate through each URI and see pre-flight diagnostics.
 */

import { useState, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  RefreshCw, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Layers,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MintPreflightPanel, PreflightDiagnostics } from '../MintPreflightPanel';
import { useMintPreflight } from '@/hooks/useMintPreflight';

interface AdminBatchPreflightPanelProps {
  walletAddress: string;
  isConnected: boolean;
  chainId?: string | number | null;
  className?: string;
}

export function AdminBatchPreflightPanel({
  walletAddress,
  isConnected,
  chainId,
  className,
}: AdminBatchPreflightPanelProps) {
  const [tokenURIs, setTokenURIs] = useState<string[]>(['']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [simulationResults, setSimulationResults] = useState<Map<number, PreflightDiagnostics>>(new Map());

  // Use preflight hook for current URI
  const { 
    diagnostics, 
    isRefreshing, 
    refresh,
    contractState,
  } = useMintPreflight({
    address: walletAddress,
    isConnected,
    chainId,
    tokenURI: tokenURIs[currentIndex] || undefined,
    autoRefresh: false,
  });

  // Save result when diagnostics update
  const saveCurrentResult = useCallback(() => {
    if (diagnostics && tokenURIs[currentIndex]) {
      setSimulationResults(prev => new Map(prev).set(currentIndex, diagnostics));
    }
  }, [diagnostics, currentIndex, tokenURIs]);

  // Add new URI
  const addURI = () => {
    setTokenURIs(prev => [...prev, '']);
    setCurrentIndex(tokenURIs.length);
  };

  // Remove URI
  const removeURI = (index: number) => {
    if (tokenURIs.length <= 1) return;
    setTokenURIs(prev => prev.filter((_, i) => i !== index));
    if (currentIndex >= tokenURIs.length - 1) {
      setCurrentIndex(Math.max(0, tokenURIs.length - 2));
    }
    setSimulationResults(prev => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  };

  // Update URI
  const updateURI = (index: number, value: string) => {
    setTokenURIs(prev => prev.map((uri, i) => i === index ? value : uri));
    // Clear cached result when URI changes
    setSimulationResults(prev => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  };

  // Parse bulk input
  const parseBulkInput = () => {
    const uris = bulkInput
      .split(/[\n,]/)
      .map(uri => uri.trim())
      .filter(uri => uri.length > 0);
    
    if (uris.length > 0) {
      setTokenURIs(uris);
      setCurrentIndex(0);
      setSimulationResults(new Map());
      setBulkInput('');
      setShowBulkInput(false);
    }
  };

  // Navigate
  const goToPrev = () => {
    saveCurrentResult();
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    saveCurrentResult();
    setCurrentIndex(prev => Math.min(tokenURIs.length - 1, prev + 1));
  };

  // Run simulation for current
  const runSimulation = async () => {
    await refresh();
    if (diagnostics) {
      setSimulationResults(prev => new Map(prev).set(currentIndex, diagnostics));
    }
  };

  // Run all simulations
  const runAllSimulations = async () => {
    for (let i = 0; i < tokenURIs.length; i++) {
      setCurrentIndex(i);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for state update
      await refresh();
    }
  };

  // Get status for URI
  const getURIStatus = (index: number): 'pending' | 'pass' | 'fail' | 'warn' => {
    const result = simulationResults.get(index);
    if (!result) return 'pending';
    if (result.blockers.length > 0) return 'fail';
    if (result.warnings.length > 0) return 'warn';
    return 'pass';
  };

  const passCount = Array.from(simulationResults.values()).filter(r => r.blockers.length === 0).length;
  const failCount = Array.from(simulationResults.values()).filter(r => r.blockers.length > 0).length;

  return (
    <Card className={cn("border-amber-500/30 bg-gradient-to-br from-background to-amber-950/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            Batch Mint Simulation
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {tokenURIs.filter(u => u.trim()).length} URIs
            </Badge>
            {simulationResults.size > 0 && (
              <>
                <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                  {passCount} Pass
                </Badge>
                {failCount > 0 && (
                  <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
                    {failCount} Fail
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bulk Input Toggle */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkInput(!showBulkInput)}
            className="text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            {showBulkInput ? 'Single Entry' : 'Bulk Import'}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runAllSimulations}
              disabled={isRefreshing || tokenURIs.every(u => !u.trim())}
              className="text-xs"
            >
              <Play className="h-3 w-3 mr-1" />
              Simulate All
            </Button>
          </div>
        </div>

        {/* Bulk Input Area */}
        {showBulkInput && (
          <div className="space-y-2 p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
            <p className="text-xs text-muted-foreground">
              Paste multiple IPFS URIs (one per line or comma-separated)
            </p>
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="ipfs://QmXxx...&#10;ipfs://QmYyy...&#10;ipfs://QmZzz..."
              className="min-h-[100px] text-xs font-mono"
            />
            <Button 
              size="sm" 
              onClick={parseBulkInput}
              disabled={!bulkInput.trim()}
            >
              Import URIs
            </Button>
          </div>
        )}

        {/* Single URI Editor */}
        {!showBulkInput && (
          <>
            {/* URI List Thumbnails */}
            <div className="flex flex-wrap gap-1">
              {tokenURIs.map((uri, index) => {
                const status = getURIStatus(index);
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "w-8 h-8 rounded text-xs font-mono flex items-center justify-center transition-all",
                      index === currentIndex 
                        ? "bg-amber-500 text-white ring-2 ring-amber-500/50" 
                        : "bg-muted hover:bg-muted/80",
                      status === 'pass' && index !== currentIndex && "border-2 border-green-500",
                      status === 'fail' && index !== currentIndex && "border-2 border-destructive",
                      status === 'warn' && index !== currentIndex && "border-2 border-yellow-500"
                    )}
                  >
                    {index + 1}
                  </button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={addURI}
                className="w-8 h-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Current URI Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  URI #{currentIndex + 1} of {tokenURIs.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPrev}
                    disabled={currentIndex === 0}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNext}
                    disabled={currentIndex >= tokenURIs.length - 1}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={tokenURIs[currentIndex] || ''}
                  onChange={(e) => updateURI(currentIndex, e.target.value)}
                  placeholder="ipfs://Qm..."
                  className="font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeURI(currentIndex)}
                  disabled={tokenURIs.length <= 1}
                  className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Simulate Button */}
              <Button
                onClick={runSimulation}
                disabled={isRefreshing || !tokenURIs[currentIndex]?.trim()}
                className="w-full"
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Simulate Mint
              </Button>
            </div>
          </>
        )}

        <Separator />

        {/* Pre-flight Results */}
        {diagnostics && (
          <MintPreflightPanel
            diagnostics={diagnostics}
            onRefresh={refresh}
            isRefreshing={isRefreshing}
            compact={false}
          />
        )}

        {/* Contract State Summary */}
        {contractState && (
          <div className="p-3 rounded-lg bg-muted/30 text-xs space-y-1">
            <div className="font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Contract State
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mint Active</span>
                <span className={contractState.isMintActive ? 'text-green-500' : 'text-destructive'}>
                  {contractState.isMintActive ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Free Mint</span>
                <span>{contractState.isFreeMint ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kill Switch</span>
                <span className={contractState.isKillSwitchActive ? 'text-destructive' : 'text-green-500'}>
                  {contractState.isKillSwitchActive ? 'Active' : 'Off'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Minted</span>
                <span className="font-mono">{contractState.totalMinted.toString()}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminBatchPreflightPanel;
