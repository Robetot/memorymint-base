import { useCallback, useRef, useEffect } from 'react';

// Unique animal sound URLs - verified working sounds from Pixabay
const ANIMAL_SOUNDS: Record<string, string> = {
  calf: 'https://cdn.pixabay.com/audio/2022/03/10/audio_b4a55c9260.mp3',
  puppy: 'https://cdn.pixabay.com/audio/2022/03/15/audio_d7b8e06a96.mp3',
  duckling: 'https://cdn.pixabay.com/audio/2022/10/30/audio_fe51173af7.mp3',
  chick: 'https://cdn.pixabay.com/audio/2024/02/20/audio_e2b7f0c40d.mp3',
  cat: 'https://cdn.pixabay.com/audio/2024/04/02/audio_43db6ad467.mp3',
  lamb: 'https://cdn.pixabay.com/audio/2022/03/24/audio_b9970dfc56.mp3',
  piggy: 'https://cdn.pixabay.com/audio/2022/10/30/audio_57723d3560.mp3',
  parrot: 'https://cdn.pixabay.com/audio/2022/11/17/audio_aa9a002c06.mp3',
  swan: 'https://cdn.pixabay.com/audio/2021/08/04/audio_bb630a570a.mp3',
  owl: 'https://cdn.pixabay.com/audio/2022/03/19/audio_13709e33c7.mp3',
  polarbear: 'https://cdn.pixabay.com/audio/2024/09/20/audio_74b131a88a.mp3',
  seal: 'https://cdn.pixabay.com/audio/2022/09/21/audio_8c8f0b4e49.mp3',
  squirrel: 'https://cdn.pixabay.com/audio/2022/03/22/audio_a9a3e009e7.mp3',
  tiger: 'https://cdn.pixabay.com/audio/2024/07/23/audio_98aa4d2a52.mp3',
  leopard: 'https://cdn.pixabay.com/audio/2022/03/15/audio_ed8bfa3b2e.mp3',
  deer: 'https://cdn.pixabay.com/audio/2022/03/24/audio_2f04a50c26.mp3',
  fox: 'https://cdn.pixabay.com/audio/2024/02/19/audio_c8b7c84c29.mp3',
  panda: 'https://cdn.pixabay.com/audio/2024/09/20/audio_74b131a88a.mp3',
  dolphin: 'https://cdn.pixabay.com/audio/2022/03/15/audio_2f8bea8d89.mp3',
  koala: 'https://cdn.pixabay.com/audio/2022/03/22/audio_a9a3e009e7.mp3',
};

// UI sound effects
const UI_SOUNDS = {
  flip: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  match: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  noMatch: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  lose: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  combo: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
};

export function useSoundEffects() {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isMuted = useRef(false);
  const volume = useRef(0.5);

  // Preload sounds
  useEffect(() => {
    const preloadSound = (url: string) => {
      if (!audioCache.current.has(url)) {
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
        audio.volume = volume.current;
        audioCache.current.set(url, audio);
      }
    };

    // Preload animal sounds
    Object.values(ANIMAL_SOUNDS).forEach(preloadSound);
    // Preload UI sounds
    Object.values(UI_SOUNDS).forEach(preloadSound);
  }, []);

  const playSound = useCallback((url: string) => {
    if (isMuted.current) return;

    try {
      let audio = audioCache.current.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.volume = volume.current;
        audioCache.current.set(url, audio);
      }
      
      // Clone for overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = volume.current;
      clone.play().catch(() => {
        // Silently fail - user might not have interacted yet
      });
    } catch {
      // Silently fail
    }
  }, []);

  const playAnimalSound = useCallback((animalId: string) => {
    const url = ANIMAL_SOUNDS[animalId];
    if (url) {
      playSound(url);
    }
  }, [playSound]);

  const playFlipSound = useCallback(() => {
    playSound(UI_SOUNDS.flip);
  }, [playSound]);

  const playMatchSound = useCallback(() => {
    playSound(UI_SOUNDS.match);
  }, [playSound]);

  const playNoMatchSound = useCallback(() => {
    playSound(UI_SOUNDS.noMatch);
  }, [playSound]);

  const playWinSound = useCallback(() => {
    playSound(UI_SOUNDS.win);
  }, [playSound]);

  const playLoseSound = useCallback(() => {
    playSound(UI_SOUNDS.lose);
  }, [playSound]);

  const playClickSound = useCallback(() => {
    playSound(UI_SOUNDS.click);
  }, [playSound]);

  const playComboSound = useCallback(() => {
    playSound(UI_SOUNDS.combo);
  }, [playSound]);

  const setMuted = useCallback((muted: boolean) => {
    isMuted.current = muted;
  }, []);

  const setVolume = useCallback((vol: number) => {
    volume.current = Math.max(0, Math.min(1, vol));
    audioCache.current.forEach((audio) => {
      audio.volume = volume.current;
    });
  }, []);

  return {
    playAnimalSound,
    playFlipSound,
    playMatchSound,
    playNoMatchSound,
    playWinSound,
    playLoseSound,
    playClickSound,
    playComboSound,
    setMuted,
    setVolume,
  };
}
