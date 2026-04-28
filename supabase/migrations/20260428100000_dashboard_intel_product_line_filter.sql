-- Extend get_vendor_dashboard_intel with optional product-line filtering.
--
-- When p_product_line_slug is provided, metrics, feature gaps, supporting
-- quotes, sentiment history, and actionable insights are scoped to that
-- product line. When NULL (the default), behaviour is identical to before.
--
-- Must DROP the old single-param signature first to avoid overload ambiguity.

DROP FUNCTION IF EXISTS get_vendor_dashboard_intel(TEXT);

CREATE OR REPLACE FUNCTION get_vendor_dashboard_intel(
  p_vendor_name TEXT,
  p_product_line_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id          UUID;
  v_canonical_name     TEXT;
  v_product_line_id    UUID;
  v_product_line_name  TEXT;
  v_effective_name     TEXT;
  v_metrics            RECORD;
  v_benchmarks         RECORD;
  v_category           TEXT;
  v_recommendations    JSONB;
  v_feature_gaps       JSONB;
  v_history            JSONB;
  v_percentiles        JSONB;
BEGIN
  -- Entity resolution
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name
    FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  -- Product line resolution (when slug provided)
  IF p_product_line_slug IS NOT NULL AND v_entity_id IS NOT NULL THEN
    SELECT id, name INTO v_product_line_id, v_product_line_name
    FROM public.vendor_product_lines
    WHERE slug = p_product_line_slug AND vendor_entity_id = v_entity_id;
  END IF;

  -- Effective name: product line name when resolved, else canonical name
  v_effective_name := COALESCE(v_product_line_name, v_canonical_name);

  -- Category lookup (always parent-level)
  SELECT category INTO v_category
  FROM public.vendor_metadata WHERE vendor_name = v_canonical_name;

  -- Metrics lookup (uses effective name so product lines get their own scores)
  SELECT * INTO v_metrics
  FROM public.vendor_metric_scores WHERE vendor_name = v_effective_name;

  -- Category benchmarks (always parent-level)
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

  -- Dynamic insights (uses effective name for product-line-scoped insights)
  v_recommendations := get_vendor_actionable_insights(v_effective_name);

  -- Feature gaps with ai_insight and supporting quotes
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',              fg.id,
      'gap_label',       fg.gap_label,
      'mention_count',   fg.mention_count,
      'first_seen',      fg.first_seen,
      'last_seen',       fg.last_seen,
      'trend_direction', fg.trend_direction,
      'mapped_metric',   fg.mapped_metric,
      'is_emerging',     fg.is_emerging,
      'ai_insight',      fg.ai_insight,
      'supporting_quotes', (
        SELECT COALESCE(jsonb_agg(sq.obj), '[]'::jsonb)
        FROM (
          SELECT jsonb_build_object(
            'quote',    vm.quote,
            'headline', vm.headline,
            'source',   vm.source
          ) AS obj
          FROM public.vendor_mentions vm
          WHERE vm.type IN ('warning', 'negative')
            AND vm.is_hidden = false
            AND vm.dimension = CASE fg.gap_label
              WHEN 'Product reliability'   THEN 'reliable'
              WHEN 'Integration quality'   THEN 'integrates'
              WHEN 'Support & training'    THEN 'support'
              WHEN 'Adoption & onboarding' THEN 'adopted'
              WHEN 'Pricing & value'       THEN 'worth_it'
            END
            AND (
              (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
              (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
            )
            AND (v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id)
            AND vm.quote IS NOT NULL
          ORDER BY vm.created_at DESC
          LIMIT 6
        ) sq
      )
    )
    ORDER BY fg.mention_count DESC
  ), '[]'::JSONB) INTO v_feature_gaps
  FROM public.vendor_feature_gaps fg WHERE fg.vendor_name = v_effective_name;

  -- Sentiment history (6 months) -- entity-aware, with NPS tiers + product line filter
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month',          to_char(d.month, 'YYYY-MM'),
      'total_mentions', COALESCE(c.total, 0),
      'positive_count', COALESCE(c.positive, 0),
      'negative_count', COALESCE(c.neg, 0),
      'neutral_count',  COALESCE(c.neut, 0),
      'mixed_count',    COALESCE(c.mix, 0),
      'health_estimate', CASE
        WHEN COALESCE(c.total, 0) = 0 THEN NULL
        WHEN COALESCE(c.total - c.neut, 0) = 0 THEN NULL
        ELSE ROUND(c.positive::NUMERIC / (c.total - c.neut) * 100)
      END,
      'avg_intensity',   c.avg_intensity,
      'promoter_count',  COALESCE(c.promoters, 0),
      'passive_count',   COALESCE(c.passives, 0),
      'detractor_count', COALESCE(c.detractors, 0)
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
      COUNT(*) FILTER (WHERE type = 'positive') AS positive,
      COUNT(*) FILTER (WHERE type IN ('negative', 'warning')) AS neg,
      COUNT(*) FILTER (WHERE type = 'neutral') AS neut,
      COUNT(*) FILTER (WHERE type = 'mixed') AS mix,
      ROUND(AVG(sentiment_score)::NUMERIC, 1) AS avg_intensity,
      COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoters,
      COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passives,
      COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractors
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    ) AND is_hidden = false
      AND (v_product_line_id IS NULL OR vendor_product_line_id = v_product_line_id)
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
    'sentiment_history', v_history,
    'product_line',   CASE WHEN v_product_line_id IS NOT NULL THEN
      jsonb_build_object('id', v_product_line_id, 'name', v_product_line_name, 'slug', p_product_line_slug)
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_vendor_dashboard_intel(TEXT, TEXT) TO authenticated, anon, service_role;
