import { Loader2, Users, AlertTriangle, TrendingDown, Shield, BarChart3 } from "lucide-react";
import {
  useVendorTechStackIntel,
  getReasonLabel,
  getSentimentColor,
  getSwitchingRiskLevel,
} from "@/hooks/useVendorTechStackIntel";
import { useActiveProductLine } from "@/hooks/useActiveProductLine";
import { CompetitiveMovementCard } from "@/components/vendor-dashboard/CompetitiveMovementCard";

interface DashboardDealerSignalsProps {
  vendorName: string;
}

export function DashboardDealerSignals({ vendorName }: DashboardDealerSignalsProps) {
  const { activeProductLine } = useActiveProductLine();
  const productLineSlug = activeProductLine?.slug ?? null;
  const { data, isLoading, isError } = useVendorTechStackIntel(vendorName, productLineSlug);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">
          Failed to load dealer signals. Please try refreshing.
        </p>
      </div>
    );
  }

  if (data.below_threshold) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Not enough data yet
          </p>
          <p className="mt-1 text-xs text-slate-400">
            At least {data.min_threshold} dealers need to report using this vendor
            before signals are shown. Currently {data.adoption_count} dealer
            {data.adoption_count === 1 ? " has" : "s have"} reported.
          </p>
        </div>
      </div>
    );
  }

  const risk = getSwitchingRiskLevel(data.switching_risk_pct);
  const totalAtRisk = data.status_breakdown.exploring + data.status_breakdown.left;

  return (
    <div className="space-y-6">
      <Header />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Dealers Using"
          value={data.adoption_count}
          icon={<Users className="h-4 w-4 text-blue-500" />}
          subtitle={
            data.category_market_share
              ? `${data.category_market_share.share_pct}% of ${data.category} dealers`
              : undefined
          }
        />
        <KpiCard
          label="Avg Sentiment"
          value={data.avg_sentiment !== null ? `${data.avg_sentiment}/10` : "—"}
          icon={<BarChart3 className="h-4 w-4 text-violet-500" />}
          valueColor={getSentimentColor(data.avg_sentiment)}
        />
        <KpiCard
          label="Switching Risk"
          value={`${data.switching_risk_pct}%`}
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          subtitle={risk.label}
          valueColor={risk.color}
        />
        <KpiCard
          label="At Risk"
          value={totalAtRisk}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          subtitle={`${data.status_breakdown.exploring} exploring, ${data.status_breakdown.left} left`}
        />
      </div>

      {/* Status Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Dealer Status Breakdown
        </h3>
        <StatusBar breakdown={data.status_breakdown} total={data.adoption_count} />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Stable ({data.status_breakdown.stable})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Exploring ({data.status_breakdown.exploring})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            Left ({data.status_breakdown.left})
          </span>
        </div>
      </div>

      {/* Exit Reasons */}
      {data.exit_reasons.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Why Dealers Are Leaving
          </h3>
          <div className="space-y-3">
            {data.exit_reasons.map((er) => {
              const maxCount = data.exit_reasons[0].count;
              const pct = maxCount > 0 ? (er.count / maxCount) * 100 : 0;
              return (
                <div key={er.reason}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">
                      {getReasonLabel(er.reason)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {er.count} dealer{er.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Competitive Movement */}
      <CompetitiveMovementCard vendorName={vendorName} />

      {/* Market Share */}
      {data.category_market_share && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            Category Market Share
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Based on {data.category_market_share.category_total} dealers reporting
            a {data.category} vendor
          </p>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-900">
              {data.category_market_share.share_pct}%
            </span>
            <span className="text-sm text-slate-500 mb-1">
              of dealers in {data.category}
            </span>
          </div>
          <div className="mt-3 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${data.category_market_share.share_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Privacy note */}
      <p className="text-[11px] text-slate-400 text-center">
        All data is anonymized. Individual dealer identities are never shared.
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dealer Signals</h1>
      <p className="mt-1 text-sm text-slate-500">
        Self-reported data from dealers who use this vendor
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  subtitle,
  valueColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${valueColor ?? "text-slate-900"}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}

function StatusBar({
  breakdown,
  total,
}: {
  breakdown: { stable: number; exploring: number; left: number };
  total: number;
}) {
  if (total === 0) return null;

  const stablePct = (breakdown.stable / total) * 100;
  const exploringPct = (breakdown.exploring / total) * 100;
  const leftPct = (breakdown.left / total) * 100;

  return (
    <div className="flex h-4 w-full rounded-full overflow-hidden">
      {stablePct > 0 && (
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: `${stablePct}%` }}
        />
      )}
      {exploringPct > 0 && (
        <div
          className="bg-amber-400 transition-all"
          style={{ width: `${exploringPct}%` }}
        />
      )}
      {leftPct > 0 && (
        <div
          className="bg-red-400 transition-all"
          style={{ width: `${leftPct}%` }}
        />
      )}
    </div>
  );
}
