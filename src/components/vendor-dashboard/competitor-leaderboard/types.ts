// CAR-19: type definitions for the multi-metric competitor leaderboard.
// Shapes mirror get_compared_vendors v2.

export type SortMetric =
  | "pulse"
  | "product_stability"
  | "customer_experience"
  | "value_perception"
  | "volume";

export interface LeaderboardVendor {
  vendor_name: string;
  is_self: boolean;
  rank: number;
  rank_delta_90d: number | null;
  is_above_median: boolean;
  health_score: number | null;
  product_stability_score: number | null;
  customer_experience_score: number | null;
  value_perception_score: number | null;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number;
}

export interface LeaderboardSegment {
  category: string | null;
  origin: "category" | "override";
  widened_to: string | null;
  qualifying_vendor_count: number;
  median: {
    health_score: number | null;
    product_stability: number | null;
    customer_experience: number | null;
    value_perception: number | null;
  };
}

export interface LeaderboardPayload {
  vendors: LeaderboardVendor[];
  segment: LeaderboardSegment;
}
