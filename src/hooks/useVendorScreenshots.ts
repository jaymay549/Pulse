import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorScreenshot {
  id: string;
  vendor_name: string;
  url: string;
  sort_order: number;
  created_at: string;
}

export function useVendorScreenshots(vendorName: string) {
  return useQuery<VendorScreenshot[]>({
    queryKey: ["vendor-screenshots", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_screenshots" as never)
        .select("id, vendor_name, url, sort_order, created_at")
        .eq("vendor_name", vendorName)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VendorScreenshot[];
    },
    enabled: !!vendorName,
  });
}
