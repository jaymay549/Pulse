-- Fuzzy vendor tier lookup: matches vendor_name case-insensitively and by prefix.
-- Handles mismatches between vendor_profiles.vendor_name and vendor_logins.vendor_name.
-- SECURITY DEFINER bypasses RLS on vendor_logins.
CREATE OR REPLACE FUNCTION public.get_vendor_tier(p_vendor_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tier FROM public.vendor_logins
  WHERE lower(vendor_name) = lower(p_vendor_name)
     OR lower(p_vendor_name) LIKE lower(vendor_name) || '%'
     OR lower(vendor_name) LIKE lower(p_vendor_name) || '%'
  ORDER BY
    CASE WHEN lower(vendor_name) = lower(p_vendor_name) THEN 0 ELSE 1 END
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_tier(text) TO anon, authenticated;
