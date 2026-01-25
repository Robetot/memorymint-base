export function Week01Distortion({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-10 animate-pulse opacity-20"
      style={{
        background: `
          radial-gradient(ellipse at 20% 30%, hsl(var(--primary) / 0.3) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, hsl(var(--accent) / 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, transparent 0%, hsl(var(--background) / 0.1) 100%)
        `,
        mixBlendMode: "overlay",
      }}
    />
  );
}
