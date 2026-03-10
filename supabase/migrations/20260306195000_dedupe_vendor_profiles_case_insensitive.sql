-- ============================================================
-- Deduplicate vendor_profiles by case-insensitive vendor name
-- - Chooses one canonical row per lower(vendor_name)
-- - Remaps child FK references to canonical row
-- - Merges vendor_custom_content safely
-- - Removes duplicate rows
-- - Enforces case-insensitive uniqueness going forward
-- ============================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  CREATE TEMP TABLE _vendor_profile_merge_map (
    dup_id UUID PRIMARY KEY,
    keep_id UUID NOT NULL,
    key_name TEXT NOT NULL
  ) ON COMMIT DROP;

  -- Build duplicate -> canonical mapping.
  WITH ranked AS (
    SELECT
      vp.id,
      lower(vp.vendor_name) AS key_name,
      vp.vendor_name,
      vp.is_approved,
      vp.created_at,
      (
        CASE WHEN vp.company_website IS NOT NULL AND vp.company_website <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.company_logo_url IS NOT NULL AND vp.company_logo_url <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.company_description IS NOT NULL AND vp.company_description <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.linkedin_url IS NOT NULL AND vp.linkedin_url <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.banner_url IS NOT NULL AND vp.banner_url <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.tagline IS NOT NULL AND vp.tagline <> '' THEN 1 ELSE 0 END +
        CASE WHEN vp.headquarters IS NOT NULL AND vp.headquarters <> '' THEN 1 ELSE 0 END
      ) AS richness,
      row_number() OVER (
        PARTITION BY lower(vp.vendor_name)
        ORDER BY
          vp.is_approved DESC,
          (
            CASE WHEN vp.company_website IS NOT NULL AND vp.company_website <> '' THEN 1 ELSE 0 END +
            CASE WHEN vp.company_logo_url IS NOT NULL AND vp.company_logo_url <> '' THEN 1 ELSE 0 END +
            CASE WHEN vp.company_description IS NOT NULL AND vp.company_description <> '' THEN 1 ELSE 0 END +
            CASE WHEN vp.linkedin_url IS NOT NULL AND vp.linkedin_url <> '' THEN 1 ELSE 0 END +
            CASE WHEN vp.banner_url IS NOT NULL AND vp.banner_url <> '' THEN 1 ELSE 0 END +
            CASE WHEN vp.tagline IS NOT NULL AND vp.tagline <> '' THEN 1 ELSE 0 END +
            CASE WHEN vp.headquarters IS NOT NULL AND vp.headquarters <> '' THEN 1 ELSE 0 END
          ) DESC,
          vp.created_at ASC,
          vp.id ASC
      ) AS rn
    FROM public.vendor_profiles vp
  ),
  keepers AS (
    SELECT key_name, id AS keep_id
    FROM ranked
    WHERE rn = 1
  ),
  dups AS (
    SELECT r.id AS dup_id, k.keep_id, r.key_name
    FROM ranked r
    JOIN keepers k ON k.key_name = r.key_name
    WHERE r.rn > 1
  )
  INSERT INTO _vendor_profile_merge_map (dup_id, keep_id, key_name)
  SELECT dup_id, keep_id, key_name
  FROM dups;

  -- Nothing to do.
  IF NOT EXISTS (SELECT 1 FROM _vendor_profile_merge_map) THEN
    RETURN;
  END IF;

  -- Merge vendor_custom_content rows where both keep + dup exist.
  UPDATE public.vendor_custom_content keep
  SET
    highlights = COALESCE(keep.highlights, dup.highlights),
    customer_segments = COALESCE(keep.customer_segments, dup.customer_segments),
    integration_partners = COALESCE(keep.integration_partners, dup.integration_partners),
    custom_description = COALESCE(keep.custom_description, dup.custom_description),
    updated_at = GREATEST(keep.updated_at, dup.updated_at)
  FROM _vendor_profile_merge_map m
  JOIN public.vendor_custom_content dup
    ON dup.vendor_profile_id = m.dup_id
  WHERE keep.vendor_profile_id = m.keep_id;

  -- Reassign vendor_custom_content where keep row doesn't already exist.
  UPDATE public.vendor_custom_content c
  SET
    vendor_profile_id = m.keep_id,
    vendor_name = kp.vendor_name
  FROM _vendor_profile_merge_map m
  JOIN public.vendor_profiles kp
    ON kp.id = m.keep_id
  LEFT JOIN public.vendor_custom_content keep
    ON keep.vendor_profile_id = m.keep_id
  WHERE c.vendor_profile_id = m.dup_id
    AND keep.vendor_profile_id IS NULL;

  -- Remove any remaining dup-content rows (already merged).
  DELETE FROM public.vendor_custom_content c
  USING _vendor_profile_merge_map m
  WHERE c.vendor_profile_id = m.dup_id;

  -- Remap all FK references to vendor_profiles dynamically.
  FOR rec IN
    SELECT
      nsp.nspname AS table_schema,
      cls.relname AS table_name,
      att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cls
      ON cls.oid = con.conrelid
    JOIN pg_namespace nsp
      ON nsp.oid = cls.relnamespace
    JOIN unnest(con.conkey) AS conkey(attnum)
      ON TRUE
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = conkey.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.vendor_profiles'::regclass
      AND NOT (nsp.nspname = 'public' AND cls.relname = 'vendor_custom_content')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I t
       SET %I = m.keep_id
       FROM _vendor_profile_merge_map m
       WHERE t.%I = m.dup_id',
      rec.table_schema, rec.table_name, rec.column_name, rec.column_name
    );
  END LOOP;

  -- If vendor_profiles has user_id, keep ownership if canonical is empty.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_profiles'
      AND column_name = 'user_id'
  ) THEN
    UPDATE public.vendor_profiles keep
    SET user_id = COALESCE(keep.user_id, dup.user_id)
    FROM _vendor_profile_merge_map m
    JOIN public.vendor_profiles dup
      ON dup.id = m.dup_id
    WHERE keep.id = m.keep_id;
  END IF;

  -- Merge richer profile fields into canonical row.
  UPDATE public.vendor_profiles keep
  SET
    company_website = COALESCE(keep.company_website, dup.company_website),
    company_logo_url = COALESCE(keep.company_logo_url, dup.company_logo_url),
    company_description = COALESCE(keep.company_description, dup.company_description),
    linkedin_url = COALESCE(keep.linkedin_url, dup.linkedin_url),
    banner_url = COALESCE(keep.banner_url, dup.banner_url),
    tagline = COALESCE(keep.tagline, dup.tagline),
    headquarters = COALESCE(keep.headquarters, dup.headquarters),
    is_approved = (keep.is_approved OR dup.is_approved)
  FROM _vendor_profile_merge_map m
  JOIN public.vendor_profiles dup
    ON dup.id = m.dup_id
  WHERE keep.id = m.keep_id;

  -- Remove duplicate rows.
  DELETE FROM public.vendor_profiles vp
  USING _vendor_profile_merge_map m
  WHERE vp.id = m.dup_id;
END $$;

-- Enforce case-insensitive uniqueness to prevent future duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_profiles_vendor_name_ci
  ON public.vendor_profiles (lower(vendor_name));
