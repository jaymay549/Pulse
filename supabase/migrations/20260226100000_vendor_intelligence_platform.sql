-- ============================================================
-- Vendor Intelligence Platform
-- Transforms vendor dashboard from review inbox to command center.
-- Creates computed metric scores, category benchmarks,
-- AI recommendations, and feature gap aggregation.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_metric_scores (
  vendor_name TEXT PRIMARY KEY,
  product_stability NUMERIC,
  customer_experience NUMERIC,
  value_perception NUMERIC,
  health_score NUMERIC,
  product_stability_data JSONB,
  customer_experience_data JSONB,
  value_perception_data JSONB,
  computed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vendor_metric_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vendor_metric_scores"
  ON public.vendor_metric_scores FOR SELECT USING (true);

-- ──

CREATE TABLE IF NOT EXISTS public.category_benchmarks (
  category TEXT PRIMARY KEY,
  product_stability_median NUMERIC,
  customer_experience_median NUMERIC,
  value_perception_median NUMERIC,
  qualifying_vendor_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.category_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read category_benchmarks"
  ON public.category_benchmarks FOR SELECT USING (true);

-- ──

CREATE TABLE IF NOT EXISTS public.vendor_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT NOT NULL CHECK (category IN (
    'urgent', 'improvement', 'celebrate', 'competitive',
    'product', 'awareness', 'engagement'
  )),
  metric_affected TEXT,
  insight_text TEXT,
  supporting_data JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

ALTER TABLE public.vendor_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vendor_recommendations"
  ON public.vendor_recommendations FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_vendor_recommendations_active
  ON public.vendor_recommendations(vendor_name, is_active)
  WHERE is_active = true;

-- ──

CREATE TABLE IF NOT EXISTS public.vendor_feature_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  gap_label TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 0,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  mapped_metric TEXT CHECK (mapped_metric IN (
    'product_stability', 'customer_experience', 'value_perception'
  )),
  mentions_summary JSONB,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_name, gap_label)
);

ALTER TABLE public.vendor_feature_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vendor_feature_gaps"
  ON public.vendor_feature_gaps FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_vendor_feature_gaps_vendor
  ON public.vendor_feature_gaps(vendor_name);

-- ── Helper: compute a single metric score ───────────────────

CREATE OR REPLACE FUNCTION _compute_metric_score(
  p_vendor_name TEXT,
  p_dimensions TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
  v_positive INTEGER;
  v_sentiment_ratio NUMERIC;
  v_volume_confidence NUMERIC;
  v_recency_score NUMERIC;
  v_velocity_score NUMERIC;
  v_recent_positive INTEGER;
  v_recent_total INTEGER;
  v_prior_positive INTEGER;
  v_prior_total INTEGER;
  v_score NUMERIC;
  v_weighted_pos NUMERIC;
  v_weight_sum NUMERIC;
BEGIN
  -- Count total and positive mentions in last 90 days
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'positive')
  INTO v_total, v_positive
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  -- Below threshold
  IF v_total < 5 THEN
    RETURN jsonb_build_object(
      'score', NULL,
      'mention_count', v_total,
      'below_threshold', true
    );
  END IF;

  -- 1. Sentiment ratio (0-100)
  v_sentiment_ratio := (v_positive::NUMERIC / v_total) * 100;

  -- 2. Volume confidence (0-100, log-scaled)
  v_volume_confidence := LEAST(100, LN(v_total + 1) / LN(2) * 20);

  -- 3. Recency bias (0-100)
  -- Weight positive mentions more if they are recent (30-day half-life)
  SELECT
    COALESCE(SUM(
      CASE WHEN type = 'positive'
        THEN EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))
    ), 0)
  INTO v_weighted_pos, v_weight_sum
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  IF v_weight_sum > 0 THEN
    v_recency_score := (v_weighted_pos / v_weight_sum) * 100;
  ELSE
    v_recency_score := 50;
  END IF;

  -- 4. Velocity (0-100, 50 = stable)
  SELECT
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*)
  INTO v_recent_positive, v_recent_total
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '30 days';

  SELECT
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*)
  INTO v_prior_positive, v_prior_total
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days'
    AND created_at < now() - INTERVAL '30 days';

  IF v_recent_total > 0 AND v_prior_total > 0 THEN
    v_velocity_score := 50 + (
      (v_recent_positive::NUMERIC / v_recent_total)
      - (v_prior_positive::NUMERIC / v_prior_total)
    ) * 150;
    v_velocity_score := GREATEST(0, LEAST(100, v_velocity_score));
  ELSE
    v_velocity_score := 50;
  END IF;

  -- Composite
  v_score := ROUND(
    v_sentiment_ratio   * 0.4 +
    v_volume_confidence * 0.2 +
    v_recency_score     * 0.2 +
    v_velocity_score    * 0.2
  );
  v_score := GREATEST(0, LEAST(100, v_score));

  RETURN jsonb_build_object(
    'score', v_score,
    'mention_count', v_total,
    'below_threshold', false,
    'sentiment_ratio', ROUND(v_sentiment_ratio, 1),
    'volume_confidence', ROUND(v_volume_confidence, 1),
    'recency_score', ROUND(v_recency_score, 1),
    'velocity_score', ROUND(v_velocity_score, 1),
    'positive_count', v_positive,
    'recent_mentions', v_recent_total,
    'prior_mentions', v_prior_total
  );
