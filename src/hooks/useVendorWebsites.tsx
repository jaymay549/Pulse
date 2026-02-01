import { useState } from "react";

interface VendorWebsite {
  vendor_name: string;
  company_website: string | null;
  company_logo_url: string | null;
}

interface UseVendorWebsitesResult {
  websites: Record<string, VendorWebsite>;
  getWebsiteForVendor: (vendorName: string) => string | null;
  getLogoForVendor: (vendorName: string) => string | null;
  isLoading: boolean;
}

/**
 * Hook to fetch approved vendor profile websites for linking on vendor cards.
 * Currently a stub since database tables were removed.
 */
export function useVendorWebsites(): UseVendorWebsitesResult {
  const [websites] = useState<Record<string, VendorWebsite>>({});
  const [isLoading] = useState(false);

  const getWebsiteForVendor = (_vendorName: string): string | null => {
    return null;
  };

  const getLogoForVendor = (_vendorName: string): string | null => {
    return null;
  };

  return {
    websites,
    getWebsiteForVendor,
    getLogoForVendor,
    isLoading,
  };
}
