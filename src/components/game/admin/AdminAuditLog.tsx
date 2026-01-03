import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History,
  Trash2,
  ExternalLink,
  Clock,
  Wallet,
} from 'lucide-react';
import { AdminAction, ADMIN_STORAGE_KEYS } from './types';

interface AdminAuditLogProps {
  walletAddress: string;
}

export function AdminAuditLog({ walletAddress }: AdminAuditLogProps) {
  const [actions, setActions] = useState<AdminAction[]>([]);

  // Load actions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEYS.auditLog);
      if (stored) {
        const parsed = JSON.parse(stored) as AdminAction[];
        setActions(parsed.slice(0, 50)); // Keep last 50 actions
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const clearLog = () => {
    setActions([]);
    localStorage.removeItem(ADMIN_STORAGE_KEYS.auditLog);
  };

  const formatAddress = (addr: string) => 
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string): string => {
    if (action.includes('Pause') || action.includes('Stop') || action.includes('Kill')) {
      return 'text-destructive';
    }
    if (action.includes('Deposit') || action.includes('Enable')) {
      return 'text-emerald-600 dark:text-emerald-400';
    }
    if (action.includes('Withdraw')) {
      return 'text-amber-600 dark:text-amber-400';
    }
    return 'text-foreground';
  };

  if (actions.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Admin Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No actions recorded yet</p>
            <p className="text-xs mt-1">Admin actions will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Admin Audit Log
            <Badge variant="secondary" className="text-xs">
              {actions.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLog}
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          <div className="px-4 pb-4 space-y-2">
            {actions.map((action) => (
              <div 
                key={action.id}
                className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${getActionColor(action.action)}`}>
                      {action.action}
                    </span>
                    {action.txHash && (
                      <a
                        href={`https://basescan.org/tx/${action.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {action.details && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {action.details}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(action.timestamp)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {formatAddress(action.wallet)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Helper function to log admin actions
export function logAdminAction(
  action: string,
  wallet: string,
  details?: string,
  txHash?: string
): void {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEYS.auditLog);
    const existing: AdminAction[] = stored ? JSON.parse(stored) : [];
    
    const newAction: AdminAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      wallet,
      action,
      details,
      txHash,
    };
    
    const updated = [newAction, ...existing].slice(0, 100);
    localStorage.setItem(ADMIN_STORAGE_KEYS.auditLog, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}
