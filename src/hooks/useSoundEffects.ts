import { useCallback, useRef, useEffect } from 'react';

// All 36 animal sounds - unique sounds per animal from free sources
const ANIMAL_SOUNDS: Record<string, string> = {
  // Row 1: Cat, Calf, Horse, Lamb
  cat: 'https://cdn.pixabay.com/audio/2024/04/02/audio_43db6ad467.mp3', // cat meow
  calf: 'https://cdn.pixabay.com/audio/2022/03/10/audio_b4a55c9260.mp3', // young cow moo
  horse: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8e8fa6a8d.mp3', // neigh
  lamb: 'https://cdn.pixabay.com/audio/2022/03/24/audio_b9970dfc56.mp3', // bleat
  
  // Row 2: Polar Bear, Seal, Shark, Duckling, Chick, Rabbit
  polarbear: 'https://cdn.pixabay.com/audio/2024/09/20/audio_74b131a88a.mp3', // growl
  seal: 'https://cdn.pixabay.com/audio/2022/09/21/audio_8c8f0b4e49.mp3', // seal bark
  shark: 'https://cdn.pixabay.com/audio/2021/08/04/audio_c85f64c3e0.mp3', // water swoosh
  duckling: 'https://cdn.pixabay.com/audio/2022/10/30/audio_fe51173af7.mp3', // peep
  chick: 'https://cdn.pixabay.com/audio/2024/02/20/audio_e2b7f0c40d.mp3', // chirp
  rabbit: 'https://cdn.pixabay.com/audio/2022/03/22/audio_a9a3e009e7.mp3', // soft hop rustle
  
  // Row 3: Swan, Puppy, Owl, Eagle, Bird, Parrot
  swan: 'https://cdn.pixabay.com/audio/2021/08/04/audio_bb630a570a.mp3', // honk
  puppy: 'https://cdn.pixabay.com/audio/2022/03/15/audio_d7b8e06a96.mp3', // puppy bark
  owl: 'https://cdn.pixabay.com/audio/2022/03/19/audio_13709e33c7.mp3', // hoot
  eagle: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c7c2c28e8f.mp3', // screech
  bird: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0e6b2e2f1.mp3', // small bird chirp
  parrot: 'https://cdn.pixabay.com/audio/2022/11/17/audio_aa9a002c06.mp3', // squawk
  
  // Row 4: Penguin, Piggy, Beluga Whale, Hedgehog
  penguin: 'https://cdn.pixabay.com/audio/2022/03/10/audio_2a3a3b0a58.mp3', // penguin chirp
  piggy: 'https://cdn.pixabay.com/audio/2022/10/30/audio_57723d3560.mp3', // oink
  belugawhale: 'https://cdn.pixabay.com/audio/2024/08/20/audio_8e6c5b0a38.mp3', // whale call
  hedgehog: 'https://cdn.pixabay.com/audio/2022/03/22/audio_85b4e44c35.mp3', // snuffle
  
  // Row 5: Manta Ray, Squirrel, Zebra, Lion
  mantaray: 'https://cdn.pixabay.com/audio/2021/08/04/audio_c85f64c3e0.mp3', // soft water glide
  squirrel: 'https://cdn.pixabay.com/audio/2024/04/25/audio_3c6a4b6a26.mp3', // chatter
  zebra: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8e8fa6a8d.mp3', // whinny (similar to horse)
  lion: 'https://cdn.pixabay.com/audio/2024/07/23/audio_98aa4d2a52.mp3', // lion cub roar
  
  // Row 6: Tiger, Leopard, Deer, Fox, Monkey, Elephant
  tiger: 'https://cdn.pixabay.com/audio/2022/03/24/audio_2f04a50c26.mp3', // tiger growl
  leopard: 'https://cdn.pixabay.com/audio/2022/03/15/audio_ed8bfa3b2e.mp3', // snarl
  deer: 'https://cdn.pixabay.com/audio/2024/02/19/audio_6d3a7a9e8d.mp3', // fawn bleat
  fox: 'https://cdn.pixabay.com/audio/2024/02/19/audio_c8b7c84c29.mp3', // fox yip
  monkey: 'https://cdn.pixabay.com/audio/2022/03/10/audio_f5a8c8b7d9.mp3', // monkey screech
  elephant: 'https://cdn.pixabay.com/audio/2022/03/15/audio_2a58b9e1c5.mp3', // trumpet
  
  // Row 7: Panda, Dolphin, Koala, Butterfly, Rhinoceros, Sea Turtle
  panda: 'https://cdn.pixabay.com/audio/2022/03/24/audio_b9970dfc56.mp3', // panda bleat
  dolphin: 'https://cdn.pixabay.com/audio/2024/06/14/audio_5e3b7c9d2f.mp3', // clicks/whistles
  koala: 'https://cdn.pixabay.com/audio/2024/09/20/audio_74b131a88a.mp3', // grunt
  butterfly: 'https://cdn.pixabay.com/audio/2021/08/04/audio_0ef5a459a8.mp3', // wing flutter
  rhinoceros: 'https://cdn.pixabay.com/audio/2022/03/15/audio_ed8bfa3b2e.mp3', // rhino grunt
  seaturtle: 'https://cdn.pixabay.com/audio/2021/08/04/audio_c85f64c3e0.mp3', // soft water swimming
};

