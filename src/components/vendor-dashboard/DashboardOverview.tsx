import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";

interface DashboardOverviewProps {
  vendorName: string;
  onNavigate: (section: string) => void;
}

interface VendorStats {
  totalMentions: number;
  positiveCount: number;
  warningCount: number;
  positivePercent: number;
  warningPercent: number;
}

interface VendorProfile {
  vendorName: string;
  stats: VendorStats;
}

interface VendorTrend {
  currentPositivePct: number;
  previousPositivePct: number;
  direction: "up" | "down" | "stable";
  mentionVolumeChangePct: number;
}

interface VendorMention {
  id: string;
  quote: string;
  type: string;
  created_at: string;
}

interface SentimentMonth {
  month: string;
  total_mentions: number;
  positive_count: number;
  warning_count: number;
  positive_percent: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonthLabel(yyyyMm: string): string {
  const monthIndex = parseInt(yyyyMm.split("-")[1], 10) - 1;
  return MONTH_LABELS[monthIndex] ?? yyyyMm;
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

function sentimentColor(percent: number): string {
  if (percent >= 70) return "text-emerald-600";
  if (percent >= 50) return "text-yellow-600";
  return "text-red-500";
}

function TrendBadge({ trend }: { trend: VendorTrend }) {
  const pct = trend.mentionVolumeChangePct;

  if (trend.direction === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
        <ArrowUp className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  if (trend.direction === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
        <ArrowDown className="h-3 w-3" />
        {pct}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
      <Minus className="h-3 w-3" />
      {pct}%
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "positive") {
    return (
      <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        positive
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      warning
    </span>
  );
}

export function DashboardOverview({ vendorName, onNavigate }: DashboardOverviewProps): JSX.Element {
  const supabase = useClerkSupabase();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["vendor-profile", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_profile" as never, { p_vendor_name: vendorName } as never);
      if (error) throw error;
      return data as unknown as VendorProfile;
    },
  });

  const { data: trend } = useQuery({
    queryKey: ["vendor-trend", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_trend" as never, { p_vendor_name: vendorName } as never);
      if (error) throw error;
      return data as unknown as VendorTrend;
    },
  });

  const { data: mentions } = useQuery({
    queryKey: ["vendor-recent-mentions", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_mentions")
        .select("id, quote, type, created_at")
        .eq("vendor_name", vendorName)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as VendorMention[];
    },
  });

  const { data: sentimentHistory = [] } = useQuery({
    queryKey: ["vendor-sentiment-history", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_sentiment_history" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return (data || []) as SentimentMonth[];
    },
  });

  if (profileLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  const stats = profile?.stats;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{stats?.totalMentions ?? 0}</span>
            {trend && <TrendBadge trend={trend} />}
          </div>
          <p className="mt-1 text-xs text-slate-500">Total Mentions</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <span className={`text-2xl font-bold ${sentimentColor(stats?.positivePercent ?? 0)}`}>
            {stats?.positivePercent ?? 0}%
          </span>
          <p className="mt-1 text-xs text-slate-500">Positive Sentiment</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <span className="text-2xl font-bold text-red-500">{stats?.warningCount ?? 0}</span>
          <p className="mt-1 text-xs text-slate-500">Concerns Flagged</p>
        </div>
      </div>

      {/* Sentiment over time chart */}
      {sentimentHistory.length >= 2 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-medium text-slate-900">Sentiment Over Time</h2>
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {sentimentHistory.map((m) => {
                const pct = m.positive_percent ?? 0;
                const barHeight = Math.max(pct, 4); // minimum 4% so the bar is always visible
                return (
                  <div
                    key={m.month}
                    className="group flex flex-1 flex-col items-center gap-1"
                  >
                    {/* Percentage label */}
                    <span className="text-xs font-medium text-slate-600">
                      {pct}%
                    </span>
                    {/* Bar container */}
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[40px] rounded-t-md bg-emerald-400 transition-all group-hover:bg-emerald-500"
                        style={{ height: `${barHeight}%` }}
                        title={`${parseMonthLabel(m.month)}: ${pct}% positive (${m.total_mentions} mentions)`}
                      />
                    </div>
                    {/* Month label */}
                    <span className="text-xs text-slate-500">
                      {parseMonthLabel(m.month)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Monthly positive sentiment % over the last {sentimentHistory.length} months
            </p>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <h2 className="mt-8 mb-3 text-lg font-medium text-slate-900">Recent Activity</h2>

      {!mentions || mentions.length === 0 ? (
        <p className="text-sm text-slate-500">No recent mentions.</p>
      ) : (
        <>
          <div className="space-y-2">
            {mentions.map((mention) => (
              <div key={mention.id} className="flex items-start justify-between gap-4 rounded-lg border bg-white p-3">
                <p className="line-clamp-2 text-sm italic text-slate-700">{mention.quote}</p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <TypeBadge type={mention.type} />
                  <span className="text-xs text-slate-400">{formatRelativeTime(mention.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
            onClick={() => onNavigate("mentions")}
          >
            View all mentions &rarr;
          </button>
        </>
      )}
    </div>
  );
}
