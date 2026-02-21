import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "./useClerkSupabase";
import { useClerkAuth } from "./useClerkAuth";

interface VendorOwnership {
  id: string;
  vendor_name: string;
  is_approved: boolean;
}

/**
 * Returns the vendor_profiles row for the current user if they are
 * the approved owner of `vendorName`. Returns null if not owner.
 * Uses RLS — the query only returns data if user_id = auth.uid().
 */
export function useVendorOwnership(vendorName: string | undefined) {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated } = useClerkAuth();

  return useQuery<VendorOwnership | null>({
    queryKey: ["vendor-ownership", vendorName, user?.id],
    queryFn: async () => {
      if (!vendorName) return null;
      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, is_approved")
        .eq("vendor_name", vendorName)
        .eq("user_id", user!.id)
        .eq("is_approved", true)
        .maybeSingle();
      if (error) throw error;
      return data as VendorOwnership | null;
    },
    enabled: isAuthenticated && !!vendorName,
    staleTime: 0, // Always refetch on focus/mount after auth state changes
  });
}
