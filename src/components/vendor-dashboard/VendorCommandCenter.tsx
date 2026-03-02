import { Loader2 } from "lucide-react";
import {
  useVendorIntelligenceDashboard,
  type MetricKey,
} from "@/hooks/useVendorIntelligenceDashboard";
import { HealthScoreHero } from "./HealthScoreHero";
import { MetricCard } from "./MetricCard";
import { MetricsBenchmarkChart } from "./MetricsBenchmarkChart";
import { ActionPlan } from "./ActionPlan";
import { FeatureGapList } from "./FeatureGapList";
import { TrendDeepDive } from "./TrendDeepDive";

interface VendorCommandCenterProps {
  vendorName: string;
}

const METRIC_KEYS: MetricKey[] = ["product_stability", "customer_experience", "value_perception"];

export function VendorCommandCenter({ vendorName }: VendorCommandCenterProps) {
  const { data: intel, isLoading, isError } = useVendorIntelligenceDashboard(vendorName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !intel) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">
          Failed to load intelligence data. Please try refreshing.
        </p>
      </div>
    );
  }

  const metrics = intel.metrics;

  // Find metric-specific insights from recommendations
  const insightMap: Record<string, string | null> = {};
  for (const key of METRIC_KEYS) {
    const rec = intel.recommendations.find(
      (r) => r.metric_affected === key && r.insight_text
    );
    insightMap[key] = rec?.insight_text ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Intelligence</h1>
        {intel.category && (
          <p className="mt-1 text-sm text-slate-500">
            {intel.category} category
            {intel.benchmarks
              ? ` · ${intel.benchmarks.qualifying_vendor_count} vendors benchmarked`
              : ""}
          </p>
        )}
      </div>

      {/* Health Score */}
      <HealthScoreHero
        score={metrics?.health_score ?? null}
        history={intel.sentiment_history}
      />

      {/* Performance Metrics */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Performance Metrics
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {METRIC_KEYS.map((key) => (
            <MetricCard
              key={key}
              metricKey={key}
              metric={
                metrics?.[key] ?? { score: null, data: null }
              }
              insightText={insightMap[key]}
            />
          ))}
        </div>
      </div>

      {/* Benchmarks */}
      {metrics && (
        <MetricsBenchmarkChart
          metrics={metrics}
          benchmarks={intel.benchmarks}
          percentiles={intel.percentiles}
        />
      )}

      {/* Action Plan */}
      <ActionPlan recommendations={intel.recommendations} />

      {/* Feature Gaps + Trend in a 2-col layout on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FeatureGapList gaps={intel.feature_gaps} />
        {metrics && (
          <TrendDeepDive metrics={metrics} history={intel.sentiment_history} />
        )}
      </div>
    </div>
  );
}
