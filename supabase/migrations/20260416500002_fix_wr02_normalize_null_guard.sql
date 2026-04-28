-- ============================================================
-- Fix WR-02: NULL guard in _normalize_vendor_name helper
--
-- The original _normalize_vendor_name used coalesce(p_name, '') before
-- initcap(), which converts NULL inputs to empty string ''. This caused
-- UPDATE statements to replace legitimately NULL vendor_name values with
-- '' (empty string), which is a different and worse state — it passes
-- IS DISTINCT FROM NULL checks and updates rows unnecessarily.
--
-- This replacement short-circuits on NULL input and returns NULL,
-- preserving the original NULL state for rows that have no vendor name.
-- ============================================================

CREATE OR REPLACE FUNCTION public._normalize_vendor_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN NULL
    ELSE initcap(trim(regexp_replace(p_name, '\s+', ' ', 'g')))
  END;
$$;

-- Restore correct grant (revoke anon as per WR-02 fix scope — see also WR-03 migration)
REVOKE EXECUTE ON FUNCTION public._normalize_vendor_name(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public._normalize_vendor_name(TEXT) TO authenticated, service_role;

-- Repair any vendor_name columns that were set to '' by the original NULL→''
-- conversion. These are rows where vendor_name is an empty string AND the
-- original data was presumably NULL (we conservatively restore them to NULL
-- since '' is never a valid vendor name).
UPDATE public.vendor_mentions
SET vendor_name = NULL
WHERE vendor_name = '';

UPDATE public.vendor_metadata
SET vendor_name = NULL
WHERE vendor_name = '';

UPDATE public.vendor_profiles
SET vendor_name = NULL
WHERE vendor_name = '';
