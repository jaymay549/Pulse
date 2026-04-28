import { ArrowUp, ArrowDown, Minus, Activity, ShieldCheck, TrendingUp, Sparkles } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  type SentimentHistoryPoint,
  getScoreColor,
} from "@/hooks/useVendorIntelligenceDashboard";
import { InfoTooltip } from "./InfoTooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HealthScoreHeroProps {
  score: number | null;
  history: SentimentHistoryPoint[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonthLabel(yyyyMm: string): string {
  const monthIndex = parseInt(yyyyMm.split("-")[1], 10) - 1;
  return MONTH_LABELS[monthIndex] ?? yyyyMm;
}

function getTrend(history: SentimentHistoryPoint[]): { direction: "up" | "down" | "stable"; delta: number } {
  const withData = history.filter((h) => h.health_estimate !== null);
  if (withData.length < 2) return { direction: "stable", delta: 0 };
  const recent = withData[withData.length - 1].health_estimate!;
  const prior = withData[withData.length - 2].health_estimate!;
  const delta = recent - prior;
  if (delta > 2) return { direction: "up", delta };
  if (delta < -2) return { direction: "down", delta };
  return { direction: "stable", delta };
}

export function HealthScoreHero({ score, history }: HealthScoreHeroProps) {
  const trend = getTrend(history);
  
  const statusConfig = {
    strong: { label: "Exceptional", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: ShieldCheck },
    improving: { label: "Solid Performance", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", icon: TrendingUp },
    attention: { label: "Action Required", color: "text-red-600", bg: "bg-red-50", border: "border-red-100", icon: Activity },
    gathering: { label: "Calculating...", color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-100", icon: Activity },
  };

  const status = score === null ? "gathering" : score >= 75 ? "strong" : score >= 55 ? "improving" : "attention";
  const { label: statusLabel, color: statusTextColor, bg: statusBg, border: statusBorder, icon: StatusIcon } = statusConfig[status];

  return (
    <div className="relative overflow-hidden bg-white p-6 sm:p-8">
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        {/* Score display */}
        <div className="flex items-center gap-6">
          <div className="relative flex h-32 w-32 items-center justify-center shrink-0">
            {/* Circular progress */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="44"
                fill="none" stroke="#F1F5F9" strokeWidth="8"
              />
              {score !== null && (
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 276.5} 276.5`}
                  transform="rotate(-90 50 50)"
                  className={cn("transition-all duration-1000 ease-out", getScoreColor(score))}
                />
              )}
            </svg>
            <div className="flex flex-col items-center justify-center">
              <span className={cn("text-4xl font-black tracking-tighter", getScoreColor(score))}>
                {score !== null ? score : "—"}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pulse Score</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Market Health Score</h2>
                <InfoTooltip
                  content={
                    <div className="p-1 space-y-2">
                      <p className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                        Intelligence Engine
                      </p>
                      <p className="text-[12px] leading-relaxed text-slate-600">A weighted composite of your performance dimensions, based on verified dealer feedback from the last 90 days.</p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CX Ratio</p>
                          <p className="text-[12px] font-bold text-slate-700">40% Weight</p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stability</p>
                          <p className="text-[12px] font-bold text-slate-700">35% Weight</p>
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>
              
              <div className="flex items-center gap-2">
                {trend.direction === "up" && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-1 py-1 pr-2.5">
                    <ArrowUp className="h-3 w-3 stroke-[3]" />
                    <span className="font-bold">+{Math.abs(trend.delta)}</span>
                  </Badge>
                )}
                {trend.direction === "down" && (
                  <Badge className="bg-red-50 text-red-600 border-red-100 gap-1 py-1 pr-2.5">
                    <ArrowDown className="h-3 w-3 stroke-[3]" />
                    <span className="font-bold">{trend.delta}</span>
                  </Badge>
                )}
                {trend.direction === "stable" && score !== null && (
                  <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1 py-1 pr-2.5">
                    <Minus className="h-3 w-3 stroke-[3]" />
                    <span className="font-bold tracking-tight">STABLE</span>
                  </Badge>
                )}
              </div>
            </div>

            <div className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[12px] font-medium", statusBg, statusBorder, statusTextColor)}>
              <StatusIcon className="h-3 w-3" />
              {statusLabel}
            </div>

            <p className="max-w-md text-[13px] leading-relaxed text-slate-400">
              {score === null
                ? "Our engine is currently gathering dealer feedback. Need 5+ discussions across all dimensions to generate your first score."
                : score >= 75
                  ? "Your presence is outstanding. Dealers consistently report high satisfaction and product reliability."
                  : score >= 55
                    ? "Solid performance overall, with specific opportunities to improve dealer perception in key areas."
                    : "Significant market concerns detected. Review recent discussions to address critical stability or experience issues."
              }
            </p>
          </div>
        </div>

        {/* Sparkline area chart */}
        {history.length >= 2 && (() => {
          const sparkData = history.map((h) => ({
            month: parseMonthLabel(h.month),
            health: h.health_estimate ?? 0,
          }));
          const color = score !== null
            ? score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"
            : "#94a3b8";

          return (
            <div className="flex flex-col items-end gap-3 self-end lg:self-center">
              <div className="w-full sm:w-[240px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Growth Trend</span>
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">90D</span>
                </div>
                <div style={{ width: '100%', height: 70 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="healthSparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" hide />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, padding: "8px 12px", boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.1)" }}
                        formatter={(value: number) => [`${value}%`, "Health"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="health"
                        stroke={color}
                        strokeWidth={3}
                        fill="url(#healthSparkGrad)"
                        dot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {score === null && (
        <div className="mt-8 flex items-center gap-3 rounded-xl bg-indigo-50/50 border border-indigo-100/50 px-4 py-3.5 text-[13px] font-medium text-indigo-700">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          Market intelligence gathering in progress. Real-time feedback will populate here shortly.
        </div>
      )}
    </div>
  );
}
