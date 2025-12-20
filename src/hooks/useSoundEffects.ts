import { useCallback, useRef, useEffect } from 'react';

// Sound effects are disabled - using silent stubs to avoid audio errors
// Animal sounds and UI sounds are intentionally empty to prevent console errors
const ANIMAL_SOUNDS: Record<string, string> = {};
const UI_SOUNDS: Record<string, string> = {};

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
    
    // Preload in batches
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await Promise.all(batch.map(([key, url]) => this.preloadOne(key, url)));
    }
    console.log('All sounds preloaded');
  }

  private async preloadOne(key: string, url: string): Promise<void> {
    // For base64 data URIs, decode directly
    if (url.startsWith('data:')) {
      if (this.useWebAudio && this.context) {
        try {
          const base64 = url.split(',')[1];
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const audioBuffer = await this.context.decodeAudioData(bytes.buffer.slice(0));
          this.bufferMap.set(key, audioBuffer);
          return;
        } catch (e) {
          // Fallback to HTML Audio for base64
        }
      }
      
      // HTML Audio fallback for base64
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.audioElems.set(key, audio);
      return;
    }

    // For external URLs
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

  const playMismatchSound = useCallback(() => {
    // Subtle, lower volume mismatch sound
    managerRef.current.play('mismatch', { volume: 0.4 });
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
    playMismatchSound,
    playWinSound,
    playLoseSound,
    playClickSound,
    playComboSound,
    setMuted,
    setVolume,
    stopAll,
  };
}
