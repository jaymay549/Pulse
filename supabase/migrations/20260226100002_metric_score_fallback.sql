-- Fix: fall back to all mentions when no dimension tags exist yet.
-- When dimensions are populated, scoring uses them. Until then,
-- computes from all mentions using the type field.

CREATE OR REPLACE FUNCTION _compute_metric_score(
  p_vendor_name TEXT,
  p_dimensions TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_has_dimensions BOOLEAN;
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
  -- Check if this vendor has ANY dimension-tagged mentions
  SELECT EXISTS(
    SELECT 1 FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND dimension IS NOT NULL
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
    LIMIT 1
  ) INTO v_has_dimensions;

  -- Count total and positive mentions in last 90 days
  -- If dimensions exist, filter by them. Otherwise use all mentions.
  IF v_has_dimensions THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE type = 'positive')
    INTO v_total, v_positive
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND dimension = ANY(p_dimensions)
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days';
  ELSE
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE type = 'positive')
    INTO v_total, v_positive
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days';
  END IF;

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
  IF v_has_dimensions THEN
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
  ELSE
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
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days';
  END IF;

  IF v_weight_sum > 0 THEN
    v_recency_score := (v_weighted_pos / v_weight_sum) * 100;
  ELSE
    v_recency_score := 50;
  END IF;

  -- 4. Velocity (0-100, 50 = stable)
  IF v_has_dimensions THEN
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
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE type = 'positive'),
      COUNT(*)
    INTO v_recent_positive, v_recent_total
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '30 days';

    SELECT
      COUNT(*) FILTER (WHERE type = 'positive'),
      COUNT(*)
    INTO v_prior_positive, v_prior_total
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
      AND created_at < now() - INTERVAL '30 days';
  END IF;

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
    'dimensions_available', v_has_dimensions,
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
