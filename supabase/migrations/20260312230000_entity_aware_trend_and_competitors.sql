-- ============================================================
-- Entity-aware get_vendor_trend and get_compared_vendors
--
-- Both functions previously existed only in the database (not in
-- migrations) and used name-only filtering.  These replacements
-- resolve vendor_entity_id first so CDK-family mentions
-- (Elead, Roadster, etc.) are included in every calculation.
-- ============================================================

-- ── get_vendor_trend ─────────────────────────────────────────
-- Compares the most-recent 30-day window against the prior
-- 30-day window to produce direction + volume-change %.

CREATE OR REPLACE FUNCTION public.get_vendor_trend(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id       UUID;
  v_cur_total       INTEGER := 0;
  v_cur_positive    INTEGER := 0;
  v_prev_total      INTEGER := 0;
  v_prev_positive   INTEGER := 0;
  v_cur_pct         NUMERIC := 0;
  v_prev_pct        NUMERIC := 0;
  v_direction       TEXT;
  v_volume_change   NUMERIC := 0;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  -- Current 30-day window
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE type = 'positive')::INTEGER
  INTO v_cur_total, v_cur_positive
  FROM public.vendor_mentions
  WHERE (
    (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  )
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '30 days';

  -- Prior 30-day window (30–60 days ago)
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE type = 'positive')::INTEGER
  INTO v_prev_total, v_prev_positive
  FROM public.vendor_mentions
  WHERE (
    (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  )
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '60 days'
    AND created_at <  now() - INTERVAL '30 days';

  v_cur_pct  := CASE WHEN v_cur_total  = 0 THEN 0 ELSE ROUND(v_cur_positive::NUMERIC  / v_cur_total  * 100) END;
  v_prev_pct := CASE WHEN v_prev_total = 0 THEN 0 ELSE ROUND(v_prev_positive::NUMERIC / v_prev_total * 100) END;

  -- Direction: >5 pt swing = trend; otherwise stable
  IF    v_cur_pct > v_prev_pct + 5 THEN v_direction := 'up';
  ELSIF v_cur_pct < v_prev_pct - 5 THEN v_direction := 'down';
  ELSE  v_direction := 'stable';
  END IF;

  -- Volume change %
  v_volume_change := CASE
    WHEN v_prev_total = 0 THEN 0
    ELSE ABS(ROUND(((v_cur_total - v_prev_total)::NUMERIC / v_prev_total) * 100))
  END;

  RETURN jsonb_build_object(
    'currentPositivePct',      v_cur_pct,
    'previousPositivePct',     v_prev_pct,
    'direction',               v_direction,
    'mentionVolumeChangePct',  v_volume_change
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_trend(TEXT) TO authenticated, anon, service_role;


-- ── get_compared_vendors ─────────────────────────────────────
-- Returns the top N vendors in the same category, ranked by
-- mention count.  co_occurrence_count is the number of distinct
-- members who mentioned BOTH this vendor and the compared vendor
-- (a genuine signal of "dealers who compared the two").

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
  v_entity_id     UUID;
  v_canonical     TEXT;
  v_category      TEXT;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical := COALESCE(v_canonical, p_vendor_name);

  -- Category of the requested vendor
  SELECT category INTO v_category
  FROM public.vendor_metadata
  WHERE lower(vendor_name) = lower(v_canonical)
  LIMIT 1;

  RETURN jsonb_build_object(
    'vendors', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'vendor_name',        vname,
          'mention_count',      mc,
          'positive_percent',   pp,
          'co_occurrence_count', cooc
        ) ORDER BY COALESCE(cooc, 0) DESC, mc DESC
      )
      FROM (
        SELECT
          COALESCE(ve2.canonical_name, vm.vendor_name) AS vname,
          COUNT(*)::INTEGER AS mc,
          ROUND(
            COUNT(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
            / NULLIF(COUNT(*), 0) * 100
          )::INTEGER AS pp,
          -- Members who also mentioned the input vendor
          (
            SELECT COUNT(DISTINCT m_inner.member_id)::INTEGER
            FROM public.vendor_mentions m_inner
            WHERE m_inner.member_id IS NOT NULL
              AND m_inner.is_hidden = false
              AND (
                (v_entity_id IS NOT NULL AND m_inner.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(m_inner.vendor_name) = lower(p_vendor_name))
              )
              AND m_inner.member_id IN (
                SELECT DISTINCT vm2.member_id
                FROM public.vendor_mentions vm2
                WHERE vm2.is_hidden = false
                  AND vm2.member_id IS NOT NULL
                  AND (
                    (ve2.id IS NOT NULL AND vm2.vendor_entity_id = ve2.id) OR
                    (ve2.id IS NULL AND lower(vm2.vendor_name) = lower(COALESCE(ve2.canonical_name, vm.vendor_name)))
                  )
              )
          ) AS cooc
        FROM public.vendor_mentions vm
        LEFT JOIN public.vendor_entities ve2 ON ve2.id = vm.vendor_entity_id
        WHERE vm.is_hidden = false
          -- Exclude the input vendor itself
          AND COALESCE(ve2.canonical_name, vm.vendor_name) <> v_canonical
          -- Same category filter (skip if no category known)
          AND (
            v_category IS NULL
            OR EXISTS (
              SELECT 1 FROM public.vendor_metadata meta
              WHERE lower(meta.vendor_name) = lower(COALESCE(ve2.canonical_name, vm.vendor_name))
                AND meta.category = v_category
            )
          )
        GROUP BY COALESCE(ve2.canonical_name, vm.vendor_name), ve2.id
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT p_limit
      ) sub
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compared_vendors(TEXT, INTEGER) TO authenticated, anon, service_role;
