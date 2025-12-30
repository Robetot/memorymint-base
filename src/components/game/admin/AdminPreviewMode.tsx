import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye, AlertCircle } from 'lucide-react';

interface AdminPreviewModeProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AdminPreviewMode({ isEnabled, onToggle }: AdminPreviewModeProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Preview Mode
        </h3>
      </div>

      <Card className={`border-border/50 ${isEnabled ? 'border-secondary bg-secondary/5' : ''}`}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Preview Player View</Label>
              <p className="text-sm text-muted-foreground">
                See the game as a player would
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={onToggle}
            />
          </div>

          {isEnabled && (
            <div className="flex items-start gap-3 p-3 bg-secondary/10 rounded-lg border border-secondary/30">
              <AlertCircle className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-secondary">Preview mode active</p>
                <p className="text-muted-foreground">
                  All transaction buttons are disabled. No on-chain changes can be made while in preview mode.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
