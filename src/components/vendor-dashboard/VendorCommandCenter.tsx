import { Loader2, Info, Target, Activity } from "lucide-react";
import {
  useVendorIntelligenceDashboard,
  type MetricKey,
} from "@/hooks/useVendorIntelligenceDashboard";
import { useActiveProductLine } from "@/hooks/useActiveProductLine";
import { HealthScoreHero } from "./HealthScoreHero";
import { NPSChart } from "./NPSChart";
import { MetricCard } from "./MetricCard";
import { MetricsBenchmarkChart } from "./MetricsBenchmarkChart";
import { FeatureGapList } from "./FeatureGapList";
import { TrendDeepDive } from "./TrendDeepDive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompetitiveMovementCompact } from "./CompetitiveMovementCard";
import { AnimateOnScroll } from "./AnimateOnScroll";

interface VendorCommandCenterProps {
  vendorName: string;
}

const METRIC_KEYS: MetricKey[] = ["product_stability", "customer_experience", "value_perception"];

export function VendorCommandCenter({ vendorName }: VendorCommandCenterProps) {
  const { activeProductLine } = useActiveProductLine();
  const productLineSlug = activeProductLine?.slug ?? null;
  const { data: intel, isLoading, isError } = useVendorIntelligenceDashboard(vendorName, productLineSlug);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Analyzing market intelligence...</p>
      </div>
    );
  }

  if (isError || !intel) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center max-w-2xl mx-auto mt-12">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Info className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-red-900">Intelligence Data Unavailable</h3>
        <p className="mt-2 text-sm text-red-700 leading-relaxed">
          We encountered an error while retrieving your vendor intelligence report. 
          Please try refreshing the page or contact support if the issue persists.
        </p>
        <Button 
          variant="outline" 
          className="mt-6 border-red-200 text-red-700 hover:bg-red-100 transition-colors"
          onClick={() => window.location.reload()}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  const metrics = intel.metrics;
  const latestSentiment = intel.sentiment_history?.[intel.sentiment_history.length - 1] ?? null;

  // Find metric-specific insights from recommendations
  const insightMap: Record<string, string | null> = {};
  for (const key of METRIC_KEYS) {
    const rec = intel.recommendations.find(
      (r) => r.metric_affected === key && r.insight_text
    );
    insightMap[key] = rec?.insight_text ?? null;
  }

  return (
    <div className="space-y-10 pb-12">
      {/* Intelligence Header */}
      <AnimateOnScroll>
      <div className="pb-2 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intelligence Hub</h1>
      </div>
      </AnimateOnScroll>

      {/* Health Score & Analytics */}
      <AnimateOnScroll delay={0.1}>
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Primary Health Score Hero */}
          <div className="lg:col-span-2 relative group overflow-hidden rounded-2xl border border-yellow-400 bg-white p-1 transition-all hover:shadow-xl hover:shadow-yellow-500/5 duration-300">
            <HealthScoreHero
              score={metrics?.health_score ?? null}
              history={intel.sentiment_history}
            />
          </div>

          {/* NPS Chart */}
          <div className="lg:col-span-1">
            <NPSChart 
              promoterCount={latestSentiment?.promoter_count ?? 0}
              passiveCount={latestSentiment?.passive_count ?? 0}
              detractorCount={latestSentiment?.detractor_count ?? 0}
            />
          </div>
        </div>

        {/* Performance Metrics Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Sentiment Analysis & Reliability
            </h2>
            <div className="h-px flex-1 bg-slate-100 ml-4 mr-2" />
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
      </AnimateOnScroll>

      {/* Comparative Benchmarks */}
      {metrics && (
        <AnimateOnScroll>
        <div className="rounded-2xl border border-yellow-400 bg-white overflow-hidden shadow-sm">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              Comparative Benchmarking
            </h3>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Live Marketplace Data</span>
          </div>
          <div className="p-6 sm:p-8">
            <MetricsBenchmarkChart
              metrics={metrics}
              benchmarks={intel.benchmarks}
              percentiles={intel.percentiles}
            />
          </div>
        </div>
        </AnimateOnScroll>
      )}

      {/* Insights & Actions Section */}
      <AnimateOnScroll>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Action Plan / Feature Gaps */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Recommended Actions</h2>
            <Badge className="bg-yellow-50 text-yellow-700 border-yellow-300 text-[10px] uppercase font-bold tracking-wider px-1.5 h-5">Priority</Badge>
          </div>
          <div className="rounded-2xl border border-yellow-400 bg-white shadow-sm h-full">
            <FeatureGapList gaps={intel.feature_gaps} />
          </div>
        </div>

        {/* Trend Analysis */}
        {metrics && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-yellow-400 bg-white shadow-sm p-5 h-full">
              <TrendDeepDive metrics={metrics} history={intel.sentiment_history} />
            </div>
          </div>
        )}

        {/* Competitive Movement */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Competitive Movement</h2>
          <CompetitiveMovementCompact vendorName={vendorName} />
        </div>
      </div>
      </AnimateOnScroll>
    </div>
  );
}
