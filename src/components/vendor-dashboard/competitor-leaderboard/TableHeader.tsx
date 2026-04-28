export function TableHeader() {
  const right = "text-right";
  return (
    <div
      className="grid items-center gap-3.5 border-b border-slate-200 pb-2.5 pt-3.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 grid-cols-[30px_minmax(140px,2fr)_70px_70px_70px_70px_80px_12px]"
    >
      <span />
      <span>Vendor</span>
      <span className={right}>Pulse</span>
      <span className={right}>Stability</span>
      <span className={right}>CX</span>
      <span className={right}>Value</span>
      <span className={right}>90D</span>
      <span />
    </div>
  );
}
