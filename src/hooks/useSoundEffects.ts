import { useCallback, useRef, useEffect } from 'react';

// Unique animal sound URLs from free sound libraries - each animal has its own distinct sound
const ANIMAL_SOUNDS: Record<string, string> = {
  calf: 'https://cdn.freesound.org/previews/58/58277_634166-lq.mp3',
  puppy: 'https://cdn.freesound.org/previews/351/351879_3248244-lq.mp3',
  duckling: 'https://cdn.freesound.org/previews/111/111949_1890469-lq.mp3',
  chick: 'https://cdn.freesound.org/previews/316/316920_5123451-lq.mp3',
  cat: 'https://cdn.freesound.org/previews/110/110011_511637-lq.mp3',
  lamb: 'https://cdn.freesound.org/previews/192/192322_3291925-lq.mp3',
  piggy: 'https://cdn.freesound.org/previews/131/131025_2398403-lq.mp3',
  parrot: 'https://cdn.freesound.org/previews/106/106546_909642-lq.mp3',
  swan: 'https://cdn.freesound.org/previews/416/416017_4284968-lq.mp3',
  owl: 'https://cdn.freesound.org/previews/398/398318_7573900-lq.mp3',
  polarbear: 'https://cdn.freesound.org/previews/169/169365_2590910-lq.mp3',
  seal: 'https://cdn.freesound.org/previews/131/131186_2398403-lq.mp3',
  squirrel: 'https://cdn.freesound.org/previews/430/430093_6399487-lq.mp3',
  tiger: 'https://cdn.freesound.org/previews/323/323601_5260872-lq.mp3',
  leopard: 'https://cdn.freesound.org/previews/416/416472_4058875-lq.mp3',
  deer: 'https://cdn.freesound.org/previews/210/210433_3162678-lq.mp3',
  fox: 'https://cdn.freesound.org/previews/244/244910_3162678-lq.mp3',
  panda: 'https://cdn.freesound.org/previews/382/382735_5674468-lq.mp3',
  dolphin: 'https://cdn.freesound.org/previews/317/317727_5121236-lq.mp3',
  koala: 'https://cdn.freesound.org/previews/466/466649_9497060-lq.mp3',
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
