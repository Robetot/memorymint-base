import { Button } from '@/components/ui/button';
import { Home, Trophy, Award, Settings, Wallet, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_OWNER_ADDRESS = '0x830f4c15480aa516a0cc4826902443936f9596cf';

type NavView = 'welcome' | 'levels' | 'game' | 'leaderboard' | 'achievements' | 'settings' | 'wallet' | 'stats' | 'ai-art' | 'admin' | 'memory-game';

interface BottomNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  walletAddress?: string | null;
}

const navItems = [
  { view: 'welcome' as const, icon: Home, label: 'Home' },
  { view: 'leaderboard' as const, icon: Trophy, label: 'Ranks' },
  { view: 'achievements' as const, icon: Award, label: 'Badges' },
  { view: 'wallet' as const, icon: Wallet, label: 'Wallet' },
  { view: 'settings' as const, icon: Settings, label: 'Settings' },
];

export function BottomNav({ currentView, onNavigate, walletAddress }: BottomNavProps) {
  // Hide bottom nav during gameplay
  if (currentView === 'game' || currentView === 'ai-art') {
    return null;
  }

  // Check if connected wallet is admin (case-insensitive)
  const isAdmin = walletAddress?.toLowerCase() === ADMIN_OWNER_ADDRESS.toLowerCase();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">
        {navItems.map(({ view, icon: Icon, label }) => {
          const isActive = currentView === view || 
            (view === 'welcome' && currentView === 'levels') ||
            (view === 'achievements' && currentView === 'stats');
          
          return (
            <Button
              key={view}
              variant="ghost"
              onClick={() => onNavigate(view)}
              className={cn(
                'flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[56px] min-h-[56px] rounded-xl transition-all',
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Button>
          );
        })}
        
        {/* Admin button - only visible to admin wallet */}
        {isAdmin && (
          <Button
            variant="ghost"
            onClick={() => onNavigate('admin')}
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-[56px] min-h-[56px] rounded-xl transition-all',
              currentView === 'admin'
                ? 'text-amber-500 bg-amber-500/10' 
                : 'text-amber-400/70 hover:text-amber-500 hover:bg-amber-500/10'
            )}
            aria-label="Admin Panel"
            aria-current={currentView === 'admin' ? 'page' : undefined}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Button>
        )}
      </div>
    </nav>
  );
}
