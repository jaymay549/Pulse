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
 *  - Top 5 by rank.
 *  - The vendor's own row (always).
 *  - The vendor immediately above and below the vendor (when the vendor is
 *    outside the top 5).
 *  - Median strip rendered between rows where Pulse score crosses the
 *    segment median.
 */
export function buildDefaultWindow(
  vendors: LeaderboardVendor[],
  medianHealth: number | null,
  expanded: boolean,
): WindowedView {
  const sorted = [...vendors].sort((a, b) => a.rank - b.rank);
  if (expanded) {
    return splitByMedian(sorted, medianHealth, sorted.length, false);
  }

  const top5 = sorted.slice(0, 5);
  const self = sorted.find((v) => v.is_self);
  const include = new Set(top5.map((v) => v.vendor_name));

  if (self && !include.has(self.vendor_name)) {
    const idx = sorted.findIndex((v) => v.vendor_name === self.vendor_name);
    [sorted[idx - 1], self, sorted[idx + 1]].forEach((v) => v && include.add(v.vendor_name));
  }

  const visible = sorted.filter((v) => include.has(v.vendor_name));
  return splitByMedian(visible, medianHealth, sorted.length, sorted.length > visible.length);
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
