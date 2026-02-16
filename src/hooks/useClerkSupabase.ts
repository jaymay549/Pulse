import { useSession } from "@clerk/clerk-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useRef } from "react";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Returns a Supabase client whose requests carry the current Clerk session
 * token.  This means Supabase RLS policies can inspect the JWT claims
 * (`auth.jwt()`) to enforce the same tier-based access rules as the WAM
 * backend — both for user-tier reads AND vendor org response writes.
 *
 * Prerequisites (one-time setup):
 *
 *   1. Clerk Dashboard → Sessions → Customize session token → add:
 *        {
 *          "role": "authenticated",
 *          "user_tier": "{{user.public_metadata.circles.tier}}",
 *          "vendor_paid": "{{org.public_metadata.vendor.paid}}",
 *          "vendor_verified": "{{org.public_metadata.vendor.verified}}",
 *          "vendor_tier": "{{org.public_metadata.vendor.tier}}",
 *          "vendor_names": "{{org.public_metadata.vendor.vendorNames}}"
 *        }
 *
 *      This gives Supabase RLS access to:
 *        - user_tier   → controls read access (free vs pro, mirrors WAM)
 *        - org_id      → included automatically by Clerk for org-scoped sessions
 *        - vendor_*    → controls vendor response writes (mirrors WAM requireVendorPro)
 *
 *   2. Supabase Dashboard → Auth → Third-Party → Add Clerk integration
 *      (domain: clerk.cdgpulse.com  or  evolved-pigeon-28.clerk.accounts.dev for dev)
 *
 * For anonymous / signed-out users the regular anon client
 * (`@/integrations/supabase/client`) should be used instead.
 */
export function useClerkSupabase(): SupabaseClient<Database> {
  const { session } = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const client = useMemo(() => {
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      accessToken: async () => {
        return (await sessionRef.current?.getToken()) ?? null;
      },
    });
  }, []);

  return client;
}
