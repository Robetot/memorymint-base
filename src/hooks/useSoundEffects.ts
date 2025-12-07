import { useCallback, useRef, useEffect } from 'react';

// Free sound URLs from various sources
const ANIMAL_SOUNDS: Record<string, string> = {
  duck: 'https://www.soundjay.com/animal/duck-quack-1.mp3',
  dog: 'https://www.soundjay.com/animal/dog-barking-1.mp3',
  cat: 'https://www.soundjay.com/animal/cat-meow-1.mp3',
  cow: 'https://www.soundjay.com/animal/cow-moo-1.mp3',
  pig: 'https://www.soundjay.com/animal/pig-oink-1.mp3',
  chicken: 'https://www.soundjay.com/animal/rooster-crow-1.mp3',
  sheep: 'https://www.soundjay.com/animal/sheep-bleat-1.mp3',
  horse: 'https://www.soundjay.com/animal/horse-neigh-1.mp3',
};

// UI sound effects
const UI_SOUNDS = {
  flip: 'https://www.soundjay.com/button/button-09.mp3',
  match: 'https://www.soundjay.com/misc/magic-chime-02.mp3',
  noMatch: 'https://www.soundjay.com/button/button-10.mp3',
  win: 'https://www.soundjay.com/misc/trumpet-fanfare.mp3',
  lose: 'https://www.soundjay.com/misc/fail-buzzer-03.mp3',
  click: 'https://www.soundjay.com/button/button-16.mp3',
  combo: 'https://www.soundjay.com/misc/magic-chime-03.mp3',
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
