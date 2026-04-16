-- Admin RPC: returns vendor_logins joined with auth.users for the admin vendor management table.
-- SECURITY DEFINER is required because auth.users is not accessible via anon/authenticated keys.

CREATE OR REPLACE FUNCTION public.admin_list_vendor_logins()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  vendor_name TEXT,
  tier TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      vl.id,
      vl.user_id,
      vl.vendor_name,
      vl.tier,
      u.email::TEXT,
      vl.created_at,
      u.last_sign_in_at
    FROM public.vendor_logins vl
    JOIN auth.users u ON u.id = vl.user_id
    ORDER BY vl.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_vendor_logins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_vendor_logins() TO authenticated;

COMMENT ON FUNCTION public.admin_list_vendor_logins() IS 'Admin-only RPC: returns vendor_logins joined with auth.users for the admin vendor management table. SECURITY DEFINER required because auth.users is not accessible via anon/authenticated keys.';
