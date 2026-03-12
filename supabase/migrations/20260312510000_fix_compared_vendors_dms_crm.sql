-- Fix get_compared_vendors:
--
-- 1. Inclusive DMS/CRM category matching.
--    CDK has category = 'dms-crm' but after the split migration most
--    DMS/CRM competitors were reclassified to 'dms' or 'crm'.
--    The old exact-match filter (`meta.category = v_category`) therefore
--    found almost no competitors for CDK.
--    New rule: any of dms / crm / dms-crm is considered the same competitive
--    pool, matching the logic already used in get_vendor_pulse_feed_v2.
--
-- 2. Pre-materialise co-occurrence counts via a CTE.
--    The old implementation used a correlated subquery per competitor
--    (O(N × M) scans of vendor_mentions).  The new version pre-computes
--    member sets once per side and joins them.

CREATE OR REPLACE FUNCTION public.get_compared_vendors(
  p_vendor_name TEXT,
  p_limit       INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id  UUID;
  v_canonical  TEXT;
  v_category   TEXT;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical
    FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical := COALESCE(v_canonical, p_vendor_name);

  SELECT category INTO v_category
  FROM public.vendor_metadata
  WHERE lower(vendor_name) = lower(v_canonical)
  LIMIT 1;

  RETURN jsonb_build_object(
    'vendors', COALESCE((
      WITH
      -- Members who mentioned the input vendor (used for co-occurrence)
      own_members AS (
        SELECT DISTINCT member_id
        FROM public.vendor_mentions
        WHERE is_hidden = false
          AND member_id IS NOT NULL
          AND (
            (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
            (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
          )
      ),
      -- Candidate competitor mentions (exclude the input vendor itself)
      candidates AS (
        SELECT
          vm.member_id,
          vm.type,
          COALESCE(ve2.canonical_name, vm.vendor_name) AS vname,
          ve2.id AS ve2_id
        FROM public.vendor_mentions vm
        LEFT JOIN public.vendor_entities ve2 ON ve2.id = vm.vendor_entity_id
        WHERE vm.is_hidden = false
          AND COALESCE(ve2.canonical_name, vm.vendor_name) <> v_canonical
          -- Inclusive DMS/CRM category filter:
          -- if either side is dms/crm/dms-crm, treat them all as one pool.
          AND (
            v_category IS NULL
            OR EXISTS (
              SELECT 1 FROM public.vendor_metadata meta
              WHERE lower(meta.vendor_name) = lower(COALESCE(ve2.canonical_name, vm.vendor_name))
                AND (
                  meta.category = v_category
                  OR (
                    v_category IN ('dms', 'crm', 'dms-crm')
                    AND meta.category IN ('dms', 'crm', 'dms-crm')
                  )
                )
            )
          )
      ),
      -- Aggregate per competitor
      aggregated AS (
        SELECT
          vname,
          ve2_id,
          COUNT(*)::INTEGER                                    AS mc,
          ROUND(
            COUNT(*) FILTER (WHERE type = 'positive')::NUMERIC
            / NULLIF(COUNT(*), 0) * 100
          )::INTEGER                                           AS pp,
          COUNT(DISTINCT member_id) FILTER (
            WHERE member_id IS NOT NULL
              AND member_id IN (SELECT member_id FROM own_members)
          )::INTEGER                                           AS cooc
        FROM candidates
        GROUP BY vname, ve2_id
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT p_limit
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'vendor_name',         vname,
          'mention_count',       mc,
          'positive_percent',    pp,
          'co_occurrence_count', cooc
        ) ORDER BY COALESCE(cooc, 0) DESC, mc DESC
      )
      FROM aggregated
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compared_vendors(TEXT, INTEGER) TO authenticated, anon, service_role;
