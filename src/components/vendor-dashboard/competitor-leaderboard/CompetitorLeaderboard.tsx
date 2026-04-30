import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVendorTier } from "../GatedCard";
import { CategoryChips } from "./CategoryChips";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { LeaderboardHeader } from "./LeaderboardHeader";
import { LeaderboardRow } from "./LeaderboardRow";
import { MedianRow } from "./MedianRow";
import { ShowAllToggle } from "./ShowAllToggle";
import { SortChips } from "./SortChips";
import { TableHeader } from "./TableHeader";
import { Tier2CapabilityCard } from "./Tier2CapabilityCard";
import { WidenedNotice } from "./WidenedNotice";
import { YourShapeCard } from "./YourShapeCard";
import { useLeaderboardData } from "./useLeaderboardData";
import { track } from "./telemetry";
import { buildDefaultWindow } from "./window";
import type { LeaderboardVendor, SortMetric } from "./types";

interface CompetitorLeaderboardProps {
  vendorName: string;
  productLineSlug?: string | null;
}

export function CompetitorLeaderboard({ vendorName, productLineSlug = null }: CompetitorLeaderboardProps) {
  const tier = useVendorTier();
  const [sortBy, setSortBy] = useState<SortMetric>("pulse");
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeRowVendor, setActiveRowVendor] = useState<LeaderboardVendor | null>(null);

  const segmentOverride = useCompetitorOverride(vendorName);
  const { data, isLoading, isError } = useLeaderboardData({
    vendorName,
    productLineSlug,
    categoryOverride,
    limit: expanded ? 50 : 8,
    segmentOverride,
  });

  useEffect(() => {
    if (!data) return;
    const self = data.vendors.find((v) => v.is_self);
    track({
      name: "leaderboard_viewed",
      payload: {
        tier,
        segment_category: data.segment.category,
        was_widened: data.segment.widened_to !== null,
        qualifying_vendor_count: data.segment.qualifying_vendor_count,
        rank: self?.rank ?? null,
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrow: fire once per segment shape change, not on every refetch
  }, [data?.segment.category, data?.segment.widened_to, data?.segment.qualifying_vendor_count, tier]);

  const onRowClick = (vendor: LeaderboardVendor) => {
    track({
      name: "leaderboard_row_clicked",
      payload: { tier, vendor_name: vendor.vendor_name, was_own_row: vendor.is_self },
    });
    setActiveRowVendor(vendor);
  };

  const sorted = useMemo(() => sortVendors(data?.vendors ?? [], sortBy), [data?.vendors, sortBy]);
  const window = useMemo(
    () => buildDefaultWindow(sorted, data?.segment.median.health_score ?? null, expanded),
    [sorted, data?.segment.median.health_score, expanded],
  );

  if (isLoading) return <p className="text-sm text-slate-500">Loading leaderboard…</p>;
  if (isError || !data) return <p className="text-sm text-slate-500">Could not load competitive standing.</p>;
  if (data.vendors.length < 2) return <EmptyState />;

  const isT1 = tier !== undefined && tier !== "tier_2";

  return (
    <section className="rounded-xl border bg-white p-6" aria-labelledby="competitor-leaderboard-heading">
        <div id="competitor-leaderboard-heading">
          <LeaderboardHeader segment={data.segment} />
        </div>
        {data.segment.widened_to && <WidenedNotice widenedTo={data.segment.widened_to} />}

        <CategoryChips
          availableCategories={data.segment.available_categories ?? data.segment.included_categories ?? []}
          activeCategory={categoryOverride}
          autoCategory={data.segment.category}
          onChange={(next) => {
            setCategoryOverride(next);
            setExpanded(false);
          }}
        />
        <SortChips
          value={sortBy}
          onChange={(next) => {
            track({ name: "leaderboard_sort_changed", payload: { from: sortBy, to: next } });
            setSortBy(next);
          }}
        />
        <TableHeader />

        {window.aboveMedian.map((v, i) => (
          <LeaderboardRow
            key={`${v.vendor_name}-${sortBy}`}
            vendor={v}
            sparkline={mockSparklineFor(v)}
            sparklineTrend={inferTrend(v)}
            onClick={onRowClick}
            delayMs={i * 60}
          />
        ))}
        <MedianRow segment={data.segment} />
        {(() => {
          const aboveCount = window.aboveMedian.length;
          return window.belowMedian.map((v, i) => (
            <LeaderboardRow
              key={`${v.vendor_name}-${sortBy}`}
              vendor={v}
              sparkline={mockSparklineFor(v)}
              sparklineTrend={inferTrend(v)}
              onClick={onRowClick}
              delayMs={(i + aboveCount) * 60}
            />
          ));
        })()}

        {window.hasMore && (
          <ShowAllToggle
            expanded={expanded}
            totalCount={data.segment.qualifying_vendor_count}
            onToggle={() => {
              setExpanded((x) => {
                const next = !x;
                if (next && data) {
                  track({
                    name: "leaderboard_show_all_expanded",
                    payload: { total_vendors: data.segment.qualifying_vendor_count },
                  });
                }
                return next;
              });
            }}
          />
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <YourShapeCard payload={data} />
          {isT1 && (
            <Tier2CapabilityCard
              onCtaClick={() =>
                track({ name: "tier2_card_cta_clicked", payload: { source: "competitor_leaderboard" } })
              }
            />
          )}
        </div>

      {activeRowVendor && (
        <RowClickResult
          tier={tier}
          vendor={activeRowVendor}
          onDismiss={() => setActiveRowVendor(null)}
        />
      )}
    </section>
  );
}

/**
 * Sort comparator. The visible composite column always shows Pulse, but the
 * row order changes with the sort key.
 */
function sortVendors(vendors: LeaderboardVendor[], sortBy: SortMetric): LeaderboardVendor[] {
  const get = (v: LeaderboardVendor): number => {
    if (sortBy === "pulse") return v.health_score ?? -Infinity;
    if (sortBy === "product_stability") return v.product_stability_score ?? -Infinity;
    if (sortBy === "customer_experience") return v.customer_experience_score ?? -Infinity;
    if (sortBy === "value_perception") return v.value_perception_score ?? -Infinity;
    return v.mention_count;
  };
  return [...vendors].sort((a, b) => get(b) - get(a));
}

/**
 * v1 sparkline: derive a flat-to-current curve from the vendor's current
 * health_score so the column has visual rhythm. Replaced by real per-vendor
 * 90D sentiment_history wiring in a follow-up.
 */
function mockSparklineFor(v: LeaderboardVendor): number[] {
  const target = (v.health_score ?? 50) / 100;
  const start = Math.max(0.2, target - 0.18);
  return Array.from({ length: 8 }, (_, i) => start + ((target - start) * i) / 7);
}

function inferTrend(v: LeaderboardVendor): "up" | "down" | "flat" {
  if (v.rank_delta_90d === null) return "flat";
  if (v.rank_delta_90d > 0) return "up";
  if (v.rank_delta_90d < 0) return "down";
  return "flat";
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
        Not enough data yet to rank you against competitors.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
        Our engine is currently gathering dealer feedback. Need 2+ qualifying vendors in your segment to render the leaderboard.
      </p>
    </section>
  );
}

/**
 * Row-click outcome. Tier 1 sees an inline strip directly under the table
 * pointing them at Tier 2. Tier 2 v1 ships a console.warn no-op (the real
 * drawer is a follow-up issue).
 */
function RowClickResult({
  tier, vendor, onDismiss,
}: {
  tier: string | undefined;
  vendor: LeaderboardVendor;
  onDismiss: () => void;
}) {
  if (tier === "tier_2" || tier === undefined) {
    console.warn("CompetitorLeaderboard: Tier 2 drawer not yet implemented", vendor);
    // For v1, dismiss immediately so the click feels intentional but inert.
    // Replaced wholesale by the follow-up drawer issue.
    requestAnimationFrame(onDismiss);
    return null;
  }
  return (
    <div className="mt-4 grid grid-cols-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 text-[13px] text-slate-700 sm:grid-cols-[1fr_auto]">
      <span>
        Diagnostic mode is available in Tier 2. See the dealer quotes, feature gaps, and competitor moves driving <strong className="font-semibold text-slate-900">{vendor.vendor_name}</strong>{`'`}s scores.
      </span>
      <div className="flex gap-2 justify-self-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Dismiss
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 font-sans text-xs font-semibold text-yellow-400 hover:bg-slate-800"
        >
          Talk to your CSM →
        </button>
      </div>
    </div>
  );
}

/**
 * Reads `vendor_profiles.competitor_override` for the given vendor name.
 * Returns the string array override if set, or null to fall back to the
 * auto-derived category segment in the leaderboard RPC.
 */
function useCompetitorOverride(vendorName: string): string[] | null {
  const supabase = useClerkSupabase();
  const { data } = useQuery({
    queryKey: ["competitor-override", vendorName],
    enabled: !!vendorName,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("competitor_override")
        .ilike("vendor_name", vendorName)
        .maybeSingle();
      if (error) throw error;
      return (data?.competitor_override as string[] | null) ?? null;
    },
  });
  return data ?? null;
}
