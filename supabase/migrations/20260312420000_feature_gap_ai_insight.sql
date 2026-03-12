-- ============================================================
-- Add ai_insight column to vendor_feature_gaps
--
-- The generate-vendor-intelligence Edge Function will populate
-- this with Gemini-generated consultant-style recommendations
-- per dimension gap (e.g. "Dealers report informal onboarding —
-- a structured process review is likely needed").
--
-- get_vendor_dashboard_intel already returns feature_gaps;
-- we just need to add ai_insight to that aggregation.
-- ============================================================

ALTER TABLE public.vendor_feature_gaps
  ADD COLUMN IF NOT EXISTS ai_insight TEXT;

-- Update get_vendor_dashboard_intel to include ai_insight in feature_gaps
CREATE OR REPLACE FUNCTION get_vendor_dashboard_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id      UUID;
  v_canonical_name TEXT;
  v_metrics        RECORD;
  v_benchmarks     RECORD;
  v_category       TEXT;
  v_recommendations JSONB;
  v_feature_gaps   JSONB;
  v_history        JSONB;
  v_percentiles    JSONB;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name
    FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  SELECT category INTO v_category
  FROM public.vendor_metadata WHERE vendor_name = v_canonical_name;

  SELECT * INTO v_metrics
  FROM public.vendor_metric_scores WHERE vendor_name = v_canonical_name;

  SELECT * INTO v_benchmarks
  FROM public.category_benchmarks WHERE category = v_category;

  -- Percentiles (only when 4+ vendors in category)
  IF v_benchmarks IS NOT NULL AND v_benchmarks.qualifying_vendor_count >= 4
     AND v_metrics IS NOT NULL THEN
    SELECT jsonb_build_object(
      'product_stability',   (
        SELECT ROUND((COUNT(*) FILTER (WHERE s.product_stability   <= v_metrics.product_stability)::NUMERIC   / NULLIF(COUNT(*), 0)) * 100)
        FROM public.vendor_metric_scores s
        JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
        WHERE m.category = v_category AND s.product_stability IS NOT NULL
      ),
      'customer_experience', (
        SELECT ROUND((COUNT(*) FILTER (WHERE s.customer_experience <= v_metrics.customer_experience)::NUMERIC / NULLIF(COUNT(*), 0)) * 100)
        FROM public.vendor_metric_scores s
        JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
        WHERE m.category = v_category AND s.customer_experience IS NOT NULL
      ),
      'value_perception',    (
        SELECT ROUND((COUNT(*) FILTER (WHERE s.value_perception    <= v_metrics.value_perception)::NUMERIC    / NULLIF(COUNT(*), 0)) * 100)
        FROM public.vendor_metric_scores s
        JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
        WHERE m.category = v_category AND s.value_perception IS NOT NULL
      )
    ) INTO v_percentiles;
  ELSE
    v_percentiles := NULL;
  END IF;

  -- Dynamic insights (replaces vendor_recommendations table)
  v_recommendations := get_vendor_actionable_insights(p_vendor_name);

  -- Feature gaps with ai_insight included
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',              id,
      'gap_label',       gap_label,
      'mention_count',   mention_count,
      'first_seen',      first_seen,
      'last_seen',       last_seen,
      'trend_direction', trend_direction,
      'mapped_metric',   mapped_metric,
      'is_emerging',     is_emerging,
      'ai_insight',      ai_insight
    )
    ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_feature_gaps
  FROM public.vendor_feature_gaps WHERE vendor_name = v_canonical_name;

  -- Sentiment history: entity-aware
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month',          to_char(d.month, 'YYYY-MM'),
      'total_mentions', COALESCE(c.total, 0),
      'positive_count', COALESCE(c.positive, 0),
      'health_estimate', CASE
        WHEN COALESCE(c.total, 0) = 0 THEN NULL
        ELSE ROUND(c.positive::NUMERIC / c.total * 100)
      END
    ) ORDER BY d.month
  ), '[]'::JSONB) INTO v_history
  FROM generate_series(
    date_trunc('month', now() - INTERVAL '5 months'),
    date_trunc('month', now()),
    INTERVAL '1 month'
  ) d(month)
  LEFT JOIN (
    SELECT
      date_trunc('month', created_at) AS month,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE type = 'positive') AS positive
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    ) AND is_hidden = false
    GROUP BY 1
  ) c ON c.month = d.month;

  RETURN jsonb_build_object(
    'vendor_name',    v_canonical_name,
    'category',       v_category,
    'metrics',        CASE WHEN v_metrics IS NULL THEN NULL
                      ELSE jsonb_build_object(
                        'health_score',        v_metrics.health_score,
                        'product_stability',   jsonb_build_object('score', v_metrics.product_stability,   'data', v_metrics.product_stability_data),
                        'customer_experience', jsonb_build_object('score', v_metrics.customer_experience, 'data', v_metrics.customer_experience_data),
                        'value_perception',    jsonb_build_object('score', v_metrics.value_perception,    'data', v_metrics.value_perception_data),
                        'computed_at',         v_metrics.computed_at
                      ) END,
    'benchmarks',     CASE
                        WHEN v_benchmarks IS NULL OR v_benchmarks.qualifying_vendor_count < 4 THEN NULL
                        ELSE jsonb_build_object(
                          'product_stability_median',   v_benchmarks.product_stability_median,
                          'customer_experience_median', v_benchmarks.customer_experience_median,
                          'value_perception_median',    v_benchmarks.value_perception_median,
                          'qualifying_vendor_count',    v_benchmarks.qualifying_vendor_count
                        )
                      END,
    'percentiles',    v_percentiles,
    'recommendations', v_recommendations,
    'feature_gaps',   v_feature_gaps,
    'sentiment_history', v_history
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_vendor_dashboard_intel(TEXT) TO authenticated, anon, service_role;
