-- ============================================================
-- Prefer vendor_profiles casing for canonical vendor names
-- Prevents creation of case-variant vendor profile duplicates
-- when mentions arrive with different casing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.canonical_vendor_name_case(p_vendor_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_input TEXT;
  v_canonical TEXT;
  v_entity_id UUID;
BEGIN
  v_input := NULLIF(trim(coalesce(p_vendor_name, '')), '');
  IF v_input IS NULL THEN
    RETURN p_vendor_name;
  END IF;

  -- 1) Prefer approved vendor_profiles casing first.
  -- Pick the richest profile row when multiple case variants exist.
  SELECT x.vendor_name
  INTO v_canonical
  FROM (
    SELECT
      vp.vendor_name,
      (
        CASE WHEN vp.company_website IS NOT NULL AND vp.company_website <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.company_logo_url IS NOT NULL AND vp.company_logo_url <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.company_description IS NOT NULL AND vp.company_description <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.linkedin_url IS NOT NULL AND vp.linkedin_url <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.banner_url IS NOT NULL AND vp.banner_url <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.tagline IS NOT NULL AND vp.tagline <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.headquarters IS NOT NULL AND vp.headquarters <> '' THEN 1 ELSE 0 END
      ) AS richness,
      vp.created_at
    FROM public.vendor_profiles vp
    WHERE lower(vp.vendor_name) = lower(v_input)
      AND vp.is_approved = true
  ) x
  ORDER BY x.richness DESC, x.created_at ASC, x.vendor_name ASC
  LIMIT 1;

  IF v_canonical IS NOT NULL AND v_canonical <> '' THEN
    RETURN v_canonical;
  END IF;

  -- 2) Then prefer canonical vendor family name when mapped.
  BEGIN
    SELECT r.vendor_entity_id
    INTO v_entity_id
    FROM public.resolve_vendor_family(v_input, NULL, NULL, NULL) r
    LIMIT 1;

    IF v_entity_id IS NOT NULL THEN
      SELECT ve.canonical_name INTO v_canonical
      FROM public.vendor_entities ve
      WHERE ve.id = v_entity_id
      LIMIT 1;

      IF v_canonical IS NOT NULL AND v_canonical <> '' THEN
        RETURN v_canonical;
      END IF;
    END IF;
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  -- 3) Otherwise, use the most frequent existing mention casing.
  SELECT x.vendor_name
  INTO v_canonical
  FROM (
    SELECT vendor_name, COUNT(*) AS cnt
    FROM public.vendor_mentions
    WHERE lower(vendor_name) = lower(v_input)
    GROUP BY vendor_name
    ORDER BY cnt DESC, vendor_name ASC
    LIMIT 1
  ) x;

  RETURN COALESCE(v_canonical, v_input);
END;
$$;

-- Backfill existing mention casing with the improved canonical resolver.
UPDATE public.vendor_mentions vm
SET vendor_name = public.canonical_vendor_name_case(vm.vendor_name)
WHERE vm.vendor_name <> public.canonical_vendor_name_case(vm.vendor_name);