END;
$$;

-- ── compute_vendor_metrics ──────────────────────────────────

CREATE OR REPLACE FUNCTION compute_vendor_metrics(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ps JSONB;
  v_cx JSONB;
  v_vp JSONB;
  v_ps_score NUMERIC;
  v_cx_score NUMERIC;
  v_vp_score NUMERIC;
  v_health NUMERIC;
  v_non_null INTEGER := 0;
  v_weighted_sum NUMERIC := 0;
BEGIN
  v_ps := _compute_metric_score(p_vendor_name, ARRAY['reliable', 'integrates']);
  v_cx := _compute_metric_score(p_vendor_name, ARRAY['support', 'adopted']);
  v_vp := _compute_metric_score(p_vendor_name, ARRAY['worth_it']);

  v_ps_score := (v_ps->>'score')::NUMERIC;
  v_cx_score := (v_cx->>'score')::NUMERIC;
  v_vp_score := (v_vp->>'score')::NUMERIC;

  -- Health score: weighted average of available metrics
  -- Weights: PS=0.35, CX=0.40, VP=0.25
  IF v_ps_score IS NOT NULL THEN
    v_weighted_sum := v_weighted_sum + v_ps_score * 0.35;
    v_non_null := v_non_null + 1;
  END IF;
  IF v_cx_score IS NOT NULL THEN
    v_weighted_sum := v_weighted_sum + v_cx_score * 0.40;
    v_non_null := v_non_null + 1;
  END IF;
  IF v_vp_score IS NOT NULL THEN
    v_weighted_sum := v_weighted_sum + v_vp_score * 0.25;
    v_non_null := v_non_null + 1;
  END IF;

  IF v_non_null > 0 THEN
    -- Re-normalize weights for missing metrics
    v_health := ROUND(v_weighted_sum / (
      CASE v_non_null
        WHEN 3 THEN 1.0
        WHEN 2 THEN
          CASE
            WHEN v_ps_score IS NULL THEN 0.65
            WHEN v_cx_score IS NULL THEN 0.60
            ELSE 0.75
          END
        ELSE
          CASE
            WHEN v_ps_score IS NOT NULL THEN 0.35
            WHEN v_cx_score IS NOT NULL THEN 0.40
            ELSE 0.25
          END
      END
    ));
  ELSE
    v_health := NULL;
  END IF;

  -- Upsert
  INSERT INTO public.vendor_metric_scores (
    vendor_name, product_stability, customer_experience, value_perception,
    health_score, product_stability_data, customer_experience_data,
    value_perception_data, computed_at
  ) VALUES (
    p_vendor_name, v_ps_score, v_cx_score, v_vp_score,
    v_health, v_ps, v_cx, v_vp, now()
  )
  ON CONFLICT (vendor_name) DO UPDATE SET
    product_stability = EXCLUDED.product_stability,
    customer_experience = EXCLUDED.customer_experience,
    value_perception = EXCLUDED.value_perception,
    health_score = EXCLUDED.health_score,
    product_stability_data = EXCLUDED.product_stability_data,
    customer_experience_data = EXCLUDED.customer_experience_data,
    value_perception_data = EXCLUDED.value_perception_data,
    computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'vendor_name', p_vendor_name,
    'health_score', v_health,
    'product_stability', v_ps,
    'customer_experience', v_cx,
    'value_perception', v_vp
  );
END;
$$;

-- ── compute_category_benchmarks ─────────────────────────────

