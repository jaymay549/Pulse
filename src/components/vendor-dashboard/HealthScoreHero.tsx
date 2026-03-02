import { ArrowUp, ArrowDown, Minus, Activity } from "lucide-react";
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
  if (delta > 3) return { direction: "up", delta };
  if (delta < -3) return { direction: "down", delta };
  return { direction: "stable", delta };
}

export function HealthScoreHero({ score, history }: HealthScoreHeroProps) {
  const trend = getTrend(history);

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="flex items-start justify-between">
        {/* Score display */}
        <div className="flex items-center gap-5">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* Circular progress */}
            <svg className="absolute inset-0" viewBox="0 0 96 96">
              <circle
                cx="48" cy="48" r="42"
                fill="none" stroke="#f1f5f9" strokeWidth="6"
              />
              {score !== null && (
                <circle
                  cx="48" cy="48" r="42"
                  fill="none"
                  stroke={score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 264} 264`}
                  transform="rotate(-90 48 48)"
                  className="transition-all duration-700"
                />
              )}
            </svg>
            <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
              {score !== null ? score : "—"}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Health Score</h2>
              {trend.direction === "up" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <ArrowUp className="h-3 w-3" />
                  +{Math.abs(trend.delta)}
                </span>
              )}
              {trend.direction === "down" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                  <ArrowDown className="h-3 w-3" />
                  {trend.delta}
                </span>
              )}
              {trend.direction === "stable" && score !== null && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                  <Minus className="h-3 w-3" />
                  Stable
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {score === null
                ? "Gathering data — need 5+ mentions across dimensions"
                : score >= 70
                  ? "Strong performance across key dimensions"
                  : score >= 50
                    ? "Room for improvement in some areas"
                    : "Significant concerns flagged by dealers"
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
            <div style={{ width: 180, height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="healthSparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" hide />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, padding: "4px 8px" }}
                    formatter={(value: number) => [`${value}%`, "Health"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="health"
                    stroke={color}
                    strokeWidth={2}
                    fill="url(#healthSparkGrad)"
                    dot={{ r: 2.5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      {score === null && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Activity className="h-3.5 w-3.5" />
          Your scores will appear once enough dealer feedback has been collected.
        </div>
      )}
    </div>
  );
}
