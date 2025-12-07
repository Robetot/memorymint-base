import { Button } from '@/components/ui/button';
import { Sparkles, Play, Wallet } from 'lucide-react';

interface WelcomeScreenProps {
  onStartGame: () => void;
}

export function WelcomeScreen({ onStartGame }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted to-background overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-float" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-secondary/20 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-1/3 w-16 h-16 bg-primary/20 rounded-full blur-xl animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Logo and Title */}
      <div className="relative z-10 text-center mb-12">
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

      {/* Animal preview cards */}
      <div className="flex gap-4 mb-12 relative z-10">
        {['🦆', '🐕', '🐱', '🐄'].map((emoji, i) => (
          <div
            key={emoji}
            className="w-16 h-16 md:w-20 md:h-20 bg-card rounded-xl shadow-lg flex items-center justify-center text-3xl md:text-4xl animate-bounce-in border-2 border-border hover:border-primary transition-colors hover:scale-110"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* Start button */}
      <div className="relative z-10 flex flex-col gap-4 items-center">
        <Button
          onClick={onStartGame}
          size="lg"
          className="text-xl px-12 py-8 rounded-2xl font-display bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg hover:shadow-xl transition-all hover:scale-105 glow-primary"
        >
          <Play className="w-6 h-6 mr-2" />
          Play Demo
        </Button>
        
        <p className="text-sm text-muted-foreground flex items-center gap-2 font-body">
          <Wallet className="w-4 h-4" />
          Wallet connection coming soon
        </p>
      </div>

      {/* Features preview */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full relative z-10">
        {[
          { icon: '🎮', title: 'Match & Win', desc: 'Classic memory gameplay' },
          { icon: '🎨', title: 'Create Art', desc: 'AI-powered image forge' },
          { icon: '💎', title: 'Mint NFTs', desc: 'Own your creations on Base' },
        ].map((feature, i) => (
          <div
            key={feature.title}
            className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-6 text-center hover:bg-card/80 transition-all hover:scale-105 animate-bounce-in"
            style={{ animationDelay: `${0.3 + i * 0.1}s` }}
          >
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="font-display font-semibold text-foreground mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground font-body">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
