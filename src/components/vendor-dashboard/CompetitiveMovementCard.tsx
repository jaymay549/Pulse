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
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
        <TrendingUp className="h-3 w-3" />
        Net positive (+{net})
      </span>
    );
  }

  if (net < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-600">
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
    <div className="rounded-xl border bg-white p-5">
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
            <span className="text-[12px] font-semibold text-emerald-600">
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
                  className="flex items-center justify-between rounded-lg bg-emerald-50/50 border border-emerald-100 px-3 py-1.5"
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
            <span className="text-[12px] font-semibold text-red-500">
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
                  className="flex items-center justify-between rounded-lg bg-red-50/50 border border-red-100 px-3 py-1.5"
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="h-4 w-4 text-amber-500" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Competitive Movement
        </h3>
      </div>

      {/* Net trend badge */}
      <div className="mb-4">
        <NetTrendBadge
          switchedTo={data.switched_to}
          switchedFrom={data.switched_from}
        />
      </div>

      {/* Compact stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-emerald-600">Gained</span>
          <span className="text-sm font-bold text-slate-900">{data.switched_to} dealers</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-red-500">Lost</span>
          <span className="text-sm font-bold text-slate-900">{data.switched_from} dealers</span>
        </div>
      </div>

      {/* Top vendors (compact) */}
      {data.to_sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-medium text-slate-400 mb-1.5">Top gained from</p>
          <p className="text-[12px] text-slate-600 truncate">
            {data.to_sources.slice(0, 3).map((s) => s.vendor).join(", ")}
          </p>
        </div>
      )}

      {data.from_destinations.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-slate-400 mb-1.5">Top lost to</p>
          <p className="text-[12px] text-slate-600 truncate">
            {data.from_destinations.slice(0, 3).map((d) => d.vendor).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
