-- Admin RPC to update vendor tier for all logins under a vendor_name
CREATE OR REPLACE FUNCTION public.admin_update_vendor_tier(
  p_vendor_name TEXT,
  p_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tier NOT IN ('unverified', 'tier_1', 'tier_2') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_tier;
  END IF;

  UPDATE public.vendor_logins
  SET tier = p_tier, updated_at = now()
  WHERE vendor_name = p_vendor_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found: %', p_vendor_name;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_vendor_tier(TEXT, TEXT) TO authenticated;
