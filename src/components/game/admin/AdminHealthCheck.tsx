import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Wallet,
  Network,
  Shield,
  FileCode,
  Database,
  Loader2,
} from 'lucide-react';
import { AdminHealthStatus } from '@/hooks/useAdminState';

interface AdminHealthCheckProps {
  healthStatus: AdminHealthStatus;
  onRunCheck: () => Promise<AdminHealthStatus>;
  isLoading?: boolean;
}

interface HealthItem {
  label: string;
  status: boolean;
  icon: typeof CheckCircle2;
  description: string;
}

export function AdminHealthCheck({ 
  healthStatus, 
  onRunCheck,
  isLoading = false,
}: AdminHealthCheckProps) {
  const [isChecking, setIsChecking] = useState(false);

  const handleRunCheck = async () => {
    setIsChecking(true);
    try {
      await onRunCheck();
    } finally {
      setIsChecking(false);
    }
  };

  const healthItems: HealthItem[] = [
    {
      label: 'Wallet Connected',
      status: healthStatus.walletConnected,
      icon: Wallet,
      description: 'Ethereum wallet is connected',
    },
    {
      label: 'Network (Base)',
      status: healthStatus.networkCorrect,
      icon: Network,
      description: 'Connected to Base mainnet',
    },
    {
      label: 'Admin Access',
      status: healthStatus.isAdmin,
      icon: Shield,
      description: 'Wallet has owner permissions',
    },
    {
      label: 'Contract Reachable',
      status: healthStatus.contractReachable,
      icon: FileCode,
      description: 'Contract responds to RPC calls',
    },
    {
      label: 'Config Loaded',
      status: healthStatus.configLoaded,
      icon: Database,
      description: 'Contract configuration loaded',
    },
    {
      label: 'ABI Valid',
      status: healthStatus.abiFunctionsPresent,
      icon: FileCode,
      description: 'All ABI functions available',
    },
  ];

  const allHealthy = healthItems.every(item => item.status);
  const criticalIssues = healthItems.filter(item => !item.status);
  const lastCheckTime = healthStatus.lastCheck 
    ? new Date(healthStatus.lastCheck).toLocaleTimeString()
    : 'Never';

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {allHealthy ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            )}
            System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Last: {lastCheckTime}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRunCheck}
              disabled={isChecking || isLoading}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Overall Status */}
        <div className="mb-4">
          <Badge 
            variant={allHealthy ? "default" : "destructive"}
            className={allHealthy 
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
              : "bg-destructive/20"
            }
          >
            {allHealthy ? 'All Systems Operational' : `${criticalIssues.length} Issue(s) Detected`}
          </Badge>
        </div>

        {/* Health Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {healthItems.map((item) => (
            <div 
              key={item.label}
              className={`
                flex items-center gap-2 p-2 rounded-lg text-sm
                ${item.status 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-destructive/10 text-destructive'
                }
              `}
              title={item.description}
            >
              {item.status ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Issues List */}
        {criticalIssues.length > 0 && (
          <div className="mt-4 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
            <p className="text-sm font-medium text-destructive mb-2">Issues to resolve:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {criticalIssues.map((issue) => (
                <li key={issue.label} className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {issue.label}: {issue.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
