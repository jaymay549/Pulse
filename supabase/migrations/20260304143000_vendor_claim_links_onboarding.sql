-- Reusable claim links + public onboarding submission flow

CREATE TABLE IF NOT EXISTS public.vendor_claim_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  claim_token TEXT NOT NULL UNIQUE DEFAULT lower(replace(gen_random_uuid()::text, '-', '')),
  admin_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'started', 'submitted', 'activated', 'archived')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_claim_links_vendor_name
  ON public.vendor_claim_links (vendor_name);

CREATE INDEX IF NOT EXISTS idx_vendor_claim_links_status
  ON public.vendor_claim_links (status);

ALTER TABLE public.vendor_claim_links ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_vendor_claim_links_updated_at ON public.vendor_claim_links;
CREATE TRIGGER update_vendor_claim_links_updated_at
BEFORE UPDATE ON public.vendor_claim_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Admin list helper for claim-link tracking and activation workflow.
CREATE OR REPLACE FUNCTION public.admin_list_vendor_claim_links()
RETURNS TABLE (
  id UUID,
  vendor_name TEXT,
  claim_token TEXT,
  admin_email TEXT,
  status TEXT,
  is_active BOOLEAN,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  company_website TEXT,
  company_description TEXT,
  contact_email TEXT,
  company_logo_url TEXT,
  is_approved BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.vendor_name,
    l.claim_token,
    l.admin_email,
    l.status,
    l.is_active,
    l.first_viewed_at,
    l.last_viewed_at,
    l.submitted_at,
    l.activated_at,
    l.last_notified_at,
    l.created_at,
    vp.company_website,
    vp.company_description,
    vp.contact_email,
    vp.company_logo_url,
    COALESCE(vp.is_approved, false) AS is_approved
  FROM public.vendor_claim_links l
  LEFT JOIN public.vendor_profiles vp
    ON LOWER(vp.vendor_name) = LOWER(l.vendor_name)
  ORDER BY l.created_at DESC;
$$;

-- Create a reusable claim link from admin panel.
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
BEGIN
  v_name := NULLIF(TRIM(p_vendor_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'vendor name is required';
  END IF;

  IF NULLIF(TRIM(p_admin_email), '') IS NULL THEN
    RAISE EXCEPTION 'admin email is required';
  END IF;

  INSERT INTO public.vendor_profiles (vendor_name, is_approved)
  VALUES (v_name, false)
  ON CONFLICT (vendor_name) DO NOTHING;

  RETURN QUERY
  INSERT INTO public.vendor_claim_links (vendor_name, admin_email, created_by)
  VALUES (v_name, TRIM(p_admin_email), auth.uid())
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

CREATE OR REPLACE FUNCTION public.admin_set_vendor_claim_link_active(
  p_link_id UUID,
  p_is_active BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vendor_claim_links
  SET
    is_active = COALESCE(p_is_active, true),
    status = CASE
      WHEN COALESCE(p_is_active, true) = false THEN 'archived'
      WHEN status = 'archived' THEN 'created'
      ELSE status
    END
  WHERE id = p_link_id;
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
BEGIN
  SELECT * INTO v_link
  FROM public.vendor_claim_links
  WHERE id = p_link_id;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'claim link not found';
  END IF;

  INSERT INTO public.vendor_profiles (vendor_name, is_approved, approved_at, approved_by)
  VALUES (v_link.vendor_name, true, now(), auth.uid())
  ON CONFLICT (vendor_name)
  DO UPDATE SET
    is_approved = true,
    approved_at = now(),
    approved_by = auth.uid();

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

-- Public resolver for reusable claim-link landing + prefilled profile data.
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
  UPDATE public.vendor_claim_links
  SET
    first_viewed_at = COALESCE(first_viewed_at, now()),
    last_viewed_at = now(),
    status = CASE WHEN status = 'created' THEN 'started' ELSE status END
  WHERE claim_token = p_token
    AND is_active = true;

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
  FROM public.vendor_claim_links l
  LEFT JOIN public.vendor_profiles vp
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
  SELECT * INTO v_link
  FROM public.vendor_claim_links
  WHERE claim_token = p_token
    AND is_active = true;

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
  ON CONFLICT (vendor_name)
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

GRANT EXECUTE ON FUNCTION public.admin_list_vendor_claim_links() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_vendor_claim_link(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_vendor_claim_link_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_vendor_claim_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_vendor_claim_link(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_submit_vendor_claim_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;
