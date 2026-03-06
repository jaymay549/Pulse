-- Resolve ambiguous column/variable references in claim-link RPCs.

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
  v_link_id UUID;
BEGIN
  v_name := NULLIF(TRIM(p_vendor_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'vendor name is required';
  END IF;

  IF NULLIF(TRIM(p_admin_email), '') IS NULL THEN
    RAISE EXCEPTION 'admin email is required';
  END IF;

  v_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  IF v_sub IS NOT NULL AND v_sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_created_by := v_sub::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_created_by) THEN
      v_created_by := NULL;
    END IF;
  END IF;

  INSERT INTO public.vendor_profiles (vendor_name, is_approved)
  VALUES (v_name, false)
  ON CONFLICT ON CONSTRAINT vendor_profiles_vendor_name_key DO NOTHING;

  INSERT INTO public.vendor_claim_links (vendor_name, admin_email, created_by)
  VALUES (v_name, TRIM(p_admin_email), v_created_by)
  RETURNING vendor_claim_links.id INTO v_link_id;

  RETURN QUERY
  SELECT
    l.id,
    l.vendor_name,
    l.claim_token,
    l.admin_email,
    l.status,
    l.is_active,
    l.created_at
  FROM public.vendor_claim_links l
  WHERE l.id = v_link_id;
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
  v_approved_by UUID := NULL;
  v_sub TEXT;
BEGIN
  SELECT * INTO v_link
  FROM public.vendor_claim_links
  WHERE id = p_link_id;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'claim link not found';
  END IF;

  v_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  IF v_sub IS NOT NULL AND v_sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_approved_by := v_sub::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_approved_by) THEN
      v_approved_by := NULL;
    END IF;
  END IF;

  INSERT INTO public.vendor_profiles (vendor_name, is_approved, approved_at, approved_by)
  VALUES (v_link.vendor_name, true, now(), v_approved_by)
  ON CONFLICT ON CONSTRAINT vendor_profiles_vendor_name_key
  DO UPDATE SET
    is_approved = true,
    approved_at = now(),
    approved_by = v_approved_by;

  UPDATE public.vendor_claim_links
  SET
    status = 'activated',
    activated_at = now(),
    is_active = true
  WHERE id = p_link_id;
END;
$$;
