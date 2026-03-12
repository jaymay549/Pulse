-- ============================================================
-- On-demand actionable insights + lower feature gap threshold
--
-- 1. get_vendor_actionable_insights(p_vendor_name TEXT)
--    Replaces vendor_recommendations table (never populated)
--    with dynamically computed insights from raw mention data.
--
-- 2. Add is_emerging column to vendor_feature_gaps
--    Lower compute_vendor_feature_gaps threshold >= 2 → >= 1
--    Flag single-mention gaps as is_emerging = true
--
-- 3. Update get_vendor_dashboard_intel to:
--    - Call get_vendor_actionable_insights for recommendations
--    - Include is_emerging in feature_gaps output
-- ============================================================

-- ── 1. Add is_emerging to vendor_feature_gaps ─────────────────

ALTER TABLE public.vendor_feature_gaps
  ADD COLUMN IF NOT EXISTS is_emerging BOOLEAN NOT NULL DEFAULT false;

-- ── 2. get_vendor_actionable_insights ─────────────────────────

CREATE OR REPLACE FUNCTION get_vendor_actionable_insights(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id         UUID;
  v_canonical_name    TEXT;
  v_result            JSONB := '[]'::JSONB;
  v_total_mentions    INTEGER;
  v_own_positive      INTEGER;
  v_recent_warnings   INTEGER;
  v_prior_warnings    INTEGER;
  v_own_health        NUMERIC;
  v_comp_name         TEXT;
  v_comp_health       NUMERIC;
  v_best_dim_dim      TEXT;
  v_best_dim_pos      BIGINT;
  v_best_dim_total    BIGINT;
  v_best_dim_pct      NUMERIC;
  v_dim               RECORD;
  v_dim_label         TEXT;
  v_metric            TEXT;
BEGIN
  -- Resolve entity
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;
  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name
    FROM public.vendor_entities WHERE id = v_entity_id;
  END IF;
  v_canonical_name := COALESCE(v_canonical_name, p_vendor_name);

  -- Total mention count
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'positive')
  INTO v_total_mentions, v_own_positive
  FROM public.vendor_mentions
  WHERE (
    (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  ) AND is_hidden = false;

  IF v_total_mentions = 0 THEN
    RETURN '[]'::JSONB;
  END IF;

  -- ── 1. URGENT: rising concern velocity ──────────────────────

  SELECT COUNT(*) INTO v_recent_warnings
  FROM public.vendor_mentions
  WHERE (
    (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  ) AND is_hidden = false AND type = 'warning'
    AND created_at >= now() - INTERVAL '30 days';

  SELECT COUNT(*) INTO v_prior_warnings
  FROM public.vendor_mentions
  WHERE (
    (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  ) AND is_hidden = false AND type = 'warning'
    AND created_at >= now() - INTERVAL '60 days'
    AND created_at < now() - INTERVAL '30 days';

  IF v_recent_warnings > 0 AND v_prior_warnings > 0 AND
     v_recent_warnings::NUMERIC / v_prior_warnings > 1.25 THEN
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',             gen_random_uuid(),
      'rule_id',        'concern_velocity',
      'priority',       'high',
      'category',       'urgent',
      'metric_affected', NULL,
      'insight_text',   'Concerns are rising — ' || v_recent_warnings || ' new concern' ||
                        CASE WHEN v_recent_warnings != 1 THEN 's' ELSE '' END ||
                        ' in the last month, up ' ||
                        ROUND(((v_recent_warnings::NUMERIC / v_prior_warnings) - 1) * 100) ||
                        '% from the prior period. Review recent mentions to identify the cause.',
      'supporting_data', jsonb_build_object(
                          'recent_warnings', v_recent_warnings,
                          'prior_warnings',  v_prior_warnings
                        ),
      'triggered_at',   now()
    ));
  END IF;

  -- ── 2. IMPROVEMENT: top dimensions with warning mentions ─────

  FOR v_dim IN
    SELECT
      dimension,
      COUNT(*) FILTER (WHERE type = 'warning')  AS warning_count,
      COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
      COUNT(*)                                   AS total_count
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    ) AND is_hidden = false
      AND dimension IS NOT NULL AND dimension NOT IN ('other', '')
    GROUP BY dimension
    HAVING COUNT(*) FILTER (WHERE type = 'warning') >= 1
    ORDER BY COUNT(*) FILTER (WHERE type = 'warning') DESC
    LIMIT 3
  LOOP
    v_dim_label := CASE v_dim.dimension
      WHEN 'reliable'   THEN 'product reliability'
      WHEN 'integrates' THEN 'integration quality'
      WHEN 'support'    THEN 'support & training'
      WHEN 'adopted'    THEN 'adoption & onboarding'
      WHEN 'worth_it'   THEN 'pricing & value'
      ELSE v_dim.dimension
    END;
    v_metric := CASE v_dim.dimension
      WHEN 'reliable'   THEN 'product_stability'
      WHEN 'integrates' THEN 'product_stability'
      WHEN 'support'    THEN 'customer_experience'
      WHEN 'adopted'    THEN 'customer_experience'
      WHEN 'worth_it'   THEN 'value_perception'
      ELSE NULL
    END;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',             gen_random_uuid(),
      'rule_id',        'dim_improvement_' || v_dim.dimension,
      'priority',       CASE
                          WHEN v_dim.warning_count >= 3 THEN 'high'
                          WHEN v_dim.warning_count >= 2 THEN 'medium'
                          ELSE 'low'
                        END,
      'category',       'improvement',
      'metric_affected', v_metric,
      'insight_text',   'Dealers flagged ' || v_dim.warning_count || ' concern' ||
                        CASE WHEN v_dim.warning_count != 1 THEN 's' ELSE '' END ||
                        ' about ' || v_dim_label || '. Review recent mentions to identify patterns.',
      'supporting_data', jsonb_build_object(
                          'dimension',      v_dim.dimension,
                          'warning_count',  v_dim.warning_count,
                          'positive_count', v_dim.positive_count,
                          'total_count',    v_dim.total_count
                        ),
      'triggered_at',   now()
    ));
  END LOOP;

  -- ── 3. COMPETITIVE: category peer outperforming by >5 pts ────

  SELECT health_score INTO v_own_health
  FROM public.vendor_metric_scores WHERE vendor_name = v_canonical_name;

  SELECT vm2.vendor_name, vms2.health_score
  INTO v_comp_name, v_comp_health
  FROM public.vendor_metadata vm
  JOIN public.vendor_metadata vm2
    ON vm2.category = vm.category AND vm2.vendor_name != v_canonical_name
  JOIN public.vendor_metric_scores vms2
    ON vms2.vendor_name = vm2.vendor_name
  WHERE vm.vendor_name = v_canonical_name
    AND vms2.health_score IS NOT NULL
    AND vms2.health_score > COALESCE(v_own_health, 0) + 5
  ORDER BY vms2.health_score DESC
  LIMIT 1;

  IF v_comp_name IS NOT NULL AND v_comp_health IS NOT NULL THEN
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',             gen_random_uuid(),
      'rule_id',        'competitive_gap',
      'priority',       'medium',
      'category',       'competitive',
      'metric_affected', NULL,
      'insight_text',   v_comp_name || ' leads your category with a health score of ' ||
                        v_comp_health || ' vs your ' ||
                        COALESCE(v_own_health::TEXT, 'N/A') ||
                        '. Review their positioning to understand what drives their edge.',
      'supporting_data', jsonb_build_object(
                          'competitor',       v_comp_name,
                          'competitor_health', v_comp_health,
                          'own_health',        v_own_health
                        ),
      'triggered_at',   now()
    ));
  END IF;

  -- ── 4. CELEBRATE: strongest dimension with ≥3 positive mentions

  SELECT
    dimension,
    SUM(CASE WHEN type = 'positive' THEN 1 ELSE 0 END),
    COUNT(*),
    ROUND(SUM(CASE WHEN type = 'positive' THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100)
  INTO v_best_dim_dim, v_best_dim_pos, v_best_dim_total, v_best_dim_pct
  FROM public.vendor_mentions
  WHERE (
    (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
  ) AND is_hidden = false
    AND dimension IS NOT NULL AND dimension NOT IN ('other', '')
  GROUP BY dimension
  HAVING SUM(CASE WHEN type = 'positive' THEN 1 ELSE 0 END) >= 3
  ORDER BY SUM(CASE WHEN type = 'positive' THEN 1 ELSE 0 END)::NUMERIC
           / NULLIF(COUNT(*), 0) DESC
  LIMIT 1;

  IF v_best_dim_dim IS NOT NULL THEN
    v_dim_label := CASE v_best_dim_dim
      WHEN 'reliable'   THEN 'Product reliability'
      WHEN 'integrates' THEN 'Integration quality'
      WHEN 'support'    THEN 'Support & training'
      WHEN 'adopted'    THEN 'Adoption & onboarding'
      WHEN 'worth_it'   THEN 'Pricing & value'
      ELSE initcap(v_best_dim_dim)
    END;
    v_metric := CASE v_best_dim_dim
      WHEN 'reliable'   THEN 'product_stability'
      WHEN 'integrates' THEN 'product_stability'
      WHEN 'support'    THEN 'customer_experience'
      WHEN 'adopted'    THEN 'customer_experience'
      WHEN 'worth_it'   THEN 'value_perception'
      ELSE NULL
    END;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',             gen_random_uuid(),
      'rule_id',        'dimension_strength',
      'priority',       'low',
      'category',       'celebrate',
      'metric_affected', v_metric,
      'insight_text',   v_dim_label || ' is your strongest signal with ' ||
                        v_best_dim_pos || ' positive mention' ||
                        CASE WHEN v_best_dim_pos != 1 THEN 's' ELSE '' END ||
                        ' (' || v_best_dim_pct || '%). Amplify this in your messaging and sales conversations.',
      'supporting_data', jsonb_build_object(
                          'dimension',     v_best_dim_dim,
                          'positive_count', v_best_dim_pos,
                          'total_count',    v_best_dim_total,
                          'positive_pct',   v_best_dim_pct
                        ),
      'triggered_at',   now()
    ));
  END IF;

  -- ── 5. AWARENESS: low total mention volume ───────────────────

  IF v_total_mentions < 10 THEN
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',             gen_random_uuid(),
      'rule_id',        'low_volume',
      'priority',       'medium',
      'category',       'awareness',
      'metric_affected', NULL,
      'insight_text',   'Only ' || v_total_mentions || ' dealer' ||
                        CASE WHEN v_total_mentions != 1 THEN 's have' ELSE ' has' END ||
                        ' mentioned you so far. Engage more dealers to build a stronger, more representative signal.',
      'supporting_data', jsonb_build_object('total_mentions', v_total_mentions),
      'triggered_at',   now()
    ));
  END IF;

  RETURN v_result;
