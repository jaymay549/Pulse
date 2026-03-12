import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { fetchVendorPulseFeed } from "@/hooks/useSupabaseVendorData";
import { PulseBriefing } from "./PulseBriefing";

interface DashboardOverviewProps {
  vendorName: string;
  onNavigate: (section: string) => void;
}

interface VendorMention {
  id: string;
  quote: string;
  type: string;
  conversationTime: string | null;
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
      concern
    </span>
  );
}

export function DashboardOverview({ vendorName, onNavigate }: DashboardOverviewProps): JSX.Element {
  const supabase = useClerkSupabase();

  const { data: mentions } = useQuery({
    queryKey: ["vendor-recent-mentions", vendorName],
    queryFn: async () => {
      const result = await fetchVendorPulseFeed({ vendorName, pageSize: 10 });
      return result.mentions.map((m) => ({
        id: String(m.id),
        quote: m.quote ?? "",
        type: m.type,
        conversationTime: m.conversationTime ?? null,
      })) as VendorMention[];
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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>

      {/* Pulse Briefing — health, quotes, signals, competitive, top actions */}
      <div className="mt-6">
        <PulseBriefing vendorName={vendorName} onNavigate={onNavigate} />
      </div>

      {/* Sentiment over time chart */}
      {sentimentHistory.length >= 2 && (() => {
        const chartData = sentimentHistory.map((m) => ({
          month: parseMonthLabel(m.month),
          positive: m.positive_percent ?? 0,
          total: m.total_mentions,
          positiveCount: m.positive_count,
          warningCount: m.warning_count,
        }));

        return (
          <div className="mt-8 space-y-4">
            {/* Sentiment trend area chart */}
            <div className="rounded-xl border bg-white p-5">
              <h2 className="mb-4 text-lg font-medium text-slate-900">Sentiment Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(value: number) => [`${value}%`, "Positive"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#sentimentGrad)"
                    dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-slate-400">
                Monthly positive sentiment % over the last {sentimentHistory.length} months
              </p>
            </div>

            {/* Mention volume bar chart */}
            <div className="rounded-xl border bg-white p-5">
              <h2 className="mb-4 text-lg font-medium text-slate-900">Mention Volume</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(value: number, name: string) => [value, name === "positiveCount" ? "Positive" : "Concerns"]}
                  />
                  <Bar dataKey="positiveCount" stackId="mentions" fill="#10b981" radius={[0, 0, 0, 0]} name="Positive" />
                  <Bar dataKey="warningCount" stackId="mentions" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Concerns" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Positive
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Concerns
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recent activity */}
      <h2 className="mt-8 mb-3 text-lg font-medium text-slate-900">Recent Activity</h2>

      {!mentions || mentions.length === 0 ? (
        <p className="text-sm text-slate-500">No recent mentions.</p>
      ) : (
        <>
          <div className="space-y-2">
            {mentions.slice(0, 5).map((mention) => (
              <div key={mention.id} className="flex items-start justify-between gap-4 rounded-lg border bg-white p-3">
                <p className="line-clamp-2 text-sm italic text-slate-700">{mention.quote}</p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <TypeBadge type={mention.type} />
                  <span className="text-xs text-slate-400">{mention.conversationTime ? formatRelativeTime(mention.conversationTime) : ""}</span>
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
