import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'freeze' | 'reveal' | 'shuffle' | 'daily_complete' | 'weekly_complete' | 'achievement';

export const usePowerUpSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = 0.3;
      }
    };

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const osc = audioContextRef.current.createOscillator();
    const envelope = audioContextRef.current.createGain();
    
    osc.connect(envelope);
    envelope.connect(gainNodeRef.current);
    
    osc.frequency.value = frequency;
    osc.type = type;
    
    const now = audioContextRef.current.currentTime;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.5, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.start(now);
    osc.stop(now + duration);
  }, []);

  const playSound = useCallback((type: SoundType) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    switch (type) {
      case 'freeze':
        // Ice/crystal sound - descending arpeggio
        [880, 660, 440, 330].forEach((freq, i) => {
          setTimeout(() => playTone(freq, 0.15, 'sine'), i * 50);
        });
        break;

      case 'reveal':
        // Sparkle/magic reveal - ascending with shimmer
        [523, 659, 784, 1047].forEach((freq, i) => {
          setTimeout(() => playTone(freq, 0.1, 'triangle'), i * 40);
        });
        setTimeout(() => playTone(1318, 0.3, 'sine'), 160);
        break;

      case 'shuffle':
        // Whoosh/shuffle - quick swooping sound
        [200, 300, 400, 350, 250, 150].forEach((freq, i) => {
          setTimeout(() => playTone(freq, 0.05, 'sawtooth'), i * 30);
        });
        break;

      case 'daily_complete':
        // Victory fanfare - triumphant melody
        const dailyMelody = [523, 659, 784, 1047, 784, 1047];
        dailyMelody.forEach((freq, i) => {
          setTimeout(() => playTone(freq, 0.2, 'triangle'), i * 100);
        });
        break;

      case 'weekly_complete':
        // Epic fanfare - grander celebration
        const weeklyMelody = [392, 523, 659, 784, 880, 1047, 1319, 1568];
        weeklyMelody.forEach((freq, i) => {
          setTimeout(() => {
            playTone(freq, 0.25, 'triangle');
            playTone(freq * 1.5, 0.25, 'sine');
          }, i * 120);
        });
        break;

      case 'achievement':
        // Achievement unlock - special chime
        [659, 784, 880, 1047].forEach((freq, i) => {
          setTimeout(() => {
            playTone(freq, 0.3, 'sine');
            playTone(freq * 1.25, 0.3, 'triangle');
          }, i * 80);
        });
        break;
    }
  }, [playTone]);

  return { playSound };
};
