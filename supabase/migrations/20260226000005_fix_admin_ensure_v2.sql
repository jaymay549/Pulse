-- Fix admin_ensure_vendor_profile v2:
-- Use INSERT...SELECT with LEFT JOIN to avoid uninitialized RECORD crash
-- when vendor_metadata has no row for the vendor.

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

  -- Create if not found, seeding from vendor_metadata via LEFT JOIN
  IF NOT FOUND THEN
    INSERT INTO vendor_profiles (
      vendor_name, is_approved, approved_at,
      company_website, company_logo_url, company_description,
      linkedin_url, banner_url, tagline, headquarters
    )
    SELECT
      p_vendor_name, true, now(),
      vm.website_url, vm.company_logo_url, vm.description,
      vm.linkedin_url, vm.banner_url, vm.tagline, vm.headquarters
    FROM (SELECT 1) AS dummy
    LEFT JOIN vendor_metadata vm ON vm.vendor_name = p_vendor_name
    RETURNING vendor_profiles.id, vendor_profiles.vendor_name, vendor_profiles.is_approved
    INTO v_id, v_vendor_name, v_is_approved;
  END IF;

  RETURN QUERY SELECT v_id, v_vendor_name, v_is_approved;
END;
$$;
