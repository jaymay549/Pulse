-- ============================================================
-- RPC: admin_ensure_vendor_profile
-- Finds or creates a vendor_profiles row for admin management.
-- Seeds new profiles with data from vendor_metadata.
-- Uses SECURITY DEFINER to bypass RLS (same pattern as other admin RPCs).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_ensure_vendor_profile(p_vendor_name TEXT)
RETURNS TABLE (
  id UUID,
  vendor_name TEXT,
  is_approved BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_vendor_name TEXT;
  v_is_approved BOOLEAN;
  v_meta RECORD;
BEGIN
  IF COALESCE(auth.jwt() ->> 'user_role', '') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  -- Try to find existing profile
  SELECT vp.id, vp.vendor_name, vp.is_approved
    INTO v_id, v_vendor_name, v_is_approved
    FROM vendor_profiles vp
   WHERE vp.vendor_name = p_vendor_name
   LIMIT 1;

  -- Create if not found, seeding from vendor_metadata
  IF NOT FOUND THEN
    SELECT vm.website_url, vm.company_logo_url, vm.description,
           vm.linkedin_url, vm.banner_url, vm.tagline, vm.headquarters
      INTO v_meta
      FROM vendor_metadata vm
     WHERE vm.vendor_name = p_vendor_name;

    INSERT INTO vendor_profiles (
      vendor_name, is_approved, approved_at,
      company_website, company_logo_url, company_description,
      linkedin_url, banner_url, tagline, headquarters
    )
    VALUES (
      p_vendor_name, true, now(),
      v_meta.website_url, v_meta.company_logo_url, v_meta.description,
      v_meta.linkedin_url, v_meta.banner_url, v_meta.tagline, v_meta.headquarters
    )
    RETURNING vendor_profiles.id, vendor_profiles.vendor_name, vendor_profiles.is_approved
    INTO v_id, v_vendor_name, v_is_approved;
  END IF;

  RETURN QUERY SELECT v_id, v_vendor_name, v_is_approved;
END;
$$;
