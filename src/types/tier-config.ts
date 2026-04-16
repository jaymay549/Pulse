/**
 * Tier Config System Types
 *
 * Types and constants for the admin-configurable tier-component visibility system.
 * Used by the admin tier config panel (Phase 4) and dynamic frontend gating (Phase 5).
 */

/** Visibility level for a dashboard component within a tier */
export type ComponentVisibility = "full" | "gated" | "hidden";

/** Vendor tiers that appear in tier_component_config (excludes 'unverified') */
export type VendorTier = "tier_1" | "tier_2" | "test";

/** A single tier-component visibility mapping row from the database */
export interface TierComponentConfig {
  id: string;
  tier: VendorTier;
  component_key: string;
  visibility: ComponentVisibility;
  updated_at: string;
}

/** A sub-component within a dashboard page */
export interface DashboardSubComponent {
  key: string;
  label: string;
}

/** A dashboard component (page) that may contain sub-components */
export interface DashboardComponent {
  key: string;
  label: string;
  group: string;
  children?: DashboardSubComponent[];
}

/**
 * All vendor dashboard components with their sub-components.
 * Single source of truth for the admin config grid.
 * Sub-component keys use dot notation: "parent.child"
 */
export const DASHBOARD_COMPONENTS: DashboardComponent[] = [
  {
    key: "intelligence",
    label: "Intelligence Hub",
    group: "Analytics & Insights",
    children: [
      { key: "intelligence.health_score", label: "Health Score" },
      { key: "intelligence.nps_chart", label: "NPS Chart" },
      { key: "intelligence.performance_metrics", label: "Performance Metrics" },
      { key: "intelligence.benchmarking", label: "Comparative Benchmarking" },
      { key: "intelligence.recommended_actions", label: "Recommended Actions" },
      { key: "intelligence.momentum", label: "Historical Momentum" },
    ],
  },
  {
    key: "overview",
    label: "Overview",
    group: "Analytics & Insights",
    children: [
      { key: "overview.pulse_briefing", label: "Pulse Briefing" },
      { key: "overview.sentiment_trend", label: "Sentiment Trend" },
      { key: "overview.discussion_volume", label: "Discussion Volume" },
      { key: "overview.nps", label: "NPS Chart" },
      { key: "overview.recent_activity", label: "Recent Activity" },
    ],
  },
  {
    key: "segments",
    label: "Segments",
    group: "Analytics & Insights",
    children: [
      { key: "segments.axis_summary", label: "Axis Summary" },
      { key: "segments.bucket_cards", label: "Segment Cards" },
    ],
  },
  {
    key: "intel",
    label: "Market Intel",
    group: "Analytics & Insights",
    children: [
      { key: "intel.your_position", label: "Your Position" },
      { key: "intel.competitor_table", label: "Competitor Comparison" },
    ],
  },
  {
    key: "mentions",
    label: "Discussions",
    group: "Engagement & Activity",
    children: [
      { key: "mentions.sentiment_card", label: "Community Sentiment" },
      { key: "mentions.mention_cards", label: "Discussion Feed" },
      { key: "mentions.respond", label: "Official Responses" },
    ],
  },
  {
    key: "dealer-signals",
    label: "Dealer Signals",
    group: "Engagement & Activity",
    children: [
      { key: "dealer-signals.kpi_cards", label: "KPI Cards" },
      { key: "dealer-signals.status_breakdown", label: "Dealer Status Breakdown" },
      { key: "dealer-signals.exit_reasons", label: "Exit Reasons" },
      { key: "dealer-signals.market_share", label: "Category Market Share" },
    ],
  },
  {
    key: "demo-requests",
    label: "Demo Requests",
    group: "Engagement & Activity",
    children: [
      { key: "demo-requests.request_cards", label: "Request Cards" },
      { key: "demo-requests.contact_info", label: "Contact Information" },
    ],
  },
  {
    key: "dimensions",
    label: "Dimensions",
    group: "Presence & Catalog",
    children: [
      { key: "dimensions.radar_chart", label: "Radar Overview" },
      { key: "dimensions.bar_chart", label: "Discussion Breakdown" },
      { key: "dimensions.dimension_cards", label: "Dimension Cards" },
    ],
  },
  {
    key: "categories",
    label: "Categories",
    group: "Presence & Catalog",
  },
  {
    key: "screenshots",
    label: "Screenshots",
    group: "Presence & Catalog",
    children: [
      { key: "screenshots.upload", label: "Upload Area" },
      { key: "screenshots.gallery", label: "Screenshot Gallery" },
    ],
  },
  {
    key: "profile",
    label: "Edit Profile",
    group: "Presence & Catalog",
    children: [
      { key: "profile.banner_logo", label: "Banner & Logo" },
      { key: "profile.details_form", label: "Profile Details" },
      { key: "profile.screenshots", label: "Screenshots Gallery" },
    ],
  },
];

/** Human-readable tier labels for the admin UI */
export const TIER_LABELS: Record<VendorTier, string> = {
  tier_1: "Tier 1 ($12K)",
  tier_2: "Tier 2 ($25K)",
  test: "Test (Demo)",
};
