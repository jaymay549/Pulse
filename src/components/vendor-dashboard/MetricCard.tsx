import { ArrowUp, ArrowDown, Minus, Lock } from "lucide-react";
import {
  type MetricScore,
  type MetricKey,
  METRIC_CONFIG,
  getScoreColor,
  getVelocityLabel,
} from "@/hooks/useVendorIntelligenceDashboard";

interface MetricCardProps {
  metricKey: MetricKey;
  metric: MetricScore;
  insightText?: string | null;
}

const COLOR_MAP: Record<string, { bar: string; bg: string; border: string }> = {
  blue: { bar: "bg-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  violet: { bar: "bg-violet-500", bg: "bg-violet-50", border: "border-violet-200" },
  amber: { bar: "bg-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
};

export function MetricCard({ metricKey, metric, insightText }: MetricCardProps) {
  const config = METRIC_CONFIG[metricKey];
  const colors = COLOR_MAP[config.color];
  const score = metric.score;
  const data = metric.data;
  const velocity = getVelocityLabel(data?.velocity_score);

  if (score === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-300" />
          <h3 className="text-sm font-medium text-slate-400">{config.label}</h3>
        </div>
        <p className="mt-2 text-xs text-slate-400">{config.description}</p>
        <p className="mt-3 text-xs text-slate-400">
          Gathering data ({data?.mention_count ?? 0}/5 mentions)
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-white p-5 ${colors.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-600">{config.label}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{config.description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
          {velocity.direction === "up" && (
            <ArrowUp className="h-4 w-4 text-emerald-500" />
          )}
          {velocity.direction === "down" && (
            <ArrowDown className="h-4 w-4 text-red-500" />
          )}
          {velocity.direction === "stable" && (
            <Minus className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Sub-metrics */}
      {data && (
        <div className="mt-3 flex gap-3 text-[11px] text-slate-500">
          <span>{data.mention_count} mentions</span>
          <span className="text-slate-300">|</span>
          <span>{velocity.label}</span>
          {data.sentiment_ratio !== undefined && (
            <>
              <span className="text-slate-300">|</span>
              <span>{data.sentiment_ratio}% positive</span>
            </>
          )}
        </div>
      )}

      {/* AI insight */}
      {insightText && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs text-slate-600 ${colors.bg}`}>
          {insightText}
        </p>
      )}
    </div>
  );
}
