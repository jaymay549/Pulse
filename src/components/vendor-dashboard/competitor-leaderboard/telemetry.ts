// CAR-19 telemetry. Currently a stub — wire into the project analytics layer
// when one ships. All payloads are flat objects of primitives.

type LeaderboardEvent =
  | { name: "leaderboard_viewed"; payload: { tier: string | undefined; segment_category: string | null; was_widened: boolean; qualifying_vendor_count: number; rank: number | null } }
  | { name: "leaderboard_sort_changed"; payload: { from: string; to: string } }
  | { name: "leaderboard_row_clicked"; payload: { tier: string | undefined; vendor_name: string; was_own_row: boolean } }
  | { name: "leaderboard_show_all_expanded"; payload: { total_vendors: number } }
  | { name: "tier2_card_cta_clicked"; payload: { source: string } };

export function track(event: LeaderboardEvent): void {
  console.debug("[CompetitorLeaderboard][telemetry]", event.name, event.payload);
}
