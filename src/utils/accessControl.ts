import { isProUser } from "./tierUtils";

interface VendorOrgAccessInput {
  isActive?: boolean;
  isPro?: boolean;
}

export interface VendorFeaturePermissions {
  canAccessVendorPulse: boolean;
  canRespondAsVendor: boolean;
}

/**
 * Unified client-side access resolver for vendor surfaces.
 * Mirrors backend logic: full access if user tier is pro/executive OR vendor org is active+pro.
 */
export function resolveVendorAccess({
  tier,
  vendorOrg,
}: {
  tier: string | null | undefined;
  vendorOrg?: VendorOrgAccessInput | null;
}) {
  const hasUserTierAccess = isProUser(tier);
  const hasVendorOrgAccess = Boolean(vendorOrg?.isActive && vendorOrg?.isPro);
  const hasFullAccess = hasUserTierAccess || hasVendorOrgAccess;
  const permissions: VendorFeaturePermissions = {
    canAccessVendorPulse: hasFullAccess,
    canRespondAsVendor: hasVendorOrgAccess,
  };

  return {
    hasFullAccess,
    hasUserTierAccess,
    hasVendorOrgAccess,
    permissions,
  };
}
