import { ArrowUp, ArrowDown, Minus, AlertCircle } from "lucide-react";
import {
  type DashboardFeatureGap,
  type MetricKey,
  METRIC_CONFIG,
} from "@/hooks/useVendorIntelligenceDashboard";

interface FeatureGapListProps {
  gaps: DashboardFeatureGap[];
}

const METRIC_BADGE_COLORS: Record<string, string> = {
  product_stability: "text-blue-600 bg-blue-50",
  customer_experience: "text-violet-600 bg-violet-50",
  value_perception: "text-amber-600 bg-amber-50",
};

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
          <AlertCircle className="h-4 w-4" />
          <h3 className="text-sm font-medium">Feature Gaps</h3>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          No recurring feature gaps detected. Gaps appear when 2+ mentions reference
          the same concern within 90 days.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Feature Gaps</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {gaps.length}
        </span>
      </div>

      <div className="rounded-xl border bg-white divide-y">
        {gaps.map((gap, i) => {
          const metricLabel = gap.mapped_metric
            ? METRIC_CONFIG[gap.mapped_metric as MetricKey]?.label
            : null;
          const metricColor = gap.mapped_metric
            ? METRIC_BADGE_COLORS[gap.mapped_metric] || "text-slate-600 bg-slate-50"
            : "text-slate-600 bg-slate-50";

          return (
            <div key={gap.id} className="flex items-center gap-3 px-4 py-3">
              {/* Rank */}
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                {i + 1}
              </span>

              {/* Gap details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {gap.gap_label}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-400">
                    {gap.mention_count} mentions
                  </span>
                  <span className="text-slate-200">·</span>
                  <span className="text-[11px] text-slate-400">
                    Last {formatRelative(gap.last_seen)}
                  </span>
                </div>
              </div>

              {/* Metric badge */}
              {metricLabel && (
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${metricColor}`}>
                  {metricLabel}
                </span>
              )}

              {/* Trend */}
              <div className="flex-shrink-0">
                {gap.trend_direction === "up" && (
                  <ArrowUp className="h-4 w-4 text-red-500" title="Increasing" />
                )}
                {gap.trend_direction === "down" && (
                  <ArrowDown className="h-4 w-4 text-emerald-500" title="Decreasing" />
                )}
                {gap.trend_direction === "stable" && (
                  <Minus className="h-4 w-4 text-slate-300" title="Stable" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
