import type { LeaderboardSegment } from "./types";

interface MedianRowProps {
  segment: LeaderboardSegment;
}

export function MedianRow({ segment }: MedianRowProps) {
  const m = segment.median;
  const labelCategory =
    segment.origin === "override"
      ? "Curated competitor set"
      : segment.widened_to
      ? `Broader ${segment.widened_to} category`
      : segment.category ?? "segment";

  return (
    <div
      role="separator"
      aria-label={`Segment median: Pulse ${m.health_score ?? "not available"}`}
      className="my-1.5 grid items-center gap-3.5 border-y border-dashed border-slate-400 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500 grid-cols-[30px_minmax(140px,2fr)_70px_70px_70px_70px_80px_12px]"
    >
      <span />
      <span className="text-slate-500">Segment median · {labelCategory}</span>
      <span className="text-right text-slate-500">{m.health_score ?? "—"}</span>
      <span className="text-right text-slate-500">{m.product_stability ?? "—"}</span>
      <span className="text-right text-slate-500">{m.customer_experience ?? "—"}</span>
      <span className="text-right text-slate-500">{m.value_perception ?? "—"}</span>
      <span />
      <span />
    </div>
  );
}
