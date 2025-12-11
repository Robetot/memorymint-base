import { useState, useEffect, useRef, useCallback } from 'react';
import { MusicTheme } from './useSettings';

// Different music themes for players to choose from
const MUSIC_THEMES: Record<MusicTheme, { url: string; name: string; description: string }> = {
  chill: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3',
    name: 'Chill Vibes',
    description: 'Relaxing worldbeat music',
  },
  adventure: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3',
    name: 'Adventure',
    description: 'Upbeat and energetic',
  },
  zen: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3',
    name: 'Zen Garden',
    description: 'Peaceful and calming',
  },
  retro: {
    url: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
    name: 'Retro Arcade',
    description: 'Classic gaming vibes',
  },
};

const STORAGE_KEY = 'memorymint_music_enabled';

export function useBackgroundMusic(theme: MusicTheme = 'chill') {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const [currentTheme, setCurrentTheme] = useState<MusicTheme>(theme);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize or change audio when theme changes
  useEffect(() => {
    const themeData = MUSIC_THEMES[currentTheme];
    
    // Stop existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    audioRef.current = new Audio(themeData.url);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;

    // Resume playing if enabled
    if (isEnabled) {
      audioRef.current.play().catch(() => {
        // Autoplay blocked
      });
      setIsPlaying(true);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentTheme]);

  // Update theme when prop changes
  useEffect(() => {
    if (theme !== currentTheme) {
      setCurrentTheme(theme);
    }
  }, [theme, currentTheme]);

  const toggle = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsEnabled(false);
      localStorage.setItem(STORAGE_KEY, 'false');
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setIsEnabled(true);
        localStorage.setItem(STORAGE_KEY, 'true');
      }).catch(() => {
        console.log('Autoplay blocked');
      });
    }
  }, [isPlaying]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  const changeTheme = useCallback((newTheme: MusicTheme) => {
    setCurrentTheme(newTheme);
  }, []);

  return {
    isPlaying,
    toggle,
    setVolume,
    changeTheme,
    currentTheme,
    themes: MUSIC_THEMES,
  };
}

export { MUSIC_THEMES };
