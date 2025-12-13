import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft, Sparkles, Timer, Trophy, Lightbulb, Layers } from 'lucide-react';

interface TutorialProps {
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to MemoryMint!',
    content: 'Test your memory by matching pairs of adorable animals. Flip cards to reveal them and find all matching pairs before time runs out!',
    icon: Sparkles,
    color: 'from-primary to-secondary',
  },
  {
    title: 'How to Play',
    content: 'Tap any card to flip it and reveal an animal. Then tap another card to find its match. Match all pairs to win!',
    icon: Layers,
    color: 'from-accent to-primary',
  },
  {
    title: 'Beat the Clock',
    content: 'Each level has a time limit. Finish faster for bonus points! The timer turns red when time is running low.',
    icon: Timer,
    color: 'from-destructive to-accent',
  },
  {
    title: 'Earn NFT Rewards',
    content: 'Win the game to create unique AI-generated art as NFTs. Your skill determines the rarity: Common, Rare, Epic, Legendary, or Mythic!',
    icon: Trophy,
    color: 'from-yellow-500 to-orange-500',
  },
  {
    title: 'Use Hints Wisely',
    content: 'Stuck? Use the hint button to briefly reveal a matching pair. But use them sparingly - they\'re limited!',
    icon: Lightbulb,
    color: 'from-yellow-400 to-amber-500',
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
  const IconComponent = step.icon;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-scale-in">
        {/* Header with skip */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-muted-foreground font-medium">
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip
            <X className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
            <IconComponent className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-display font-bold text-foreground mb-3">
            {step.title}
          </h2>
          <p className="text-muted-foreground font-body leading-relaxed text-sm md:text-base">
            {step.content}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {TUTORIAL_STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              aria-label={`Go to step ${index + 1} of ${TUTORIAL_STEPS.length}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-muted hover:bg-muted-foreground/50'
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
            className="flex-1 font-display rounded-xl h-12"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            className={`flex-1 font-display rounded-xl h-12 bg-gradient-to-r ${step.color} hover:opacity-90 text-white border-0`}
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
