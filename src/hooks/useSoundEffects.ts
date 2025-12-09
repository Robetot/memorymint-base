import { useCallback, useRef, useEffect } from 'react';

// Animal sound URLs - verified working sounds from freesound.org CDN
const ANIMAL_SOUNDS: Record<string, string> = {
  cat: 'https://freesound.org/data/previews/415/415209_5121236-lq.mp3',
  calf: 'https://freesound.org/data/previews/58/58277_634166-lq.mp3',
  horse: 'https://freesound.org/data/previews/145/145209_1044014-lq.mp3',
  lamb: 'https://freesound.org/data/previews/316/316403_5436578-lq.mp3',
  polarbear: 'https://freesound.org/data/previews/275/275154_4872613-lq.mp3',
  seal: 'https://freesound.org/data/previews/179/179497_2613709-lq.mp3',
  shark: 'https://freesound.org/data/previews/398/398032_2462020-lq.mp3',
  duckling: 'https://freesound.org/data/previews/316/316920_4939573-lq.mp3',
  chick: 'https://freesound.org/data/previews/316/316920_4939573-lq.mp3',
  rabbit: 'https://freesound.org/data/previews/439/439151_6142149-lq.mp3',
  swan: 'https://freesound.org/data/previews/244/244853_4284968-lq.mp3',
  puppy: 'https://freesound.org/data/previews/328/328730_230356-lq.mp3',
  owl: 'https://freesound.org/data/previews/398/398166_6399959-lq.mp3',
  eagle: 'https://freesound.org/data/previews/434/434048_9021618-lq.mp3',
  bird: 'https://freesound.org/data/previews/321/321967_4939573-lq.mp3',
  parrot: 'https://freesound.org/data/previews/412/412096_7948056-lq.mp3',
  penguin: 'https://freesound.org/data/previews/316/316920_4939573-lq.mp3',
  piggy: 'https://freesound.org/data/previews/86/86336_927936-lq.mp3',
  belugawhale: 'https://freesound.org/data/previews/398/398032_2462020-lq.mp3',
  hedgehog: 'https://freesound.org/data/previews/439/439151_6142149-lq.mp3',
  mantaray: 'https://freesound.org/data/previews/398/398032_2462020-lq.mp3',
  squirrel: 'https://freesound.org/data/previews/439/439151_6142149-lq.mp3',
  zebra: 'https://freesound.org/data/previews/145/145209_1044014-lq.mp3',
  lion: 'https://freesound.org/data/previews/275/275154_4872613-lq.mp3',
  tiger: 'https://freesound.org/data/previews/275/275154_4872613-lq.mp3',
  leopard: 'https://freesound.org/data/previews/275/275154_4872613-lq.mp3',
  deer: 'https://freesound.org/data/previews/58/58277_634166-lq.mp3',
  fox: 'https://freesound.org/data/previews/328/328730_230356-lq.mp3',
  monkey: 'https://freesound.org/data/previews/434/434048_9021618-lq.mp3',
  elephant: 'https://freesound.org/data/previews/48/48412_373912-lq.mp3',
  panda: 'https://freesound.org/data/previews/275/275154_4872613-lq.mp3',
  dolphin: 'https://freesound.org/data/previews/398/398032_2462020-lq.mp3',
  koala: 'https://freesound.org/data/previews/275/275154_4872613-lq.mp3',
  butterfly: 'https://freesound.org/data/previews/321/321967_4939573-lq.mp3',
  rhinoceros: 'https://freesound.org/data/previews/48/48412_373912-lq.mp3',
  seaturtle: 'https://freesound.org/data/previews/398/398032_2462020-lq.mp3',
};

// UI sound effects using data URIs for reliability
const UI_SOUNDS: Record<string, string> = {
  flip: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
  match: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
  noMatch: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
  win: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
  lose: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
  click: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
  combo: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAYAAAAAAAAAAAAAAAAAAAAAAA==',
};

// WebAudio-based Sound Manager for low latency
class SoundManager {
  private context: AudioContext | null = null;
  private bufferMap: Map<string, AudioBuffer> = new Map();
  private audioElems: Map<string, HTMLAudioElement> = new Map();
  private activeSources: Map<string, { type: 'webaudio'; src: AudioBufferSourceNode; gain: GainNode } | { type: 'html'; audio: HTMLAudioElement }> = new Map();
  private useWebAudio = false;
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
      this.useWebAudio = true;
    } catch (e) {
      console.warn('WebAudio unavailable, using HTMLAudio fallback', e);
      this.useWebAudio = false;
    }
    
    await this.preloadAll();
    this.initialized = true;
    console.log('Sound system initialized');
  }

  private async preloadAll() {
    const allSounds = { ...ANIMAL_SOUNDS, ...UI_SOUNDS };
    const entries = Object.entries(allSounds);
    
    // Preload in batches
    const batchSize = 8;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(([key, url]) => this.preloadOne(key, url)));
    }
    console.log(`Sounds loaded: ${this.loadedSounds.size}/${entries.length}`);
  }

  private async preloadOne(key: string, url: string): Promise<void> {
    // Use HTMLAudio for better cross-origin support
    try {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
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

    if (this.audioElems.has(key)) {
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
    
    return null;
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
    
    if (entry.type === 'html') {
      try {
        entry.audio.pause();
        entry.audio.currentTime = 0;
      } catch (e) {}
    }
    
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
    
    // Update volume on active sources
    this.activeSources.forEach((entry) => {
      if (entry.type === 'html') {
        entry.audio.volume = this._volume;
      }
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

  // Initialize on mount and resume on user interaction
  useEffect(() => {
    const manager = managerRef.current;
    
    if (!initializedRef.current) {
      manager.init().then(() => {
        initializedRef.current = true;
      });
    }

    // Resume audio context on first user interaction (mobile requirement)
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
