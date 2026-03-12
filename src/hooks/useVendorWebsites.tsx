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
 * Logo resolution order:
 *   1. vendor_profiles.company_logo_url  (claimed/approved profiles)
 *   2. vendor_metadata.logo_url          (enrichment pipeline fallback)
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

      // Fetch both sources in parallel
      const [profilesResult, metadataResult] = await Promise.all([
        supabase
          .from("vendor_profiles" as never)
          .select("vendor_name, company_website, company_logo_url" as never)
          .eq("is_approved" as never, true),
        (supabase as any)
          .from("vendor_metadata")
          .select("vendor_name, logo_url, website_url"),
      ]);

      if (cancelled) return;

      if (profilesResult.error) {
        console.error("Failed to load vendor websites:", profilesResult.error);
      }

      const next: Record<string, VendorWebsite> = {};

      // Layer 1: vendor_metadata logos as base (lower priority)
      for (const row of (metadataResult.data ?? []) as { vendor_name: string; logo_url: string | null; website_url: string | null }[]) {
        if (!row.vendor_name) continue;
        const key = row.vendor_name.toLowerCase();
        if (!next[key]) {
          next[key] = {
            vendor_name: row.vendor_name,
            company_website: row.website_url ?? null,
            company_logo_url: row.logo_url ?? null,
          };
        }
      }

      // Layer 2: vendor_profiles overrides (higher priority — claimed/approved)
      for (const row of (profilesResult.data as VendorWebsite[] | null) ?? []) {
        const key = row.vendor_name.toLowerCase();
        const existing = next[key];
        if (!existing) {
          next[key] = row;
        } else {
          // Prefer profile values; keep metadata logo if profile has none
          next[key] = {
            vendor_name: row.vendor_name,
            company_website: row.company_website ?? existing.company_website,
            company_logo_url: row.company_logo_url ?? existing.company_logo_url,
          };
        }
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
