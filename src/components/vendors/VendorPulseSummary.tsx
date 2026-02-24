import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { fetchVendorPulseSummary } from "@/hooks/useSupabaseVendorData";

const MIN_MENTIONS = 5;

interface VendorPulseSummaryProps {
  vendorName: string;
  mentionCount: number;
}

export function VendorPulseSummary({
  vendorName,
  mentionCount,
}: VendorPulseSummaryProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["vendor-pulse-summary", vendorName],
    queryFn: () => fetchVendorPulseSummary(vendorName),
    enabled: !!vendorName && mentionCount >= MIN_MENTIONS,
    staleTime: 5 * 60 * 1000,
  });

  if (mentionCount < MIN_MENTIONS) return null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-4 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-full" />
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-5/6" />
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-4/6" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">
          Vendor Pulse Summary
        </h3>
      </div>

      {/* Summary text */}
      <p className="text-[14px] leading-relaxed text-zinc-200">
        {summary.summary_text}
      </p>

      {/* Category context */}
      {summary.category_context && (
        <>
          <div className="border-t border-zinc-800 my-4" />
          <p className="text-[13px] leading-relaxed text-zinc-500">
            {summary.category_context}
          </p>
        </>
      )}
    </div>
  );
}

export default VendorPulseSummary;
