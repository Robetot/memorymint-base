import { useCallback, useRef, useEffect } from 'react';

// Local animal sounds from /public/sounds/ - add mp3 files for each animal
const ANIMAL_SOUNDS: Record<string, string> = {
  cat: '/sounds/cat.mp3',
  calf: '/sounds/calf.mp3',
  horse: '/sounds/horse.mp3',
  lamb: '/sounds/lamb.mp3',
  polarbear: '/sounds/polar-bear.mp3',
  seal: '/sounds/seal.mp3',
  shark: '/sounds/shark.mp3',
  duckling: '/sounds/duckling.mp3',
  chick: '/sounds/chick.mp3',
  rabbit: '/sounds/rabbit.mp3',
  swan: '/sounds/swan.mp3',
  puppy: '/sounds/puppy.mp3',
  owl: '/sounds/owl.mp3',
  eagle: '/sounds/eagle.mp3',
  bird: '/sounds/bird.mp3',
  parrot: '/sounds/parrot.mp3',
  penguin: '/sounds/penguin.mp3',
  piggy: '/sounds/piggy.mp3',
  belugawhale: '/sounds/beluga-whale.mp3',
  hedgehog: '/sounds/hedgehog.mp3',
  mantaray: '/sounds/manta-ray.mp3',
  squirrel: '/sounds/squirrel.mp3',
  zebra: '/sounds/zebra.mp3',
  lion: '/sounds/lion.mp3',
  tiger: '/sounds/tiger.mp3',
  leopard: '/sounds/leopard.mp3',
  deer: '/sounds/deer.mp3',
  fox: '/sounds/fox.mp3',
  monkey: '/sounds/monkey.mp3',
  elephant: '/sounds/elephant.mp3',
  panda: '/sounds/panda.mp3',
  dolphin: '/sounds/dolphin.mp3',
  koala: '/sounds/koala.mp3',
  butterfly: '/sounds/butterfly.mp3',
  rhinoceros: '/sounds/rhinoceros.mp3',
  seaturtle: '/sounds/sea-turtle.mp3',
};

// UI sounds from /public/sounds/
const UI_SOUNDS: Record<string, string> = {
  flip: '/sounds/flip.mp3',
  match: '/sounds/match.mp3',
  noMatch: '/sounds/no-match.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  click: '/sounds/click.mp3',
  combo: '/sounds/combo.mp3',
};

// WebAudio-based Sound Manager for low latency
class SoundManager {
  private context: AudioContext | null = null;
  private audioElems: Map<string, HTMLAudioElement> = new Map();
  private activeSources: Map<string, { type: 'html'; audio: HTMLAudioElement }> = new Map();
  private _isMuted = false;
  private _volume = 0.5;
  private flipTimestamps: Map<string, number> = new Map();
  private maxConcurrent = 6;
  private initialized = false;
  private loadedSounds: Set<string> = new Set();

  async init() {
    if (this.initialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass();
    } catch (e) {
      console.warn('WebAudio unavailable', e);
    }
    
    await this.preloadAll();
    this.initialized = true;
    console.log('Sound system initialized');
  }

  private async preloadAll() {
    const allSounds = { ...ANIMAL_SOUNDS, ...UI_SOUNDS };
    const entries = Object.entries(allSounds);
    
    // Preload all sounds in parallel
    await Promise.allSettled(entries.map(([key, url]) => this.preloadOne(key, url)));
    console.log(`Sounds loaded: ${this.loadedSounds.size}/${entries.length}`);
  }

