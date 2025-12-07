import { Button } from '@/components/ui/button';
import { Sparkles, Play, Wallet, Trophy, Settings, BarChart3 } from 'lucide-react';

import calfImg from '@/assets/animals/calf.jpg';
import puppyImg from '@/assets/animals/puppy.jpg';
import ducklingImg from '@/assets/animals/duckling.jpg';
import tigerImg from '@/assets/animals/tiger.jpg';

interface WelcomeScreenProps {
  onStartGame: () => void;
  onConnectWallet: () => void;
  onViewLeaderboard?: () => void;
  onViewSettings?: () => void;
  onViewStats?: () => void;
}

const previewAnimals = [
  { img: calfImg, name: 'Calf' },
  { img: puppyImg, name: 'Puppy' },
  { img: ducklingImg, name: 'Duckling' },
  { img: tigerImg, name: 'Tiger' },
];

export function WelcomeScreen({ onStartGame, onConnectWallet, onViewLeaderboard, onViewSettings, onViewStats }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted to-background overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-float" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-secondary/20 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Settings button */}
      {onViewSettings && (
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="icon" onClick={onViewSettings} className="rounded-full">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Logo */}
      <div className="relative z-10 text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg glow-primary animate-pulse-glow">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4 text-glow">
          MemoryMint
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto font-body">
          Classic Skill. Modern Creation. On-Chain Ownership.
        </p>
      </div>

      {/* Animal cards */}
      <div className="flex gap-4 mb-10 relative z-10">
        {previewAnimals.map((animal, i) => (
          <div
            key={animal.name}
            className="w-16 h-16 md:w-20 md:h-20 bg-card rounded-xl shadow-lg overflow-hidden animate-bounce-in border-2 border-border hover:border-primary transition-all hover:scale-110"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <img src={animal.img} alt={animal.name} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Main buttons */}
      <div className="relative z-10 flex flex-col gap-4 items-center w-full max-w-sm">
        <Button
          onClick={onStartGame}
          size="lg"
          className="w-full text-xl py-8 rounded-2xl font-display bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg hover:shadow-xl transition-all hover:scale-105 glow-primary"
        >
          <Play className="w-6 h-6 mr-2" />
          Play Now
        </Button>
        
        <div className="flex gap-3 w-full">
          <Button onClick={onConnectWallet} variant="outline" size="lg" className="flex-1 py-6 rounded-xl font-display">
            <Wallet className="w-5 h-5 mr-2" />
            Wallet
          </Button>
          {onViewLeaderboard && (
            <Button onClick={onViewLeaderboard} variant="outline" size="lg" className="flex-1 py-6 rounded-xl font-display">
              <Trophy className="w-5 h-5 mr-2" />
              Ranks
            </Button>
          )}
          {onViewStats && (
            <Button onClick={onViewStats} variant="outline" size="lg" className="flex-1 py-6 rounded-xl font-display">
              <BarChart3 className="w-5 h-5 mr-2" />
              Stats
            </Button>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg w-full relative z-10">
        {[
          { icon: '🎮', title: 'Match & Win' },
          { icon: '🎨', title: 'Create Art' },
          { icon: '💎', title: 'Mint NFTs' },
        ].map((feature, i) => (
          <div key={feature.title} className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 text-center animate-bounce-in" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
            <div className="text-3xl mb-2">{feature.icon}</div>
            <p className="text-xs font-display font-medium text-foreground">{feature.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
