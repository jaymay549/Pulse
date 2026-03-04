import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
 */
export function useVendorWebsites(): UseVendorWebsitesResult {
  const [websites, setWebsites] = useState<Record<string, VendorWebsite>>({});
  const [isLoading, setIsLoading] = useState(true);

  const normalizeVendorName = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;

    const loadVendorProfiles = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("vendor_profiles" as never)
        .select("vendor_name, company_website, company_logo_url" as never)
        .eq("is_approved" as never, true);

      if (cancelled) return;
      if (error) {
        console.error("Failed to load vendor websites:", error);
        setWebsites({});
        setIsLoading(false);
        return;
      }

      const next: Record<string, VendorWebsite> = {};
      for (const row of (data as VendorWebsite[] | null) ?? []) {
        const key = row.vendor_name.toLowerCase();
        next[key] = row;
      }

      setWebsites(next);
      setIsLoading(false);
    };

    void loadVendorProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const websitesByNormalizedName = useMemo(() => {
    const index: Record<string, VendorWebsite> = {};

    for (const website of Object.values(websites)) {
      const normalized = normalizeVendorName(website.vendor_name);
      if (!normalized) continue;

      const existing = index[normalized];
      if (!existing) {
        index[normalized] = website;
        continue;
      }

      const existingHasLogo = !!existing.company_logo_url;
      const nextHasLogo = !!website.company_logo_url;
      if (!existingHasLogo && nextHasLogo) {
        index[normalized] = website;
      }
    }

    return index;
  }, [websites]);

  const getVendorProfile = (vendorName: string): VendorWebsite | null => {
    if (!vendorName) return null;

    const direct = websites[vendorName.toLowerCase()];
    if (direct) return direct;

    const normalized = normalizeVendorName(vendorName);
    if (!normalized) return null;
    return websitesByNormalizedName[normalized] ?? null;
  };

  const getWebsiteForVendor = (vendorName: string): string | null => {
    return getVendorProfile(vendorName)?.company_website ?? null;
  };

  const getLogoForVendor = (vendorName: string): string | null => {
    return getVendorProfile(vendorName)?.company_logo_url ?? null;
  };

  return {
    websites,
    getWebsiteForVendor,
    getLogoForVendor,
    isLoading,
  };
}
