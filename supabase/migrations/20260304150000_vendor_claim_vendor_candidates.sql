-- Admin helper: suggest unclaimed vendors for claim link creation.
-- Unclaimed = no vendor_profiles row with a non-null user_id.

CREATE OR REPLACE FUNCTION public.admin_list_unclaimed_vendor_candidates(
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  vendor_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      vm.vendor_name
    FROM public.vendor_metadata vm
    WHERE vm.vendor_name IS NOT NULL
      AND NULLIF(TRIM(vm.vendor_name), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.vendor_profiles vp_claimed
        WHERE LOWER(vp_claimed.vendor_name) = LOWER(vm.vendor_name)
          AND vp_claimed.user_id IS NOT NULL
      )

    UNION

    SELECT
      vp.vendor_name
    FROM public.vendor_profiles vp
    WHERE vp.vendor_name IS NOT NULL
      AND NULLIF(TRIM(vp.vendor_name), '') IS NOT NULL
      AND vp.user_id IS NULL
  )
  SELECT DISTINCT n.vendor_name
  FROM normalized n
  WHERE
    p_query IS NULL
    OR NULLIF(TRIM(p_query), '') IS NULL
    OR n.vendor_name ILIKE ('%' || TRIM(p_query) || '%')
  ORDER BY n.vendor_name
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_unclaimed_vendor_candidates(TEXT, INTEGER) TO authenticated;
