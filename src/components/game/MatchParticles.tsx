import { useEffect, useState, useCallback, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
  speed: number;
  rotation: number;
  shape: 'circle' | 'star' | 'heart' | 'sparkle';
}

interface MatchParticlesProps {
  x: number;
  y: number;
  combo: number;
  onComplete: () => void;
}

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#F97316', '#22D3EE', '#EC4899'];
const COMBO_COLORS = ['#FFD700', '#FF6B6B', '#A855F7', '#22D3EE'];

export function MatchParticles({ x, y, combo, onComplete }: MatchParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const baseCount = 12;
    const comboMultiplier = Math.min(combo, 5);
    const particleCount = baseCount + comboMultiplier * 4;
    
    const newParticles: Particle[] = [];
    const shapes: Particle['shape'][] = ['circle', 'star', 'sparkle'];
    if (combo >= 3) shapes.push('heart');

    for (let i = 0; i < particleCount; i++) {
      const isComboParticle = combo > 1 && i < comboMultiplier * 3;
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        size: isComboParticle ? 12 + Math.random() * 8 : 6 + Math.random() * 6,
        color: isComboParticle 
          ? COMBO_COLORS[Math.floor(Math.random() * COMBO_COLORS.length)]
          : COLORS[Math.floor(Math.random() * COLORS.length)],
        angle: (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5,
        speed: 60 + Math.random() * 80 + (isComboParticle ? 30 : 0),
        rotation: Math.random() * 360,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    setParticles(newParticles);

    const timer = setTimeout(() => {
      onComplete();
    }, 800);

    return () => clearTimeout(timer);
  }, [combo, onComplete]);

  const renderShape = (particle: Particle) => {
    switch (particle.shape) {
      case 'star':
        return (
          <svg viewBox="0 0 24 24" fill={particle.color} className="w-full h-full">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      case 'heart':
        return (
          <svg viewBox="0 0 24 24" fill={particle.color} className="w-full h-full">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        );
      case 'sparkle':
        return (
          <svg viewBox="0 0 24 24" fill={particle.color} className="w-full h-full">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" />
          </svg>
        );
      default:
        return (
          <div 
            className="w-full h-full rounded-full"
            style={{ backgroundColor: particle.color }}
          />
        );
    }
  };

  return (
    <div 
      className="fixed pointer-events-none z-50"
      style={{ left: x, top: y }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-particle"
          style={{
            width: particle.size,
            height: particle.size,
            transform: `rotate(${particle.rotation}deg)`,
            '--particle-x': `${Math.cos(particle.angle) * particle.speed}px`,
            '--particle-y': `${Math.sin(particle.angle) * particle.speed}px`,
          } as React.CSSProperties}
        >
          {renderShape(particle)}
        </div>
      ))}
    </div>
  );
}

interface ComboParticlesProps {
  combo: number;
}

export function ComboParticles({ combo }: ComboParticlesProps) {
  const [sparks, setSparks] = useState<{ id: string; x: number; delay: number }[]>([]);
  const prevComboRef = useRef(0);

  useEffect(() => {
    // Only trigger sparks when combo increases, not on every render
    if (combo > prevComboRef.current && combo >= 2) {
      const sparkCount = Math.min(combo, 6); // Limit max sparks
      const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
        id: `${Date.now()}-${i}`,
        x: 10 + Math.random() * 80,
        delay: Math.random() * 0.2,
      }));
      setSparks(newSparks);
      
      // Auto-cleanup sparks after animation completes
      const timer = setTimeout(() => {
        setSparks([]);
      }, 1200);
      
      return () => clearTimeout(timer);
    } else if (combo < 2) {
      setSparks([]);
    }
    
    prevComboRef.current = combo;
  }, [combo]);

  if (sparks.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {sparks.map((spark) => (
        <div
          key={spark.id}
          className="absolute w-1 h-6 bg-gradient-to-b from-accent via-primary to-transparent"
          style={{
            left: `${spark.x}%`,
            bottom: 0,
            animationDelay: `${spark.delay}s`,
            animation: 'spark-rise 1s ease-out forwards',
          }}
        />
      ))}
    </div>
  );
}