import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MIN_MENTIONS = 5;
const MIN_DATA_POINTS = 3;

interface PricingMention {
  amount: string | null;
  terms: string | null;
  unit_type: string | null;
}

interface PricingIntelResult {
  data_points: number;
  mentions: PricingMention[];
}

interface PricingIntelligenceProps {
  vendorName: string;
  mentionCount: number;
}

export function PricingIntelligence({
  vendorName,
  mentionCount,
}: PricingIntelligenceProps) {
  const { data, isLoading } = useQuery<PricingIntelResult | null>({
    queryKey: ["vendor-pricing-intel", vendorName],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc(
        "get_vendor_pricing_intel" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return result as unknown as PricingIntelResult | null;
    },
    enabled: !!vendorName && mentionCount >= MIN_MENTIONS,
    staleTime: 5 * 60 * 1000,
  });

  if (mentionCount < MIN_MENTIONS) return null;
  if (isLoading) return null;
  if (!data || data.data_points < MIN_DATA_POINTS) return null;

  // Collect unique non-null price amounts
  const amounts = Array.from(
    new Set(
      data.mentions
        .map((m) => m.amount)
        .filter((a): a is string => a !== null && a.trim() !== "")
    )
  );

  // Find most common contract term
  const termCounts: Record<string, number> = {};
  for (const m of data.mentions) {
    if (m.terms && m.terms.trim()) {
      const t = m.terms.trim();
      termCounts[t] = (termCounts[t] || 0) + 1;
    }
  }
  const topTerm = Object.entries(termCounts).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];

  // If no amounts to display, hide component
  if (amounts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-4 w-4 text-amber-500" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Pricing Intelligence
        </h3>
      </div>

      {/* Reported price amounts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {amounts.map((amount) => (
          <span
            key={amount}
            className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[13px] font-medium text-slate-700"
          >
            {amount}
          </span>
        ))}
      </div>

      {/* Contract term + data point count */}
      <div className="flex items-center gap-3 text-[12px] text-slate-400">
        {topTerm && (
          <span>
            Most common term:{" "}
            <span className="text-slate-600 font-medium">{topTerm}</span>
          </span>
        )}
        {topTerm && <span className="text-slate-300">&middot;</span>}
        <span>
          Based on{" "}
          <span className="text-slate-600 font-medium tabular-nums">
            {data.data_points}
          </span>{" "}
          data point{data.data_points !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

export default PricingIntelligence;
