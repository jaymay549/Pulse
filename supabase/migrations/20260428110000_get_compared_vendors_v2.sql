-- CAR-19: get_compared_vendors v2.
-- Backwards-compatible: legacy fields (vendor_name, mention_count,
-- positive_percent, co_occurrence_count) are preserved on every row so
-- existing callers (PulseBriefing.tsx) keep working.
--
-- New per-row fields:
--   health_score, product_stability_score, customer_experience_score,
--   value_perception_score, rank, rank_delta_90d (NULL in v1 — follow-up
--   issue will add the prior-snapshot computation), is_above_median, is_self.
--
-- New envelope field `segment`:
--   { category, origin, widened_to, qualifying_vendor_count,
--     median: { health_score, product_stability, customer_experience, value_perception } }.
--
-- New optional input `p_segment_override`: when non-null, this jsonb array
-- of canonical vendor names defines the explicit competitor set and bypasses
-- the auto-derived category segment.
--
-- rank_delta_90d ships as NULL for every row in v1. No prior-snapshot table
-- exists yet. The UI renders "—" in the delta column. Prior-window
-- computation lands in a follow-up issue.

CREATE OR REPLACE FUNCTION public.get_compared_vendors(
  p_vendor_name       TEXT,
  p_limit             INTEGER DEFAULT 8,
  p_segment_override  JSONB   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id        UUID;
  v_canonical        TEXT;
  v_category         TEXT;
  v_widened_to       TEXT;
  v_qualifying_count INTEGER;
  v_segment_origin   TEXT;
  v_segment_names    TEXT[];
  v_vendors          JSONB;
  v_medians          JSONB;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────────
  -- Entity resolution (mirrors the pattern in 20260312510000 and
  -- 20260416100000 reference migrations).
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical
    FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical := COALESCE(v_canonical, p_vendor_name);

  -- ─────────────────────────────────────────────────────────────────────────
  -- Resolve segment: override > category (with auto-widen on thin segments)
  -- ─────────────────────────────────────────────────────────────────────────
  IF p_segment_override IS NOT NULL THEN
    -- Caller provided an explicit curated list of canonical vendor names.
    v_segment_origin   := 'override';
    v_segment_names    := ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_segment_override));
    v_category         := NULL;
    v_widened_to       := NULL;
    v_qualifying_count := COALESCE(array_length(v_segment_names, 1), 0);

  ELSE
    -- Auto-derive segment from vendor_metadata category (case-insensitive).
    SELECT category INTO v_category
    FROM public.vendor_metadata
    WHERE lower(vendor_name) = lower(v_canonical)
    LIMIT 1;

    v_segment_origin := 'category';

    -- Collect qualifying vendor names for the category using _categories_match
    -- which folds dms / crm / dms-crm into one competitive family.
    SELECT array_agg(DISTINCT vm.vendor_name)
    INTO v_segment_names
    FROM public.vendor_metadata vm
    JOIN public.vendor_metric_scores s
      ON lower(s.vendor_name) = lower(vm.vendor_name)
    WHERE public._categories_match(vm.category, v_category)
      AND s.health_score IS NOT NULL;

    v_qualifying_count := COALESCE(array_length(v_segment_names, 1), 0);

    -- Auto-widen flag: when the category segment is thin (< 3 qualifying
    -- vendors), set widened_to = v_category so the frontend can surface a
    -- "compared against broader category" note. A real category_hierarchy
    -- table is a follow-up; for now the _categories_match helper already
    -- handles the only known widening family (dms/crm/dms-crm).
    IF v_qualifying_count < 3 AND v_category IS NOT NULL THEN
      v_widened_to := v_category;
    END IF;

  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Compute segment medians over the resolved vendor set
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'health_score',        ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.health_score)::NUMERIC),
    'product_stability',   ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.product_stability)::NUMERIC),
    'customer_experience', ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.customer_experience)::NUMERIC),
    'value_perception',    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.value_perception)::NUMERIC)
  )
  INTO v_medians
  FROM public.vendor_metric_scores s
  WHERE lower(s.vendor_name) = ANY(
    SELECT lower(n) FROM unnest(v_segment_names) n
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Build the ranked vendor list. The viewing vendor is always included so
  -- the frontend can render its own row in context.
  -- rank_delta_90d is NULL for every row in v1 (no prior-snapshot table yet).
  -- ─────────────────────────────────────────────────────────────────────────
  WITH
  metrics AS (
    SELECT
      s.vendor_name,
      s.health_score,
      s.product_stability,
      s.customer_experience,
      s.value_perception
    FROM public.vendor_metric_scores s
    WHERE lower(s.vendor_name) = ANY(
      SELECT lower(n) FROM unnest(v_segment_names) n
    )
  ),
  ranked AS (
    SELECT
      m.vendor_name,
      m.health_score,
      m.product_stability,
      m.customer_experience,
      m.value_perception,
      DENSE_RANK() OVER (ORDER BY m.health_score DESC NULLS LAST)::INTEGER AS rnk,
      m.health_score >= COALESCE((v_medians ->> 'health_score')::NUMERIC, 0) AS is_above_median
    FROM metrics m
  ),
  -- Members who mentioned the input vendor (for co-occurrence computation;
  -- preserved from v1 for backwards compatibility).
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
  -- ── mention_agg ───────────────────────────────────────────────────────────
  -- NOTE: v1 (20260312510000) gated this CTE with HAVING COUNT(*) >= 3 to
  -- exclude vendors with too few mentions. v2 intentionally drops that filter.
  -- Segment membership is now governed by vendor_metric_scores.health_score IS
  -- NOT NULL (see the category branch above), which is a stricter quality gate
  -- than a raw mention count.  mention_count is preserved for backwards
  -- compatibility and displayed as an informational field only.
  -- ─────────────────────────────────────────────────────────────────────────
  mention_agg AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS vname,
      COUNT(*)::INTEGER AS mc,
      ROUND(
        COUNT(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / NULLIF(COUNT(*), 0) * 100
      )::INTEGER AS pp,
      COUNT(DISTINCT vm.member_id) FILTER (
        WHERE vm.member_id IN (SELECT member_id FROM own_members)
      )::INTEGER AS cooc
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND lower(COALESCE(ve.canonical_name, vm.vendor_name)) = ANY(
        SELECT lower(n) FROM unnest(v_segment_names) n
      )
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  ),
  -- Apply p_limit while always keeping the viewing vendor's row.
  limited AS (
    -- Top N by composite health_score
    (
      SELECT *
      FROM ranked
      ORDER BY health_score DESC NULLS LAST, vendor_name ASC
      LIMIT GREATEST(p_limit + 1, 6)
    )
    UNION
    -- Always include the calling vendor's own row, even if below the top-N
    (
      SELECT *
      FROM ranked
      WHERE lower(vendor_name) = lower(v_canonical)
    )
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      -- legacy fields (backwards-compatible with v1 callers)
      'vendor_name',               l.vendor_name,
      'mention_count',             COALESCE(ma.mc, 0),
      'positive_percent',          COALESCE(ma.pp, 0),
      'co_occurrence_count',       COALESCE(ma.cooc, 0),
      -- new multi-metric fields
      'health_score',              l.health_score,
      'product_stability_score',   l.product_stability,
      'customer_experience_score', l.customer_experience,
      'value_perception_score',    l.value_perception,
      'rank',                      l.rnk,
      'rank_delta_90d',            NULL::INTEGER,
      'is_above_median',           l.is_above_median,
      'is_self',                   lower(l.vendor_name) = lower(v_canonical)
    )
    ORDER BY l.health_score DESC NULLS LAST, lower(l.vendor_name) ASC
  )
  INTO v_vendors
  FROM limited l
  LEFT JOIN mention_agg ma ON lower(ma.vname) = lower(l.vendor_name);

  RETURN jsonb_build_object(
    'vendors', COALESCE(v_vendors, '[]'::jsonb),
    'segment', jsonb_build_object(
      'category',                v_category,
      'origin',                  v_segment_origin,
      'widened_to',              v_widened_to,
      'qualifying_vendor_count', COALESCE(v_qualifying_count, 0),
      'median',                  COALESCE(v_medians, '{}'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compared_vendors(TEXT, INTEGER, JSONB)
  TO authenticated, anon, service_role;
