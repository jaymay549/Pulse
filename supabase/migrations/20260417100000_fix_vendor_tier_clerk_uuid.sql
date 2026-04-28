-- Fix: vendor_tier() and auth_vendor_name() crash with Clerk JWTs
--
-- Root cause: Clerk JWT sub claims are strings like "user_3C4Ib6KC8..."
-- not valid UUIDs. When auth.uid() tries to parse this, PostgreSQL throws
-- "invalid input syntax for type uuid". This breaks every RPC that calls
-- vendor_tier() or auth_vendor_name() (get_vendor_dashboard_intel,
-- get_vendor_dimensions, etc.) for Clerk/admin sessions.
--
-- Fix: Convert from plain SQL to PL/pgSQL with EXCEPTION handler that
-- catches invalid_text_representation and returns NULL (correct behavior
-- for non-vendor sessions).

CREATE OR REPLACE FUNCTION public.vendor_tier()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT tier
    FROM public.vendor_logins
    WHERE user_id = auth.uid()
    LIMIT 1
  );
EXCEPTION WHEN invalid_text_representation THEN
  -- Clerk JWTs have non-UUID sub claims (e.g. "user_3C4...")
  -- Return NULL so callers treat this as a non-vendor session
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_tier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_tier() TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_vendor_name()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT vendor_name
    FROM public.vendor_logins
    WHERE user_id = auth.uid()
    LIMIT 1
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_vendor_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_vendor_name() TO authenticated;
