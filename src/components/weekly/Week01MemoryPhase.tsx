import { WEEK_01 } from "./week01.data";
import { useWeeklyGame } from "./WeeklyGameProvider";
import { useState, useCallback } from "react";

export function isValidPair(a: string, b: string, pairs: [string, string][]): boolean {
  return pairs.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
}

const OBJECT_EMOJIS: Record<string, string> = {
  mirror: "🪞",
  clock: "🕰️",
  key: "🔑",
  brush: "🖌️",
  letter: "✉️",
};

export function Week01MemoryPhase() {
  const { setCompleted, setPhase } = useWeeklyGame();
  const [selected, setSelected] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<"match" | "miss" | null>(null);

  const cards = WEEK_01.hiddenObjects.map(o => o.id);

  const select = useCallback((id: string) => {
    if (isChecking || selected.length === 2 || matched.includes(id) || selected.includes(id)) {
      return;
    }

    const newSel = [...selected, id];
    setSelected(newSel);

    if (newSel.length === 2) {
      setIsChecking(true);
      const valid = isValidPair(newSel[0], newSel[1], WEEK_01.memoryPairs);
      setLastResult(valid ? "match" : "miss");

      setTimeout(() => {
        if (valid) {
          const newMatched = [...matched, ...newSel];
          setMatched(newMatched);
          
          if (newMatched.length === cards.length) {
            setTimeout(() => {
              setPhase("complete");
              setCompleted(true);
            }, 800);
          }
        }
        setSelected([]);
        setIsChecking(false);
        setTimeout(() => setLastResult(null), 300);
      }, 700);
    }
  }, [selected, matched, isChecking, cards.length, setCompleted, setPhase]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="mb-6 text-foreground text-center">
        <h2 className="text-2xl font-bold mb-2">Memory Fusion</h2>
        <p className="text-muted-foreground">Match the paired objects from the atelier</p>
        <p className="text-sm mt-2 text-primary">
          Matched: {matched.length} / {cards.length}
        </p>
        
        {lastResult && (
          <p className={`mt-2 font-semibold animate-pulse ${
            lastResult === "match" ? "text-green-500" : "text-red-500"
          }`}>
            {lastResult === "match" ? "✓ Match!" : "✗ Try again"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md">
        {cards.map(id => {
          const isSelected = selected.includes(id);
          const isMatched = matched.includes(id);

          return (
            <button
              key={id}
              onClick={() => select(id)}
              disabled={isMatched || isChecking}
              className={`
                relative w-24 h-24 rounded-lg border-2 transition-all duration-300
                ${isMatched 
                  ? 'opacity-30 border-green-500 cursor-not-allowed bg-green-900/20' 
                  : 'border-border hover:border-primary bg-card'}
                ${isSelected 
                  ? 'scale-105 border-primary shadow-lg shadow-primary/50 bg-primary/10' 
                  : ''}
                ${isChecking && !isSelected 
                  ? 'cursor-wait' 
                  : 'cursor-pointer'}
                backdrop-blur-sm
                flex items-center justify-center
              `}
            >
              <span className="text-4xl">
                {OBJECT_EMOJIS[id] || "❓"}
              </span>
              <span className="absolute bottom-1 text-xs text-muted-foreground capitalize">
                {id}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground max-w-xs">
        <p>Hint: Objects that were near each other in the atelier are paired!</p>
      </div>
    </div>
  );
}
