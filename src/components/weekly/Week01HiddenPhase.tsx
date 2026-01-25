import { WEEK_01 } from "./week01.data";
import { useWeeklyGame } from "./WeeklyGameProvider";
import { useState } from "react";

export function Week01HiddenPhase() {
  const { foundObjects, setFoundObjects, setPhase } = useWeeklyGame();
  const [clickedObject, setClickedObject] = useState<string | null>(null);

  function find(id: string) {
    if (foundObjects.includes(id)) return;
    
    setClickedObject(id);
    const updated = [...foundObjects, id];
    setFoundObjects(updated);

    // Visual feedback before removing
    setTimeout(() => setClickedObject(null), 500);

    if (updated.length === WEEK_01.hiddenObjects.length) {
      setTimeout(() => setPhase("memory"), 1500);
    }
  }

  return (
    <div className="absolute inset-0">
      {/* Progress indicator */}
      <div className="absolute top-4 left-4 bg-black/60 text-foreground px-4 py-2 rounded-lg z-30">
        Found: {foundObjects.length} / {WEEK_01.hiddenObjects.length}
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-black/60 text-foreground px-4 py-2 rounded-lg z-30 text-sm">
        Find all hidden objects!
      </div>

      {WEEK_01.hiddenObjects.map(obj => {
        const isFound = foundObjects.includes(obj.id);
        const isClicked = clickedObject === obj.id;
        
        return (
          <div
            key={obj.id}
            onClick={() => find(obj.id)}
            className={`
              absolute cursor-pointer transition-all duration-300
              ${isFound ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 hover:scale-110'}
              ${isClicked ? 'scale-125 animate-bounce' : ''}
              bg-gradient-to-br from-primary/20 to-accent/20 rounded-full
              border-2 border-primary/50 hover:border-primary
              flex items-center justify-center
              shadow-lg hover:shadow-primary/30
            `}
            style={{
              top: obj.position.top,
              left: obj.position.left,
              width: obj.size?.width || "80px",
              height: obj.size?.height || "80px",
            }}
          >
            <span className="text-2xl">
              {obj.id === "mirror" && "🪞"}
              {obj.id === "clock" && "🕰️"}
              {obj.id === "key" && "🔑"}
              {obj.id === "brush" && "🖌️"}
              {obj.id === "letter" && "✉️"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
