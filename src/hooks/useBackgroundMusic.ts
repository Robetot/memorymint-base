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
  

  // Load and play audio - only called when user enables music
  const loadAndPlay = useCallback((themeKey: MusicTheme) => {
    const themeData = MUSIC_THEMES[themeKey];
    
    // Stop existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.3;
    
    // Handle load errors silently
    audio.addEventListener('error', () => {
      setIsPlaying(false);
    });

    audio.src = themeData.url;
    audioRef.current = audio;
    
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  }, []);

  // Update theme when prop changes (only if currently playing)
  useEffect(() => {
    if (theme !== currentTheme) {
      setCurrentTheme(theme);
      if (isPlaying && audioRef.current) {
        loadAndPlay(theme);
      }
    }
  }, [theme, currentTheme, isPlaying, loadAndPlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setIsEnabled(false);
      localStorage.setItem(STORAGE_KEY, 'false');
    } else {
      loadAndPlay(currentTheme);
      setIsEnabled(true);
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }, [isPlaying, currentTheme, loadAndPlay]);

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
