import { ArrowUp, ArrowDown, Minus, Lock, Info, Quote } from "lucide-react";
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

const COLOR_MAP: Record<string, { bar: string; bg: string; border: string; accent: string }> = {
  blue: { bar: "bg-blue-500", bg: "bg-blue-50/50", border: "border-blue-100", accent: "text-blue-600" },
  violet: { bar: "bg-indigo-500", bg: "bg-indigo-50/50", border: "border-indigo-100", accent: "text-indigo-600" },
  amber: { bar: "bg-amber-500", bg: "bg-amber-50/50", border: "border-amber-100", accent: "text-amber-600" },
};

export function MetricCard({ metricKey, metric, insightText }: MetricCardProps) {
  const config = METRIC_CONFIG[metricKey];
  const colors = COLOR_MAP[config.color];
  const score = metric.score;
  const data = metric.data;
  const velocity = getVelocityLabel(data?.velocity_score);

  if (score === null) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Lock className="h-4 w-4" />
          </div>
          <InfoTooltip content={METRIC_TOOLTIP[metricKey]} />
        </div>
        <h3 className="text-[15px] font-bold text-slate-400 tracking-tight mb-1">{config.label}</h3>
        <p className="text-[12px] text-slate-400 font-medium leading-relaxed flex-1">{config.description}</p>
        <div className="mt-6 pt-4 border-t border-slate-100/60">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</span>
            <span className="text-[10px] font-bold text-slate-400">{Math.round(((data?.mention_count ?? 0) / 5) * 100)}%</span>
          </div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-200 transition-all duration-500" style={{ width: `${((data?.mention_count ?? 0) / 5) * 100}%` }} />
          </div>
          <p className="mt-3 text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-slate-300 animate-pulse" />
            Awaiting {5 - (data?.mention_count ?? 0)} more dealer reports
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full", colors.border)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="text-[15px] font-extrabold text-slate-900 tracking-tight">{config.label}</h3>
            <InfoTooltip content={METRIC_TOOLTIP[metricKey]} />
          </div>
          <p className="text-[12px] text-slate-500 font-medium leading-tight">{config.description}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className={cn("text-3xl font-black tracking-tighter", getScoreColor(score))}>{score}</span>
          <div className="flex items-center gap-1 mt-0.5">
             {velocity.direction === "up" && <ArrowUp className="h-3 w-3 text-emerald-500 stroke-[3]" />}
             {velocity.direction === "down" && <ArrowDown className="h-3 w-3 text-red-500 stroke-[3]" />}
             {velocity.direction === "stable" && <Minus className="h-3 w-3 text-slate-300 stroke-[3]" />}
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{velocity.label}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-auto pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimension Score</span>
          <span className={cn("text-[10px] font-bold", colors.accent)}>{score}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all duration-1000 ease-out", colors.bar)}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Sub-metrics tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-slate-50 text-slate-500 text-[10px] font-bold py-0.5 border-slate-100">
            {data.mention_count} REPORTS
          </Badge>
          {data.sentiment_ratio !== undefined && (
            <Badge variant="secondary" className="bg-slate-50 text-slate-500 text-[10px] font-bold py-0.5 border-slate-100">
              {data.sentiment_ratio}% POSITIVE
            </Badge>
          )}
        </div>

        {/* AI insight */}
        {insightText && (
          <div className={cn("mt-5 relative rounded-xl p-3.5 border border-transparent transition-all", colors.bg)}>
            <Quote className={cn("absolute -top-2 -left-1 h-4 w-4 opacity-10", colors.accent)} />
            <p className="text-[12px] leading-relaxed text-slate-700 font-medium italic relative z-10">
              {insightText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
