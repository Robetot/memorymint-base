import React, { useEffect, useRef } from 'react';
import { createHopaGame } from '@/hopa/HopaGame';

interface HopaGameWrapperProps {
  onBack?: () => void;
}

const HopaGameWrapper: React.FC<HopaGameWrapperProps> = ({ onBack }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameContainerRef.current && !gameRef.current) {
      gameRef.current = createHopaGame(gameContainerRef.current);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      id="hopa-game-container"
      ref={gameContainerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        backgroundColor: '#1a1a2e',
        overflow: 'hidden',
      }}
    />
  );
};

export default HopaGameWrapper;
