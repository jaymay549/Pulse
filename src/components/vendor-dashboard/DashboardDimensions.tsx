import { useQuery } from "@tanstack/react-query";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { VENDOR_DIMENSIONS } from "@/types/admin";
import type { VendorDimension } from "@/hooks/useSupabaseVendorData";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

interface DashboardDimensionsProps {
  vendorName: string;
}

interface DimensionMention {
  id: string;
  quote: string;
  type: string;
  conversation_time: string | null;
}

function getSentimentLabel(positivePercent: number): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  if (positivePercent >= 75) {
    return {
      label: "Mostly positive",
      colorClass: "text-emerald-700",
      bgClass: "bg-emerald-50",
    };
  }
  if (positivePercent >= 50) {
    return {
      label: "Mixed",
      colorClass: "text-yellow-700",
      bgClass: "bg-yellow-50",
    };
  }
  return {
    label: "Needs attention",
    colorClass: "text-red-700",
    bgClass: "bg-red-50",
  };
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

const TYPE_BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: "bg-emerald-100", text: "text-emerald-700", label: "positive" },
  negative: { bg: "bg-red-100", text: "text-red-700", label: "concern" },
  warning: { bg: "bg-red-100", text: "text-red-700", label: "concern" },
  neutral: { bg: "bg-slate-100", text: "text-slate-600", label: "neutral" },
  mixed: { bg: "bg-amber-100", text: "text-amber-700", label: "mixed" },
};

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_BADGE_STYLES[type] ?? TYPE_BADGE_STYLES.neutral;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function DashboardDimensions({ vendorName }: DashboardDimensionsProps): JSX.Element {
  const supabase = useClerkSupabase();

  // Fetch dimension aggregates
  const { data: dimensions, isLoading: dimensionsLoading } = useQuery<VendorDimension[]>({
    queryKey: ["dashboard-dimensions", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_dimensions" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return (data || []) as VendorDimension[];
    },
  });

  // Resolve vendor entity ID for entity-aware mention queries
  const { data: vendorEntityId = null } = useQuery<string | null>({
    queryKey: ["vendor-entity-id", vendorName],
    queryFn: async () => {
      const { data } = await supabase.rpc(
        "resolve_vendor_family_name_only" as never,
        { p_vendor_name: vendorName } as never
      );
      return (data as any[])?.[0]?.vendor_entity_id ?? null;
    },
  });

  // Fetch recent mentions per dimension (all at once, then split client-side)
  const dimensionKeys = dimensions?.map((d) => d.dimension) ?? [];

  const { data: mentionsByDimension } = useQuery<Record<string, DimensionMention[]>>({
    queryKey: ["dashboard-dimension-mentions", vendorName, dimensionKeys, vendorEntityId],
    queryFn: async () => {
      const result: Record<string, DimensionMention[]> = {};

      await Promise.all(
        dimensionKeys.map(async (dimension) => {
          const { data, error } = await (
            vendorEntityId
              ? (supabase as any)
                  .from("vendor_mentions")
                  .select("id, quote, type, conversation_time")
                  .eq("vendor_entity_id", vendorEntityId)
                  .eq("dimension", dimension)
                  .order("conversation_time", { ascending: false })
                  .limit(3)
              : (supabase as any)
                  .from("vendor_mentions")
                  .select("id, quote, type, conversation_time")
                  .eq("vendor_name", vendorName)
                  .eq("dimension", dimension)
                  .order("conversation_time", { ascending: false })
                  .limit(3)
          );

          if (error) {
            console.error(`Error fetching mentions for dimension ${dimension}:`, error);
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

  if (dimensionsLoading) {
    return <p className="text-sm text-slate-500">Loading dimensions...</p>;
  }

  if (!dimensions || dimensions.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dimensions</h1>
        <p className="mt-2 text-sm text-slate-500">
          No dimensional feedback available yet for {vendorName}.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dimensions</h1>
      <p className="mt-1 text-sm text-slate-500">
        See how dealers rate you across key dimensions
      </p>

      {/* Charts — 2 column grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar chart overview */}
        {dimensions.length >= 3 && (() => {
          const radarData = dimensions.map((dim) => ({
            dimension: (VENDOR_DIMENSIONS[dim.dimension]?.label || dim.dimension),
            score: dim.positive_percent,
            mentions: dim.mention_count,
            fullMark: 100,
          }));

          return (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-medium text-slate-900">Dimension Overview</h2>
              <p className="mt-1 text-xs text-slate-400">Positive sentiment % across all dimensions</p>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "#475569" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Radar
                    name="Positive %"
                    dataKey="score"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Mention count bar chart */}
        {dimensions.length >= 2 && (() => {
          const barData = dimensions.map((dim) => ({
            name: (VENDOR_DIMENSIONS[dim.dimension]?.label || dim.dimension),
            mentions: dim.mention_count,
            positive: dim.positive_count,
            neutral: dim.neutral_count,
            mixed: dim.mixed_count,
            negative: dim.negative_count,
          }));

          return (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-medium text-slate-900">Mentions by Dimension</h2>
              <ResponsiveContainer width="100%" height={dimensions.length * 50 + 40}>
                <BarChart data={barData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="positive" stackId="dim" fill="#10b981" radius={[0, 0, 0, 0]} name="Positive" />
                  <Bar dataKey="neutral" stackId="dim" fill="#94a3b8" radius={[0, 0, 0, 0]} name="Neutral" />
                  <Bar dataKey="mixed" stackId="dim" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Mixed" />
                  <Bar dataKey="negative" stackId="dim" fill="#ef4444" radius={[0, 4, 4, 0]} name="Negative" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Positive
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Neutral
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Mixed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Negative
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Dimensional Breakdown — 2 column grid with hover popovers */}
      <h2 className="mt-6 text-lg font-medium text-slate-900">Dimensional Breakdown</h2>
      <p className="mt-1 text-xs text-slate-400">Hover a dimension to see recent mentions</p>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {dimensions.map((dim) => {
          const dimConfig = VENDOR_DIMENSIONS[dim.dimension];
          const label = dimConfig?.label || dim.dimension;
          const sentiment = getSentimentLabel(dim.positive_percent);
          const mentions = mentionsByDimension?.[dim.dimension] ?? [];

          return (
            <HoverCard key={dim.dimension} openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div className="cursor-default rounded-xl border bg-white p-4 transition-colors hover:border-slate-300">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-900">{label}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sentiment.colorClass} ${sentiment.bgClass}`}
                      >
                        {sentiment.label}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {dim.mention_count}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                      style={{ width: `${dim.positive_percent}%` }}
                    />
                  </div>
                </div>
              </HoverCardTrigger>

              <HoverCardContent side="bottom" align="start" className="w-96 p-0">
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
                          {mention.conversation_time ? formatRelativeTime(mention.conversation_time) : ""}
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
