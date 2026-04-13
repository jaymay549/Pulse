import { vendorSupabase } from "@/integrations/supabase/vendorClient";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useVendorSupabaseAuth } from "@/hooks/useVendorSupabaseAuth";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Returns the appropriate Supabase client for the current session.
 *
 * - Vendor sessions (Supabase Auth via vendorClient): returns vendorSupabase
 *   so auth.uid() works for RLS policies.
 * - Dealer/admin sessions (Clerk): returns the Clerk-scoped client.
 *
 * IMPORTANT: When both isVendorAuth and isClerkAuth are true (admin viewing
 * vendor dashboard), returns the Clerk client — admin uses service-role
 * Edge Functions, not vendor RLS.
 */
export function useVendorDataClient(): SupabaseClient<Database> {
  const { isAuthenticated: isClerkAuth } = useClerkAuth();
  const { isAuthenticated: isVendorAuth } = useVendorSupabaseAuth();
  const clerkClient = useClerkSupabase();

  if (isVendorAuth && !isClerkAuth) {
    return vendorSupabase;
  }
  return clerkClient;
}
