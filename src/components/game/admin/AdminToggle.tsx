import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToggleState = 'on' | 'off' | 'pending' | 'error';

interface AdminToggleProps {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  
  // On-chain state (source of truth)
  isEnabled: boolean;
  
  // Callback for toggle action - must return true on success
  onToggle: (newState: boolean) => Promise<boolean>;
  
  // UI state
  disabled?: boolean;
  isPreviewMode?: boolean;
  isPending?: boolean;
  
  // Visual options
  variant?: 'default' | 'danger' | 'success';
  showStatus?: boolean;
  locked?: boolean;
  
  // Additional content
  children?: React.ReactNode;
}

export function AdminToggle({
  id,
  label,
  description,
  icon,
  isEnabled,
  onToggle,
  disabled = false,
  isPreviewMode = false,
  isPending: externalPending = false,
  variant = 'default',
  showStatus = true,
  locked = false,
  children,
}: AdminToggleProps) {
  // Local state tracks UI until tx confirms
  const [localEnabled, setLocalEnabled] = useState(isEnabled);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with on-chain state when it changes (source of truth)
  useEffect(() => {
    if (!isPending) {
      setLocalEnabled(isEnabled);
      setError(null);
    }
  }, [isEnabled, isPending]);

  const handleToggle = useCallback(async (checked: boolean) => {
    if (disabled || isPreviewMode || locked || isPending || externalPending) return;

    setIsPending(true);
    setError(null);

    try {
      const success = await onToggle(checked);
      
      if (success) {
        // Update local state on success
        setLocalEnabled(checked);
      } else {
        // Revert on failure
        setLocalEnabled(isEnabled);
        setError('Transaction failed');
      }
    } catch (err) {
      // Revert on error
      setLocalEnabled(isEnabled);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsPending(false);
    }
  }, [disabled, isPreviewMode, locked, isPending, externalPending, onToggle, isEnabled]);

  const variantClasses = {
    default: {
      container: 'bg-muted/30 border-border/50',
      activeContainer: 'bg-primary/5 border-primary/20',
    },
    danger: {
      container: 'bg-destructive/5 border-destructive/20',
      activeContainer: 'bg-destructive/10 border-destructive/30',
    },
    success: {
      container: 'bg-emerald-500/5 border-emerald-500/20',
      activeContainer: 'bg-emerald-500/10 border-emerald-500/30',
    },
  };

  const isActive = isPending || externalPending;
  const containerClass = localEnabled 
    ? variantClasses[variant].activeContainer 
    : variantClasses[variant].container;

  return (
    <div 
      className={cn(
        'p-3 rounded-lg border transition-all',
        containerClass,
        locked && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && (
            <div className={cn(
              'flex-shrink-0',
              localEnabled ? 'text-primary' : 'text-muted-foreground'
            )}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
              {label}
            </Label>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status indicator */}
          {showStatus && (
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs px-2 py-0',
                isActive && 'animate-pulse',
                error && 'border-destructive text-destructive',
                !error && localEnabled && 'border-emerald-500 text-emerald-600 bg-emerald-500/10',
                !error && !localEnabled && 'border-muted-foreground text-muted-foreground'
              )}
            >
              {isActive ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pending
                </span>
              ) : error ? (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Error
                </span>
              ) : localEnabled ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  ON
                </span>
              ) : (
                'OFF'
              )}
            </Badge>
          )}

          {/* Toggle switch */}
          <Switch
            id={id}
            checked={localEnabled}
            onCheckedChange={handleToggle}
            disabled={disabled || isPreviewMode || locked || isActive}
            className={cn(
              variant === 'danger' && localEnabled && 'data-[state=checked]:bg-destructive',
              variant === 'success' && localEnabled && 'data-[state=checked]:bg-emerald-500'
            )}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Conditional children when enabled */}
      {localEnabled && children && (
        <div className="mt-3 pt-3 border-t border-border/30">
          {children}
        </div>
      )}
    </div>
  );
}

// Locked/Emergency toggle variant
interface AdminLockedToggleProps extends Omit<AdminToggleProps, 'onToggle'> {
  onArm: () => Promise<boolean>;
  onDisarm?: () => Promise<boolean>;
  requiresConfirmation?: boolean;
  confirmationText?: string;
}

export function AdminLockedToggle({
  onArm,
  onDisarm,
  requiresConfirmation = true,
  confirmationText = 'Are you sure?',
  ...props
}: AdminLockedToggleProps) {
  const [isArmed, setIsArmed] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      if (requiresConfirmation) {
        const confirmed = window.confirm(confirmationText);
        if (!confirmed) return false;
      }
      return onArm();
    } else if (onDisarm) {
      return onDisarm();
    }
    return false;
  };

  return (
    <AdminToggle
      {...props}
      onToggle={handleToggle}
      variant="danger"
    />
  );
}
