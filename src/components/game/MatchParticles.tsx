import { useEffect, useState, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
  speed: number;
  rotation: number;
  shape: 'circle' | 'star' | 'sparkle';
}

interface MatchParticlesProps {
  x: number;
  y: number;
  combo: number;
  onComplete: () => void;
}

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#F97316'];

export function MatchParticles({ x, y, combo, onComplete }: MatchParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const onCompleteRef = useRef(onComplete);
  const hasInitRef = useRef(false);
  
  // Keep ref updated but don't trigger effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    // Only initialize once
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    
    // Limit particle count based on combo
    const particleCount = Math.min(8 + combo * 2, 16);
    
    const newParticles: Particle[] = [];
    const shapes: Particle['shape'][] = ['circle', 'star', 'sparkle'];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        size: 6 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        angle: (Math.PI * 2 * i) / particleCount,
        speed: 40 + Math.random() * 40,
        rotation: Math.random() * 360,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    setParticles(newParticles);

    // Auto-cleanup after animation
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 600);

    return () => clearTimeout(timer);
  }, []); // Empty deps - only run once on mount

  const renderShape = (particle: Particle) => {
    switch (particle.shape) {
      case 'star':
        return (
          <svg viewBox="0 0 24 24" fill={particle.color} className="w-full h-full">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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

  if (particles.length === 0) return null;

  return (
    <div 
      className="fixed pointer-events-none z-50"
      style={{ left: x, top: y }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            width: particle.size,
            height: particle.size,
            transform: `rotate(${particle.rotation}deg)`,
            animation: `particle-explode 0.6s ease-out forwards`,
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
  const [sparks, setSparks] = useState<{ id: string; x: number }[]>([]);
  const prevComboRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Only trigger sparks when combo increases to 2+
    if (combo >= 2 && combo > prevComboRef.current) {
      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      const sparkCount = Math.min(combo, 4);
      const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
        id: `${Date.now()}-${i}`,
        x: 20 + Math.random() * 60,
      }));
      setSparks(newSparks);
      
      // Auto-cleanup sparks
      timerRef.current = setTimeout(() => {
        setSparks([]);
      }, 800);
    } else if (combo < 2) {
      setSparks([]);
    }
    
    prevComboRef.current = combo;
  }, [combo]);

  if (sparks.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {sparks.map((spark, index) => (
        <div
          key={spark.id}
          className="absolute w-1 h-4 rounded-full bg-gradient-to-b from-accent to-primary"
          style={{
            left: `${spark.x}%`,
            bottom: 0,
            animation: `spark-rise 0.8s ease-out ${index * 0.05}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
