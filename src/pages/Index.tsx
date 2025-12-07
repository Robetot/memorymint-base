import { useState } from 'react';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { GameScreen } from '@/components/game/GameScreen';
import { WalletScreen } from '@/components/game/WalletScreen';
import { DifficultySelector } from '@/components/game/DifficultySelector';
import { Leaderboard } from '@/components/game/Leaderboard';
import { AIImageGenerator } from '@/components/game/AIImageGenerator';
import { Difficulty } from '@/data/animals';

type GameView = 'welcome' | 'wallet' | 'difficulty' | 'game' | 'leaderboard' | 'ai-art';

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('4x4');
  const [lastScore, setLastScore] = useState(0);

  const handleStartGame = () => {
    setCurrentView('difficulty');
  };

  const handleConnectWallet = () => {
    setCurrentView('wallet');
  };

  const handleWalletConnected = () => {
    setCurrentView('difficulty');
  };

  const handleSelectDifficulty = (difficulty: Difficulty) => {
    setSelectedDifficulty(difficulty);
    setCurrentView('game');
  };

  const handleBackToMenu = () => {
    setCurrentView('welcome');
  };

  const handleBackFromDifficulty = () => {
    setCurrentView('welcome');
  };

  const handleBackFromWallet = () => {
    setCurrentView('welcome');
  };

  const handleViewLeaderboard = () => {
    setCurrentView('leaderboard');
  };

  const handleCreateArt = (score: number) => {
    setLastScore(score);
    setCurrentView('ai-art');
  };

  const handleArtComplete = () => {
    setCurrentView('welcome');
  };

  return (
    <>
      {currentView === 'welcome' && (
        <WelcomeScreen 
          onStartGame={handleStartGame} 
          onConnectWallet={handleConnectWallet}
          onViewLeaderboard={handleViewLeaderboard}
        />
      )}
      {currentView === 'wallet' && (
        <WalletScreen 
          onBack={handleBackFromWallet}
          onConnected={handleWalletConnected}
        />
      )}
      {currentView === 'difficulty' && (
        <DifficultySelector
          onSelectDifficulty={handleSelectDifficulty}
          onBack={handleBackFromDifficulty}
        />
      )}
      {currentView === 'game' && (
        <GameScreen 
          onBackToMenu={handleBackToMenu}
          difficulty={selectedDifficulty}
          onCreateArt={handleCreateArt}
        />
      )}
      {currentView === 'leaderboard' && (
        <Leaderboard onBack={handleBackToMenu} />
      )}
      {currentView === 'ai-art' && (
        <AIImageGenerator
          score={lastScore}
          onBack={handleBackToMenu}
          onComplete={handleArtComplete}
        />
      )}
    </>
  );
};

export default Index;
