import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Loader2, 
  AlertCircle,
  RefreshCw,
  Wallet,
  Network,
  Shield,
  FileCode,
  Crown,
} from 'lucide-react';
import { AdminInitState } from '@/hooks/useAdminState';

interface AdminLoadingStateProps {
  initState: AdminInitState;
  error: string | null;
  onRetry: () => void;
  onClose?: () => void;
}

const STATE_MESSAGES: Record<AdminInitState, { title: string; description: string; icon: typeof Loader2 }> = {
  idle: {
    title: 'Initializing...',
    description: 'Preparing admin panel',
    icon: Loader2,
  },
  'checking-wallet': {
    title: 'Checking Wallet',
    description: 'Verifying wallet connection',
    icon: Wallet,
  },
  'checking-network': {
    title: 'Checking Network',
    description: 'Verifying Base network connection',
    icon: Network,
  },
  'checking-admin': {
    title: 'Checking Permissions',
    description: 'Verifying admin access',
    icon: Shield,
  },
  'loading-config': {
    title: 'Loading Configuration',
    description: 'Fetching on-chain data',
    icon: FileCode,
  },
  ready: {
    title: 'Ready',
    description: 'Admin panel loaded',
    icon: Crown,
  },
  error: {
    title: 'Error',
    description: 'Something went wrong',
    icon: AlertCircle,
  },
};

export function AdminLoadingState({ 
  initState, 
  error, 
  onRetry,
  onClose,
}: AdminLoadingStateProps) {
  const stateInfo = STATE_MESSAGES[initState] || STATE_MESSAGES.idle;
  const Icon = stateInfo.icon;
  const isError = initState === 'error';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-amber-950/5 to-background">
      <Card className={`max-w-md w-full ${isError ? 'border-destructive/50' : 'border-amber-500/30'}`}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon */}
          <div className={`
            w-16 h-16 mx-auto rounded-full flex items-center justify-center
            ${isError 
              ? 'bg-destructive/10' 
              : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
            }
          `}>
            <Icon className={`
              h-8 w-8
              ${isError 
                ? 'text-destructive' 
                : 'text-amber-500 animate-spin'
              }
            `} style={{ animationDuration: isError ? '0s' : '2s' }} />
          </div>

          {/* Title */}
          <div>
            <h2 className={`text-xl font-bold mb-1 ${isError ? 'text-destructive' : 'text-foreground'}`}>
              {stateInfo.title}
            </h2>
            <p className="text-muted-foreground">
              {error || stateInfo.description}
            </p>
          </div>

          {/* Progress Steps */}
          {!isError && (
            <div className="space-y-2">
              {(['checking-wallet', 'checking-network', 'checking-admin', 'loading-config'] as AdminInitState[]).map((step, index) => {
                const stepInfo = STATE_MESSAGES[step];
                const currentIndex = ['idle', 'checking-wallet', 'checking-network', 'checking-admin', 'loading-config'].indexOf(initState);
                const stepIndex = index + 1;
                const isComplete = stepIndex < currentIndex;
                const isCurrent = step === initState;

                return (
                  <div 
                    key={step}
                    className={`
                      flex items-center gap-3 px-4 py-2 rounded-lg text-sm
                      ${isComplete ? 'text-emerald-500' : isCurrent ? 'text-amber-500' : 'text-muted-foreground'}
                    `}
                  >
                    {isComplete ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-muted" />
                    )}
                    {stepInfo.description}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading Skeleton */}
          {!isError && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
            </div>
          )}

          {/* Error Actions */}
          {isError && (
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={onRetry}
                className="border-amber-500/30 hover:border-amber-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              {onClose && (
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
