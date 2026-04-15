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

/**
 * All 11 vendor dashboard components with human-readable labels and nav groups.
 * Single source of truth for the admin config grid — matches VendorDashboardSidebar navGroups.
 */
export const DASHBOARD_COMPONENTS = [
  { key: "intelligence", label: "Intelligence Hub", group: "Analytics & Insights" },
  { key: "overview", label: "Overview", group: "Analytics & Insights" },
  { key: "segments", label: "Segments", group: "Analytics & Insights" },
  { key: "intel", label: "Market Intel", group: "Analytics & Insights" },
  { key: "mentions", label: "Discussions", group: "Engagement & Activity" },
  { key: "dealer-signals", label: "Dealer Signals", group: "Engagement & Activity" },
  { key: "demo-requests", label: "Demo Requests", group: "Engagement & Activity" },
  { key: "dimensions", label: "Dimensions", group: "Presence & Catalog" },
  { key: "categories", label: "Categories", group: "Presence & Catalog" },
  { key: "screenshots", label: "Screenshots", group: "Presence & Catalog" },
  { key: "profile", label: "Edit Profile", group: "Presence & Catalog" },
] as const;

/** Human-readable tier labels for the admin UI */
export const TIER_LABELS: Record<VendorTier, string> = {
  tier_1: "Tier 1 ($12K)",
  tier_2: "Tier 2 ($25K)",
  test: "Test (Demo)",
};
