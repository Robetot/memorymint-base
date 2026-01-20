import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ConfigWarningBannerProps {
  show: boolean;
  message?: string;
  severity?: 'warning' | 'info';
  onRetry?: () => void;
  isRetrying?: boolean;
}

/**
 * Fail-open warning banner for when contract status reads fail.
 * Shows user-friendly messaging instead of technical errors.
 * The contract itself enforces all rules - frontend warnings are informational only.
 */
export function ConfigWarningBanner({ 
  show, 
  message,
  severity = 'warning',
  onRetry,
  isRetrying = false
}: ConfigWarningBannerProps) {
  if (!show) return null;

  const isWarning = severity === 'warning';
  const Icon = isWarning ? AlertTriangle : Info;

  // Use semantic tokens for styling
  const containerClass = isWarning 
    ? 'bg-muted/50 border-border' 
    : 'bg-muted/30 border-border';
  
  const iconClass = isWarning ? 'text-amber-500' : 'text-primary';

  // User-friendly default message (hide technical details)
  const displayMessage = message || 'Network temporarily unstable. Minting should still work – the contract enforces all rules.';

  return (
    <Alert className={`${containerClass} mb-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 ${iconClass} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-foreground text-sm font-medium">
            {isWarning ? 'Network Unstable' : 'Note'}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground text-sm mt-1">
            {displayMessage}
          </AlertDescription>
        </div>
        {onRetry && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRetry}
            disabled={isRetrying}
            className="shrink-0"
          >
            {isRetrying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Retry'
            )}
          </Button>
        )}
      </div>
    </Alert>
  );
}