END;
$$;

-- ── 3. compute_vendor_feature_gaps: threshold >= 1 + is_emerging

CREATE OR REPLACE FUNCTION compute_vendor_feature_gaps(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id      UUID;
  v_canonical_name TEXT;
  v_gap            RECORD;
  v_result         JSONB := '[]'::JSONB;
  v_recent_count   INTEGER;
  v_prior_count    INTEGER;
  v_trend          TEXT;
  v_mapped         TEXT;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_canonical_name
    FROM public.vendor_entities WHERE id = v_entity_id;
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
    HAVING COUNT(*) >= 1   -- lowered from 2
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
      trend_direction, mapped_metric, computed_at, is_emerging
    ) VALUES (
      v_canonical_name, v_gap.gap_label, v_gap.mention_count,
      v_gap.first_seen, v_gap.last_seen, v_trend, v_mapped, now(),
      (v_gap.mention_count = 1)
    );
  END LOOP;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             id,
      'gap_label',      gap_label,
      'mention_count',  mention_count,
      'first_seen',     first_seen,
      'last_seen',      last_seen,
      'trend_direction', trend_direction,
      'mapped_metric',  mapped_metric,
      'is_emerging',    is_emerging
    )
    ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_result
  FROM public.vendor_feature_gaps WHERE vendor_name = v_canonical_name;

  RETURN v_result;
END;
$$;

-- ── 4. Update get_vendor_dashboard_intel ─────────────────────
-- Uses get_vendor_actionable_insights instead of vendor_recommendations.
-- Includes is_emerging in feature_gaps output.

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

  -- Feature gaps with is_emerging flag
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             id,
      'gap_label',      gap_label,
      'mention_count',  mention_count,
      'first_seen',     first_seen,
      'last_seen',      last_seen,
      'trend_direction', trend_direction,
      'mapped_metric',  mapped_metric,
      'is_emerging',    is_emerging
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

-- ── Re-run feature gap computation with new threshold ─────────
SELECT public.refresh_all_vendor_metrics();

-- ── Grants ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_vendor_actionable_insights(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_vendor_dashboard_intel(TEXT) TO authenticated, anon, service_role;
