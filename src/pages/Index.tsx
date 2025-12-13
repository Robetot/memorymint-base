import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { useSettings } from '@/hooks/useSettings';
import { useAchievements } from '@/hooks/useAchievements';
import { RarityResult } from '@/utils/rarityCalculator';

// Lazy load components not needed on initial page load
const GameScreen = lazy(() => import('@/components/game/GameScreen').then(m => ({ default: m.GameScreen })));
const WalletScreen = lazy(() => import('@/components/game/WalletScreen').then(m => ({ default: m.WalletScreen })));
const LevelSelector = lazy(() => import('@/components/game/LevelSelector').then(m => ({ default: m.LevelSelector })));
const Leaderboard = lazy(() => import('@/components/game/Leaderboard').then(m => ({ default: m.Leaderboard })));
const AIImageGenerator = lazy(() => import('@/components/game/AIImageGenerator').then(m => ({ default: m.AIImageGenerator })));
const Tutorial = lazy(() => import('@/components/game/Tutorial').then(m => ({ default: m.Tutorial })));
const SettingsScreen = lazy(() => import('@/components/game/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const StatsScreen = lazy(() => import('@/components/game/StatsScreen').then(m => ({ default: m.StatsScreen })));
const AchievementsPanel = lazy(() => import('@/components/game/AchievementsPanel').then(m => ({ default: m.AchievementsPanel })));
const AchievementUnlockPopup = lazy(() => import('@/components/game/AchievementUnlockPopup').then(m => ({ default: m.AchievementUnlockPopup })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse text-primary text-xl">Loading...</div>
  </div>
);

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
    // Force re-mount GameScreen by briefly switching views
    setCurrentView('welcome');
    setTimeout(() => {
      setCurrentView('game');
    }, 0);
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
    <Suspense fallback={<LoadingFallback />}>
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
    </Suspense>
  );
};

export default Index;
