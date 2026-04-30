import type { LeaderboardVendor } from "./types";

export interface WindowedView {
  /** Rows above the median in display order. */
  aboveMedian: LeaderboardVendor[];
  /** Rows at or below the median in display order. */
  belowMedian: LeaderboardVendor[];
  /** Whether more vendors exist beyond what is rendered. */
  hasMore: boolean;
  /** Total qualifying vendors in the segment. */
  totalCount: number;
}

/**
 * Default render set:
 *  - Top 5 in the caller's sort order (caller decides which metric drives rank).
 *  - The vendor's own row (always).
 *  - The vendor immediately above and below the vendor (when the vendor is
 *    outside the top 5).
 *  - Median strip rendered between rows where Pulse score crosses the
 *    segment median.
 *
 * The caller (CompetitorLeaderboard) is responsible for sorting `vendors`
 * before calling this function. We preserve that order here.
 */
export function buildDefaultWindow(
  vendors: LeaderboardVendor[],
  medianHealth: number | null,
  expanded: boolean,
): WindowedView {
  const ordered = [...vendors];
  if (expanded) {
    return splitByMedian(ordered, medianHealth, ordered.length, false);
  }

  const top5 = ordered.slice(0, 5);
  const self = ordered.find((v) => v.is_self);
  const include = new Set(top5.map((v) => v.vendor_name));

  if (self && !include.has(self.vendor_name)) {
    const idx = ordered.findIndex((v) => v.vendor_name === self.vendor_name);
    [ordered[idx - 1], self, ordered[idx + 1]].forEach((v) => v && include.add(v.vendor_name));
  }

  const visible = ordered.filter((v) => include.has(v.vendor_name));
  return splitByMedian(visible, medianHealth, ordered.length, ordered.length > visible.length);
}

function splitByMedian(
  visible: LeaderboardVendor[],
  medianHealth: number | null,
  totalCount: number,
  hasMore: boolean,
): WindowedView {
  if (medianHealth === null) {
    return { aboveMedian: visible, belowMedian: [], hasMore, totalCount };
  }
  const above: LeaderboardVendor[] = [];
  const below: LeaderboardVendor[] = [];
  for (const v of visible) {
    if ((v.health_score ?? -Infinity) >= medianHealth) above.push(v);
    else below.push(v);
  }
  return { aboveMedian: above, belowMedian: below, hasMore, totalCount };
}
