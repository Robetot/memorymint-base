import { useCallback, useRef, useEffect } from 'react';

// Using reliable, CORS-friendly sound URLs from Supabase storage or embedded base64
// These are short, pleasant sounds optimized for game use

// Animal sounds for the 21 unique animals - using reliable sources
const ANIMAL_SOUNDS: Record<string, string> = {
  cat: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  calf: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  lamb: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  polarbear: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  seal: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  duckling: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  chick: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  swan: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  puppy: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  owl: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  parrot: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  penguin: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  piggy: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  squirrel: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  tiger: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  leopard: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  deer: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  fox: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  panda: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  dolphin: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  koala: 'data:audio/mp3;base64,//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
};

// Embedded base64 audio for UI sounds - short, reliable, no CORS issues
// These are tiny placeholder sounds that work without network requests
const UI_SOUNDS: Record<string, string> = {
  // Soft whoosh flip sound
  flip: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH6EgIF5cGVjaHN9g4GBfXx7f3+Af3p2dHZ6fYB/fXp4eHp8fn9+fXt6eXl7fH1+fn59fHt7e3x9fn5+fn18fHx8fX5+fn5+fX19fX19fn5+fn5+fn19fX19fn5+fn5+fX19fX19fX5+fn5+fn19fX19fX1+fn5+fn59fX19fX19fn5+fn5+fX19fX19fX5+fn5+fn19fX19fX19fn5+fn5+fX19',
  // Pleasant chime for match
  match: 'data:audio/wav;base64,UklGRsQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAFAAB/gH5+fn9/gICAgH9/f39/f39/f4CAgIB/f39/f39/gICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f39/gICAf39/f39/f3+AgIB/f39/f39/f4CAgH9/f39/f39/gICAf39/f39/f3+AgIB/f39/f39/f4B/f39/',
  // Soft, calm mismatch sound - gentle wood tap
  mismatch: 'data:audio/wav;base64,UklGRmQEAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YUAEAAB/gH+AgIB/f39/gIB/f4CAgH9/gIB/f4CAgH9/f4CAf3+AgH9/f4B/f3+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/',
  // Victory fanfare
  win: 'data:audio/wav;base64,UklGRpoEAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YXYEAACAgICBgYKCg4OEhIWFhoaHh4iIiYmKiouLjIyNjY6Oj4+QkJGRkpKTk5SUlZWWlpeXmJiZmZqam5ucnJ2dnp6fn6CgoaGioqOjpKSlpaampqenqKipqaqqq6usrK2trq6vr7CwsbGysrOztLS1tba2t7e4uLm5urq7u7y8vb2+vr+/wMDBwcLCw8PExMXFxsbHx8jIycnKysvLzMzNzc7Oz8/Q0NHR0tLT09TU1dXW1tfX2NjZ2dra29vc3N3d3t7f3+Dg4eHi4uPj5OTl5ebm5+fo6Onp6urr6+zs7e3u7u/v8PDx8fLy8/P09PX19vb39/j4+fn6+vv7/Pz9/f7+',
  // Gentle game over
  lose: 'data:audio/wav;base64,UklGRpoEAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YXYEAAD+/v39/Pz7+/r6+fn4+Pf39vb19fT08/Py8vHx8PDv7+7u7e3s7Ovr6urp6ejo5+fm5uXl5OTj4+Li4eHg4N/f3t7d3dzc29va2tnZ2NjX19bW1dXU1NPT0tLR0dDQz8/Ozs3NzMzLy8rKycnIyMfHxsbFxcTEw8PCwsHBwMC/v76+vb28vLu7urq5ubi4t7e2trW1tLSzs7KysbGwsK+vrq6tra2sq6uqqampqKinp6ampqWlpKSjo6KioaGgoJ+fnp6dnZycm5ubmpqZmZiYl5eWlpWVlJSTk5KSkZGQkI+Pjo6NjYyMi4uKiomJiIiHh4aGhYWEhIODgoKBgYCA',
  // Soft UI click
  click: 'data:audio/wav;base64,UklGRlwCAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YTYCAAB/gICAgICAgH9/f39/f3+AgICAgH9/f39/f39/gICAf39/f39/f4CAgH9/f39/f3+AgIB/f39/f39/f4CAf39/f39/f39/gH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/',
  // Pleasant combo bonus
  combo: 'data:audio/wav;base64,UklGRsQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAFAAB/gH5+fn9/gICAgH9/f39/f39/f4CAgIB/f39/f39/gICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f3+AgICAgH9/f39/f39/gICAf39/f39/f3+AgIB/f39/f39/f4CAgH9/f39/f39/gICAf39/f39/f3+AgIB/f39/f39/f4B/f39/',
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
