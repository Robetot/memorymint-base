import { useCallback, useRef, useEffect } from 'react';

// Web Audio based synthesized sounds - no external files needed
class SynthSoundManager {
  private context: AudioContext | null = null;
  private _isMuted = false;
  private _volume = 0.5;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new AudioContextClass();
      this.initialized = true;
    } catch (e) {
      console.warn('WebAudio unavailable', e);
    }
  }

  async resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    delay: number = 0,
    volume: number = 0.3
  ) {
    if (!this.context || this._isMuted) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    
    const adjustedVolume = volume * this._volume;
    gainNode.gain.setValueAtTime(0, now + delay);
    gainNode.gain.linearRampToValueAtTime(adjustedVolume, now + delay + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.01);
  }

  private playNoise(duration: number, delay: number = 0, volume: number = 0.1) {
    if (!this.context || this._isMuted) return;

    const bufferSize = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.context.createGain();
    const now = this.context.currentTime;
    const adjustedVolume = volume * this._volume;
    
    gainNode.gain.setValueAtTime(adjustedVolume, now + delay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);

    source.connect(gainNode);
    gainNode.connect(this.context.destination);

    source.start(now + delay);
  }

  // Animal sounds - synthesized versions
  playAnimalSound(animalId: string) {
    if (this._isMuted) return;

    // Create unique sounds based on animal type
    const animalSounds: Record<string, () => void> = {
      cat: () => {
        this.playTone(800, 0.2, 'sine', 0, 0.4);
        this.playTone(600, 0.3, 'sine', 0.15, 0.35);
      },
      dog: () => {
        this.playTone(400, 0.1, 'sawtooth', 0, 0.3);
        this.playTone(500, 0.15, 'sawtooth', 0.1, 0.35);
      },
      bird: () => {
        this.playTone(1200, 0.08, 'sine', 0, 0.3);
        this.playTone(1400, 0.08, 'sine', 0.1, 0.3);
        this.playTone(1100, 0.1, 'sine', 0.2, 0.25);
      },
      lion: () => {
        this.playTone(150, 0.3, 'sawtooth', 0, 0.4);
        this.playTone(120, 0.4, 'sawtooth', 0.2, 0.35);
      },
      elephant: () => {
        this.playTone(200, 0.15, 'triangle', 0, 0.4);
        this.playTone(350, 0.25, 'triangle', 0.1, 0.45);
        this.playTone(180, 0.2, 'triangle', 0.3, 0.35);
      },
      monkey: () => {
        this.playTone(600, 0.08, 'square', 0, 0.25);
        this.playTone(800, 0.08, 'square', 0.1, 0.25);
        this.playTone(700, 0.1, 'square', 0.2, 0.2);
      },
      frog: () => {
        this.playTone(250, 0.1, 'square', 0, 0.3);
        this.playTone(200, 0.15, 'square', 0.12, 0.25);
      },
      owl: () => {
        this.playTone(400, 0.3, 'sine', 0, 0.35);
        this.playTone(350, 0.4, 'sine', 0.35, 0.3);
      },
      duck: () => {
        this.playTone(500, 0.08, 'sawtooth', 0, 0.3);
        this.playTone(450, 0.1, 'sawtooth', 0.1, 0.28);
      },
      wolf: () => {
        this.playTone(300, 0.2, 'sine', 0, 0.35);
        this.playTone(400, 0.4, 'sine', 0.15, 0.4);
        this.playTone(350, 0.3, 'sine', 0.5, 0.3);
      },
    };

    // Find matching sound or use default
    const soundKey = Object.keys(animalSounds).find(key => 
      animalId.toLowerCase().includes(key)
    );

    if (soundKey) {
      animalSounds[soundKey]();
    } else {
      // Default animal sound - generic chirp
      this.playTone(600, 0.1, 'sine', 0, 0.3);
      this.playTone(700, 0.1, 'sine', 0.1, 0.25);
    }
  }

  playFlip() {
    this.playTone(800, 0.06, 'sine', 0, 0.2);
    this.playTone(600, 0.05, 'sine', 0.02, 0.15);
  }

  playMatch() {
    // Happy ascending chime
    this.playTone(523, 0.12, 'sine', 0, 0.35);      // C5
    this.playTone(659, 0.12, 'sine', 0.08, 0.35);   // E5
    this.playTone(784, 0.15, 'sine', 0.16, 0.4);    // G5
    this.playTone(1047, 0.25, 'sine', 0.24, 0.3);   // C6
  }

  playMismatch() {
    // Soft descending tone
    this.playTone(350, 0.1, 'triangle', 0, 0.2);
    this.playTone(280, 0.15, 'triangle', 0.08, 0.18);
  }

  playWin() {
    // Victory fanfare
    this.playTone(523, 0.12, 'sine', 0, 0.35);       // C5
    this.playTone(659, 0.12, 'sine', 0.1, 0.35);     // E5
    this.playTone(784, 0.12, 'sine', 0.2, 0.35);     // G5
    this.playTone(1047, 0.2, 'sine', 0.3, 0.4);      // C6
    this.playTone(1319, 0.15, 'sine', 0.45, 0.35);   // E6
    this.playTone(1568, 0.25, 'sine', 0.55, 0.4);    // G6
    this.playTone(2093, 0.4, 'sine', 0.75, 0.45);    // C7
  }

  playLose() {
    // Sad descending tones
    this.playTone(400, 0.2, 'sine', 0, 0.3);
    this.playTone(350, 0.25, 'sine', 0.2, 0.28);
    this.playTone(300, 0.3, 'sine', 0.45, 0.25);
    this.playTone(250, 0.4, 'sine', 0.75, 0.22);
  }

  playClick() {
    this.playTone(1200, 0.025, 'sine', 0, 0.2);
    this.playNoise(0.015, 0, 0.03);
  }

  playCombo() {
    // Sparkle sound for combos
    this.playTone(880, 0.08, 'sine', 0, 0.3);
    this.playTone(1109, 0.08, 'sine', 0.04, 0.3);
    this.playTone(1318, 0.08, 'sine', 0.08, 0.3);
    this.playTone(1760, 0.12, 'sine', 0.12, 0.35);
    this.playTone(2217, 0.15, 'sine', 0.16, 0.25);
  }

  setMuted(muted: boolean) {
    this._isMuted = muted;
  }

  setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(1, vol));
  }

  get isMuted() {
    return this._isMuted;
  }

  get volume() {
    return this._volume;
  }
}

