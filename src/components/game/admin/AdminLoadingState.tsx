import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertCircle, RefreshCw, Crown, Shield } from 'lucide-react';
import type { AdminAuthPhase, AdminInitState } from '@/hooks/useAdminState';

interface AdminLoadingStateProps {
  initState: AdminInitState;
  authPhase: AdminAuthPhase;
  error: string | null;
  onRetry: () => void;
  onClose?: () => void;
}

export function AdminLoadingState({
  initState,
  authPhase,
  error,
  onRetry,
  onClose,
}: AdminLoadingStateProps) {
  const isError = initState === 'error';
  const isUnauthorized = error?.includes('Not authorized');
  const isWrongNetwork = error?.includes('Wrong network');

  // Determine icon and colors based on state
  const getIconAndStyle = () => {
    if (isError) {
      if (isUnauthorized) {
        return {
          icon: Shield,
          bgClass: 'bg-amber-500/10',
          iconClass: 'text-amber-500',
        };
      }
      if (isWrongNetwork) {
        return {
          icon: AlertCircle,
          bgClass: 'bg-orange-500/10',
          iconClass: 'text-orange-500',
        };
      }
      return {
        icon: AlertCircle,
        bgClass: 'bg-destructive/10',
        iconClass: 'text-destructive',
      };
    }
    return {
      icon: Crown,
      bgClass: 'bg-amber-500/10',
      iconClass: 'text-amber-500',
    };
  };

  const { icon: Icon, bgClass, iconClass } = getIconAndStyle();

  // Unified loading message with phase-specific text
  const getMessage = () => {
    if (isError) {
      // Show descriptive error for owner detection failures
      if (error?.includes('Owner not detected')) {
        return 'Owner not detected. Check network or proxy.';
      }
      if (error?.includes('Wrong network')) {
        return error;
      }
      return error || 'Failed to load admin panel';
    }
    if (authPhase === 'connecting') {
      return 'Connecting to wallet...';
    }
    if (authPhase === 'verifying') {
      return 'Verifying network and fetching contract owner (up to 10 attempts)...';
    }
    return 'Loading Admin Panel...';
  };

  const getTitle = () => {
    if (isError) {
      if (isUnauthorized) return 'Access Denied';
      if (isWrongNetwork) return 'Wrong Network';
      return 'Error';
    }
    if (authPhase === 'verifying') return 'Verifying Admin Access';
    return 'Admin Panel';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted/30 to-background">
      <Card className={`max-w-md w-full ${isError ? 'border-destructive/30' : 'border-amber-500/30'}`}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon */}
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${bgClass}`}>
            {isError ? (
              <Icon className={`h-8 w-8 ${iconClass}`} aria-hidden="true" />
            ) : (
              <Loader2
                className={`h-8 w-8 ${iconClass} animate-spin`}
                aria-hidden="true"
              />
            )}
          </div>

          {/* Title & Message */}
          <div>
            <h2 className={`text-xl font-bold mb-2 ${isError ? 'text-foreground' : 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 bg-clip-text text-transparent'}`}>
              {getTitle()}
            </h2>
            <p className="text-muted-foreground text-sm">{getMessage()}</p>
          </div>

          {/* Loading skeleton (only when not error) */}
          {!isError && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4 mx-auto" />
            </div>
          )}

          {/* Error Actions */}
          {isError && (
            <div className="flex gap-3 justify-center pt-2">
              <Button 
                variant="outline" 
                onClick={onRetry}
                className="border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10"
              >
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
