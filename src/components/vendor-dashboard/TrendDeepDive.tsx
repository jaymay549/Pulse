import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  type SentimentHistoryPoint,
  type DashboardMetrics,
  type MetricKey,
  METRIC_CONFIG,
} from "@/hooks/useVendorIntelligenceDashboard";

interface TrendDeepDiveProps {
  metrics: DashboardMetrics;
  history: SentimentHistoryPoint[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonthLabel(yyyyMm: string): string {
  const monthIndex = parseInt(yyyyMm.split("-")[1], 10) - 1;
  return MONTH_LABELS[monthIndex] ?? yyyyMm;
}

const METRIC_KEYS: MetricKey[] = ["product_stability", "customer_experience", "value_perception"];

const BAR_COLORS: Record<string, string> = {
  product_stability: "#1e293b",
  customer_experience: "#1e293b",
  value_perception: "#1e293b",
};

export function TrendDeepDive({ metrics, history }: TrendDeepDiveProps) {
  const [expanded, setExpanded] = useState(true);

  if (history.length < 2) return null;

  const chartData = history.map((h) => ({
    month: parseMonthLabel(h.month),
    total: h.total_mentions,
    positive: h.positive_count,
    negative: h.negative_count ?? (h.total_mentions - h.positive_count),
    neutral: h.neutral_count ?? 0,
    mixed: h.mixed_count ?? 0,
    sentiment: h.total_mentions > 0
      ? Math.round((h.positive_count / h.total_mentions) * 100)
      : 0,
    promoters: h.promoter_count ?? 0,
    passives: h.passive_count ?? 0,
    detractors: h.detractor_count ?? 0,
  }));

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Trends</h3>
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        }
      </button>

      {expanded && (
        <div className="space-y-5">
          {/* Per-metric mini sparklines */}
          <div className="space-y-4">
            {METRIC_KEYS.map((key) => {
              const score = metrics[key]?.score;
              const config = METRIC_CONFIG[key];
              const color = BAR_COLORS[key];

              if (score === null) return null;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-600">{config.label}</span>
                    <span className="text-[11px] font-bold text-slate-900">{score}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={50}>
                    <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`trendGrad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="positive"
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#trendGrad-${key})`}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>

          {/* Volume bar chart */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Volume</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#fef9c3' }}
                  contentStyle={{ borderRadius: 8, border: "2px solid #1e293b", fontSize: 11, backgroundColor: "#fffef5" }}
                />
                <Bar dataKey="positive" stackId="vol" fill="#eab308" radius={[0, 0, 0, 0]} name="Positive" />
                <Bar dataKey="negative" stackId="vol" fill="#1e293b" radius={[2, 2, 0, 0]} name="Negative" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-sm bg-yellow-400" /> Positive
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-sm bg-slate-800" /> Negative
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
