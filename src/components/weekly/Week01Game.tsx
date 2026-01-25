import { WeeklyGameProvider, useWeeklyGame } from "./WeeklyGameProvider";
import { Week01HiddenPhase } from "./Week01HiddenPhase";
import { Week01MemoryPhase } from "./Week01MemoryPhase";
import { Week01Distortion } from "./Week01Distortion";
import { WeeklyCompleteModal } from "./WeeklyCompleteModal";
import { WEEK_01 } from "./week01.data";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Week01FlowProps {
  onBack?: () => void;
}

function Week01Flow({ onBack }: Week01FlowProps) {
  const { phase, completed, resetGame } = useWeeklyGame();

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

      {/* Back button */}
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="absolute top-4 left-4 z-40"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      )}

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 text-center">
        <h1 className="text-xl font-bold text-foreground">{WEEK_01.title}</h1>
        <p className="text-sm text-muted-foreground">Week {WEEK_01.weekId}</p>
      </div>

      {/* Distortion overlay during hidden phase */}
      <Week01Distortion active={phase === "hidden"} />

      {/* Game phases */}
      <div className="relative z-20">
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
