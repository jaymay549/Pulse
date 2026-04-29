import { ArrowRightLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useVendorSwitchingIntel } from "@/hooks/useVendorSwitchingIntel";

// ── Local NetTrendBadge (vendor-dashboard variant) ──────────────────────

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
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-[11px] font-medium text-yellow-700">
        <TrendingUp className="h-3 w-3" />
        Net positive (+{net})
      </span>
    );
  }

  if (net < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-800">
        <TrendingDown className="h-3 w-3" />
        Net negative ({net})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
      <Minus className="h-3 w-3" />
      Neutral
    </span>
  );
}

// ── Full Card (Market Intel & Dealer Signals) ───────────────────────────

interface CompetitiveMovementCardProps {
  vendorName: string;
}

export function CompetitiveMovementCard({ vendorName }: CompetitiveMovementCardProps) {
  const { data, isLoading, isError } = useVendorSwitchingIntel(vendorName);

  if (isLoading || isError || !data) return null;
  if (data.switched_to + data.switched_from === 0) return null;

  return (
    <div className="rounded-xl border border-yellow-400 bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-amber-500" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Competitive Movement
          </h3>
        </div>
        <NetTrendBadge
          switchedTo={data.switched_to}
          switchedFrom={data.switched_from}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gained from */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-semibold text-yellow-600">
              Gained from
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              ({data.switched_to})
            </span>
          </div>

          {data.to_sources.length > 0 ? (
            <div className="space-y-1.5">
              {data.to_sources.slice(0, 5).map((source) => (
                <div
                  key={source.vendor}
                  className="flex items-center justify-between rounded-lg bg-yellow-50/50 border border-yellow-200 px-3 py-1.5"
                >
                  <span className="text-[13px] text-slate-700 truncate mr-2">
                    {source.vendor}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    {source.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">No data</p>
          )}
        </div>

        {/* Lost to */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-semibold text-slate-800">
              Lost to
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              ({data.switched_from})
            </span>
          </div>

          {data.from_destinations.length > 0 ? (
            <div className="space-y-1.5">
              {data.from_destinations.slice(0, 5).map((dest) => (
                <div
                  key={dest.vendor}
                  className="flex items-center justify-between rounded-lg bg-slate-50/50 border border-slate-300 px-3 py-1.5"
                >
                  <span className="text-[13px] text-slate-700 truncate mr-2">
                    {dest.vendor}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    {dest.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Compact Card (Intelligence Hub) ─────────────────────────────────────

interface CompetitiveMovementCompactProps {
  vendorName: string;
}

export function CompetitiveMovementCompact({ vendorName }: CompetitiveMovementCompactProps) {
  const { data, isLoading, isError } = useVendorSwitchingIntel(vendorName);

  if (isLoading || isError || !data) return null;
  if (data.switched_to + data.switched_from === 0) return null;

  return (
    <div className="rounded-2xl border border-yellow-400 bg-white shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Movement</h3>
        </div>
        <NetTrendBadge switchedTo={data.switched_to} switchedFrom={data.switched_from} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] font-semibold text-yellow-600">Gained</span>
          <span className="text-sm font-bold text-slate-900">{data.switched_to}</span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] font-semibold text-slate-700">Lost</span>
          <span className="text-sm font-bold text-slate-900">{data.switched_from}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
        {data.to_sources.length > 0 && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">From</span>
            <span className="text-[11px] text-slate-600 truncate text-right">
              {data.to_sources.slice(0, 2).map((s) => s.vendor).join(", ")}
            </span>
          </div>
        )}
        {data.from_destinations.length > 0 && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">To</span>
            <span className="text-[11px] text-slate-600 truncate text-right">
              {data.from_destinations.slice(0, 2).map((d) => d.vendor).join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
