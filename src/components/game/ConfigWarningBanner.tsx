import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConfigWarningBannerProps {
  show: boolean;
}

export function ConfigWarningBanner({ show }: ConfigWarningBannerProps) {
  if (!show) return null;

  return (
    <Alert className="bg-amber-500/10 border-amber-500/30 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-amber-200 text-sm">
        Contract status unavailable. Minting may still work - the contract will enforce its rules.
      </AlertDescription>
    </Alert>
  );
}
