import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'memorymint_settings';

export type MusicTheme = 'chill' | 'adventure' | 'zen' | 'retro';

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  musicTheme: MusicTheme;
  sfxVolume: number;
  showTutorial: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  darkMode: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.3,
  musicTheme: 'chill',
  sfxVolume: 0.5,
  showTutorial: true,
  vibrationEnabled: true,
  reducedMotion: false,
  darkMode: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<GameSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const updateSetting = useCallback(<K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const markTutorialComplete = useCallback(() => {
    updateSetting('showTutorial', false);
  }, [updateSetting]);

  return {
    settings,
    updateSetting,
    resetSettings,
    markTutorialComplete,
  };
}
