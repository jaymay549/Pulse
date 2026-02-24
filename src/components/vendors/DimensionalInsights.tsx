import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchVendorDimensions,
  type VendorDimension,
} from "@/hooks/useSupabaseVendorData";
import { VENDOR_DIMENSIONS } from "@/types/admin";

const MIN_MENTIONS = 5;

interface DimensionalInsightsProps {
  vendorName: string;
  mentionCount: number;
}

function getSentimentLabel(positivePercent: number): {
  label: string;
  color: string;
} {
  if (positivePercent >= 75) {
    return { label: "Mostly positive", color: "text-emerald-400" };
  }
  if (positivePercent >= 50) {
    return { label: "Mixed-positive", color: "text-emerald-300" };
  }
  if (positivePercent >= 25) {
    return { label: "Mixed", color: "text-amber-400" };
  }
  return { label: "Needs attention", color: "text-red-400" };
}

export function DimensionalInsights({
  vendorName,
  mentionCount,
}: DimensionalInsightsProps) {
  const {
    data: dimensions,
    isLoading,
  } = useQuery<VendorDimension[]>({
    queryKey: ["vendor-dimensions", vendorName],
    queryFn: () => fetchVendorDimensions(vendorName),
    enabled: !!vendorName && mentionCount >= MIN_MENTIONS,
    staleTime: 5 * 60 * 1000,
  });

  if (mentionCount < MIN_MENTIONS) return null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse mb-5" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="h-2 bg-zinc-800 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!dimensions || dimensions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400 mb-5">
        Dimensional Breakdown
      </h3>

      <div className="space-y-4">
        {dimensions.map((dim) => {
          const dimConfig = VENDOR_DIMENSIONS[dim.dimension];
          const label = dimConfig?.label || dim.dimension;
          const sentiment = getSentimentLabel(dim.positive_percent);

          return (
            <div key={dim.dimension}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-zinc-200">
                  {label}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium ${sentiment.color}`}>
                    {sentiment.label}
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">
                    {dim.mention_count} mentions
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${dim.positive_percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DimensionalInsights;
