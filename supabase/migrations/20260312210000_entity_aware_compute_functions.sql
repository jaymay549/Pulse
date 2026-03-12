-- ============================================================
-- Make all compute/intelligence functions entity-aware
-- Fixes: _compute_metric_score, compute_vendor_metrics,
--   compute_vendor_feature_gaps, compute_vendor_segments,
--   get_vendor_dashboard_intel, get_vendor_segment_intel,
--   refresh_all_vendor_metrics
-- Pattern: resolve entity_id once per call, filter by
--   vendor_entity_id when available (else exact name match),
--   always store under the canonical entity name.
-- ============================================================

-- ── Helper: entity-aware metric score ────────────────────────

CREATE OR REPLACE FUNCTION _compute_metric_score(
  p_vendor_name TEXT,
  p_dimensions TEXT[],
  p_entity_id UUID DEFAULT NULL
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
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'positive')
  INTO v_total, v_positive
  FROM public.vendor_mentions
  WHERE (
    (p_entity_id IS NOT NULL AND vendor_entity_id = p_entity_id) OR
    (p_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  )
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  IF v_total < 5 THEN
    RETURN jsonb_build_object('score', NULL, 'mention_count', v_total, 'below_threshold', true);
  END IF;

  v_sentiment_ratio := (v_positive::NUMERIC / v_total) * 100;
  v_volume_confidence := LEAST(100, LN(v_total + 1) / LN(2) * 20);

  SELECT
    COALESCE(SUM(CASE WHEN type = 'positive' THEN EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400)) ELSE 0 END), 0),
    COALESCE(SUM(EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))), 0)
  INTO v_weighted_pos, v_weight_sum
  FROM public.vendor_mentions
  WHERE (
    (p_entity_id IS NOT NULL AND vendor_entity_id = p_entity_id) OR
    (p_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  )
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  v_recency_score := CASE WHEN v_weight_sum > 0 THEN (v_weighted_pos / v_weight_sum) * 100 ELSE 50 END;

  SELECT COUNT(*) FILTER (WHERE type = 'positive'), COUNT(*)
  INTO v_recent_positive, v_recent_total
  FROM public.vendor_mentions
  WHERE (
    (p_entity_id IS NOT NULL AND vendor_entity_id = p_entity_id) OR
    (p_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  )
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '30 days';

  SELECT COUNT(*) FILTER (WHERE type = 'positive'), COUNT(*)
  INTO v_prior_positive, v_prior_total
  FROM public.vendor_mentions
  WHERE (
    (p_entity_id IS NOT NULL AND vendor_entity_id = p_entity_id) OR
    (p_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  )
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days'
    AND created_at < now() - INTERVAL '30 days';

  IF v_recent_total > 0 AND v_prior_total > 0 THEN
    v_velocity_score := GREATEST(0, LEAST(100,
      50 + ((v_recent_positive::NUMERIC / v_recent_total) - (v_prior_positive::NUMERIC / v_prior_total)) * 150
    ));
  ELSE
    v_velocity_score := 50;
  END IF;

  v_score := GREATEST(0, LEAST(100, ROUND(
    v_sentiment_ratio   * 0.4 +
    v_volume_confidence * 0.2 +
    v_recency_score     * 0.2 +
    v_velocity_score    * 0.2
  )));

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

-- ── compute_vendor_metrics (entity-aware) ────────────────────

CREATE OR REPLACE FUNCTION compute_vendor_metrics(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_canonical_name TEXT;
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
  -- Resolve entity and canonical name
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  v_ps := _compute_metric_score(v_canonical_name, ARRAY['reliable', 'integrates'], v_entity_id);
  v_cx := _compute_metric_score(v_canonical_name, ARRAY['support', 'adopted'], v_entity_id);
  v_vp := _compute_metric_score(v_canonical_name, ARRAY['worth_it'], v_entity_id);

  v_ps_score := (v_ps->>'score')::NUMERIC;
  v_cx_score := (v_cx->>'score')::NUMERIC;
  v_vp_score := (v_vp->>'score')::NUMERIC;

  IF v_ps_score IS NOT NULL THEN v_weighted_sum := v_weighted_sum + v_ps_score * 0.35; v_non_null := v_non_null + 1; END IF;
  IF v_cx_score IS NOT NULL THEN v_weighted_sum := v_weighted_sum + v_cx_score * 0.40; v_non_null := v_non_null + 1; END IF;
  IF v_vp_score IS NOT NULL THEN v_weighted_sum := v_weighted_sum + v_vp_score * 0.25; v_non_null := v_non_null + 1; END IF;

  IF v_non_null > 0 THEN
    v_health := ROUND(v_weighted_sum / (
      CASE v_non_null
        WHEN 3 THEN 1.0
        WHEN 2 THEN CASE WHEN v_ps_score IS NULL THEN 0.65 WHEN v_cx_score IS NULL THEN 0.60 ELSE 0.75 END
        ELSE CASE WHEN v_ps_score IS NOT NULL THEN 0.35 WHEN v_cx_score IS NOT NULL THEN 0.40 ELSE 0.25 END
      END
    ));
    v_health := GREATEST(0, LEAST(100, v_health));
  ELSE
    v_health := NULL;
  END IF;

  INSERT INTO public.vendor_metric_scores (
    vendor_name, product_stability, customer_experience, value_perception,
    health_score, product_stability_data, customer_experience_data,
    value_perception_data, computed_at
  ) VALUES (
    v_canonical_name, v_ps_score, v_cx_score, v_vp_score,
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

  RETURN jsonb_build_object('vendor_name', v_canonical_name, 'health_score', v_health,
    'product_stability', v_ps, 'customer_experience', v_cx, 'value_perception', v_vp);
END;
$$;

-- ── compute_vendor_feature_gaps (entity-aware) ───────────────

CREATE OR REPLACE FUNCTION compute_vendor_feature_gaps(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_canonical_name TEXT;
  v_gap RECORD;
  v_result JSONB := '[]'::JSONB;
  v_recent_count INTEGER;
  v_prior_count INTEGER;
  v_trend TEXT;
  v_mapped TEXT;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  DELETE FROM public.vendor_feature_gaps WHERE vendor_name = v_canonical_name;

  FOR v_gap IN
    SELECT
      title AS gap_label,
      COUNT(*) AS mention_count,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      MODE() WITHIN GROUP (ORDER BY dimension) AS primary_dimension
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND type = 'warning'
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
      AND title IS NOT NULL
      AND title <> ''
    GROUP BY title
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
    LIMIT 10
  LOOP
    SELECT COUNT(*) INTO v_recent_count
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND title = v_gap.gap_label
      AND type = 'warning' AND is_hidden = false
      AND created_at >= now() - INTERVAL '30 days';

    SELECT COUNT(*) INTO v_prior_count
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND title = v_gap.gap_label
      AND type = 'warning' AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
      AND created_at < now() - INTERVAL '30 days';

    IF v_prior_count > 0 THEN
      IF v_recent_count > (v_prior_count::NUMERIC / 2) * 1.2 THEN v_trend := 'up';
      ELSIF v_recent_count < (v_prior_count::NUMERIC / 2) * 0.8 THEN v_trend := 'down';
      ELSE v_trend := 'stable';
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
      v_canonical_name, v_gap.gap_label, v_gap.mention_count,
      v_gap.first_seen, v_gap.last_seen, v_trend, v_mapped, now()
    );
  END LOOP;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('gap_label', gap_label, 'mention_count', mention_count,
      'first_seen', first_seen, 'last_seen', last_seen,
      'trend_direction', trend_direction, 'mapped_metric', mapped_metric)
    ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_result
  FROM public.vendor_feature_gaps WHERE vendor_name = v_canonical_name;

  RETURN v_result;
END;
$$;

-- ── compute_vendor_segments (entity-aware) ───────────────────

CREATE OR REPLACE FUNCTION public.compute_vendor_segments(p_vendor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_canonical_name TEXT;
  v_min_bucket INTEGER := 3;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  DELETE FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name;

  -- SIZE axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    v_canonical_name, 'size',
    CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE (
    (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
  )
    AND vm.is_hidden = false
    AND m.rooftops >= 1
  GROUP BY 3
  HAVING count(*) >= v_min_bucket;

  -- ROLE axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    v_canonical_name, 'role', m.role_band,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE (
    (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
  )
    AND vm.is_hidden = false
    AND m.role_band IS NOT NULL AND m.role_band <> '' AND m.role_band <> 'Unknown'
  GROUP BY m.role_band
  HAVING count(*) >= v_min_bucket;

  -- GEO axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    v_canonical_name, 'geo', m.region,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE (
    (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
  )
    AND vm.is_hidden = false
    AND m.region IS NOT NULL AND m.region <> ''
  GROUP BY m.region
  HAVING count(*) >= v_min_bucket;

  -- OEM axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    v_canonical_name, 'oem', public._classify_oem_mix(m.oems),
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE (
    (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
  )
    AND vm.is_hidden = false
    AND m.oems IS NOT NULL AND array_length(m.oems, 1) > 0
    AND public._classify_oem_mix(m.oems) IS NOT NULL
  GROUP BY public._classify_oem_mix(m.oems)
  HAVING count(*) >= v_min_bucket;
END;
$$;

-- ── get_vendor_segment_intel (entity-aware total) ────────────

CREATE OR REPLACE FUNCTION public.get_vendor_segment_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_canonical_name TEXT;
  v_total INTEGER;
  v_axes JSONB;
  v_standout TEXT;
  v_best_axis TEXT;
  v_best_spread INTEGER := 0;
  v_axis_rec RECORD;
  v_high_bucket TEXT;
  v_low_bucket TEXT;
  v_high_pct INTEGER;
  v_low_pct INTEGER;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  SELECT count(*) INTO v_total
  FROM public.vendor_mentions vm
  WHERE (
    (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
  )
    AND vm.is_hidden = false
    AND vm.member_id IS NOT NULL;

  SELECT jsonb_build_object(
    'size', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name AND segment_axis = 'size'), '[]'::jsonb),
    'role', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name AND segment_axis = 'role'), '[]'::jsonb),
    'geo',  COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name AND segment_axis = 'geo'),  '[]'::jsonb),
    'oem',  COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name AND segment_axis = 'oem'),  '[]'::jsonb)
  ) INTO v_axes;

  FOR v_axis_rec IN
    SELECT segment_axis, max(positive_pct) as max_pct, min(positive_pct) as min_pct, max(positive_pct) - min(positive_pct) as spread
    FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name
    GROUP BY segment_axis HAVING count(*) >= 2 ORDER BY spread DESC LIMIT 1
  LOOP
    IF v_axis_rec.spread > v_best_spread THEN
      v_best_spread := v_axis_rec.spread;
      v_best_axis := v_axis_rec.segment_axis;
      SELECT segment_bucket, positive_pct INTO v_high_bucket, v_high_pct FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name AND segment_axis = v_best_axis ORDER BY positive_pct DESC LIMIT 1;
      SELECT segment_bucket, positive_pct INTO v_low_bucket, v_low_pct FROM public.vendor_segment_scores WHERE vendor_name = v_canonical_name AND segment_axis = v_best_axis ORDER BY positive_pct ASC LIMIT 1;
      v_standout := v_high_bucket || ' dealers rate you ' || v_best_spread || ' points higher than ' || v_low_bucket || ' dealers.';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('total_attributed', v_total, 'standout', v_standout, 'axes', v_axes);
END;
$$;

-- ── get_vendor_dashboard_intel: fix sentiment history ────────

CREATE OR REPLACE FUNCTION get_vendor_dashboard_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_canonical_name TEXT;
  v_metrics RECORD;
  v_benchmarks RECORD;
  v_category TEXT;
  v_recommendations JSONB;
  v_feature_gaps JSONB;
  v_history JSONB;
  v_percentiles JSONB;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  SELECT category INTO v_category FROM public.vendor_metadata WHERE vendor_name = v_canonical_name;
  SELECT * INTO v_metrics FROM public.vendor_metric_scores WHERE vendor_name = v_canonical_name;
  SELECT * INTO v_benchmarks FROM public.category_benchmarks WHERE category = v_category;

  IF v_benchmarks IS NOT NULL AND v_benchmarks.qualifying_vendor_count >= 4 AND v_metrics IS NOT NULL THEN
    SELECT jsonb_build_object(
      'product_stability', (SELECT ROUND((COUNT(*) FILTER (WHERE s.product_stability <= v_metrics.product_stability)::NUMERIC / NULLIF(COUNT(*), 0)) * 100) FROM public.vendor_metric_scores s JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name WHERE m.category = v_category AND s.product_stability IS NOT NULL),
      'customer_experience', (SELECT ROUND((COUNT(*) FILTER (WHERE s.customer_experience <= v_metrics.customer_experience)::NUMERIC / NULLIF(COUNT(*), 0)) * 100) FROM public.vendor_metric_scores s JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name WHERE m.category = v_category AND s.customer_experience IS NOT NULL),
      'value_perception', (SELECT ROUND((COUNT(*) FILTER (WHERE s.value_perception <= v_metrics.value_perception)::NUMERIC / NULLIF(COUNT(*), 0)) * 100) FROM public.vendor_metric_scores s JOIN public.vendor_metadata m ON s.vendor_name = m.vendor_name WHERE m.category = v_category AND s.value_perception IS NOT NULL)
    ) INTO v_percentiles;
  ELSE
    v_percentiles := NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', r.id, 'rule_id', r.rule_id, 'priority', r.priority, 'category', r.category,
      'metric_affected', r.metric_affected, 'insight_text', r.insight_text, 'supporting_data', r.supporting_data, 'triggered_at', r.triggered_at)
    ORDER BY CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, r.triggered_at DESC
  ), '[]'::JSONB) INTO v_recommendations
  FROM (
    SELECT id, rule_id, priority, category, metric_affected, insight_text, supporting_data, triggered_at
    FROM public.vendor_recommendations
    WHERE vendor_name = v_canonical_name AND is_active = true AND (expires_at IS NULL OR expires_at > now())
    ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, triggered_at DESC
    LIMIT 5
  ) r;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'gap_label', gap_label, 'mention_count', mention_count,
      'first_seen', first_seen, 'last_seen', last_seen, 'trend_direction', trend_direction, 'mapped_metric', mapped_metric)
    ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_feature_gaps
  FROM public.vendor_feature_gaps WHERE vendor_name = v_canonical_name;

  -- Sentiment history: entity-aware
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', to_char(d.month, 'YYYY-MM'),
      'total_mentions', COALESCE(c.total, 0),
      'positive_count', COALESCE(c.positive, 0),
      'health_estimate', CASE WHEN COALESCE(c.total, 0) = 0 THEN NULL ELSE ROUND(c.positive::NUMERIC / c.total * 100) END
    ) ORDER BY d.month
  ), '[]'::JSONB) INTO v_history
  FROM generate_series(date_trunc('month', now() - INTERVAL '5 months'), date_trunc('month', now()), INTERVAL '1 month') d(month)
  LEFT JOIN (
    SELECT
      date_trunc('month', created_at) AS month,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE type = 'positive') AS positive
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND is_hidden = false
    GROUP BY 1
  ) c ON c.month = d.month;

  RETURN jsonb_build_object(
    'vendor_name', v_canonical_name,
    'category', v_category,
    'metrics', CASE WHEN v_metrics IS NULL THEN NULL ELSE jsonb_build_object(
      'health_score', v_metrics.health_score,
      'product_stability', jsonb_build_object('score', v_metrics.product_stability, 'data', v_metrics.product_stability_data),
      'customer_experience', jsonb_build_object('score', v_metrics.customer_experience, 'data', v_metrics.customer_experience_data),
      'value_perception', jsonb_build_object('score', v_metrics.value_perception, 'data', v_metrics.value_perception_data),
      'computed_at', v_metrics.computed_at
    ) END,
    'benchmarks', CASE WHEN v_benchmarks IS NULL OR v_benchmarks.qualifying_vendor_count < 4 THEN NULL
      ELSE jsonb_build_object(
        'product_stability_median', v_benchmarks.product_stability_median,
        'customer_experience_median', v_benchmarks.customer_experience_median,
        'value_perception_median', v_benchmarks.value_perception_median,
        'qualifying_vendor_count', v_benchmarks.qualifying_vendor_count
      ) END,
    'percentiles', v_percentiles,
    'recommendations', v_recommendations,
    'feature_gaps', v_feature_gaps,
    'sentiment_history', v_history
  );
