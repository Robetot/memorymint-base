import React, { useEffect, useRef } from 'react';
import { createHopaGame } from '@/hopa/HopaGame';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {onBack && (
        <div className="w-full max-w-[1280px] mb-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>
        </div>
      )}
      
      <div 
        ref={gameContainerRef}
        className="w-full max-w-[1280px] aspect-video rounded-lg overflow-hidden shadow-2xl border border-border"
      />
      
      <p className="mt-4 text-sm text-muted-foreground">
        Find all hidden objects in each scene!
      </p>
    </div>
  );
};

export default HopaGameWrapper;