// Singleton instance
let soundManagerInstance: SynthSoundManager | null = null;

function getSoundManager(): SynthSoundManager {
  if (!soundManagerInstance) {
    soundManagerInstance = new SynthSoundManager();
  }
  return soundManagerInstance;
}

export function useSoundEffects() {
  const managerRef = useRef<SynthSoundManager>(getSoundManager());
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

  const playAnimalSound = useCallback((animalId: string, _cardId?: string) => {
    managerRef.current.playAnimalSound(animalId);
  }, []);

  const stopAnimalSound = useCallback((_cardId: string) => {
    // Synthesized sounds auto-stop, no action needed
  }, []);

  const playFlipSound = useCallback(() => {
    managerRef.current.playFlip();
  }, []);

  const playMatchSound = useCallback(() => {
    managerRef.current.playMatch();
  }, []);

  const playMismatchSound = useCallback(() => {
    managerRef.current.playMismatch();
  }, []);

  const playWinSound = useCallback(() => {
    managerRef.current.playWin();
  }, []);

  const playLoseSound = useCallback(() => {
    managerRef.current.playLose();
  }, []);

  const playClickSound = useCallback(() => {
    managerRef.current.playClick();
  }, []);

  const playComboSound = useCallback(() => {
    managerRef.current.playCombo();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    managerRef.current.setMuted(muted);
  }, []);

  const setVolume = useCallback((vol: number) => {
    managerRef.current.setVolume(vol);
  }, []);

  const stopAll = useCallback(() => {
    // Synthesized sounds auto-stop
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
