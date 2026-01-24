import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WelcomeScreen } from '@/components/game/WelcomeScreen';
import { BottomNav } from '@/components/game/BottomNav';
import { useSettings } from '@/hooks/useSettings';
import { useAchievements } from '@/hooks/useAchievements';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { useWallet } from '@/hooks/useWallet';
import { RarityResult } from '@/utils/rarityCalculator';
import { AdminErrorBoundary, AdminPanelRouteFallback } from '@/components/game/admin';
import { MemoryGame } from '@/components/game/MemoryGame';

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
const AdminPanel = lazy(() => import('@/components/game/AdminPanel').then(m => ({ default: m.AdminPanel })));

type GameView = 'welcome' | 'wallet' | 'levels' | 'game' | 'leaderboard' | 'ai-art' | 'settings' | 'stats' | 'achievements' | 'admin' | 'memory-game';

const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
};

const Index = () => {
  const [currentView, setCurrentView] = useState<GameView>('welcome');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [lastScore, setLastScore] = useState(0);
  const [lastRarity, setLastRarity] = useState<RarityResult | null>(null);
  const [lastGameStats, setLastGameStats] = useState<{ moves: number; time: number; maxCombo: number } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dailyChallengeConfig, setDailyChallengeConfig] = useState<{ gridSize: number; timeLimit: number } | null>(null);
  const [gameKey, setGameKey] = useState(0); // Key to force re-mount
  const { settings, updateSetting, resetSettings, markTutorialComplete } = useSettings();
  const { achievements, newUnlock, dismissNewUnlock, unlockedCount, totalCount } = useAchievements();
  const { address: walletAddress } = useWallet();
  
  // Background music system
  const { isPlaying, toggle: toggleMusic, setVolume: setMusicVolume, changeTheme } = useBackgroundMusic(settings.musicTheme);
  const hasUserInteracted = useRef(false);
  
  // Handle user interaction to enable audio (browser autoplay policy)
  const handleUserInteraction = useCallback(() => {
    if (!hasUserInteracted.current) {
      hasUserInteracted.current = true;
      // Start music on first interaction if enabled in settings
      if (settings.musicEnabled && !isPlaying) {
        toggleMusic();
      }
    }
  }, [settings.musicEnabled, isPlaying, toggleMusic]);
  
  // Add global click listener for first interaction
  useEffect(() => {
    const handler = () => handleUserInteraction();
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [handleUserInteraction]);
  
  // Sync music state with settings
  useEffect(() => {
    if (hasUserInteracted.current) {
      if (settings.musicEnabled && !isPlaying) {
        toggleMusic();
      } else if (!settings.musicEnabled && isPlaying) {
        toggleMusic();
      }
    }
  }, [settings.musicEnabled, isPlaying, toggleMusic]);
  
  // Update music volume when settings change
  useEffect(() => {
    setMusicVolume(settings.musicVolume);
  }, [settings.musicVolume, setMusicVolume]);
  
  // Update music theme when settings change
  useEffect(() => {
    changeTheme(settings.musicTheme);
  }, [settings.musicTheme, changeTheme]);

  // Show tutorial on first visit
  useEffect(() => {
    if (settings.showTutorial) {
      setShowTutorial(true);
    }
  }, [settings.showTutorial]);

  const handleStartGame = () => {
    setCurrentView('memory-game');
  };

  const handlePlayClassicMode = () => {
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

  const handleCreateArt = (score: number, rarity: RarityResult, stats?: { moves: number; time: number; maxCombo: number }) => {
    setLastScore(score);
    setLastRarity(rarity);
    setLastGameStats(stats || null);
    setCurrentView('ai-art');
  };

  const handleNextLevel = (nextLevel: number) => {
    setSelectedLevel(nextLevel);
    setGameKey(prev => prev + 1); // Force re-mount without view flicker
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
          <Suspense fallback={null}>
            <WalletScreen 
              onBack={handleBackToMenu}
              onConnected={handleWalletConnected}
            />
          </Suspense>
        );
      case 'levels':
        return (
          <Suspense fallback={null}>
            <LevelSelector
              onSelectLevel={handleSelectLevel}
              onBack={handleBackToMenu}
            />
          </Suspense>
        );
      case 'game':
        return (
          <Suspense fallback={null}>
            <GameScreen 
              key={gameKey}
              onBackToMenu={handleBackToMenu}
              level={selectedLevel}
              onCreateArt={handleCreateArt}
              onNextLevel={handleNextLevel}
            />
          </Suspense>
        );
      case 'leaderboard':
        return (
          <Suspense fallback={null}>
            <Leaderboard onBack={handleBackToMenu} />
          </Suspense>
        );
      case 'ai-art':
        return (
          <Suspense fallback={null}>
            <AIImageGenerator
              score={lastScore}
              onBack={handleBackToMenu}
              onComplete={handleBackToMenu}
              moves={lastGameStats?.moves}
              time={lastGameStats?.time}
              maxCombo={lastGameStats?.maxCombo}
              level={selectedLevel}
            />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={null}>
            <SettingsScreen
              settings={settings}
              onUpdateSetting={updateSetting}
              onReset={resetSettings}
              onBack={handleBackToMenu}
              onReplayTutorial={handleReplayTutorial}
              onResetProgress={() => {
                import('@/data/levels').then(({ resetProgress }) => {
                  resetProgress();
                });
              }}
            />
          </Suspense>
        );
      case 'stats':
        return (
          <Suspense fallback={null}>
            <StatsScreen onBack={handleBackToMenu} />
          </Suspense>
        );
      case 'achievements':
        return (
          <Suspense fallback={null}>
            <AchievementsPanel
              achievements={achievements}
              unlockedCount={unlockedCount}
              totalCount={totalCount}
              onClose={handleBackToMenu}
            />
          </Suspense>
        );
      case 'admin':
        return (
          <AdminErrorBoundary onClose={handleBackToMenu} onRetry={() => { /* AdminPanel has its own retry */ }}>
            <Suspense fallback={<AdminPanelRouteFallback />}>
              <AdminPanel walletAddress={walletAddress || ''} onClose={handleBackToMenu} />
            </Suspense>
          </AdminErrorBoundary>
        );
      case 'memory-game':
        return <MemoryGame onBack={handleBackToMenu} />;
      default:
        return null;
    }
  };

  const handleNavigation = useCallback((view: GameView) => {
    setCurrentView(view);
  }, []);

  return (
    <>
      {showTutorial && (
        <Suspense fallback={null}>
          <Tutorial onComplete={handleTutorialComplete} />
        </Suspense>
      )}
      
      {/* Achievement unlock popup */}
      <AnimatePresence>
        {newUnlock && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <Suspense fallback={null}>
              <AchievementUnlockPopup 
                achievement={newUnlock} 
                onDismiss={dismissNewUnlock} 
              />
            </Suspense>
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
          className="min-h-screen pb-20"
        >
          {renderCurrentView()}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav currentView={currentView} onNavigate={handleNavigation} walletAddress={walletAddress} />
    </>
  );
};

export default Index;
