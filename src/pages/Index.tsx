import { useState } from 'react';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { GameScreen } from '@/components/game/GameScreen';

type GameView = 'welcome' | 'game';

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');

  const handleStartGame = () => {
    setCurrentView('game');
  };

  const handleBackToMenu = () => {
    setCurrentView('welcome');
  };

  return (
    <>
      {currentView === 'welcome' && (
        <WelcomeScreen onStartGame={handleStartGame} />
      )}
      {currentView === 'game' && (
        <GameScreen onBackToMenu={handleBackToMenu} />
      )}
    </>
  );
};

export default Index;
