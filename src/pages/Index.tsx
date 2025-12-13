import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { RarityResult } from '@/utils/rarityCalculator';

type GameView = 'welcome' | 'wallet' | 'levels' | 'game' | 'leaderboard' | 'ai-art' | 'settings' | 'stats' | 'achievements';

const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
};

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [lastScore, setLastScore] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dailyChallengeConfig, setDailyChallengeConfig] = useState<{ gridSize: number; timeLimit: number } | null>(null);
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
    const levelMap: Record<number, number> = { 2: 1, 4: 3, 6: 6 };
    setSelectedLevel(levelMap[gridSize] || 3);
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
  };

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    markTutorialComplete();
  };

  const handleReplayTutorial = () => {
    setShowTutorial(true);
    setCurrentView('welcome');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'welcome':
        return (
          <WelcomeScreen 
            onStartGame={handleStartGame} 
            onConnectWallet={handleConnectWallet}
            onViewLeaderboard={handleViewLeaderboard}
            onViewSettings={handleViewSettings}
            onViewStats={handleViewStats}
            onViewAchievements={handleViewAchievements}
            onStartDailyChallenge={handleStartDailyChallenge}
            achievementCount={{ unlocked: unlockedCount, total: totalCount }}
          />
        );
      case 'wallet':
        return (
          <WalletScreen 
            onBack={handleBackToMenu}
            onConnected={handleWalletConnected}
          />
        );
      case 'levels':
        return (
          <LevelSelector
            onSelectLevel={handleSelectLevel}
            onBack={handleBackToMenu}
          />
        );
      case 'game':
        return (
          <GameScreen 
            onBackToMenu={handleBackToMenu}
            level={selectedLevel}
            onCreateArt={handleCreateArt}
            onNextLevel={handleNextLevel}
          />
        );
      case 'leaderboard':
        return <Leaderboard onBack={handleBackToMenu} />;
      case 'ai-art':
        return (
          <AIImageGenerator
            score={lastScore}
            onBack={handleBackToMenu}
            onComplete={handleBackToMenu}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            onUpdateSetting={updateSetting}
            onReset={resetSettings}
            onBack={handleBackToMenu}
            onReplayTutorial={handleReplayTutorial}
          />
        );
      case 'stats':
        return <StatsScreen onBack={handleBackToMenu} />;
      case 'achievements':
        return (
          <AchievementsPanel
            achievements={achievements}
            unlockedCount={unlockedCount}
            totalCount={totalCount}
            onClose={handleBackToMenu}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {showTutorial && <Tutorial onComplete={handleTutorialComplete} />}
      
      {/* Achievement unlock popup */}
      <AnimatePresence>
        {newUnlock && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <AchievementUnlockPopup 
              achievement={newUnlock} 
              onDismiss={dismissNewUnlock} 
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Page transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="min-h-screen"
        >
          {renderCurrentView()}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default Index;
