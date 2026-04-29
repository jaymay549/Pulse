-- CAR-19: fix competitor leaderboard segment selection and row deduping.
--
-- The first v2 RPC used vendor_metadata.category as the segment source. That
-- table currently marks many multi-product vendors (Cox, Dealertrack, Elead,
-- DriveCentric, etc.) as "other", which makes the leaderboard compare against
-- the wrong peer set. This version derives the comparison category from
-- categorized vendor_mentions, preferring the active product line when passed.
--
-- It also aggregates mentions by lower-cased canonical vendor key so casing
-- variants such as "Drivecentric" / "DriveCentric" cannot duplicate rows.

CREATE OR REPLACE FUNCTION public.get_compared_vendors(
  p_vendor_name        TEXT,
  p_limit              INTEGER DEFAULT 8,
  p_segment_override   JSONB   DEFAULT NULL,
  p_product_line_slug  TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id           UUID;
  v_product_line_id     UUID;
  v_canonical           TEXT;
  v_category            TEXT;
  v_widened_to          TEXT;
  v_qualifying_count    INTEGER;
  v_segment_origin      TEXT;
  v_segment_names       TEXT[];
  v_included_categories TEXT[];
  v_vendors             JSONB;
  v_medians             JSONB;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical
    FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical := COALESCE(v_canonical, p_vendor_name);

  IF p_product_line_slug IS NOT NULL AND p_product_line_slug <> '' AND v_entity_id IS NOT NULL THEN
    SELECT vpl.id INTO v_product_line_id
    FROM public.vendor_product_lines vpl
    WHERE vpl.vendor_entity_id = v_entity_id
      AND vpl.slug = p_product_line_slug
    LIMIT 1;
  END IF;

  IF p_segment_override IS NOT NULL THEN
    v_segment_origin      := 'override';
    v_segment_names       := ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_segment_override));
    v_category            := NULL;
    v_widened_to          := NULL;
    v_included_categories := ARRAY[]::TEXT[];
    v_qualifying_count    := COALESCE(array_length(v_segment_names, 1), 0);
  ELSE
    -- Prefer the active product line's dominant mention category.
    IF v_product_line_id IS NOT NULL THEN
      SELECT vm.category INTO v_category
      FROM public.vendor_mentions vm
      WHERE vm.is_hidden = false
        AND vm.vendor_product_line_id = v_product_line_id
        AND vm.category IS NOT NULL
      GROUP BY vm.category
      ORDER BY COUNT(*) DESC, vm.category ASC
      LIMIT 1;
    END IF;

    -- Fall back to this vendor's dominant non-"other" mention category.
    IF v_category IS NULL AND v_entity_id IS NOT NULL THEN
      SELECT vm.category INTO v_category
      FROM public.vendor_mentions vm
      WHERE vm.is_hidden = false
        AND vm.vendor_entity_id = v_entity_id
        AND vm.category IS NOT NULL
      GROUP BY vm.category
      ORDER BY (vm.category = 'other') ASC, COUNT(*) DESC, vm.category ASC
      LIMIT 1;
    END IF;

    -- Final fallback for vendors without entity-linked mentions.
    IF v_category IS NULL THEN
      SELECT category INTO v_category
      FROM public.vendor_metadata
      WHERE lower(vendor_name) = lower(v_canonical)
      LIMIT 1;
    END IF;

    v_segment_origin := 'category';

    SELECT array_agg(DISTINCT vm.category ORDER BY vm.category)
    INTO v_included_categories
    FROM public.vendor_mentions vm
    WHERE vm.is_hidden = false
      AND vm.category IS NOT NULL
      AND public._categories_match(vm.category, v_category);

    WITH mention_vendor_keys AS (
      SELECT DISTINCT lower(COALESCE(ve.canonical_name, vm.vendor_name)) AS vendor_key
      FROM public.vendor_mentions vm
      LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
      WHERE vm.is_hidden = false
        AND vm.category IS NOT NULL
        AND public._categories_match(vm.category, v_category)
    ),
    scored AS (
      SELECT DISTINCT ON (lower(s.vendor_name))
        s.vendor_name,
        s.health_score
      FROM public.vendor_metric_scores s
      JOIN mention_vendor_keys k ON k.vendor_key = lower(s.vendor_name)
      WHERE s.health_score IS NOT NULL
      ORDER BY lower(s.vendor_name), s.health_score DESC NULLS LAST, s.vendor_name ASC
    )
    SELECT array_agg(s.vendor_name ORDER BY s.health_score DESC NULLS LAST, s.vendor_name ASC)
    INTO v_segment_names
    FROM scored s;

    v_qualifying_count := COALESCE(array_length(v_segment_names, 1), 0);

    IF v_qualifying_count < 3 AND v_category IS NOT NULL THEN
      v_widened_to := v_category;
    END IF;
  END IF;

  WITH metric_rows AS (
    SELECT DISTINCT ON (lower(s.vendor_name))
      s.vendor_name,
      s.health_score,
      s.product_stability,
      s.customer_experience,
      s.value_perception
    FROM public.vendor_metric_scores s
    WHERE lower(s.vendor_name) = ANY(
      SELECT lower(n) FROM unnest(v_segment_names) n
    )
    ORDER BY lower(s.vendor_name), s.health_score DESC NULLS LAST, s.vendor_name ASC
  )
  SELECT jsonb_build_object(
    'health_score',        ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY health_score)::NUMERIC),
    'product_stability',   ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY product_stability)::NUMERIC),
    'customer_experience', ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY customer_experience)::NUMERIC),
    'value_perception',    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY value_perception)::NUMERIC)
  )
  INTO v_medians
  FROM metric_rows;

  WITH
  metrics AS (
    SELECT DISTINCT ON (lower(s.vendor_name))
      s.vendor_name,
      s.health_score,
      s.product_stability,
      s.customer_experience,
      s.value_perception
    FROM public.vendor_metric_scores s
    WHERE lower(s.vendor_name) = ANY(
      SELECT lower(n) FROM unnest(v_segment_names) n
    )
    ORDER BY lower(s.vendor_name), s.health_score DESC NULLS LAST, s.vendor_name ASC
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
  mention_agg AS (
    SELECT
      lower(COALESCE(ve.canonical_name, vm.vendor_name)) AS vendor_key,
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
    GROUP BY lower(COALESCE(ve.canonical_name, vm.vendor_name))
  ),
  limited AS (
    (
      SELECT *
      FROM ranked
      ORDER BY health_score DESC NULLS LAST, vendor_name ASC
      LIMIT GREATEST(p_limit + 1, 6)
    )
    UNION
    (
      SELECT *
      FROM ranked
      WHERE lower(vendor_name) = lower(v_canonical)
    )
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'vendor_name',               l.vendor_name,
      'mention_count',             COALESCE(ma.mc, 0),
      'positive_percent',          COALESCE(ma.pp, 0),
      'co_occurrence_count',       COALESCE(ma.cooc, 0),
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
  LEFT JOIN mention_agg ma ON ma.vendor_key = lower(l.vendor_name);

  RETURN jsonb_build_object(
    'vendors', COALESCE(v_vendors, '[]'::jsonb),
    'segment', jsonb_build_object(
      'category',                v_category,
      'origin',                  v_segment_origin,
      'widened_to',              v_widened_to,
      'included_categories',     COALESCE(v_included_categories, ARRAY[]::TEXT[]),
      'qualifying_vendor_count', COALESCE(v_qualifying_count, 0),
      'median',                  COALESCE(v_medians, '{}'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compared_vendors(TEXT, INTEGER, JSONB, TEXT)
  TO authenticated, anon, service_role;
