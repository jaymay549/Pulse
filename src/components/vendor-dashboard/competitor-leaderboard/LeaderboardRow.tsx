import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";
import { sentimentTextClass } from "./sentiment";
import type { LeaderboardVendor } from "./types";

interface LeaderboardRowProps {
  vendor: LeaderboardVendor;
  onClick: (vendor: LeaderboardVendor) => void;
  sparkline: number[];
  sparklineTrend: "up" | "down" | "flat";
  /** Render delay in milliseconds for staggered fade-in. Default: 0. */
  delayMs?: number;
}

export function LeaderboardRow({ vendor, onClick, sparkline, sparklineTrend, delayMs = 0 }: LeaderboardRowProps) {
  const self = vendor.is_self;
  return (
    <button
      type="button"
      onClick={() => onClick(vendor)}
      aria-current={self ? "true" : undefined}
      aria-label={`Rank ${vendor.rank}, ${vendor.vendor_name}, Pulse score ${vendor.health_score ?? "not yet scored"}`}
      style={{
        animationDelay: `${delayMs}ms`,
        animationFillMode: "both",
      }}
      className={cn(
        "motion-safe:animate-[leaderboard-row-in_400ms_cubic-bezier(0.16,1,0.3,1)_both]",
        "group grid w-full items-center gap-3.5 border-b border-slate-100 px-0 py-2.5 text-left text-[13px] leading-none transition-colors",
        "grid-cols-[30px_minmax(140px,2fr)_70px_70px_70px_70px_80px_12px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        self
          ? "-mx-6 bg-yellow-50/70 px-6 hover:bg-yellow-100/70"
          : "hover:bg-slate-50",
      )}
    >
      <RankCell value={vendor.rank} self={self} />
      <NameCell name={vendor.vendor_name} mentions={vendor.mention_count} self={self} />
      <PulseCell vendor={vendor} self={self} />
      <ScoreCell value={vendor.product_stability_score} />
      <ScoreCell value={vendor.customer_experience_score} />
      <ScoreCell value={vendor.value_perception_score} />
      <div className="flex items-center justify-end">
        <Sparkline values={sparkline} isSelf={self} trend={sparklineTrend} />
      </div>
      <ChevronRight
        className={cn(
          "h-3 w-3 justify-self-end text-slate-300 transition-all",
          "group-hover:translate-x-0.5 group-hover:text-slate-500",
          self && "text-amber-500",
        )}
      />
    </button>
  );
}

function RankCell({ value, self }: { value: number; self: boolean }) {
  return (
    <span className={cn("text-xs font-semibold tabular-nums", self ? "text-amber-600" : "text-slate-400")}>
      {String(value).padStart(2, "0")}
    </span>
  );
}

function NameCell({ name, mentions, self }: { name: string; mentions: number; self: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[13px] font-semibold leading-none text-slate-900">{name}</span>
      {self && (
        <span className="rounded-full bg-yellow-400 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-slate-900">
          You
        </span>
      )}
      <span className="text-[11px] leading-none text-slate-400 tabular-nums">
        · {mentions} mentions
      </span>
    </span>
  );
}

function PulseCell({ vendor }: { vendor: LeaderboardVendor; self: boolean }) {
  const value = vendor.health_score;
  const delta = vendor.rank_delta_90d;
  return (
    <span className="flex items-baseline justify-end gap-1">
      {value === null ? (
        <GatheringPill />
      ) : (
        <>
          <span className={cn("text-[13px] font-bold leading-none tabular-nums", sentimentTextClass(value))}>
            {Math.round(value)}
          </span>
          {delta !== null && delta !== 0 && (
            <span
              className={cn(
                "text-[10px] font-bold tabular-nums",
                delta > 0 ? "text-emerald-600" : "text-red-500",
              )}
              aria-label={`Rank changed ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since prior window`}
            >
              {delta > 0 ? "+" : ""}{delta}
            </span>
          )}
        </>
      )}
    </span>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return (
    <span className="flex justify-end">
      <GatheringPill />
    </span>
  );
  return (
    <span className={cn("text-right text-[13px] font-bold leading-none tabular-nums", sentimentTextClass(value))}>
      {Math.round(value)}
    </span>
  );
}

function GatheringPill() {
  return (
    <span
      className="rounded-full px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-wide text-slate-300"
      title="Not enough discussion in this dimension to score yet."
    >
      Gathering
    </span>
  );
}