CREATE OR REPLACE FUNCTION compute_category_benchmarks(p_category TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ps_median NUMERIC;
  v_cx_median NUMERIC;
  v_vp_median NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.product_stability),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.customer_experience),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.value_perception),
    COUNT(*)
  INTO v_ps_median, v_cx_median, v_vp_median, v_count
  FROM public.vendor_metric_scores s
  JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name
  WHERE m.category = p_category
    AND s.health_score IS NOT NULL;

  INSERT INTO public.category_benchmarks (
    category, product_stability_median, customer_experience_median,
    value_perception_median, qualifying_vendor_count, computed_at
  ) VALUES (
    p_category, ROUND(v_ps_median, 1), ROUND(v_cx_median, 1),
    ROUND(v_vp_median, 1), v_count, now()
  )
  ON CONFLICT (category) DO UPDATE SET
    product_stability_median = EXCLUDED.product_stability_median,
    customer_experience_median = EXCLUDED.customer_experience_median,
    value_perception_median = EXCLUDED.value_perception_median,
    qualifying_vendor_count = EXCLUDED.qualifying_vendor_count,
    computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'category', p_category,
    'product_stability_median', v_ps_median,
    'customer_experience_median', v_cx_median,
    'value_perception_median', v_vp_median,
    'qualifying_vendor_count', v_count
  );
END;
$$;

-- ── compute_vendor_feature_gaps ─────────────────────────────

CREATE OR REPLACE FUNCTION compute_vendor_feature_gaps(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gap RECORD;
  v_result JSONB := '[]'::JSONB;
  v_recent_count INTEGER;
  v_prior_count INTEGER;
  v_trend TEXT;
  v_mapped TEXT;
BEGIN
  DELETE FROM public.vendor_feature_gaps WHERE vendor_name = p_vendor_name;

  FOR v_gap IN
    SELECT
      headline AS gap_label,
      COUNT(*) AS mention_count,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      MODE() WITHIN GROUP (ORDER BY dimension) AS primary_dimension
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND type = 'warning'
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
      AND headline IS NOT NULL
      AND headline <> ''
    GROUP BY headline
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
    LIMIT 10
  LOOP
    -- Trend: last 30 days vs prior 60 days (normalized to 30-day rate)
    SELECT COUNT(*) INTO v_recent_count
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND headline = v_gap.gap_label
      AND type = 'warning' AND is_hidden = false
      AND created_at >= now() - INTERVAL '30 days';

    SELECT COUNT(*) INTO v_prior_count
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND headline = v_gap.gap_label
      AND type = 'warning' AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
      AND created_at < now() - INTERVAL '30 days';

    IF v_prior_count > 0 THEN
      IF v_recent_count > (v_prior_count::NUMERIC / 2) * 1.2 THEN
        v_trend := 'up';
      ELSIF v_recent_count < (v_prior_count::NUMERIC / 2) * 0.8 THEN
        v_trend := 'down';
      ELSE
        v_trend := 'stable';
      END IF;
    ELSE
      v_trend := CASE WHEN v_recent_count > 0 THEN 'up' ELSE 'stable' END;
    END IF;

    v_mapped := CASE v_gap.primary_dimension
      WHEN 'reliable'   THEN 'product_stability'
      WHEN 'integrates' THEN 'product_stability'
      WHEN 'support'    THEN 'customer_experience'
      WHEN 'adopted'    THEN 'customer_experience'
      WHEN 'worth_it'   THEN 'value_perception'
      ELSE NULL
    END;

    INSERT INTO public.vendor_feature_gaps (
      vendor_name, gap_label, mention_count, first_seen, last_seen,
      trend_direction, mapped_metric, computed_at
    ) VALUES (
      p_vendor_name, v_gap.gap_label, v_gap.mention_count,
      v_gap.first_seen, v_gap.last_seen, v_trend, v_mapped, now()
    );
  END LOOP;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'gap_label', gap_label,
      'mention_count', mention_count,
      'first_seen', first_seen,
      'last_seen', last_seen,
      'trend_direction', trend_direction,
      'mapped_metric', mapped_metric
    ) ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_result
  FROM public.vendor_feature_gaps
  WHERE vendor_name = p_vendor_name;

  RETURN v_result;
END;
$$;

-- ── get_vendor_dashboard_intel ──────────────────────────────

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
  SELECT COALESCE(jsonb_agg(row_to_jsonb(r) ORDER BY
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

-- Grant execute to anon / authenticated for the read-only RPC
GRANT EXECUTE ON FUNCTION get_vendor_dashboard_intel(TEXT) TO anon, authenticated;
