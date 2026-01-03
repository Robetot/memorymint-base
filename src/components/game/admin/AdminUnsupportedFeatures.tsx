import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';
import { UnsupportedFeature, getUnsupportedFeatures, ContractCapabilities } from './types';

interface AdminUnsupportedFeaturesProps {
  capabilities: ContractCapabilities;
}

export function AdminUnsupportedFeatures({ capabilities }: AdminUnsupportedFeaturesProps) {
  const unsupportedFeatures = getUnsupportedFeatures(capabilities);

  if (unsupportedFeatures.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Unsupported Features
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-3">
          The following features are not available in this contract deployment:
        </p>
        <div className="space-y-2">
          {unsupportedFeatures.map((feature) => (
            <div 
              key={feature.name}
              className="flex items-start gap-2 p-2 bg-background/50 rounded-lg"
            >
              <XCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{feature.name}</span>
                  {feature.missingFunctions.slice(0, 2).map((fn) => (
                    <Badge 
                      key={fn} 
                      variant="outline" 
                      className="text-[10px] py-0 px-1 font-mono"
                    >
                      {fn}()
                    </Badge>
                  ))}
                  {feature.missingFunctions.length > 2 && (
                    <Badge 
                      variant="outline" 
                      className="text-[10px] py-0 px-1"
                    >
                      +{feature.missingFunctions.length - 2}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {feature.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-start gap-2 mt-3 p-2 bg-primary/5 rounded-lg">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            This contract (MemoryMintUltra) is optimized for free minting. 
            Advanced features require a different contract deployment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
