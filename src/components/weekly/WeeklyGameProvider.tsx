import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface WeeklyGameContextType {
  phase: "hidden" | "memory" | "complete";
  completed: boolean;
  foundObjects: string[];
  setFoundObjects: (ids: string[]) => void;
  setPhase: (p: "hidden" | "memory" | "complete") => void;
  setCompleted: (c: boolean) => void;
  resetGame: () => void;
}

const WeeklyGameContext = createContext<WeeklyGameContextType | null>(null);

export function WeeklyGameProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"hidden" | "memory" | "complete">("hidden");
  const [completed, setCompleted] = useState(false);
  const [foundObjects, setFoundObjects] = useState<string[]>([]);

  const resetGame = useCallback(() => {
    setPhase("hidden");
    setCompleted(false);
    setFoundObjects([]);
  }, []);

  return (
    <WeeklyGameContext.Provider 
      value={{ 
        phase, 
        completed, 
        foundObjects, 
        setFoundObjects, 
        setPhase, 
        setCompleted,
        resetGame 
      }}
    >
      {children}
    </WeeklyGameContext.Provider>
  );
}

export const useWeeklyGame = () => {
  const ctx = useContext(WeeklyGameContext);
  if (!ctx) throw new Error("useWeeklyGame must be used within WeeklyGameProvider");
  return ctx;
};
