-- Fix "column reference vendor_name is ambiguous" in public_submit_vendor_claim_link.
-- The RETURNS TABLE has a vendor_name output column which conflicts with ON CONFLICT (vendor_name).
-- Fix: use ON CONFLICT ON CONSTRAINT <name> to avoid the ambiguity.

DROP FUNCTION IF EXISTS public.public_submit_vendor_claim_link(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.public_submit_vendor_claim_link(
  p_token TEXT,
  p_company_website TEXT DEFAULT NULL,
  p_company_description TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_company_logo_url TEXT DEFAULT NULL,
  p_tagline TEXT DEFAULT NULL,
  p_linkedin_url TEXT DEFAULT NULL,
  p_headquarters TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL
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
    headquarters,
    category,
    contact_phone
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
    NULLIF(TRIM(p_headquarters), ''),
    NULLIF(TRIM(p_category), ''),
    NULLIF(TRIM(p_contact_phone), '')
  )
  ON CONFLICT ON CONSTRAINT vendor_profiles_vendor_name_key
  DO UPDATE SET
    company_website = EXCLUDED.company_website,
    company_description = EXCLUDED.company_description,
    contact_email = EXCLUDED.contact_email,
    company_logo_url = EXCLUDED.company_logo_url,
    tagline = EXCLUDED.tagline,
    linkedin_url = EXCLUDED.linkedin_url,
    headquarters = EXCLUDED.headquarters,
    category = EXCLUDED.category,
    contact_phone = EXCLUDED.contact_phone;

  -- vendor_metadata uses logo_url (not company_logo_url)
  INSERT INTO public.vendor_metadata (
    vendor_name,
    website_url,
    description,
    logo_url,
    tagline,
    linkedin_url,
    headquarters,
    category,
    contact_phone
  )
  VALUES (
    v_link.vendor_name,
    NULLIF(TRIM(p_company_website), ''),
    NULLIF(TRIM(p_company_description), ''),
    NULLIF(TRIM(p_company_logo_url), ''),
    NULLIF(TRIM(p_tagline), ''),
    NULLIF(TRIM(p_linkedin_url), ''),
    NULLIF(TRIM(p_headquarters), ''),
    NULLIF(TRIM(p_category), ''),
    NULLIF(TRIM(p_contact_phone), '')
  )
  ON CONFLICT ON CONSTRAINT vendor_metadata_vendor_name_key
  DO UPDATE SET
    website_url = EXCLUDED.website_url,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    tagline = EXCLUDED.tagline,
    linkedin_url = EXCLUDED.linkedin_url,
    headquarters = EXCLUDED.headquarters,
    category = EXCLUDED.category,
    contact_phone = EXCLUDED.contact_phone;

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
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;
