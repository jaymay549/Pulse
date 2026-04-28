import type { LeaderboardSegment } from "./types";

interface LeaderboardHeaderProps {
  segment: LeaderboardSegment;
}

export function LeaderboardHeader({ segment }: LeaderboardHeaderProps) {
  const eyebrowCategory =
    segment.origin === "override"
      ? "Curated competitor set"
      : segment.widened_to
      ? `${segment.widened_to.toUpperCase()} (broader category)`
      : (segment.category ?? "Segment").toUpperCase();

  return (
    <div className="flex items-end justify-between gap-6 border-b border-slate-200 pb-3.5">
      <div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          Competitive Standing · {eyebrowCategory}
        </div>
        <h2 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.025em] text-slate-900">
          Where you rank, across every metric.
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
          90-day window, weighted composite. Click any row to expand the per-vendor breakdown.
        </p>
      </div>
      <span
        aria-label="Live, 90-day window"
        className="inline-flex items-center gap-1.5 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600"
      >
        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-600">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-600 opacity-50" />
        </span>
        LIVE · 90D
      </span>
    </div>
  );
}
