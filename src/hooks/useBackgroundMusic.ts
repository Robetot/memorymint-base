import { useState, useEffect, useRef, useCallback } from 'react';

const MUSIC_URL = 'https://assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3';
const STORAGE_KEY = 'memorymint_music_enabled';

export function useBackgroundMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    audioRef.current = new Audio(MUSIC_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Auto-play when enabled
  useEffect(() => {
    if (isEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Autoplay blocked, user needs to interact
      });
      setIsPlaying(true);
    }
  }, [isEnabled]);

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

  return {
    isPlaying,
    toggle,
    setVolume,
  };
}
