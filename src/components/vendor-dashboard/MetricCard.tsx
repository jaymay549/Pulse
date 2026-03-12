import { ArrowUp, ArrowDown, Minus, Lock } from "lucide-react";
import {
  type MetricScore,
  type MetricKey,
  METRIC_CONFIG,
  getScoreColor,
  getVelocityLabel,
} from "@/hooks/useVendorIntelligenceDashboard";
import { InfoTooltip } from "./InfoTooltip";

interface MetricCardProps {
  metricKey: MetricKey;
  metric: MetricScore;
  insightText?: string | null;
}

const METRIC_TOOLTIP: Record<string, React.ReactNode> = {
  product_stability: (
    <div className="space-y-1.5">
      <p className="font-medium text-slate-900">Product Stability</p>
      <p>Based on <strong>reliability</strong> and <strong>integration quality</strong> feedback from dealers in the last 90 days.</p>
      <p className="text-slate-500">Score formula: sentiment (40%) + volume confidence (20%) + recency weight (20%) + 30-day velocity (20%). Requires 5+ mentions.</p>
    </div>
  ),
  customer_experience: (
    <div className="space-y-1.5">
      <p className="font-medium text-slate-900">Customer Experience</p>
      <p>Based on <strong>support responsiveness</strong> and <strong>adoption success</strong> feedback from dealers in the last 90 days.</p>
      <p className="text-slate-500">Score formula: sentiment (40%) + volume confidence (20%) + recency weight (20%) + 30-day velocity (20%). Requires 5+ mentions.</p>
    </div>
  ),
  value_perception: (
    <div className="space-y-1.5">
      <p className="font-medium text-slate-900">Value Perception</p>
      <p>Based on <strong>pricing fairness</strong> and <strong>ROI sentiment</strong> feedback from dealers in the last 90 days.</p>
      <p className="text-slate-500">Score formula: sentiment (40%) + volume confidence (20%) + recency weight (20%) + 30-day velocity (20%). Requires 5+ mentions.</p>
    </div>
  ),
};

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
          <InfoTooltip content={METRIC_TOOLTIP[metricKey]} />
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
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-slate-600">{config.label}</h3>
            <InfoTooltip content={METRIC_TOOLTIP[metricKey]} />
          </div>
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
