-- Fix ambiguous references in public claim RPCs caused by RETURNS TABLE output vars.

CREATE OR REPLACE FUNCTION public.public_get_vendor_claim_link(
  p_token TEXT
)
RETURNS TABLE (
  link_id UUID,
  vendor_name TEXT,
  admin_email TEXT,
  status TEXT,
  is_active BOOLEAN,
  claim_token TEXT,
  company_website TEXT,
  company_description TEXT,
  contact_email TEXT,
  company_logo_url TEXT,
  tagline TEXT,
  linkedin_url TEXT,
  headquarters TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vendor_claim_links AS l
  SET
    first_viewed_at = COALESCE(l.first_viewed_at, now()),
    last_viewed_at = now(),
    status = CASE WHEN l.status = 'created' THEN 'started' ELSE l.status END
  WHERE l.claim_token = p_token
    AND l.is_active = true;

  RETURN QUERY
  SELECT
    l.id AS link_id,
    l.vendor_name,
    l.admin_email,
    l.status,
    l.is_active,
    l.claim_token,
    vp.company_website,
    vp.company_description,
    vp.contact_email,
    vp.company_logo_url,
    vp.tagline,
    vp.linkedin_url,
    vp.headquarters
  FROM public.vendor_claim_links AS l
  LEFT JOIN public.vendor_profiles AS vp
    ON LOWER(vp.vendor_name) = LOWER(l.vendor_name)
  WHERE l.claim_token = p_token
    AND l.is_active = true
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_submit_vendor_claim_link(
  p_token TEXT,
  p_company_website TEXT DEFAULT NULL,
  p_company_description TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_company_logo_url TEXT DEFAULT NULL,
  p_tagline TEXT DEFAULT NULL,
  p_linkedin_url TEXT DEFAULT NULL,
  p_headquarters TEXT DEFAULT NULL
)
RETURNS TABLE (
  link_id UUID,
  vendor_name TEXT,
  admin_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.vendor_claim_links%ROWTYPE;
BEGIN
  SELECT l.* INTO v_link
  FROM public.vendor_claim_links AS l
  WHERE l.claim_token = p_token
    AND l.is_active = true;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'invalid or inactive claim link';
  END IF;

  INSERT INTO public.vendor_profiles (
    vendor_name,
    is_approved,
    company_website,
    company_description,
    contact_email,
    company_logo_url,
    tagline,
    linkedin_url,
    headquarters
  )
  VALUES (
    v_link.vendor_name,
    false,
    NULLIF(TRIM(p_company_website), ''),
    NULLIF(TRIM(p_company_description), ''),
    NULLIF(TRIM(p_contact_email), ''),
    NULLIF(TRIM(p_company_logo_url), ''),
    NULLIF(TRIM(p_tagline), ''),
    NULLIF(TRIM(p_linkedin_url), ''),
    NULLIF(TRIM(p_headquarters), '')
  )
  ON CONFLICT ON CONSTRAINT vendor_profiles_vendor_name_key
  DO UPDATE SET
    company_website = EXCLUDED.company_website,
    company_description = EXCLUDED.company_description,
    contact_email = EXCLUDED.contact_email,
    company_logo_url = EXCLUDED.company_logo_url,
    tagline = EXCLUDED.tagline,
    linkedin_url = EXCLUDED.linkedin_url,
    headquarters = EXCLUDED.headquarters;

  INSERT INTO public.vendor_metadata (
    vendor_name,
    website_url,
    description,
    company_logo_url,
    tagline,
    linkedin_url,
    headquarters
  )
  VALUES (
    v_link.vendor_name,
    NULLIF(TRIM(p_company_website), ''),
    NULLIF(TRIM(p_company_description), ''),
    NULLIF(TRIM(p_company_logo_url), ''),
    NULLIF(TRIM(p_tagline), ''),
    NULLIF(TRIM(p_linkedin_url), ''),
    NULLIF(TRIM(p_headquarters), '')
  )
  ON CONFLICT (vendor_name)
  DO UPDATE SET
    website_url = EXCLUDED.website_url,
    description = EXCLUDED.description,
    company_logo_url = EXCLUDED.company_logo_url,
    tagline = EXCLUDED.tagline,
    linkedin_url = EXCLUDED.linkedin_url,
    headquarters = EXCLUDED.headquarters;

  UPDATE public.vendor_claim_links AS l
  SET
    status = 'submitted',
    submitted_at = now(),
    last_viewed_at = now()
  WHERE l.id = v_link.id;

  RETURN QUERY
  SELECT v_link.id, v_link.vendor_name, v_link.admin_email;
END;
$$;
