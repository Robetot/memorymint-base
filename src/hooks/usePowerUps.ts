import { useState, useCallback } from 'react';

export interface PowerUp {
  id: string;
  name: string;
  icon: string;
  description: string;
  cooldown: number;
  uses: number;
  maxUses: number;
}

const INITIAL_POWER_UPS: PowerUp[] = [
  { id: 'freeze', name: 'Freeze Time', icon: '❄️', description: 'Pause timer for 5 seconds', cooldown: 0, uses: 1, maxUses: 1 },
  { id: 'reveal', name: 'Peek', icon: '👁️', description: 'Reveal all cards for 2 seconds', cooldown: 0, uses: 1, maxUses: 1 },
  { id: 'shuffle', name: 'Shuffle', icon: '🔀', description: 'Shuffle unmatched cards', cooldown: 0, uses: 1, maxUses: 1 },
];

export function usePowerUps() {
  const [powerUps, setPowerUps] = useState<PowerUp[]>(INITIAL_POWER_UPS);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  const usePowerUp = useCallback((id: string): boolean => {
    const powerUp = powerUps.find(p => p.id === id);
    if (!powerUp || powerUp.uses <= 0) return false;

    setPowerUps(prev => prev.map(p => 
      p.id === id ? { ...p, uses: p.uses - 1 } : p
    ));
    setActiveEffect(id);

    return true;
  }, [powerUps]);

  const clearActiveEffect = useCallback(() => {
    setActiveEffect(null);
  }, []);

  const resetPowerUps = useCallback(() => {
    setPowerUps(INITIAL_POWER_UPS);
    setActiveEffect(null);
  }, []);

  const getPowerUp = useCallback((id: string) => {
    return powerUps.find(p => p.id === id);
  }, [powerUps]);

  return {
    powerUps,
    activeEffect,
    usePowerUp,
    clearActiveEffect,
    resetPowerUps,
    getPowerUp,
  };
}
