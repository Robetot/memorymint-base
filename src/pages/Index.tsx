import { useState, useEffect } from 'react';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { GameScreen } from '@/components/game/GameScreen';
import { WalletScreen } from '@/components/game/WalletScreen';
import { LevelSelector } from '@/components/game/LevelSelector';
import { Leaderboard } from '@/components/game/Leaderboard';
import { AIImageGenerator } from '@/components/game/AIImageGenerator';
import { Tutorial } from '@/components/game/Tutorial';
import { SettingsScreen } from '@/components/game/SettingsScreen';
import { StatsScreen } from '@/components/game/StatsScreen';
import { AchievementsPanel } from '@/components/game/AchievementsPanel';
import { AchievementUnlockPopup } from '@/components/game/AchievementUnlockPopup';
import { useSettings } from '@/hooks/useSettings';
import { useAchievements } from '@/hooks/useAchievements';
import { usePowerUpSounds } from '@/hooks/usePowerUpSounds';
import { WeeklyChallenge } from '@/hooks/useWeeklyChallenge';
import { RarityResult } from '@/utils/rarityCalculator';

type GameView = 'welcome' | 'wallet' | 'levels' | 'game' | 'leaderboard' | 'ai-art' | 'settings' | 'stats' | 'achievements';

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [lastScore, setLastScore] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dailyChallengeConfig, setDailyChallengeConfig] = useState<{ gridSize: number; timeLimit: number } | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallenge | null>(null);
  const { settings, updateSetting, resetSettings, markTutorialComplete } = useSettings();
  const { achievements, newUnlock, dismissNewUnlock, unlockedCount, totalCount } = useAchievements();
  const { playSound } = usePowerUpSounds();

  // Play achievement sound when new unlock
  useEffect(() => {
    if (newUnlock) {
      playSound('achievement');
    }
  }, [newUnlock, playSound]);

  // Show tutorial on first visit
  useEffect(() => {
    if (settings.showTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleStartGame = () => {
    setCurrentView('levels');
  };

  const handleConnectWallet = () => {
    setCurrentView('wallet');
  };

  const handleWalletConnected = () => {
    setCurrentView('levels');
  };

  const handleSelectLevel = (level: number) => {
    setSelectedLevel(level);
    setDailyChallengeConfig(null);
    setCurrentView('game');
  };

  const handleStartDailyChallenge = (gridSize: number, timeLimit: number) => {
    setDailyChallengeConfig({ gridSize, timeLimit });
    setWeeklyChallenge(null);
    // Map grid size to approximate level
    const levelMap: Record<number, number> = { 4: 3, 6: 6, 8: 8 };
    setSelectedLevel(levelMap[gridSize] || 3);
    setCurrentView('game');
  };

  const handleStartWeeklyChallenge = (challenge: WeeklyChallenge) => {
    setWeeklyChallenge(challenge);
    setDailyChallengeConfig(null);
    const levelMap: Record<number, number> = { 4: 3, 6: 6, 8: 8 };
    setSelectedLevel(levelMap[challenge.gridSize] || 6);
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

  const handleViewAchievements = () => {
    setCurrentView('achievements');
  };

  const handleCreateArt = (score: number, rarity: RarityResult) => {
    setLastScore(score);
    setCurrentView('ai-art');
  };

  const handleNextLevel = (nextLevel: number) => {
    setSelectedLevel(nextLevel);
    // Game will restart with new level
  };

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    markTutorialComplete();
  };

  return (
    <>
      {showTutorial && <Tutorial onComplete={handleTutorialComplete} />}
      
      {/* Achievement unlock popup */}
      {newUnlock && (
        <AchievementUnlockPopup 
          achievement={newUnlock} 
          onDismiss={dismissNewUnlock} 
        />
      )}
      
      {currentView === 'welcome' && (
        <WelcomeScreen 
          onStartGame={handleStartGame} 
          onConnectWallet={handleConnectWallet}
          onViewLeaderboard={handleViewLeaderboard}
          onViewSettings={handleViewSettings}
          onViewStats={handleViewStats}
          onViewAchievements={handleViewAchievements}
          onStartDailyChallenge={handleStartDailyChallenge}
          onStartWeeklyChallenge={handleStartWeeklyChallenge}
          achievementCount={{ unlocked: unlockedCount, total: totalCount }}
        />
      )}
      {currentView === 'wallet' && (
        <WalletScreen 
          onBack={handleBackToMenu}
          onConnected={handleWalletConnected}
        />
      )}
      {currentView === 'levels' && (
        <LevelSelector
          onSelectLevel={handleSelectLevel}
          onBack={handleBackToMenu}
        />
      )}
      {currentView === 'game' && (
        <GameScreen 
          onBackToMenu={handleBackToMenu}
          level={selectedLevel}
          onCreateArt={handleCreateArt}
          onNextLevel={handleNextLevel}
          weeklyChallenge={weeklyChallenge}
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
      {currentView === 'achievements' && (
        <AchievementsPanel
          achievements={achievements}
          unlockedCount={unlockedCount}
          totalCount={totalCount}
          onClose={handleBackToMenu}
        />
      )}
    </>
  );
};

export default Index;
