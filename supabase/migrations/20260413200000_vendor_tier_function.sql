-- ============================================================
-- Vendor tier helper functions for RLS policies.
--
-- These SECURITY DEFINER functions provide safe tier and vendor_name
-- lookups for use in RLS policies and SECURITY DEFINER RPCs without
-- creating circular dependencies on vendor_logins (which has its own
-- RLS policy using auth.uid() directly).
--
-- Both functions return NULL for Clerk JWT sessions and anon sessions,
-- because vendor_logins.user_id is only populated for Supabase Auth
-- (native magic-link) vendor sessions. Clerk sessions have auth.uid()
-- = NULL in Supabase (the JWT carries a different sub).
-- ============================================================

-- ── 1. vendor_tier(): returns the authenticated vendor's tier ─

CREATE OR REPLACE FUNCTION public.vendor_tier()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tier
  FROM public.vendor_logins
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Restrict to authenticated users only — anon cannot call this.
-- Returns NULL for Clerk sessions (no vendor_logins row for Clerk UIDs).
REVOKE ALL ON FUNCTION public.vendor_tier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_tier() TO authenticated;

COMMENT ON FUNCTION public.vendor_tier() IS
  'Returns the tier (unverified/tier_1/tier_2) for the current vendor session, '
  'or NULL for Clerk/anon sessions. Used in RLS policies and SECURITY DEFINER RPCs. '
  'SECURITY DEFINER to avoid circular dependency on vendor_logins RLS.';

-- ── 2. auth_vendor_name(): returns the authenticated vendor's name ─

CREATE OR REPLACE FUNCTION public.auth_vendor_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendor_name
  FROM public.vendor_logins
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Restrict to authenticated users only.
-- Returns NULL for Clerk sessions (no vendor_logins row for Clerk UIDs).
REVOKE ALL ON FUNCTION public.auth_vendor_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_vendor_name() TO authenticated;

COMMENT ON FUNCTION public.auth_vendor_name() IS
  'Returns the vendor_name for the current vendor session, or NULL for Clerk/anon sessions. '
  'Used in RLS policies for vendor isolation (vendor can only see own data). '
  'SECURITY DEFINER to avoid circular dependency on vendor_logins RLS.';
