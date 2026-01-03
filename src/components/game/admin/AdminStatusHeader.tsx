import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  FileCode,
  Database,
} from 'lucide-react';
import { BASE_CHAIN_ID_NUM } from '@/contracts/MemoryMintContract';
import { ContractCapabilities, detectContractCapabilities } from './types';

interface AdminStatusHeaderProps {
  walletAddress: string;
  isOwner: boolean;
  contractReachable: boolean;
  configLoaded: boolean;
  networkCorrect: boolean;
  loadTimeMs?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

interface StatusItem {
  id: string;
  label: string;
  status: boolean;
  icon: typeof CheckCircle2;
}

export function AdminStatusHeader({
  walletAddress,
  isOwner,
  contractReachable,
  configLoaded,
  networkCorrect,
  loadTimeMs,
  onRefresh,
  isRefreshing = false,
}: AdminStatusHeaderProps) {
  const [capabilities, setCapabilities] = useState<ContractCapabilities | null>(null);
  const [abiMatch, setAbiMatch] = useState(true);

  useEffect(() => {
    const caps = detectContractCapabilities();
    setCapabilities(caps);
    // Check if essential functions exist
    setAbiMatch(caps.hasOwner && caps.hasTotalSupply);
  }, []);

  const statusItems: StatusItem[] = [
    {
      id: 'contract',
      label: 'Contract',
      status: contractReachable,
      icon: contractReachable ? Wifi : WifiOff,
    },
    {
      id: 'network',
      label: `Base (${BASE_CHAIN_ID_NUM})`,
      status: networkCorrect,
      icon: networkCorrect ? CheckCircle2 : XCircle,
    },
    {
      id: 'abi',
      label: 'ABI',
      status: abiMatch,
      icon: abiMatch ? FileCode : AlertCircle,
    },
    {
      id: 'config',
      label: 'Config',
      status: configLoaded,
      icon: configLoaded ? Database : XCircle,
    },
    {
      id: 'owner',
      label: 'Owner',
      status: isOwner,
      icon: isOwner ? Shield : XCircle,
    },
  ];

  const allHealthy = statusItems.every(item => item.status);

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-3">
      {/* Status Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Overall Status Indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
          allHealthy 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}>
          {allHealthy ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          <span>{allHealthy ? 'Healthy' : 'Issues'}</span>
        </div>

        {/* Individual Status Badges */}
        <div className="flex flex-wrap gap-1.5">
          {statusItems.map((item) => (
            <Badge
              key={item.id}
              variant="outline"
              className={`text-xs py-0.5 ${
                item.status
                  ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-destructive/5 text-destructive border-destructive/20'
              }`}
            >
              <item.icon className="h-3 w-3 mr-1" />
              {item.label}
              {item.status ? ' ✓' : ' ✗'}
            </Badge>
          ))}
        </div>

        {/* Load Time */}
        {loadTimeMs !== undefined && (
          <Badge variant="secondary" className="text-xs py-0.5 ml-auto">
            <Clock className="h-3 w-3 mr-1" />
            {loadTimeMs}ms
          </Badge>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {/* Wrong Network Warning */}
      {!networkCorrect && (
        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            <span className="font-medium">Wrong Network</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Please connect to Base Mainnet (Chain ID: {BASE_CHAIN_ID_NUM})
          </p>
        </div>
      )}

      {/* Not Owner Warning */}
      {networkCorrect && !isOwner && walletAddress && (
        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Shield className="h-4 w-4" />
            <span className="font-medium">Not Contract Owner</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Connected wallet does not have admin permissions
          </p>
        </div>
      )}
    </div>
  );
}
