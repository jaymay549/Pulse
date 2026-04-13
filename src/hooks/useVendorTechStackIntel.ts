import { useQuery } from "@tanstack/react-query";
import { useVendorDataClient } from "@/hooks/useVendorDataClient";

// ── Types ────────────────────────────────────────────────────

export interface ExitReasonCount {
  reason: string;
  count: number;
}

export interface StatusBreakdown {
  stable: number;
  exploring: number;
  left: number;
}

export interface CategoryMarketShare {
  vendor_count: number;
  category_total: number;
  share_pct: number;
}

export interface VendorTechStackIntel {
  vendor_name: string;
  category: string | null;
  below_threshold: boolean;
  adoption_count: number;
  min_threshold?: number;
  avg_sentiment: number | null;
  status_breakdown: StatusBreakdown;
  switching_risk_pct: number;
  exit_reasons: ExitReasonCount[];
  category_market_share: CategoryMarketShare | null;
}

// ── Hook ─────────────────────────────────────────────────────

export function useVendorTechStackIntel(vendorName: string) {
  const supabase = useVendorDataClient();

  return useQuery({
    queryKey: ["vendor-tech-stack-intel", vendorName],
    queryFn: async (): Promise<VendorTechStackIntel> => {
      const { data, error } = await supabase.rpc(
        "get_vendor_tech_stack_intel" as never,
        { p_vendor_name: vendorName } as never
      );

      if (error) {
        console.error("[Supabase] get_vendor_tech_stack_intel error:", error);
        throw error;
      }

      return data as unknown as VendorTechStackIntel;
    },
    enabled: !!vendorName,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Helpers ──────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  pricing: "Pricing",
  support: "Support",
  features: "Features",
  reliability: "Reliability",
  integration: "Integration",
  other: "Other",
};

export function getReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export function getSentimentColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 8) return "text-emerald-600";
  if (score >= 6) return "text-amber-500";
  return "text-red-500";
}

export function getSwitchingRiskLevel(pct: number): {
  label: string;
  color: string;
} {
  if (pct >= 40) return { label: "High", color: "text-red-600" };
  if (pct >= 20) return { label: "Moderate", color: "text-amber-500" };
  return { label: "Low", color: "text-emerald-600" };
}
