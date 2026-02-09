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
    return vendorNames.some(
      (vn) => vn.toLowerCase() === vendorName.toLowerCase()
    );
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
