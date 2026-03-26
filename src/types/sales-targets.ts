export interface SalesOpportunitySignal {
  vendor_name: string;
  total_mentions: number;
  mentions_30d: number;
  mentions_90d: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  mixed_count: number;
  promoter_count: number;
  detractor_count: number;
  passive_count: number;
  health_score: number | null;
  trend_direction: "improving" | "declining" | "stable" | null;
  top_dimension: string | null;
  feature_gap_count: number;
  category: string | null;
  has_profile: boolean;
  confirmed_dealer_count: number;
  likely_dealer_count: number;
  mentioned_only_count: number;
}

export interface SalesOpportunityRow extends SalesOpportunitySignal {
  negative_pct: number;
  nps_score: number | null;
  known_dealers: number;
  pain_score: number;
  buzz_score: number;
  gap_score: number;
}

export interface VendorDealer {
  member_id: string;
  name: string;
  dealership_name: string | null;
  status: "Confirmed User" | "Likely User" | "Mentioned Only";
  sentiment: number | null;
  rooftops: number | null;
  region: string | null;
  switching: boolean;
  mention_count: number;
}

export interface SalesSynopsis {
  data_summary: string;
  pitch_angle: string;
}

export type SortField =
  | "vendor_name"
  | "category"
  | "mentions_30d"
  | "total_mentions"
  | "negative_pct"
  | "nps_score"
  | "health_score"
  | "trend_direction"
  | "feature_gap_count"
  | "known_dealers"
  | "has_profile"
  | "pain_score"
  | "buzz_score"
  | "gap_score";

export type SortDirection = "asc" | "desc";
