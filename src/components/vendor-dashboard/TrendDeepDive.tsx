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
  product_stability: "#3b82f6",
  customer_experience: "#8b5cf6",
  value_perception: "#f59e0b",
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
    <div className="rounded-xl border bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Trend Deep Dive</h3>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-slate-400" />
          : <ChevronDown className="h-4 w-4 text-slate-400" />
        }
      </button>

      {expanded && (
        <div className="border-t px-4 pb-5 pt-3">
          {/* Per-metric mini area charts */}
          <div className="grid gap-6 md:grid-cols-3">
            {METRIC_KEYS.map((key) => {
              const score = metrics[key]?.score;
              const config = METRIC_CONFIG[key];
              const data = metrics[key]?.data;
              const color = BAR_COLORS[key];

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-700">{config.label}</span>
                    {score !== null && (
                      <span className="text-xs font-bold" style={{ color }}>
                        {score}
                      </span>
                    )}
                  </div>

                  {score !== null ? (
                    <>
                      <ResponsiveContainer width="100%" height={80}>
                        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`trendGrad-${key}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{ borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, padding: "4px 8px" }}
                            formatter={(value: number) => [value, "Discussions"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="positive"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#trendGrad-${key})`}
                            dot={{ r: 2.5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      {data && (
                        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                          <span>Sentiment: {data.sentiment_ratio?.toFixed(0)}%</span>
                          <span>Volume: {data.mention_count}</span>
                          <span>Recent: {data.recent_mentions ?? 0}</span>
                          <span>Prior: {data.prior_mentions ?? 0}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Not enough data yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overall volume stacked bar chart */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs font-medium text-slate-700 mb-2">Monthly Discussion Volume</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11 }}
                />
                <Bar dataKey="positive" stackId="vol" fill="#10b981" radius={[0, 0, 0, 0]} name="Positive" />
                <Bar dataKey="neutral" stackId="vol" fill="#94a3b8" radius={[0, 0, 0, 0]} name="Neutral" />
                <Bar dataKey="mixed" stackId="vol" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Mixed" />
                <Bar dataKey="negative" stackId="vol" fill="#ef4444" radius={[4, 4, 0, 0]} name="Negative" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Positive
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-slate-400" /> Neutral
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-amber-500" /> Mixed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-red-500" /> Negative
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
