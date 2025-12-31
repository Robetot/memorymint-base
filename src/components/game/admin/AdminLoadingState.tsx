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
  Database,
} from 'lucide-react';
import type { AdminAuthPhase, AdminInitState } from '@/hooks/useAdminState';

interface AdminLoadingStateProps {
  initState: AdminInitState;
  authPhase: AdminAuthPhase | null;
  error: string | null;
  onRetry: () => void;
  onClose?: () => void;
}

type UiStep = 'wallet' | 'network' | 'admin' | 'contract' | 'data';

function getCurrentStep(initState: AdminInitState, authPhase: AdminAuthPhase | null): UiStep {
  if (initState === 'loadingAuth') {
    if (authPhase === 'verifyingNetwork') return 'network';
    if (authPhase === 'verifyingAdmin') return 'admin';
    return 'wallet';
  }
  if (initState === 'loadingContract') return 'contract';
  if (initState === 'loadingAdminData') return 'data';
  return 'data';
}

const STEP_ORDER: UiStep[] = ['wallet', 'network', 'admin', 'contract', 'data'];

const STEP_META: Record<UiStep, { title: string; description: string; icon: typeof Loader2 }> = {
  wallet: {
    title: 'Connecting Wallet',
    description: 'Connecting wallet…',
    icon: Wallet,
  },
  network: {
    title: 'Verifying Network',
    description: 'Verifying Base network…',
    icon: Network,
  },
  admin: {
    title: 'Verifying Admin Access',
    description: 'Verifying admin access…',
    icon: Shield,
  },
  contract: {
    title: 'Loading Configuration',
    description: 'Loading admin configuration…',
    icon: FileCode,
  },
  data: {
    title: 'Loading Admin Data',
    description: 'Fetching admin data…',
    icon: Database,
  },
};

export function AdminLoadingState({
  initState,
  authPhase,
  error,
  onRetry,
  onClose,
}: AdminLoadingStateProps) {
  const isError = initState === 'error';
  const currentStep = getCurrentStep(initState, authPhase);
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const header = isError
    ? { title: 'Admin panel failed to load', description: error || 'Retry to continue', icon: AlertCircle }
    : { ...STEP_META[currentStep], description: STEP_META[currentStep].description };

  const Icon = header.icon;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted/30 to-background">
      <Card className={`max-w-md w-full ${isError ? 'border-destructive/50' : 'border-border/60'}`}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon */}
          <div
            className={`
              w-16 h-16 mx-auto rounded-full flex items-center justify-center
              ${isError ? 'bg-destructive/10' : 'bg-muted'}
            `}
          >
            <Icon
              className={`h-8 w-8 ${isError ? 'text-destructive' : 'text-muted-foreground animate-spin'}`}
              style={{ animationDuration: isError ? '0s' : '2s' }}
              aria-hidden="true"
            />
          </div>

          {/* Title */}
          <div>
            <h2 className={`text-xl font-bold mb-1 ${isError ? 'text-destructive' : 'text-foreground'}`}>
              {header.title}
            </h2>
            <p className="text-muted-foreground">{header.description}</p>
          </div>

          {/* Progress Steps */}
          {!isError && (
            <div className="space-y-2">
              {STEP_ORDER.map((step, idx) => {
                const stepInfo = STEP_META[step];
                const isComplete = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={step}
                    className={`
                      flex items-center gap-3 px-4 py-2 rounded-lg text-sm
                      ${isComplete ? 'text-foreground' : isCurrent ? 'text-foreground' : 'text-muted-foreground'}
                      ${isCurrent ? 'bg-muted/60' : ''}
                    `}
                  >
                    {isComplete ? (
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
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
