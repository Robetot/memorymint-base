import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Activity, Clock, RefreshCw, AlertTriangle, CheckCircle, XCircle, Zap, Server, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProviderStatus {
  name: string;
  status: 'online' | 'offline' | 'slow' | 'unknown';
  responseTime?: number;
  lastChecked?: number;
  error?: string;
}

interface DiagnosticData {
  providers: ProviderStatus[];
  lastUploadError?: string;
  retryCount: number;
  activeProvider?: string;
  queuedUploads: number;
}

const IPFS_GATEWAYS = [
  { name: 'Pinata', url: 'https://api.pinata.cloud/health' },
  { name: 'ipfs.io', url: 'https://ipfs.io/api/v0/version' },
  { name: 'Cloudflare', url: 'https://cloudflare-ipfs.com/api/v0/version' },
  { name: 'dweb.link', url: 'https://dweb.link/api/v0/version' },
];

/**
 * Developer-only diagnostic panel for IPFS/upload health monitoring.
 * Shows provider status, retry counts, queue state, and gateway response times.
 */
export function IPFSDiagnosticPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({
    providers: IPFS_GATEWAYS.map(g => ({ name: g.name, status: 'unknown' as const })),
    retryCount: 0,
    queuedUploads: 0,
  });

  // Check gateway health
  const checkGatewayHealth = async () => {
    setIsChecking(true);
    const results: ProviderStatus[] = [];

    for (const gateway of IPFS_GATEWAYS) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(gateway.url, { 
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // CORS may block, but we can detect connectivity
        });
        
        clearTimeout(timeout);
        const responseTime = Date.now() - start;
        
        results.push({
          name: gateway.name,
          status: responseTime > 3000 ? 'slow' : 'online',
          responseTime,
          lastChecked: Date.now(),
        });
      } catch (e) {
        results.push({
          name: gateway.name,
          status: 'offline',
          lastChecked: Date.now(),
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    setDiagnosticData(prev => ({
      ...prev,
      providers: results,
    }));
    setIsChecking(false);
  };

  // Check on expand
  useEffect(() => {
    if (isExpanded) {
      checkGatewayHealth();
    }
  }, [isExpanded]);

  // Load queued uploads count from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('memorymint_pending_uploads');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDiagnosticData(prev => ({
          ...prev,
          queuedUploads: Array.isArray(parsed) ? parsed.filter((p: { status: string }) => p.status === 'pending').length : 0,
        }));
      }
    } catch (e) {
      // Ignore
    }
  }, [isExpanded]);

  const getStatusIcon = (status: ProviderStatus['status']) => {
    switch (status) {
      case 'online': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'slow': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'offline': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ProviderStatus['status']) => {
    switch (status) {
      case 'online': return 'text-success';
      case 'slow': return 'text-amber-500';
      case 'offline': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  // Only show in development
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('preview')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden min-w-[280px]">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">IPFS Diagnostics</span>
            {diagnosticData.queuedUploads > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full">
                {diagnosticData.queuedUploads} queued
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-3 pt-0 border-t border-border/50 space-y-3">
            {/* Provider Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Gateway Status
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={checkGatewayHealth}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              </div>
              <div className="space-y-1.5">
                {diagnosticData.providers.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(provider.status)}
                      <span className="text-foreground">{provider.name}</span>
                    </div>
                    <span className={cn('text-xs font-mono', getStatusColor(provider.status))}>
                      {provider.responseTime ? `${provider.responseTime}ms` : provider.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Queue Status */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Pending Uploads</span>
                </div>
                <span className={cn(
                  'font-mono text-sm',
                  diagnosticData.queuedUploads > 0 ? 'text-amber-500' : 'text-success'
                )}>
                  {diagnosticData.queuedUploads}
                </span>
              </div>
            </div>

            {/* Active Provider */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Active Provider</span>
                </div>
                <span className="text-foreground font-medium">
                  Pinata (primary)
                </span>
              </div>
            </div>

            {/* Last Error */}
            {diagnosticData.lastUploadError && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Last Error:</span>
                    <p className="text-xs text-destructive/80 mt-0.5 break-all">
                      {diagnosticData.lastUploadError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dev Info */}
            <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground/70">
              <p>Press Ctrl+Shift+D to toggle diagnostics</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
