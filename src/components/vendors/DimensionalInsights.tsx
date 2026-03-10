import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchVendorDimensions,
  type VendorDimension,
} from "@/hooks/useSupabaseVendorData";
import { VENDOR_DIMENSIONS } from "@/types/admin";
import { supabase } from "@/integrations/supabase/client";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

const MIN_MENTIONS = 5;

interface DimensionalInsightsProps {
  vendorName: string;
  mentionCount: number;
}

interface DimensionMention {
  id: string;
  quote: string;
  type: string;
  created_at: string;
}

function getSentimentLabel(positivePercent: number): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  if (positivePercent >= 75) {
    return { label: "Mostly positive", colorClass: "text-emerald-700", bgClass: "bg-emerald-50" };
  }
  if (positivePercent >= 50) {
    return { label: "Mixed", colorClass: "text-amber-700", bgClass: "bg-amber-50" };
  }
  return { label: "Needs attention", colorClass: "text-red-700", bgClass: "bg-red-50" };
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function TypeBadge({ type }: { type: string }) {
  if (type === "positive") {
    return (
      <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        positive
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      concern
    </span>
  );
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

  const dimensionKeys = dimensions?.map((d) => d.dimension) ?? [];

  const { data: mentionsByDimension } = useQuery<Record<string, DimensionMention[]>>({
    queryKey: ["profile-dimension-mentions", vendorName, dimensionKeys],
    queryFn: async () => {
      const result: Record<string, DimensionMention[]> = {};
      await Promise.all(
        dimensionKeys.map(async (dimension) => {
          const { data, error } = await supabase
            .from("vendor_mentions")
            .select("id, quote, type, created_at")
            .eq("vendor_name", vendorName)
            .eq("dimension", dimension)
            .order("created_at", { ascending: false })
            .limit(3);
          if (error) {
            result[dimension] = [];
          } else {
            result[dimension] = (data ?? []) as DimensionMention[];
          }
        })
      );
      return result;
    },
    enabled: dimensionKeys.length > 0,
  });

  if (mentionCount < MIN_MENTIONS) return null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mb-5" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 p-3 space-y-2">
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-2 bg-slate-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!dimensions || dimensions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">
        Dimensional Breakdown
      </h3>
      <p className="text-[10px] text-slate-400 mb-4">Hover to see recent mentions</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dimensions.map((dim) => {
          const dimConfig = VENDOR_DIMENSIONS[dim.dimension];
          const label = dimConfig?.label || dim.dimension;
          const sentiment = getSentimentLabel(dim.positive_percent);
          const mentions = mentionsByDimension?.[dim.dimension] ?? [];

          return (
            <HoverCard key={dim.dimension} openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div className="cursor-default rounded-xl border border-border/50 bg-slate-50/50 p-3 transition-colors hover:border-amber-200 hover:bg-amber-50/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-slate-800">
                      {label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${sentiment.colorClass} ${sentiment.bgClass}`}
                      >
                        {sentiment.label}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {dim.mention_count}
                      </span>
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                      style={{ width: `${dim.positive_percent}%` }}
                    />
                  </div>
                </div>
              </HoverCardTrigger>

              <HoverCardContent side="bottom" align="start" className="w-80 p-0">
                <div className="border-b px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">
                    Recent {label} Mentions
                  </p>
                </div>

                {mentions.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400">No recent mentions</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {mentions.map((mention) => (
                      <div key={mention.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs italic text-slate-600 line-clamp-3">
                            {mention.quote}
                          </p>
                          <TypeBadge type={mention.type} />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {formatRelativeTime(mention.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}

export default DimensionalInsights;
