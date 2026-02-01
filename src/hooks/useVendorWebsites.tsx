import { useState, useEffect } from "react";
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
 * Hook to fetch approved vendor profile websites for linking on vendor cards
 */
export function useVendorWebsites(): UseVendorWebsitesResult {
  const [websites, setWebsites] = useState<Record<string, VendorWebsite>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVendorWebsites();
  }, []);

  const fetchVendorWebsites = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("vendor_name, company_website, company_logo_url")
        .eq("is_approved", true);

      if (error) throw error;

      const websiteMap: Record<string, VendorWebsite> = {};
      (data || []).forEach((profile) => {
        websiteMap[profile.vendor_name.toLowerCase()] = {
          vendor_name: profile.vendor_name,
          company_website: profile.company_website,
          company_logo_url: profile.company_logo_url,
        };
      });

      setWebsites(websiteMap);
    } catch (err) {
      console.error("Failed to fetch vendor websites:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getWebsiteForVendor = (vendorName: string): string | null => {
    const key = vendorName.toLowerCase();
    return websites[key]?.company_website || null;
  };

  const getLogoForVendor = (vendorName: string): string | null => {
    const key = vendorName.toLowerCase();
    return websites[key]?.company_logo_url || null;
  };

  return {
    websites,
    getWebsiteForVendor,
    getLogoForVendor,
    isLoading,
  };
}
