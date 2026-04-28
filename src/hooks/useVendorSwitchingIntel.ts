import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";

export interface VendorCount {
  vendor: string;
  count: number;
}

export interface SwitchingIntelResult {
  switched_to: number;
  switched_from: number;
  to_sources: VendorCount[];
  from_destinations: VendorCount[];
}

export function useVendorSwitchingIntel(vendorName: string) {
  const supabase = useClerkSupabase();

  return useQuery<SwitchingIntelResult | null>({
    queryKey: ["vendor-switching-intel", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vendor_switching_intel" as never,
        { p_vendor_name: vendorName } as never
      );
      if (error) throw error;
      return data as unknown as SwitchingIntelResult | null;
    },
    enabled: !!vendorName,
    staleTime: 5 * 60 * 1000,
  });
}
