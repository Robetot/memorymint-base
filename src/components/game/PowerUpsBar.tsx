import { PowerUp } from '@/hooks/usePowerUps';

interface PowerUpsBarProps {
  powerUps: PowerUp[];
  onUsePowerUp: (id: string) => void;
  disabled?: boolean;
}

export function PowerUpsBar({ powerUps, onUsePowerUp, disabled }: PowerUpsBarProps) {
  return (
    <div className="flex gap-2 justify-center mb-4">
      {powerUps.map((powerUp) => (
        <button
          key={powerUp.id}
          onClick={() => onUsePowerUp(powerUp.id)}
          disabled={disabled || powerUp.uses <= 0}
          aria-label={`${powerUp.name}: ${powerUp.description}. ${powerUp.uses} uses remaining`}
          aria-disabled={disabled || powerUp.uses <= 0}
          className={`
            relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl
            transition-all duration-200 transform min-w-[72px] min-h-[72px]
            ${powerUp.uses > 0 && !disabled
              ? 'bg-primary/20 hover:bg-primary/30 hover:scale-105 cursor-pointer border border-primary/40'
              : 'bg-muted/30 opacity-50 cursor-not-allowed border border-muted/20'
            }
          `}
          title={powerUp.description}
        >
          <span className="text-2xl" aria-hidden="true">{powerUp.icon}</span>
          <span className="text-xs font-medium text-foreground/80">{powerUp.name}</span>
          {powerUp.uses > 0 && (
            <span 
              className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold"
              aria-hidden="true"
            >
              {powerUp.uses}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
