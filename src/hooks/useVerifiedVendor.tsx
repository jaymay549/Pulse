import { useState } from "react";

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
 * Hook for verified vendor profiles - currently a stub since database tables were removed.
 * Vendor verification is disabled until tables are recreated.
 */
export function useVerifiedVendor(): UseVerifiedVendorResult {
  const [profile] = useState<VerifiedVendorProfile | null>(null);
  const [isLoading] = useState(false);

  const canRespondTo = (_vendorName: string): boolean => {
    return false;
  };

  const refetch = async () => {
    // No-op - tables not configured
  };

  return {
    profile,
    isLoading,
    isVerified: false,
    canRespondTo,
    refetch,
  };
}
