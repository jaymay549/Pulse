import { ArrowUp, ArrowDown, Minus, Lock, Info } from "lucide-react";
import {
  type MetricScore,
  type MetricKey,
  METRIC_CONFIG,
  getScoreColor,
  getVelocityLabel,
} from "@/hooks/useVendorIntelligenceDashboard";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "./CountUp";

interface MetricCardProps {
  metricKey: MetricKey;
  metric: MetricScore;
  insightText?: string | null;
}

const METRIC_TOOLTIP: Record<string, React.ReactNode> = {
  product_stability: (
    <div className="space-y-1.5 p-1">
      <p className="font-bold text-slate-900 text-[13px]">Product Stability</p>
      <p className="text-[12px] leading-relaxed text-slate-600">Measures the reliability and integration quality of your software based on dealer reports in the last 90 days.</p>
      <p className="text-[11px] text-slate-400 italic">Formula: Sentiment (40%) + Volume (20%) + Recency (20%) + Velocity (20%)</p>
    </div>
  ),
  customer_experience: (
    <div className="space-y-1.5 p-1">
      <p className="font-bold text-slate-900 text-[13px]">Customer Experience</p>
      <p className="text-[12px] leading-relaxed text-slate-600">Assesses support responsiveness and adoption success through dealer sentiment data.</p>
      <p className="text-[11px] text-slate-400 italic">Formula: Sentiment (40%) + Volume (20%) + Recency (20%) + Velocity (20%)</p>
    </div>
  ),
  value_perception: (
    <div className="space-y-1.5 p-1">
      <p className="font-bold text-slate-900 text-[13px]">Value Perception</p>
      <p className="text-[12px] leading-relaxed text-slate-600">Quantifies how dealers perceive your pricing fairness and ROI compared to competitors.</p>
      <p className="text-[11px] text-slate-400 italic">Formula: Sentiment (40%) + Volume (20%) + Recency (20%) + Velocity (20%)</p>
    </div>
  ),
};

export function MetricCard({ metricKey, metric, insightText }: MetricCardProps) {
  const config = METRIC_CONFIG[metricKey];
  const score = metric.score;
  const data = metric.data;
  const velocity = getVelocityLabel(data?.velocity_score);

  if (score === null) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-yellow-300 bg-white p-6 flex flex-col h-full min-h-[280px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <InfoTooltip content={METRIC_TOOLTIP[metricKey]} />
        </div>
        <h3 className="text-sm font-bold text-slate-400 tracking-tight">{config.label}</h3>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed flex-1">{config.description}</p>
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</span>
            <span className="text-[10px] font-bold text-slate-400">{Math.round(((data?.mention_count ?? 0) / 5) * 100)}%</span>
          </div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-200 transition-all duration-500" style={{ width: `${((data?.mention_count ?? 0) / 5) * 100}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-slate-300 animate-pulse" />
            Awaiting {5 - (data?.mention_count ?? 0)} more dealer reports
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-yellow-400 bg-white p-5 shadow-sm flex flex-col h-full">
      {/* Header: title + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{config.label}</h3>
            <InfoTooltip content={METRIC_TOOLTIP[metricKey]} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{config.description}</p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className={cn("text-3xl font-black tracking-tighter leading-none", getScoreColor(score))}><CountUp value={score} duration={1.2} /></span>
          <div className="flex items-center gap-1 mt-1">
             {velocity.direction === "up" && <ArrowUp className="h-3 w-3 text-yellow-500 stroke-[3]" />}
             {velocity.direction === "down" && <ArrowDown className="h-3 w-3 text-slate-700 stroke-[3]" />}
             {velocity.direction === "stable" && <Minus className="h-3 w-3 text-gray-300 stroke-[3]" />}
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{velocity.label}</span>
          </div>
        </div>
      </div>

      {/* Progress bar + stats */}
      <div className="mt-5 space-y-3">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
            <span className="text-[10px] font-bold text-slate-500"><CountUp value={score} duration={1.2} suffix="%" /></span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-yellow-400 transition-all duration-1000 ease-out"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 rounded px-2 py-0.5">
            {data.mention_count} REPORTS
          </span>
          {data.sentiment_ratio !== undefined && (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 rounded px-2 py-0.5">
              {data.sentiment_ratio}% POSITIVE
            </span>
          )}
        </div>
      </div>

      {/* Insight text — fills remaining space */}
      {insightText && (
        <p className="text-[11px] leading-relaxed text-slate-600 border-t border-slate-100 pt-3 mt-auto">
          {insightText}
        </p>
      )}
    </div>
  );
}
