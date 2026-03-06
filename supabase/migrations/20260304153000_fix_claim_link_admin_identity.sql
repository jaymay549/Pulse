-- Fix RPC failures when JWT sub is not a Supabase auth.users UUID
-- (common with Clerk third-party JWTs).

CREATE OR REPLACE FUNCTION public.admin_create_vendor_claim_link(
  p_vendor_name TEXT,
  p_admin_email TEXT
)
RETURNS TABLE (
  id UUID,
  vendor_name TEXT,
  claim_token TEXT,
  admin_email TEXT,
  status TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_created_by UUID := NULL;
  v_sub TEXT;
BEGIN
  v_name := NULLIF(TRIM(p_vendor_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'vendor name is required';
  END IF;

  IF NULLIF(TRIM(p_admin_email), '') IS NULL THEN
    RAISE EXCEPTION 'admin email is required';
  END IF;

  -- Best-effort actor capture:
  -- 1) try JWT sub -> UUID cast
  -- 2) only keep it if row exists in auth.users
  -- 3) otherwise leave NULL (avoid 400 / FK failures)
  v_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  IF v_sub IS NOT NULL AND v_sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_created_by := v_sub::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_created_by) THEN
      v_created_by := NULL;
    END IF;
  END IF;

  INSERT INTO public.vendor_profiles (vendor_name, is_approved)
  VALUES (v_name, false)
  ON CONFLICT (vendor_name) DO NOTHING;

  RETURN QUERY
  INSERT INTO public.vendor_claim_links (vendor_name, admin_email, created_by)
  VALUES (v_name, TRIM(p_admin_email), v_created_by)
  RETURNING
    vendor_claim_links.id,
    vendor_claim_links.vendor_name,
    vendor_claim_links.claim_token,
    vendor_claim_links.admin_email,
    vendor_claim_links.status,
    vendor_claim_links.is_active,
    vendor_claim_links.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_activate_vendor_claim_link(
  p_link_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.vendor_claim_links%ROWTYPE;
  v_profile_id UUID;
  v_approved_by UUID := NULL;
  v_sub TEXT;
BEGIN
  SELECT * INTO v_link
  FROM public.vendor_claim_links
  WHERE id = p_link_id;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'claim link not found';
  END IF;

  -- Same Clerk-safe actor capture strategy as create RPC.
  v_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  IF v_sub IS NOT NULL AND v_sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_approved_by := v_sub::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_approved_by) THEN
      v_approved_by := NULL;
    END IF;
  END IF;

  INSERT INTO public.vendor_profiles (vendor_name, is_approved, approved_at, approved_by)
  VALUES (v_link.vendor_name, true, now(), v_approved_by)
  ON CONFLICT (vendor_name)
  DO UPDATE SET
    is_approved = true,
    approved_at = now(),
    approved_by = v_approved_by;

  SELECT id INTO v_profile_id
  FROM public.vendor_profiles
  WHERE vendor_name = v_link.vendor_name
  LIMIT 1;

  UPDATE public.vendor_claim_links
  SET
    status = 'activated',
    activated_at = now(),
    is_active = true
  WHERE id = p_link_id;
END;
$$;
