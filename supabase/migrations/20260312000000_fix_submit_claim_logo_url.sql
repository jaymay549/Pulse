-- Fix public_submit_vendor_claim_link: vendor_metadata uses logo_url, not company_logo_url.

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
  SELECT * INTO v_link
  FROM public.vendor_claim_links
  WHERE claim_token = p_token
    AND is_active = true;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'invalid or inactive claim link';
  END IF;

  -- vendor_profiles has company_logo_url
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
  ON CONFLICT (vendor_name)
  DO UPDATE SET
    company_website = EXCLUDED.company_website,
    company_description = EXCLUDED.company_description,
    contact_email = EXCLUDED.contact_email,
    company_logo_url = EXCLUDED.company_logo_url,
    tagline = EXCLUDED.tagline,
    linkedin_url = EXCLUDED.linkedin_url,
    headquarters = EXCLUDED.headquarters;

  -- vendor_metadata uses logo_url (not company_logo_url)
  INSERT INTO public.vendor_metadata (
    vendor_name,
    website_url,
    description,
    logo_url,
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
    logo_url = EXCLUDED.logo_url,
    tagline = EXCLUDED.tagline,
    linkedin_url = EXCLUDED.linkedin_url,
    headquarters = EXCLUDED.headquarters;

  UPDATE public.vendor_claim_links
  SET
    status = 'submitted',
    submitted_at = now(),
    last_viewed_at = now()
  WHERE id = v_link.id;

  RETURN QUERY
  SELECT v_link.id, v_link.vendor_name, v_link.admin_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_submit_vendor_claim_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;
