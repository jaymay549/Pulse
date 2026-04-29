import { ArrowUp, ArrowDown, Minus, Lightbulb } from "lucide-react";
import { type DashboardFeatureGap } from "@/hooks/useVendorIntelligenceDashboard";

interface FeatureGapListProps {
  gaps: DashboardFeatureGap[];
}

function formatRelative(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function FeatureGapList({ gaps }: FeatureGapListProps) {
  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Lightbulb className="h-4 w-4" />
          <h3 className="text-sm font-medium">Action Plan</h3>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          No recurring concerns detected yet. Recommendations appear when 2+ dealers
          discuss the same issue within 90 days.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-3.5 w-3.5 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Action Plan</h3>
        <span className="text-[10px] font-bold text-slate-400">{gaps.length}</span>
      </div>

      <div className="divide-y divide-slate-100">
        {gaps.map((gap) => (
          <div key={gap.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-semibold text-slate-700 shrink-0">
                  {gap.gap_label}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {gap.mention_count} · {formatRelative(gap.last_seen)}
                </span>
                {gap.is_emerging && (
                  <span className="text-[10px] font-medium text-yellow-600">NEW</span>
                )}
              </div>
              <div className="shrink-0">
                {gap.trend_direction === "up" && <ArrowUp className="h-3 w-3 text-slate-700" />}
                {gap.trend_direction === "down" && <ArrowDown className="h-3 w-3 text-yellow-500" />}
                {gap.trend_direction === "stable" && <Minus className="h-3 w-3 text-slate-300" />}
              </div>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              {gap.ai_insight || "Review recent discussions to identify patterns."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
