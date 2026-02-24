import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { VENDOR_DIMENSIONS } from "@/types/admin";
import type { VendorDimension } from "@/hooks/useSupabaseVendorData";

interface DashboardDimensionsProps {
  vendorName: string;
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

  // Fetch recent mentions per dimension (all at once, then split client-side)
  const dimensionKeys = dimensions?.map((d) => d.dimension) ?? [];

  const { data: mentionsByDimension } = useQuery<Record<string, DimensionMention[]>>({
    queryKey: ["dashboard-dimension-mentions", vendorName, dimensionKeys],
    queryFn: async () => {
      const result: Record<string, DimensionMention[]> = {};

      // Fetch in parallel for each dimension
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

      {/* Dimension summary cards */}
      <div className="mt-6 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">Dimensional Breakdown</h2>

        <div className="mt-4 space-y-4">
          {dimensions.map((dim) => {
            const dimConfig = VENDOR_DIMENSIONS[dim.dimension];
            const label = dimConfig?.label || dim.dimension;
            const sentiment = getSentimentLabel(dim.positive_percent);

            return (
              <div key={dim.dimension}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-900">{label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sentiment.colorClass} ${sentiment.bgClass}`}
                    >
                      {sentiment.label}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {dim.mention_count} mentions
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
            );
          })}
        </div>
      </div>

      {/* Recent mentions per dimension */}
      {dimensions.map((dim) => {
        const dimConfig = VENDOR_DIMENSIONS[dim.dimension];
        const label = dimConfig?.label || dim.dimension;
        const mentions = mentionsByDimension?.[dim.dimension] ?? [];

        if (mentions.length === 0) return null;

        return (
          <div key={`mentions-${dim.dimension}`} className="mt-6 rounded-xl border bg-white p-6">
            <h2 className="text-lg font-medium text-slate-900">
              Recent {label} Mentions
            </h2>

            <div className="mt-3 space-y-2">
              {mentions.map((mention) => (
                <div
                  key={mention.id}
                  className="flex items-start justify-between gap-4 rounded-lg border bg-white p-3"
                >
                  <p className="line-clamp-2 text-sm italic text-slate-700">
                    {mention.quote}
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <TypeBadge type={mention.type} />
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(mention.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
