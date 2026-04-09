import React, { useEffect, useRef, useCallback } from 'react';
import { createHopaGame } from '@/hopa/HopaGame';

interface HopaGameWrapperProps {
  onBack?: () => void;
}

const HopaGameWrapper: React.FC<HopaGameWrapperProps> = ({ onBack }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // iOS Safari viewport height fix
  const setViewportHeight = useCallback(() => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }, []);

  // Orientation change handler
  const handleOrientationChange = useCallback(() => {
    const rotateWarning = document.getElementById('rotate-warning');
    if (!rotateWarning) return;
    
    // Only show rotate warning on mobile/tablet devices, never on desktop
    const isMobileDevice = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || ('ontouchstart' in window && window.innerWidth < 1024);
    
    const isLandscape = window.innerWidth > window.innerHeight || 
      window.orientation === 90 || 
      window.orientation === -90;
    
    if (isMobileDevice && isLandscape) {
      rotateWarning.classList.add('visible');
    } else {
      rotateWarning.classList.remove('visible');
    }
  }, []);

  useEffect(() => {
    // Set initial viewport height
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Check initial orientation
    handleOrientationChange();
    
    // Initialize Phaser game
    if (gameContainerRef.current && !gameRef.current) {
      gameRef.current = createHopaGame(gameContainerRef.current);
      
      // Remove loader after game initialization
      // Phaser's preload scenes will handle their own loading bars
      const removeLoader = () => {
        const loader = document.getElementById('game-loader');
        if (loader) {
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 500);
        }
      };

      // Small delay to ensure canvas is mounted and visible
      setTimeout(removeLoader, 150);
    }

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [setViewportHeight, handleOrientationChange]);

  return (
    <>
      {/* Game Container */}
      <div 
        id="hopa-game-container"
        ref={gameContainerRef}
        style={{
          width: '100vw',
          height: 'calc(var(--vh, 1vh) * 100)', // iOS Safari fix with fallback
          minHeight: '100vh', // Fallback for non-iOS
          position: 'fixed',
          top: 0,
          left: 0,
          margin: 0,
          padding: 0,
          backgroundColor: '#1a1a2e',
          overflow: 'hidden',
          touchAction: 'none',
          // Safe area support for notches
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      />
      
      {/* Rotate Warning Overlay */}
      <div 
        id="rotate-warning"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'white',
          fontSize: '24px',
          textAlign: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <span style={{ fontSize: '64px' }}>📱</span>
        <span>Please rotate your device to portrait</span>
      </div>
      
      <style>{`
        #rotate-warning.visible {
          display: flex !important;
        }
      `}</style>
    </>
  );
};

export default HopaGameWrapper;
