import { WeeklyGameProvider, useWeeklyGame } from "./WeeklyGameProvider";
import { Week01HiddenPhase } from "./Week01HiddenPhase";
import { Week01MemoryPhase } from "./Week01MemoryPhase";
import { Week01Distortion } from "./Week01Distortion";
import { WeeklyCompleteModal } from "./WeeklyCompleteModal";
import { WEEK_01 } from "./week01.data";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Week01FlowProps {
  onBack?: () => void;
}

function Week01Flow({ onBack }: Week01FlowProps) {
  const { phase, completed, resetGame, foundObjects } = useWeeklyGame();

  const handleClose = () => {
    resetGame();
    onBack?.();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Atmospheric background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{ 
          backgroundImage: `
            radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, hsl(var(--accent) / 0.1) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, hsl(var(--secondary) / 0.05) 0%, transparent 60%)
          `
        }}
      />

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {/* Back button */}
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}

          {/* Title */}
          <div className="text-center flex-1">
            <h1 className="text-lg font-bold text-foreground">{WEEK_01.title}</h1>
            <p className="text-xs text-muted-foreground">Week {WEEK_01.weekId}</p>
          </div>

          {/* Progress indicator for hidden phase */}
          {phase === "hidden" && (
            <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
              <Search className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {foundObjects.length}/{WEEK_01.hiddenObjects.length}
              </span>
            </div>
          )}
          
          {phase !== "hidden" && <div className="w-16" />}
        </div>
      </header>

      {/* Distortion overlay during hidden phase */}
      <Week01Distortion active={phase === "hidden"} />

      {/* Game phases */}
      <div className="relative z-20 pt-16">
        {phase === "hidden" && <Week01HiddenPhase />}
        {phase === "memory" && <Week01MemoryPhase />}
      </div>

      {/* Completion modal */}
      {completed && (
        <WeeklyCompleteModal 
          weekId={WEEK_01.weekId} 
          onClose={handleClose}
        />
      )}
    </div>
  );
}

interface Week01GameProps {
  onBack?: () => void;
}

export default function Week01Game({ onBack }: Week01GameProps) {
  return (
    <WeeklyGameProvider>
      <Week01Flow onBack={onBack} />
    </WeeklyGameProvider>
  );
}