// UI sound effects - distinct sounds for game events
const UI_SOUNDS = {
  flip: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // subtle card flip
  match: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // positive chime
  noMatch: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3', // soft error
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // victory fanfare
  lose: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', // game over
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // UI click
  combo: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3', // combo bonus
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
  }

  private async preloadAll() {
    const allSounds = { ...ANIMAL_SOUNDS, ...UI_SOUNDS };
    const entries = Object.entries(allSounds);
    
    // Preload in batches to avoid overwhelming the browser
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.all(batch.map(([key, url]) => this.preloadOne(key, url)));
    }
    console.log('All sounds preloaded');
  }

  private async preloadOne(key: string, url: string): Promise<void> {
    if (this.useWebAudio && this.context) {
      try {
        const resp = await fetch(url);
        const arrayBuffer = await resp.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
        this.bufferMap.set(key, audioBuffer);
        return;
      } catch (e) {
        console.warn(`WebAudio preload failed for ${key}`, e);
      }
    }
    
    // HTMLAudio fallback
    const audio = new Audio(url);
    audio.preload = 'auto';
    this.audioElems.set(key, audio);
    
    return new Promise((resolve) => {
      audio.addEventListener('canplaythrough', () => resolve(), { once: true });
      audio.addEventListener('error', () => {
        console.error('Audio load error', key, url);
        resolve();
      }, { once: true });
    });
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
    if (!this.bufferMap.has(key) && !this.audioElems.has(key)) return null;

    const volume = (options.volume ?? 1.0) * this._volume;
    const loop = options.loop ?? false;

    // Debounce rapid flips (150ms)
    const now = Date.now();
    const lastFlip = this.flipTimestamps.get(cardId);
    if (lastFlip && now - lastFlip < 150) return null;
    this.flipTimestamps.set(cardId, now);

    // Stop any existing sound for this card
    this.stopForCard(cardId);
    
    // Enforce max concurrent sounds
    this.enforceMaxConcurrent();

    if (this.useWebAudio && this.context && this.bufferMap.has(key)) {
      const buffer = this.bufferMap.get(key)!;
      const src = this.context.createBufferSource();
      src.buffer = buffer;
      const gain = this.context.createGain();
      gain.gain.value = volume;
      src.loop = loop;
      src.connect(gain).connect(this.context.destination);
      src.start(0);
      
      src.onended = () => {
        this.activeSources.delete(cardId);
      };
      
      this.activeSources.set(cardId, { type: 'webaudio', src, gain });
      return cardId;
    } else if (this.audioElems.has(key)) {
      const audio = this.audioElems.get(key)!.cloneNode() as HTMLAudioElement;
      audio.loop = loop;
      audio.volume = volume;
      audio.play().catch((e) => {
        console.warn('Audio play rejected', e);
      });
      
      audio.onended = () => {
        this.activeSources.delete(cardId);
      };
      
      this.activeSources.set(cardId, { type: 'html', audio });
      return cardId;
    }
    
    return null;
  }

  play(key: string, options: { volume?: number } = {}): void {
    if (this._isMuted) return;
    
    const volume = (options.volume ?? 1.0) * this._volume;
    const uniqueId = `ui_${key}_${Date.now()}`;

    if (this.useWebAudio && this.context && this.bufferMap.has(key)) {
      const buffer = this.bufferMap.get(key)!;
      const src = this.context.createBufferSource();
      src.buffer = buffer;
      const gain = this.context.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(this.context.destination);
      src.start(0);
      return;
    }
    
    if (this.audioElems.has(key)) {
      const audio = this.audioElems.get(key)!.cloneNode() as HTMLAudioElement;
      audio.volume = volume;
      audio.play().catch(() => {});
    }
  }

  stopForCard(cardId: string) {
    const entry = this.activeSources.get(cardId);
    if (!entry) return;
    
    if (entry.type === 'webaudio') {
      try {
        entry.src.stop(0);
      } catch (e) {}
    } else if (entry.type === 'html') {
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
      if (entry.type === 'webaudio') {
        entry.gain.gain.value = this._volume;
      } else if (entry.type === 'html') {
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
