import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Level1TutorialProps {
  onDismiss: () => void;
}

export function Level1Tutorial({ onDismiss }: Level1TutorialProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
        <div className="flex justify-between items-start mb-4">
          <div className="text-4xl">🎴</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="rounded-full -mr-2 -mt-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <h2 className="text-xl font-display font-bold text-foreground mb-2">
          Welcome to MemoryMint!
        </h2>
        
        <p className="text-muted-foreground font-body text-sm mb-4">
          Tap a card to flip it. Match two identical cards to score. Try it now!
        </p>
        
        <Button 
          onClick={onDismiss}
          className="w-full"
        >
          Got it!
        </Button>
      </div>
    </div>
  );
}