END;
$$;

-- ── refresh_all_vendor_metrics: iterate canonical names ──────

CREATE OR REPLACE FUNCTION public.refresh_all_vendor_metrics()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vendor RECORD;
  v_cat RECORD;
  v_vendor_count INTEGER := 0;
  v_cat_count INTEGER := 0;
  v_gap_count INTEGER := 0;
  v_seg_count INTEGER := 0;
BEGIN
  -- Iterate canonical entity names (or raw vendor_name if not in entity system)
  FOR v_vendor IN
    SELECT DISTINCT COALESCE(ve.canonical_name, vm.vendor_name) AS vendor_name
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
    HAVING count(*) >= 5
    ORDER BY 1
  LOOP
    PERFORM public.compute_vendor_metrics(v_vendor.vendor_name);
    v_vendor_count := v_vendor_count + 1;
  END LOOP;

  FOR v_cat IN
    SELECT DISTINCT category FROM public.vendor_metadata WHERE category IS NOT NULL AND category <> ''
  LOOP
    PERFORM public.compute_category_benchmarks(v_cat.category);
    v_cat_count := v_cat_count + 1;
  END LOOP;

  FOR v_vendor IN
    SELECT DISTINCT COALESCE(ve.canonical_name, vm.vendor_name) AS vendor_name
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
    HAVING count(*) >= 10
    ORDER BY 1
  LOOP
    PERFORM public.compute_vendor_feature_gaps(v_vendor.vendor_name);
    v_gap_count := v_gap_count + 1;
  END LOOP;

  FOR v_vendor IN
    SELECT DISTINCT COALESCE(ve.canonical_name, vm.vendor_name) AS vendor_name
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false AND vm.member_id IS NOT NULL
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
    HAVING count(*) >= 3
    ORDER BY 1
  LOOP
    PERFORM public.compute_vendor_segments(v_vendor.vendor_name);
    v_seg_count := v_seg_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'vendors_refreshed', v_vendor_count,
    'categories_refreshed', v_cat_count,
    'feature_gaps_refreshed', v_gap_count,
    'segments_refreshed', v_seg_count,
    'completed_at', now()
  );
END;
$$;

-- ── Re-run all computations with new entity-aware logic ──────
SELECT public.refresh_all_vendor_metrics();

GRANT EXECUTE ON FUNCTION public.get_vendor_segment_intel(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_vendor_dashboard_intel(TEXT) TO authenticated, anon, service_role;
