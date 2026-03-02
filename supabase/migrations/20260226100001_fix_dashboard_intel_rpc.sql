-- Fix: replace row_to_jsonb with to_jsonb in get_vendor_dashboard_intel

CREATE OR REPLACE FUNCTION get_vendor_dashboard_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_metrics RECORD;
  v_benchmarks RECORD;
  v_category TEXT;
  v_recommendations JSONB;
  v_feature_gaps JSONB;
  v_history JSONB;
  v_percentiles JSONB;
BEGIN
  -- Vendor category
  SELECT category INTO v_category
  FROM public.vendor_metadata
  WHERE vendor_name = p_vendor_name;

  -- Metric scores
  SELECT * INTO v_metrics
  FROM public.vendor_metric_scores
  WHERE vendor_name = p_vendor_name;

  -- Category benchmarks
  SELECT * INTO v_benchmarks
  FROM public.category_benchmarks
  WHERE category = v_category;

  -- Compute percentile ranks if benchmarks exist and enough vendors
  IF v_benchmarks IS NOT NULL AND v_benchmarks.qualifying_vendor_count >= 4
     AND v_metrics IS NOT NULL THEN
    SELECT jsonb_build_object(
      'product_stability', (
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE s.product_stability <= v_metrics.product_stability)::NUMERIC
           / NULLIF(COUNT(*), 0)) * 100
        )
        FROM public.vendor_metric_scores s
        JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
        WHERE m.category = v_category AND s.product_stability IS NOT NULL
      ),
      'customer_experience', (
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE s.customer_experience <= v_metrics.customer_experience)::NUMERIC
           / NULLIF(COUNT(*), 0)) * 100
        )
        FROM public.vendor_metric_scores s
        JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
        WHERE m.category = v_category AND s.customer_experience IS NOT NULL
      ),
      'value_perception', (
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE s.value_perception <= v_metrics.value_perception)::NUMERIC
           / NULLIF(COUNT(*), 0)) * 100
        )
        FROM public.vendor_metric_scores s
        JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
        WHERE m.category = v_category AND s.value_perception IS NOT NULL
      )
    ) INTO v_percentiles;
  ELSE
    v_percentiles := NULL;
  END IF;

  -- Active recommendations (max 5)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'rule_id', r.rule_id,
      'priority', r.priority,
      'category', r.category,
      'metric_affected', r.metric_affected,
      'insight_text', r.insight_text,
      'supporting_data', r.supporting_data,
      'triggered_at', r.triggered_at
    ) ORDER BY
      CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      r.triggered_at DESC
  ), '[]'::JSONB) INTO v_recommendations
  FROM (
    SELECT id, rule_id, priority, category, metric_affected,
           insight_text, supporting_data, triggered_at
    FROM public.vendor_recommendations
    WHERE vendor_name = p_vendor_name
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      triggered_at DESC
    LIMIT 5
  ) r;

  -- Feature gaps
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id, 'gap_label', gap_label,
      'mention_count', mention_count,
      'first_seen', first_seen, 'last_seen', last_seen,
      'trend_direction', trend_direction,
      'mapped_metric', mapped_metric
    ) ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_feature_gaps
  FROM public.vendor_feature_gaps
  WHERE vendor_name = p_vendor_name;

  -- Sentiment history for sparkline (6 months)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', to_char(d.month, 'YYYY-MM'),
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
    WHERE vendor_name = p_vendor_name AND is_hidden = false
    GROUP BY 1
  ) c ON c.month = d.month;

  RETURN jsonb_build_object(
    'vendor_name', p_vendor_name,
    'category', v_category,
    'metrics', CASE WHEN v_metrics IS NULL THEN NULL ELSE jsonb_build_object(
      'health_score', v_metrics.health_score,
      'product_stability', jsonb_build_object(
        'score', v_metrics.product_stability,
        'data', v_metrics.product_stability_data
      ),
      'customer_experience', jsonb_build_object(
        'score', v_metrics.customer_experience,
        'data', v_metrics.customer_experience_data
      ),
      'value_perception', jsonb_build_object(
        'score', v_metrics.value_perception,
        'data', v_metrics.value_perception_data
      ),
      'computed_at', v_metrics.computed_at
    ) END,
    'benchmarks', CASE
      WHEN v_benchmarks IS NULL
        OR v_benchmarks.qualifying_vendor_count < 4 THEN NULL
      ELSE jsonb_build_object(
        'product_stability_median', v_benchmarks.product_stability_median,
        'customer_experience_median', v_benchmarks.customer_experience_median,
        'value_perception_median', v_benchmarks.value_perception_median,
        'qualifying_vendor_count', v_benchmarks.qualifying_vendor_count
      )
    END,
    'percentiles', v_percentiles,
    'recommendations', v_recommendations,
    'feature_gaps', v_feature_gaps,
    'sentiment_history', v_history
  );
END;
$$;
