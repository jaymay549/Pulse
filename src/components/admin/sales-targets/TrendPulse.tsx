export function TrendPulse({ direction }: { direction: string | null }) {
  const getColors = () => {
    if (direction === "improving") return ["bg-green-900/30", "bg-green-900/30", "bg-green-400"];
    if (direction === "declining") return ["bg-red-400", "bg-red-900/30", "bg-red-900/30"];
    return ["bg-zinc-800", "bg-zinc-500", "bg-zinc-800"];
  };
  const colors = getColors();
  return (
    <div className="flex gap-1 items-center h-full">
      {colors.map((c, i) => (
        <div 
          key={i} 
          className={`h-3 w-1 rounded-full transition-all duration-700 ${c} ${
            direction === 'improving' && i === 2 ? 'shadow-[0_0_8px_rgba(74,222,128,0.4)]' : ''
          } ${
            direction === 'declining' && i === 0 ? 'shadow-[0_0_8px_rgba(248,113,113,0.4)]' : ''
          }`} 
        />
      ))}
    </div>
  );
}
