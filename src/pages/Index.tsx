import { useState, useEffect } from 'react';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { GameScreen } from '@/components/game/GameScreen';
import { WalletScreen } from '@/components/game/WalletScreen';
import { DifficultySelector } from '@/components/game/DifficultySelector';
import { Leaderboard } from '@/components/game/Leaderboard';
import { AIImageGenerator } from '@/components/game/AIImageGenerator';
import { Tutorial } from '@/components/game/Tutorial';
import { SettingsScreen } from '@/components/game/SettingsScreen';
import { StatsScreen } from '@/components/game/StatsScreen';
import { useSettings } from '@/hooks/useSettings';
import { Difficulty } from '@/data/animals';
import { RarityResult } from '@/utils/rarityCalculator';

type GameView = 'welcome' | 'wallet' | 'difficulty' | 'game' | 'leaderboard' | 'ai-art' | 'settings' | 'stats';

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('4x4');
  const [lastScore, setLastScore] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const { settings, updateSetting, resetSettings, markTutorialComplete } = useSettings();

  // Show tutorial on first visit
  useEffect(() => {
    if (settings.showTutorial) {
      setShowTutorial(true);
    }
  }, []);

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

  const handleViewLeaderboard = () => {
    setCurrentView('leaderboard');
  };

  const handleViewSettings = () => {
    setCurrentView('settings');
  };

  const handleViewStats = () => {
    setCurrentView('stats');
  };

  const handleCreateArt = (score: number, rarity: RarityResult) => {
    setLastScore(score);
    setCurrentView('ai-art');
  };

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    markTutorialComplete();
  };

  return (
    <>
      {showTutorial && <Tutorial onComplete={handleTutorialComplete} />}
      
      {currentView === 'welcome' && (
        <WelcomeScreen 
          onStartGame={handleStartGame} 
          onConnectWallet={handleConnectWallet}
          onViewLeaderboard={handleViewLeaderboard}
          onViewSettings={handleViewSettings}
          onViewStats={handleViewStats}
        />
      )}
      {currentView === 'wallet' && (
        <WalletScreen 
          onBack={handleBackToMenu}
          onConnected={handleWalletConnected}
        />
      )}
      {currentView === 'difficulty' && (
        <DifficultySelector
          onSelectDifficulty={handleSelectDifficulty}
          onBack={handleBackToMenu}
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
          onComplete={handleBackToMenu}
        />
      )}
      {currentView === 'settings' && (
        <SettingsScreen
          settings={settings}
          onUpdateSetting={updateSetting}
          onReset={resetSettings}
          onBack={handleBackToMenu}
        />
      )}
      {currentView === 'stats' && (
        <StatsScreen onBack={handleBackToMenu} />
      )}
    </>
  );
};

export default Index;
