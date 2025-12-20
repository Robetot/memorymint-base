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

export interface ActiveEffects {
  freeze: boolean;
  reveal: boolean;
  shuffle: boolean;
}

const INITIAL_POWER_UPS: PowerUp[] = [
  { id: 'freeze', name: 'Freeze Time', icon: '❄️', description: 'Pause timer for 5 seconds', cooldown: 0, uses: 1, maxUses: 1 },
  { id: 'reveal', name: 'Peek', icon: '👁️', description: 'Reveal all cards for 2 seconds', cooldown: 0, uses: 1, maxUses: 1 },
  { id: 'shuffle', name: 'Shuffle', icon: '🔀', description: 'Shuffle unmatched cards', cooldown: 0, uses: 1, maxUses: 1 },
];

const INITIAL_ACTIVE_EFFECTS: ActiveEffects = {
  freeze: false,
  reveal: false,
  shuffle: false,
};

export function usePowerUps() {
  const [powerUps, setPowerUps] = useState<PowerUp[]>(INITIAL_POWER_UPS);
  const [activeEffects, setActiveEffects] = useState<ActiveEffects>(INITIAL_ACTIVE_EFFECTS);
  // Keep legacy activeEffect for backward compatibility
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  const usePowerUp = useCallback((id: string): boolean => {
    const powerUp = powerUps.find(p => p.id === id);
    if (!powerUp || powerUp.uses <= 0) return false;

    setPowerUps(prev => prev.map(p => 
      p.id === id ? { ...p, uses: p.uses - 1 } : p
    ));
    
    // Set both the new active effects tracker and legacy activeEffect
    setActiveEffects(prev => ({ ...prev, [id]: true }));
    setActiveEffect(id);

    return true;
  }, [powerUps]);

  const clearActiveEffect = useCallback((effectId?: string) => {
    if (effectId) {
      // Clear specific effect
      setActiveEffects(prev => ({ ...prev, [effectId]: false }));
      setActiveEffect(current => current === effectId ? null : current);
    } else {
      // Clear all effects (legacy behavior)
      setActiveEffects(INITIAL_ACTIVE_EFFECTS);
      setActiveEffect(null);
    }
  }, []);

  const resetPowerUps = useCallback(() => {
    setPowerUps(INITIAL_POWER_UPS);
    setActiveEffects(INITIAL_ACTIVE_EFFECTS);
    setActiveEffect(null);
  }, []);

  const getPowerUp = useCallback((id: string) => {
    return powerUps.find(p => p.id === id);
  }, [powerUps]);

  const isEffectActive = useCallback((id: string): boolean => {
    return activeEffects[id as keyof ActiveEffects] || false;
  }, [activeEffects]);

  // Check if any effect is blocking card interaction
  const isInputBlocked = useCallback((): boolean => {
    // Only reveal should block input, freeze only affects timer
    return activeEffects.reveal || activeEffects.shuffle;
  }, [activeEffects]);

  return {
    powerUps,
    activeEffect,
    activeEffects,
    usePowerUp,
    clearActiveEffect,
    resetPowerUps,
    getPowerUp,
    isEffectActive,
    isInputBlocked,
  };
}
