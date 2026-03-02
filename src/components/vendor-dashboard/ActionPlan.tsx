import { useState } from "react";
import {
  AlertTriangle,
  TrendingUp,
  Award,
  Swords,
  Package,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from "lucide-react";
import {
  type DashboardRecommendation,
  METRIC_CONFIG,
  type MetricKey,
} from "@/hooks/useVendorIntelligenceDashboard";

interface ActionPlanProps {
  recommendations: DashboardRecommendation[];
}

const CATEGORY_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
  urgent:      { icon: AlertTriangle, label: "Urgent",      color: "text-red-600 bg-red-50 border-red-200" },
  improvement: { icon: TrendingUp,    label: "Improve",     color: "text-amber-600 bg-amber-50 border-amber-200" },
  celebrate:   { icon: Award,         label: "Win",         color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  competitive: { icon: Swords,        label: "Competitive", color: "text-blue-600 bg-blue-50 border-blue-200" },
  product:     { icon: Package,       label: "Product",     color: "text-violet-600 bg-violet-50 border-violet-200" },
  awareness:   { icon: Eye,           label: "Awareness",   color: "text-slate-600 bg-slate-50 border-slate-200" },
  engagement:  { icon: Clock,         label: "Engagement",  color: "text-slate-600 bg-slate-50 border-slate-200" },
};

const PRIORITY_DOTS: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

function formatRelative(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

function RecommendationItem({ rec }: { rec: DashboardRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.awareness;
  const Icon = catConfig.icon;
  const metricLabel = rec.metric_affected
    ? METRIC_CONFIG[rec.metric_affected as MetricKey]?.label || rec.metric_affected
    : null;

  return (
    <div className="rounded-lg border bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        {/* Priority dot */}
        <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_DOTS[rec.priority]}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${catConfig.color}`}>
              <Icon className="h-3 w-3" />
              {catConfig.label}
            </span>
            {metricLabel && (
              <span className="text-[11px] text-slate-400">{metricLabel}</span>
            )}
            <span className="text-[11px] text-slate-300">{formatRelative(rec.triggered_at)}</span>
          </div>

          <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">
            {rec.insight_text || "Review your dashboard for details on this change."}
          </p>
        </div>

        {/* Expand toggle */}
        {rec.supporting_data && Object.keys(rec.supporting_data).length > 0 && (
          <div className="flex-shrink-0 pt-1">
            {expanded
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </div>
        )}
      </button>

      {/* Expanded supporting data */}
      {expanded && rec.supporting_data && Object.keys(rec.supporting_data).length > 0 && (
        <div className="border-t px-4 py-3 bg-slate-50/50">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
            Supporting Data
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(rec.supporting_data).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-slate-400">{key.replace(/_/g, " ")}:</span>{" "}
                <span className="font-medium text-slate-700">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ActionPlan({ recommendations }: ActionPlanProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Lightbulb className="h-4 w-4" />
          <h3 className="text-sm font-medium">Action Plan</h3>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          No recommendations right now. Recommendations appear when significant changes
          are detected in your metrics.
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
          {recommendations.length}
        </span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec) => (
          <RecommendationItem key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}
