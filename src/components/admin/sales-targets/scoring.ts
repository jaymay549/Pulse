import type { SalesOpportunitySignal, SalesOpportunityRow } from "@/types/sales-targets";

/**
 * Compute Pain Score (0-100).
 * - 40% negative percentage
 * - 30% detractor ratio
 * - 30% declining trend bonus
 */
function painScore(signal: SalesOpportunitySignal): number {
  const negPct =
    signal.total_mentions > 0
      ? (signal.negative_count / signal.total_mentions) * 100
      : 0;

  const totalNps =
    signal.promoter_count + signal.detractor_count + signal.passive_count;
  const detractorRatio =
    totalNps > 0 ? (signal.detractor_count / totalNps) * 100 : 0;

  const trendBonus = signal.trend_direction === "declining" ? 100 : 0;

  return Math.min(
    100,
    Math.round(negPct * 0.4 + detractorRatio * 0.3 + trendBonus * 0.3)
  );
}

/**
 * Compute Buzz Score (0-100).
 * - 60% mentions_30d (normalized to max in dataset)
 * - 40% total_mentions (normalized to max in dataset)
 */
function buzzScore(
  signal: SalesOpportunitySignal,
  max30d: number,
  maxTotal: number
): number {
  const norm30d = max30d > 0 ? (signal.mentions_30d / max30d) * 100 : 0;
  const normTotal =
    maxTotal > 0 ? (signal.total_mentions / maxTotal) * 100 : 0;
  return Math.round(norm30d * 0.6 + normTotal * 0.4);
}

/**
 * Compute Gap Score (0-100).
 * Feature gap count normalized to max in dataset.
 */
function gapScore(signal: SalesOpportunitySignal, maxGaps: number): number {
  return maxGaps > 0
    ? Math.round((signal.feature_gap_count / maxGaps) * 100)
    : 0;
}

/**
 * Enrich raw signals with computed scores.
 */
export function computeOpportunityRows(
  signals: SalesOpportunitySignal[]
): SalesOpportunityRow[] {
  const max30d = Math.max(1, ...signals.map((s) => s.mentions_30d));
  const maxTotal = Math.max(1, ...signals.map((s) => s.total_mentions));
  const maxGaps = Math.max(1, ...signals.map((s) => s.feature_gap_count));

  return signals.map((s) => {
    const totalNps =
      s.promoter_count + s.detractor_count + s.passive_count;

    return {
      ...s,
      negative_pct:
        s.total_mentions > 0
          ? Math.round((s.negative_count / s.total_mentions) * 100)
          : 0,
      nps_score:
        totalNps > 0
          ? Math.round(
              ((s.promoter_count - s.detractor_count) / totalNps) * 100
            )
          : null,
      known_dealers: s.confirmed_dealer_count + s.likely_dealer_count,
      pain_score: painScore(s),
      buzz_score: buzzScore(s, max30d, maxTotal),
      gap_score: gapScore(s, maxGaps),
    };
  });
}
