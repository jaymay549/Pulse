import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Minus, TrendingUp, Loader2 } from "lucide-react";
import { useVendorDataClient } from "@/hooks/useVendorDataClient";
import { Badge } from "@/components/ui/badge";

interface DashboardIntelProps {
  vendorName: string;
}

interface OwnProfileStats {
  totalMentions: number;
  positiveCount: number;
  warningCount: number;
  positivePercent: number;
  warningPercent: number;
}

interface OwnProfile {
  vendorName: string;
  stats: OwnProfileStats;
}

interface VendorTrend {
  currentPositivePct: number;
  previousPositivePct: number;
  direction: "up" | "down" | "stable";
  mentionVolumeChangePct: number;
}

interface ComparedVendor {
  vendor_name: string;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number | null;
}

interface TableRow {
  name: string;
  mentions: number;
  positivePct: number;
  coOccurrences: number | null;
  isOwn: boolean;
}

function sentimentColor(percent: number): string {
  if (percent >= 70) return "text-emerald-600";
  if (percent >= 50) return "text-yellow-600";
  return "text-red-500";
}

function TrendBadge({ trend }: { trend: VendorTrend }) {
  const pct = trend.mentionVolumeChangePct;

  if (trend.direction === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
        <ArrowUp className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  if (trend.direction === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-500">
        <ArrowDown className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      <Minus className="h-3 w-3" />
      {pct}%
    </span>
  );
}

export function DashboardIntel({ vendorName }: DashboardIntelProps): JSX.Element {
  const supabase = useVendorDataClient();

  // Own profile stats
  const { data: ownProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["intel-own-profile", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_profile_v3" as never,
        { p_vendor_name: vendorName, p_product_line_slug: null } as never
      );
      if (error) throw error;
      return data as OwnProfile | null;
    },
  });

  // Trend
  const { data: trend } = useQuery({
    queryKey: ["vendor-trend", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_trend" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return data as VendorTrend | null;
    },
  });

  // Competitors
  const { data: competitors = [], isLoading: competitorsLoading } = useQuery<
    ComparedVendor[]
  >({
    queryKey: ["intel-competitors", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_compared_vendors" as never,
        { p_vendor_name: vendorName, p_limit: 4 } as never
      );
      if (error) throw error;
      return ((data as any)?.vendors ?? []) as ComparedVendor[];
    },
  });

  if (profileLoading || competitorsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading intel...</p>
      </div>
    );
  }

  if (!ownProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">No data available for {vendorName}.</p>
        <p className="text-xs text-slate-400">Intel will appear once dealer discussions are recorded.</p>
      </div>
    );
  }

  const stats = ownProfile.stats;
  const positivePct = stats.positivePercent ?? 0;

  const rows: TableRow[] = [
    {
      name: ownProfile.vendorName,
      mentions: stats.totalMentions,
      positivePct: positivePct,
      coOccurrences: null as number | null,
      isOwn: true,
    },
    ...competitors.map((c) => ({
      name: c.vendor_name,
      mentions: c.mention_count,
      positivePct: c.positive_percent ?? 0,
      coOccurrences: c.co_occurrence_count,
      isOwn: false,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Market Intel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Competitive intelligence from real dealer conversations
        </p>
      </div>

      {/* Your Position card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900">Your Position</h2>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          {/* Total Discussions */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {stats.totalMentions}
              </span>
              {trend && <TrendBadge trend={trend} />}
            </div>
            <p className="mt-1 text-xs text-slate-500">Total Discussions</p>
          </div>

          {/* Positive % */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <span className={`text-2xl font-bold ${sentimentColor(positivePct)}`}>
              {positivePct}%
            </span>
            <p className="mt-1 text-xs text-slate-500">Positive Sentiment</p>
          </div>

          {/* Concerns */}
          <div className="rounded-lg border bg-slate-50 p-4">
            <span className="text-2xl font-bold text-red-500">
              {stats.warningCount}
            </span>
            <p className="mt-1 text-xs text-slate-500">Concerns</p>
          </div>
        </div>
      </div>

      {/* Competitor Comparison table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          Competitor Comparison
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Vendors dealers discuss alongside you
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Vendor
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Discussions
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Positive %
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Co-occurrences
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr
                  key={`${row.isOwn ? "own" : "comp"}-${row.name}`}
                  className={row.isOwn ? "bg-primary/5 font-medium" : ""}
                >
                  <td className="px-4 py-3 text-slate-900">
                    <div className="flex items-center gap-2">
                      {row.name}
                      {row.isOwn && (
                        <Badge variant="outline" className="text-xs py-0">
                          You
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {row.mentions}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={sentimentColor(row.positivePct)}>
                      {row.positivePct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {row.coOccurrences != null ? row.coOccurrences : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
