import { BarChart3 } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  type DashboardBenchmarks,
  type DashboardPercentiles,
  type DashboardMetrics,
  type MetricKey,
  METRIC_CONFIG,
  getPercentileLabel,
} from "@/hooks/useVendorIntelligenceDashboard";

interface MetricsBenchmarkChartProps {
  metrics: DashboardMetrics;
  benchmarks: DashboardBenchmarks | null;
  percentiles: DashboardPercentiles | null;
}

const METRIC_KEYS: MetricKey[] = ["product_stability", "customer_experience", "value_perception"];

const FILL_COLORS: Record<string, string> = {
  product_stability: "#1e293b",
  customer_experience: "#1e293b",
  value_perception: "#1e293b",
};

const PERCENTILE_BADGES: Record<string, string> = {
  product_stability: "text-slate-900 bg-yellow-50 border border-yellow-300",
  customer_experience: "text-slate-900 bg-yellow-50 border border-yellow-300",
  value_perception: "text-slate-900 bg-yellow-50 border border-yellow-300",
};

function getScoreLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 45) return "Room to grow";
  return "Needs attention";
}

function getScoreLabelColor(score: number): string {
  if (score >= 75) return "text-yellow-600";
  if (score >= 60) return "text-yellow-700";
  if (score >= 45) return "text-gray-500";
  return "text-slate-800";
}

export function MetricsBenchmarkChart({ metrics, benchmarks, percentiles }: MetricsBenchmarkChartProps) {
  if (!benchmarks) {
    const hasAnyScore = METRIC_KEYS.some((key) => metrics[key]?.score !== null);
    if (!hasAnyScore) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
          <div className="flex items-center gap-2 text-slate-400">
            <BarChart3 className="h-4 w-4" />
            <h3 className="text-sm font-medium">Performance Scores</h3>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Scores will appear once enough dealer feedback is collected across dimensions.
          </p>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Scores</h3>
            <InfoTooltip
              content={
                <div className="space-y-1.5">
                  <p className="font-medium text-slate-900">Performance Scores</p>
                  <p>Each score (0–100) measures dealer sentiment across relevant feedback dimensions in the last 90 days.</p>
                </div>
              }
            />
          </div>
          <span className="text-[10px] text-slate-400">Benchmarks unlock at 4+ vendors</span>
        </div>
        <div className="divide-y divide-slate-100">
          {METRIC_KEYS.map((key) => {
            const score = metrics[key]?.score ?? null;
            const config = METRIC_CONFIG[key];
            return (
              <div key={key} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-[12px] font-medium text-slate-600 w-28 shrink-0">{config.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  {score !== null && (
                    <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${score}%` }} />
                  )}
                </div>
                <span className="text-sm font-bold text-slate-900 w-8 text-right tabular-nums">{score ?? "—"}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const benchmarkMap: Record<string, number> = {
    product_stability: benchmarks.product_stability_median,
    customer_experience: benchmarks.customer_experience_median,
    value_perception: benchmarks.value_perception_median,
  };

  const chartData = METRIC_KEYS
    .filter((key) => metrics[key]?.score !== null)
    .map((key) => ({
      name: METRIC_CONFIG[key].label,
      key,
      score: metrics[key]?.score ?? 0,
      median: benchmarkMap[key] ?? 0,
    }));

  if (chartData.length === 0) return null;

  return (
    <div className="rounded-xl bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">vs. Category Average</h3>
          <InfoTooltip
            content={
              <div className="space-y-1.5">
                <p className="font-medium text-slate-900">Category Benchmarks</p>
                <p>Your scores compared against the median of all vendors in your product category with 5+ qualifying discussions.</p>
                <p className="text-slate-500">Percentile rank shows where you fall relative to peers — e.g. &ldquo;Top 25%&rdquo; means you outrank 75% of vendors in your category.</p>
              </div>
            }
          />
        </div>
        <span className="text-xs text-slate-400">
          {benchmarks.qualifying_vendor_count} vendors in category
        </span>
      </div>

      {/* Percentile badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        {METRIC_KEYS.map((key) => {
          const percentile = percentiles?.[key] ?? null;
          if (metrics[key]?.score === null) return null;
          return (
            <span key={key} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PERCENTILE_BADGES[key]}`}>
              {METRIC_CONFIG[key].label}: {getPercentileLabel(percentile)}
            </span>
          );
        })}
      </div>

      {/* Grouped bar chart: Your Score vs Median */}
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={chartData.length * 70 + 40}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#fef9c3' }}
              contentStyle={{ borderRadius: 10, border: "2px solid #1e293b", fontSize: 12, backgroundColor: "#fffef5", boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.15)" }}
              formatter={(value: number, name: string) => [value, name === "score" ? "Your Score" : "Category Median"]}
            />
            <Bar dataKey="score" name="Your Score" barSize={16} radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={FILL_COLORS[entry.key]} />
              ))}
            </Bar>
            <Bar dataKey="median" name="Category Median" barSize={16} fill="#fde047" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-900" /> Your Score
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-yellow-300" /> Category Median
          </span>
        </div>
      </div>
    </div>
  );
}
