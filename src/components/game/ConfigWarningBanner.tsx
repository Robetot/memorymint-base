import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ConfigWarningBannerProps {
  show: boolean;
  message?: string;
  severity?: 'warning' | 'info';
}

/**
 * Fail-open warning banner for when contract status reads fail.
 * Shown when edge functions or RPC calls fail but minting should still be attempted.
 * The contract itself enforces all rules - frontend warnings are informational only.
 */
export function ConfigWarningBanner({ 
  show, 
  message,
  severity = 'warning' 
}: ConfigWarningBannerProps) {
  if (!show) return null;

  const isWarning = severity === 'warning';
  const Icon = isWarning ? AlertTriangle : Info;
  const bgClass = isWarning ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30';
  const iconClass = isWarning ? 'text-amber-500' : 'text-blue-500';
  const textClass = isWarning ? 'text-amber-200' : 'text-blue-200';

  return (
    <Alert className={`${bgClass} mb-4`}>
      <Icon className={`h-4 w-4 ${iconClass}`} />
      <AlertTitle className={`${textClass} text-sm font-medium`}>
        {isWarning ? 'Status Check Unavailable' : 'Note'}
      </AlertTitle>
      <AlertDescription className={`${textClass} text-sm mt-1`}>
        {message || 'Contract status unavailable. Minting may still work – the contract will enforce its rules.'}
      </AlertDescription>
    </Alert>
  );
}