  private async preloadOne(key: string, url: string): Promise<void> {
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'));
        }, 5000);
        
        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          this.audioElems.set(key, audio);
          this.loadedSounds.add(key);
          resolve();
        }, { once: true });
        
        audio.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Load failed'));
        }, { once: true });
        
        audio.load();
      });
    } catch (e) {
      // Silent fail - sound just won't play
    }
  }

  async resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  private enforceMaxConcurrent() {
    if (this.activeSources.size >= this.maxConcurrent) {
      const [oldestKey] = this.activeSources.keys();
      if (oldestKey) {
        this.stopForCard(oldestKey);
      }
    }
  }

  playForCard(cardId: string, key: string, options: { volume?: number; loop?: boolean } = {}): string | null {
    if (this._isMuted) return null;
    if (!this.audioElems.has(key)) return null;

    const volume = (options.volume ?? 1.0) * this._volume;

    // Debounce rapid flips (150ms)
    const now = Date.now();
    const lastFlip = this.flipTimestamps.get(cardId);
    if (lastFlip && now - lastFlip < 150) return null;
    this.flipTimestamps.set(cardId, now);

    // Stop any existing sound for this card
    this.stopForCard(cardId);
    
    // Enforce max concurrent sounds
    this.enforceMaxConcurrent();

    try {
      const audio = this.audioElems.get(key)!.cloneNode() as HTMLAudioElement;
      audio.volume = volume;
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {});
      }
      
      audio.onended = () => {
        this.activeSources.delete(cardId);
      };
      
      this.activeSources.set(cardId, { type: 'html', audio });
      return cardId;
    } catch (e) {
      return null;
    }
  }

  play(key: string, options: { volume?: number } = {}): void {
    if (this._isMuted) return;
    if (!this.audioElems.has(key)) return;
    
    const volume = (options.volume ?? 1.0) * this._volume;

    try {
      const audio = this.audioElems.get(key)!.cloneNode() as HTMLAudioElement;
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {
      // Silent fail
    }
  }

  stopForCard(cardId: string) {
    const entry = this.activeSources.get(cardId);
    if (!entry) return;
    
    try {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    } catch (e) {}
    
    this.activeSources.delete(cardId);
  }

  stopAll() {
    for (const id of Array.from(this.activeSources.keys())) {
      this.stopForCard(id);
    }
  }

  setMuted(muted: boolean) {
    this._isMuted = muted;
    if (muted) {
      this.stopAll();
    }
  }

  setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(1, vol));
    
    this.activeSources.forEach((entry) => {
      entry.audio.volume = this._volume;
    });
  }

  get isMuted() {
    return this._isMuted;
  }

  get volume() {
    return this._volume;
  }
}

// Singleton instance
let soundManagerInstance: SoundManager | null = null;

function getSoundManager(): SoundManager {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager();
  }
  return soundManagerInstance;
}

export function useSoundEffects() {
  const managerRef = useRef<SoundManager>(getSoundManager());
  const initializedRef = useRef(false);

  useEffect(() => {
    const manager = managerRef.current;
    
    if (!initializedRef.current) {
      manager.init().then(() => {
        initializedRef.current = true;
      });
    }

    const resumeOnInteraction = () => {
      manager.resumeContext();
    };

    document.addEventListener('touchstart', resumeOnInteraction, { once: true });
    document.addEventListener('click', resumeOnInteraction, { once: true });

    return () => {
      document.removeEventListener('touchstart', resumeOnInteraction);
      document.removeEventListener('click', resumeOnInteraction);
    };
  }, []);

  const playAnimalSound = useCallback((animalId: string, cardId?: string) => {
    const manager = managerRef.current;
    const id = cardId || animalId;
    manager.playForCard(id, animalId);
  }, []);

  const stopAnimalSound = useCallback((cardId: string) => {
    managerRef.current.stopForCard(cardId);
  }, []);

  const playFlipSound = useCallback(() => {
    managerRef.current.play('flip');
  }, []);

  const playMatchSound = useCallback(() => {
    managerRef.current.play('match');
  }, []);

  const playNoMatchSound = useCallback(() => {
    managerRef.current.play('noMatch');
  }, []);

  const playWinSound = useCallback(() => {
    managerRef.current.play('win');
  }, []);

  const playLoseSound = useCallback(() => {
    managerRef.current.play('lose');
  }, []);

  const playClickSound = useCallback(() => {
    managerRef.current.play('click');
  }, []);

  const playComboSound = useCallback(() => {
    managerRef.current.play('combo');
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    managerRef.current.setMuted(muted);
  }, []);

  const setVolume = useCallback((vol: number) => {
    managerRef.current.setVolume(vol);
  }, []);

  const stopAll = useCallback(() => {
    managerRef.current.stopAll();
  }, []);

  return {
    playAnimalSound,
    stopAnimalSound,
    playFlipSound,
    playMatchSound,
    playNoMatchSound,
    playWinSound,
    playLoseSound,
    playClickSound,
    playComboSound,
    setMuted,
    setVolume,
    stopAll,
  };
}
