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
          mention the same issue within 90 days.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Action Plan</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {gaps.length}
        </span>
      </div>

      <div className="space-y-2">
        {gaps.map((gap) => (
          <div key={gap.id} className="rounded-lg border bg-white p-4">
            {/* Category + meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {gap.gap_label}
              </span>
              <span className="text-[11px] text-slate-400">
                {gap.mention_count} {gap.mention_count === 1 ? "mention" : "mentions"}
              </span>
              <span className="text-slate-200">&middot;</span>
              <span className="text-[11px] text-slate-400">
                Last {formatRelative(gap.last_seen)}
              </span>
              {gap.is_emerging && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-amber-600 bg-amber-50">
                  Emerging
                </span>
              )}
              <div className="ml-auto flex-shrink-0">
                {gap.trend_direction === "up" && (
                  <ArrowUp className="h-3.5 w-3.5 text-red-500" />
                )}
                {gap.trend_direction === "down" && (
                  <ArrowDown className="h-3.5 w-3.5 text-emerald-500" />
                )}
                {gap.trend_direction === "stable" && (
                  <Minus className="h-3.5 w-3.5 text-slate-300" />
                )}
              </div>
            </div>

            {/* Action text */}
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {gap.ai_insight || "Review recent mentions to identify patterns in this area."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
