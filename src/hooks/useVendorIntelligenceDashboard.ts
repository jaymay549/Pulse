import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";

// ── Types ────────────────────────────────────────────────────

export interface MetricComponentData {
  score: number | null;
  mention_count: number;
  below_threshold: boolean;
  sentiment_ratio?: number;
  volume_confidence?: number;
  recency_score?: number;
  velocity_score?: number;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
  mixed_count?: number;
  avg_sentiment_score?: number;
  recent_mentions?: number;
  prior_mentions?: number;
}

export interface MetricScore {
  score: number | null;
  data: MetricComponentData | null;
}

export interface DashboardMetrics {
  health_score: number | null;
  product_stability: MetricScore;
  customer_experience: MetricScore;
  value_perception: MetricScore;
  computed_at: string;
}

export interface DashboardBenchmarks {
  product_stability_median: number;
  customer_experience_median: number;
  value_perception_median: number;
  qualifying_vendor_count: number;
}

export interface DashboardPercentiles {
  product_stability: number | null;
  customer_experience: number | null;
  value_perception: number | null;
}

export interface DashboardRecommendation {
  id: string;
  rule_id: string;
  priority: "high" | "medium" | "low";
  category: string;
  metric_affected: string | null;
  insight_text: string | null;
  supporting_data: Record<string, unknown>;
  triggered_at: string;
}

export interface SupportingQuote {
  quote: string;
  headline: string | null;
  source: string;
}

export interface DashboardFeatureGap {
  id: string;
  gap_label: string;
  mention_count: number;
  first_seen: string;
  last_seen: string;
  trend_direction: "up" | "down" | "stable";
  mapped_metric: string | null;
  is_emerging?: boolean;
  ai_insight?: string | null;
  supporting_quotes?: SupportingQuote[];
}

export interface SentimentHistoryPoint {
  month: string;
  total_mentions: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  mixed_count: number;
  health_estimate: number | null;
  avg_intensity: number | null;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
}

export interface VendorDashboardIntel {
  vendor_name: string;
  category: string | null;
  metrics: DashboardMetrics | null;
  benchmarks: DashboardBenchmarks | null;
  percentiles: DashboardPercentiles | null;
  recommendations: DashboardRecommendation[];
  feature_gaps: DashboardFeatureGap[];
  sentiment_history: SentimentHistoryPoint[];
}

// ── Hook ─────────────────────────────────────────────────────

export function useVendorIntelligenceDashboard(vendorName: string, productLineSlug?: string | null) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["vendor-dashboard-intel", vendorName, productLineSlug ?? null],
    queryFn: async (): Promise<VendorDashboardIntel> => {
      const { data, error } = await supabase.rpc(
        "get_vendor_dashboard_intel" as never,
        { p_vendor_name: vendorName, p_product_line_slug: productLineSlug ?? null } as never
      );

      if (error) {
        console.error("[Supabase] get_vendor_dashboard_intel error:", error);
        throw error;
      }

      const result = data as unknown as VendorDashboardIntel;
      return {
        vendor_name: result.vendor_name,
        category: result.category,
        metrics: result.metrics,
        benchmarks: result.benchmarks,
        percentiles: result.percentiles,
        recommendations: result.recommendations || [],
        feature_gaps: result.feature_gaps || [],
        sentiment_history: result.sentiment_history || [],
      };
    },
    enabled: !!vendorName,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ── Metric display helpers ───────────────────────────────────

export const METRIC_CONFIG = {
  product_stability: {
    label: "Product Stability",
    description: "Reliability & integration quality",
    dimensions: ["reliable", "integrates"],
    color: "blue",
  },
  customer_experience: {
    label: "Customer Experience",
    description: "Support responsiveness & adoption success",
    dimensions: ["support", "adopted"],
    color: "violet",
  },
  value_perception: {
    label: "Value Perception",
    description: "Pricing fairness & ROI sentiment",
    dimensions: ["worth_it"],
    color: "amber",
  },
} as const;

export type MetricKey = keyof typeof METRIC_CONFIG;

export function getScoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 70) return "text-emerald-600";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

export function getScoreBg(score: number | null): string {
  if (score === null) return "bg-slate-100";
  if (score >= 70) return "bg-emerald-50";
  if (score >= 50) return "bg-amber-50";
  return "bg-red-50";
}

export function getPercentileLabel(percentile: number | null): string {
  if (percentile === null) return "—";
  if (percentile >= 75) return `Top ${100 - percentile}%`;
  if (percentile >= 50) return "Above Median";
  if (percentile >= 25) return "Below Median";
  return `Bottom ${percentile}%`;
}

export function getVelocityLabel(velocityScore: number | undefined): { label: string; direction: "up" | "down" | "stable" } {
  if (velocityScore === undefined) return { label: "—", direction: "stable" };
  if (velocityScore > 55) return { label: "Improving", direction: "up" };
  if (velocityScore < 45) return { label: "Declining", direction: "down" };
  return { label: "Stable", direction: "stable" };
}
