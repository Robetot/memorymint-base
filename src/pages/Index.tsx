import { useState, useEffect } from 'react';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { GameScreen } from '@/components/game/GameScreen';
import { WalletScreen } from '@/components/game/WalletScreen';
import { Leaderboard } from '@/components/game/Leaderboard';
import { AIImageGenerator } from '@/components/game/AIImageGenerator';
import { SettingsScreen } from '@/components/game/SettingsScreen';
import { StatsScreen } from '@/components/game/StatsScreen';
import { useSettings } from '@/hooks/useSettings';
import { RarityResult } from '@/utils/rarityCalculator';
import { getUnlockedLevel, getSavedNFTName, saveNFTName } from '@/data/levels';

type GameView = 'welcome' | 'wallet' | 'game' | 'leaderboard' | 'ai-art' | 'settings' | 'stats';

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [lastScore, setLastScore] = useState(0);
  const [nftName, setNftName] = useState<string | null>(null);
  const { settings, updateSetting, resetSettings } = useSettings();

  // Load saved NFT name on mount
  useEffect(() => {
    const savedName = getSavedNFTName();
    if (savedName) {
      setNftName(savedName);
    }
  }, []);

  const handleStartGame = () => {
    // Auto-start at level 1 (or resume from unlocked level)
    const startLevel = 1; // Always start from level 1 for new game
    setCurrentLevel(startLevel);
    setCurrentView('game');
  };

  const handleConnectWallet = () => {
    setCurrentView('wallet');
  };

  const handleWalletConnected = () => {
    handleStartGame();
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

  const handleNextLevel = (nextLevel: number) => {
    setCurrentLevel(nextLevel);
    // GameScreen will automatically restart with new level
  };

  // Save NFT name when set on level 1
  const handleNFTNameSet = (name: string) => {
    setNftName(name);
    saveNFTName(name);
  };

  return (
    <>
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
      {currentView === 'game' && (
        <GameScreen 
          onBackToMenu={handleBackToMenu}
          level={currentLevel}
          onCreateArt={handleCreateArt}
          onNextLevel={handleNextLevel}
          nftName={nftName}
          onNFTNameSet={handleNFTNameSet}
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
