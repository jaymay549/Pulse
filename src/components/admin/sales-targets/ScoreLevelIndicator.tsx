export function ScoreLevelIndicator({ score, label, colorClass }: { score: number, label: string, colorClass: string }) {
  const segments = Math.round(score / 20);
  return (
    <div className="flex flex-col gap-1 min-w-[60px]">
      <span className="text-[9px] uppercase text-zinc-600 font-mono tracking-wider leading-none">{label}</span>
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className={`h-1.5 w-2.5 rounded-[1px] transition-all duration-500 ${
              i < segments ? colorClass : 'bg-zinc-800'
            } ${
              score >= 70 && i < segments 
                ? 'shadow-[0_0_8px_rgba(248,113,113,0.3)]' 
                : ''
            }`} 
          />
        ))}
      </div>
    </div>
  );
}
