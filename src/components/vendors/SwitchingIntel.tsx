import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MIN_MENTIONS = 5;

interface VendorCount {
  vendor: string;
  count: number;
}

interface SwitchingIntelResult {
  switched_to: number;
  switched_from: number;
  to_sources: VendorCount[];
  from_destinations: VendorCount[];
}

interface SwitchingIntelProps {
  vendorName: string;
  mentionCount: number;
}

function NetTrendBadge({
  switchedTo,
  switchedFrom,
}: {
  switchedTo: number;
  switchedFrom: number;
}) {
  const net = switchedTo - switchedFrom;

  if (net > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
        <TrendingUp className="h-3 w-3" />
        Net positive ({`+${net}`})
      </span>
    );
  }

  if (net < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
        <TrendingDown className="h-3 w-3" />
        Net negative ({net})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
      <Minus className="h-3 w-3" />
      Neutral
    </span>
  );
}

export function SwitchingIntel({
  vendorName,
  mentionCount,
}: SwitchingIntelProps) {
  const { data, isLoading } = useQuery<SwitchingIntelResult | null>({
    queryKey: ["vendor-switching-intel", vendorName],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc(
        "get_vendor_switching_intel" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return result as unknown as SwitchingIntelResult | null;
    },
    enabled: !!vendorName && mentionCount >= MIN_MENTIONS,
    staleTime: 5 * 60 * 1000,
  });

  if (mentionCount < MIN_MENTIONS) return null;
  if (isLoading) return null;
  if (!data || (data.switched_to + data.switched_from) === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-blue-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400">
            Switching Intelligence
          </h3>
        </div>
        <NetTrendBadge
          switchedTo={data.switched_to}
          switchedFrom={data.switched_from}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Switched TO this vendor */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-semibold text-emerald-400">
              Switched to
            </span>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              ({data.switched_to})
            </span>
          </div>

          {data.to_sources.length > 0 ? (
            <div className="space-y-1.5">
              {data.to_sources.map((source) => (
                <div
                  key={source.vendor}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-1.5"
                >
                  <span className="text-[13px] text-zinc-200 truncate mr-2">
                    {source.vendor}
                  </span>
                  <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                    {source.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-600">No data</p>
          )}
        </div>

        {/* Switched FROM this vendor */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-semibold text-red-400">
              Switched from
            </span>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              ({data.switched_from})
            </span>
          </div>

          {data.from_destinations.length > 0 ? (
            <div className="space-y-1.5">
              {data.from_destinations.map((dest) => (
                <div
                  key={dest.vendor}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-1.5"
                >
                  <span className="text-[13px] text-zinc-200 truncate mr-2">
                    {dest.vendor}
                  </span>
                  <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                    {dest.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-600">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SwitchingIntel;
