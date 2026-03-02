import { BarChart3 } from "lucide-react";
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
  product_stability: "#3b82f6",
  customer_experience: "#8b5cf6",
  value_perception: "#f59e0b",
};

const PERCENTILE_BADGES: Record<string, string> = {
  product_stability: "text-blue-700 bg-blue-50",
  customer_experience: "text-violet-700 bg-violet-50",
  value_perception: "text-amber-700 bg-amber-50",
};

export function MetricsBenchmarkChart({ metrics, benchmarks, percentiles }: MetricsBenchmarkChartProps) {
  if (!benchmarks) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <BarChart3 className="h-4 w-4" />
          <h3 className="text-sm font-medium">Category Benchmarks</h3>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Not enough vendors in your category to generate benchmarks yet. Benchmarks require at least 4 qualifying vendors.
        </p>
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
    <div className="rounded-xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">vs. Category Average</h3>
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
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(value: number, name: string) => [value, name === "score" ? "Your Score" : "Category Median"]}
            />
            <Bar dataKey="score" name="Your Score" barSize={16} radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={FILL_COLORS[entry.key]} />
              ))}
            </Bar>
            <Bar dataKey="median" name="Category Median" barSize={16} fill="#cbd5e1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Your Score
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Category Median
          </span>
        </div>
      </div>
    </div>
  );
}
