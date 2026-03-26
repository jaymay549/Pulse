// src/hooks/useSalesVendorDealers.ts

import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { VendorDealer } from "@/types/sales-targets";

export function useSalesVendorDealers(vendorName: string, enabled: boolean) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["sales-vendor-dealers", vendorName],
    queryFn: async (): Promise<VendorDealer[]> => {
      const { data, error } = await supabase.rpc(
        "get_sales_vendor_dealers" as never,
        { p_vendor_name: vendorName } as never
      );

      if (error) {
        console.error("[SalesTargets] Dealer RPC error:", error);
        throw error;
      }

      return ((data as unknown as any[]) || []).map((d) => ({
        member_id: d.member_id,
        name: d.member_name || "Unknown",
        dealership_name: d.dealership_name,
        status: d.dealer_status as VendorDealer["status"],
        sentiment: d.sentiment,
        rooftops: d.rooftops,
        region: d.region,
        switching: d.switching || false,
        mention_count: d.mention_count,
      }));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
