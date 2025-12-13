import { useRef, useCallback, useEffect } from 'react';

export function useMatchSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.value = 0.3;
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }
    };

    const handleInteraction = () => {
      initAudio();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine', delay: number = 0) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(envelope);
    envelope.connect(gainNodeRef.current);

    const startTime = ctx.currentTime + delay;
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }, []);

  const playMatchSound = useCallback((combo: number) => {
    // Base match sound - rising arpeggio
    const baseFreq = 523; // C5
    playTone(baseFreq, 0.15, 'sine', 0);
    playTone(baseFreq * 1.25, 0.15, 'sine', 0.05);
    playTone(baseFreq * 1.5, 0.2, 'sine', 0.1);

    // Combo bonus sounds - higher pitched sparkle
    if (combo >= 2) {
      playTone(880, 0.1, 'triangle', 0.15);
      playTone(1047, 0.1, 'triangle', 0.2);
    }
    if (combo >= 3) {
      playTone(1175, 0.15, 'triangle', 0.25);
      playTone(1319, 0.2, 'sine', 0.3);
    }
    if (combo >= 5) {
      // Epic combo - fanfare
      playTone(1568, 0.15, 'square', 0.35);
      playTone(1760, 0.2, 'square', 0.4);
      playTone(2093, 0.3, 'sine', 0.45);
    }
  }, [playTone]);

  const playParticleExplosion = useCallback((combo: number) => {
    // Sparkle/pop sound for particle explosion
    const intensity = Math.min(combo + 1, 5);
    
    for (let i = 0; i < intensity; i++) {
      const freq = 2000 + Math.random() * 2000;
      const delay = Math.random() * 0.1;
      playTone(freq, 0.05 + Math.random() * 0.05, 'sine', delay);
    }

    // Low rumble for bigger combos
    if (combo >= 3) {
      playTone(100, 0.2, 'sine', 0);
      playTone(80, 0.3, 'sine', 0.05);
    }
  }, [playTone]);

  return {
    playMatchSound,
    playParticleExplosion,
  };
}
