/**
 * Centralized tier utilities
 * Simple 2-tier system: Pro (full access) vs Free (limited access)
 */

export type ClerkUserTier = "pro" | "community" | "free" | "executive";

/**
 * Check if a user tier has Pro-level access
 * Pro tier includes: pro, executive, viewer, verified_vendor
 */
export function isProUser(tier: string | null | undefined): boolean {
  if (!tier) return false;
  const tierLower = tier.toLowerCase();
  return (
    tierLower === "pro" ||
    tierLower === "executive" ||
    tierLower === "viewer" ||
    tierLower === "verified_vendor"
  );
}

/**
 * Get access level for a user tier
 * Returns whether the user has unlimited access
 */
export function getAccessLevel(tier: string | null | undefined): {
  unlimitedAccess: boolean;
} {
  return {
    unlimitedAccess: isProUser(tier),
  };
}

/**
 * Check if a tier is a paid tier (pro or executive)
 */
export function isPaidTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  const tierLower = tier.toLowerCase();
  return tierLower === "pro" || tierLower === "executive";
}
