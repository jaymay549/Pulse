import { useVendorAuth } from "./useVendorAuth";

export interface VerifiedVendorProfile {
  id: string;
  vendor_name: string;
  is_approved: boolean;
  company_logo_url: string | null;
  company_website: string | null;
  contact_email: string | null;
}

interface UseVerifiedVendorResult {
  profile: VerifiedVendorProfile | null;
  isLoading: boolean;
  isVerified: boolean;
  canRespondTo: (vendorName: string) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook for verified vendor profiles - delegates to useVendorAuth for org-based verification.
 * A vendor is considered "verified" if their Clerk org has both paid=true and verified=true.
 */
export function useVerifiedVendor(): UseVerifiedVendorResult {
  const { isLoaded, isActive, isPro, vendorNames, organization, user } = useVendorAuth();

  const normalizeVendorName = (value: string): string => {
    return value
      .toLowerCase()
      .replace(/\b(incorporated|inc|llc|ltd|corp|corporation|co|company)\b/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const profile: VerifiedVendorProfile | null = isActive && organization
    ? {
        id: organization.id,
        vendor_name: vendorNames[0] || organization.name,
        is_approved: true,
        company_logo_url: organization.imageUrl || null,
        company_website: null,
        contact_email: user?.primaryEmailAddress?.emailAddress || null,
      }
    : null;

  const canRespondTo = (vendorName: string): boolean => {
    if (!isPro || !isActive) return false;
    const target = normalizeVendorName(vendorName);
    if (!target) return false;

    return vendorNames.some((vn) => {
      const normalized = normalizeVendorName(vn);
      if (!normalized) return false;
      return (
        normalized === target ||
        normalized.includes(target) ||
        target.includes(normalized)
      );
    });
  };

  const refetch = async () => {
    // No-op - Clerk data is reactive
  };

  return {
    profile,
    isLoading: !isLoaded,
    isVerified: isActive,
    canRespondTo,
    refetch,
  };
}
