import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

interface TutorialProps {
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to MemoryMint! 🎮',
    content: 'Match pairs of adorable animals to win! Flip cards to reveal them and find matching pairs before time runs out.',
    image: '🎴',
  },
  {
    title: 'Build Combos! ⚡',
    content: 'Match multiple pairs in a row without mistakes to build combos. Higher combos mean bigger scores and rarer NFT rewards!',
    image: '🔥',
  },
  {
    title: 'Beat the Clock! ⏱️',
    content: 'Each difficulty level has a time limit. Finish faster for bonus points! Watch the timer - it turns red when time is running low.',
    image: '⏰',
  },
  {
    title: 'Earn NFT Rewards! 💎',
    content: 'Win the game to create unique AI-generated art. Your skill determines the rarity: Common, Rare, Epic, Legendary, or Mythic!',
    image: '✨',
  },
  {
    title: 'Use Hints Wisely! 💡',
    content: 'Stuck? Use hints to briefly reveal a matching pair. But use them sparingly - they\'re limited and reduce your final score!',
    image: '💡',
  },
];

export function Tutorial({ onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border-2 border-primary rounded-3xl p-8 max-w-md w-full shadow-2xl animate-bounce-in">
        {/* Skip button */}
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkip}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-float">{step.image}</div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-4">
            {step.title}
          </h2>
          <p className="text-muted-foreground font-body leading-relaxed">
            {step.content}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {TUTORIAL_STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-primary scale-125'
                  : 'bg-muted hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={currentStep === 0}
            className="flex-1 font-display"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1 font-display bg-gradient-to-r from-primary to-secondary"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? (
              "Let's Play!"
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
