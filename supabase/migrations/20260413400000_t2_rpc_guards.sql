-- ============================================================
-- Vendor auth guards for T2-only SECURITY DEFINER RPCs.
--
-- All vendor dashboard RPCs currently accept any p_vendor_name with no
-- auth checks. A vendor session could call get_vendor_dimensions('OtherVendor')
-- directly and receive that vendor's data.
--
-- This migration adds auth guards to T2-only RPCs and vendor-isolation
-- guards to all vendor-facing RPCs. The guard pattern:
--
--   IF public.vendor_tier() IS NOT NULL THEN
--     -- Vendor session active; check isolation and tier
--     IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
--       RETURN empty;  -- Cross-vendor read blocked
--     END IF;
--     IF public.vendor_tier() <> 'tier_2' THEN
--       RETURN empty;  -- T1 or unverified vendor blocked
--     END IF;
--   END IF;
--   -- Clerk sessions (vendor_tier() IS NULL): pass through unchanged
--
-- RPCs updated:
--   1. get_vendor_dimensions          — T2-only, vendor isolation
--   2. get_vendor_actionable_insights — T2-only, vendor isolation
--   3. get_vendor_tech_stack_intel    — T2-only, vendor isolation
--   4. get_vendor_dashboard_intel     — vendor isolation + strip recommendations for non-T2
--   5. get_vendor_pulse_feed_v3       — vendor isolation only (T1-safe feed)
-- ============================================================

-- ── 1. get_vendor_dimensions ─────────────────────────────────
-- Original: LANGUAGE sql STABLE SECURITY DEFINER
-- Changed to LANGUAGE plpgsql to support conditional guard logic.
-- Body preserved; guard prepended.

CREATE OR REPLACE FUNCTION public.get_vendor_dimensions(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vendor session auth guard (Clerk/anon sessions pass through unchanged)
  IF public.vendor_tier() IS NOT NULL THEN
    -- Vendor isolation: vendor can only query own data
    IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
      RETURN '[]'::JSONB;
    END IF;
    -- T2 tier check: T1 and unverified vendors get empty results
    IF public.vendor_tier() <> 'tier_2' THEN
      RETURN '[]'::JSONB;
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
    FROM (
      SELECT
        dimension,
        COUNT(*) AS mention_count,
        COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative_count,
        COUNT(*) FILTER (WHERE sentiment = 'mixed') AS mixed_count,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE sentiment = 'positive') / NULLIF(COUNT(*), 0)
        ) AS positive_percent
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND dimension IS NOT NULL
        AND dimension != 'other'
      GROUP BY dimension
      ORDER BY COUNT(*) DESC
    ) d
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_dimensions(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_dimensions(TEXT) TO authenticated, anon, service_role;

-- ── 2. get_vendor_actionable_insights ────────────────────────
-- T2-only: returns action plans. Guard returns '[]'::jsonb for
-- non-T2 vendor sessions and cross-vendor requests.

CREATE OR REPLACE FUNCTION public.get_vendor_actionable_insights(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Vendor session auth guard (Clerk/anon sessions pass through unchanged)
  IF public.vendor_tier() IS NOT NULL THEN
    -- Vendor isolation: vendor can only query own data
    IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
      RETURN '[]'::JSONB;
    END IF;
    -- T2 tier check: T1 and unverified vendors get empty results
    IF public.vendor_tier() <> 'tier_2' THEN
      RETURN '[]'::JSONB;
    END IF;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_vendor_actionable_insights(TEXT) TO authenticated, anon, service_role;

-- ── 3. get_vendor_tech_stack_intel ───────────────────────────
-- T2-only: dealer tech stack signals. Returns '{}'::jsonb for
-- non-T2 vendor sessions.

CREATE OR REPLACE FUNCTION public.get_vendor_tech_stack_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id UUID;
  v_canonical TEXT;
  v_category TEXT;
  v_result JSONB;
  v_adoption INTEGER;
  v_total_in_category INTEGER;
  v_avg_sentiment NUMERIC;
  v_exploring INTEGER;
  v_left INTEGER;
  v_stable INTEGER;
  v_exit_reasons JSONB;
  v_min_threshold INTEGER := 3;
BEGIN
  -- Vendor session auth guard (Clerk/anon sessions pass through unchanged)
  IF public.vendor_tier() IS NOT NULL THEN
    -- Vendor isolation: vendor can only query own data
    IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
      RETURN '{}'::JSONB;
    END IF;
    -- T2 tier check: T1 and unverified vendors get empty results
    IF public.vendor_tier() <> 'tier_2' THEN
      RETURN '{}'::JSONB;
    END IF;
  END IF;

  -- Resolve entity for canonical name matching
  SELECT ve.id, ve.canonical_name
  INTO v_entity_id, v_canonical
  FROM public.vendor_entities ve
  WHERE lower(ve.canonical_name) = lower(p_vendor_name)
  LIMIT 1;

  v_canonical := COALESCE(v_canonical, p_vendor_name);

  -- Get vendor category
  SELECT vm.category INTO v_category
  FROM public.vendor_metadata vm
  WHERE lower(vm.vendor_name) = lower(v_canonical)
  LIMIT 1;

  -- Count current users of this vendor (case-insensitive match)
  SELECT
    COUNT(*),
    ROUND(AVG(sentiment_score)::NUMERIC, 1),
    COUNT(*) FILTER (WHERE status = 'exploring'),
    COUNT(*) FILTER (WHERE status = 'left'),
    COUNT(*) FILTER (WHERE status = 'stable')
  INTO v_adoption, v_avg_sentiment, v_exploring, v_left, v_stable
  FROM public.user_tech_stack
  WHERE lower(vendor_name) = lower(v_canonical)
    AND is_current = true;

  -- Below privacy threshold — return empty
  IF v_adoption < v_min_threshold THEN
    RETURN jsonb_build_object(
      'vendor_name', v_canonical,
      'category', v_category,
      'below_threshold', true,
      'adoption_count', v_adoption,
      'min_threshold', v_min_threshold
    );
  END IF;

  -- Total dealers in same category (for market share)
  IF v_category IS NOT NULL THEN
    SELECT COUNT(DISTINCT user_id)
    INTO v_total_in_category
    FROM public.user_tech_stack
    WHERE category = v_category
      AND is_current = true;
  ELSE
    v_total_in_category := 0;
  END IF;

  -- Aggregate exit reasons across all dealers exploring/leaving this vendor
  SELECT COALESCE(jsonb_agg(reason_row), '[]'::JSONB)
  INTO v_exit_reasons
  FROM (
    SELECT jsonb_build_object(
      'reason', er.reason_category,
      'count', COUNT(*)
    ) AS reason_row
    FROM public.user_tech_stack_exit_reasons er
    JOIN public.user_tech_stack ts ON er.tech_stack_id = ts.id
    WHERE lower(ts.vendor_name) = lower(v_canonical)
      AND ts.status IN ('exploring', 'left')
    GROUP BY er.reason_category
    ORDER BY COUNT(*) DESC
  ) sub;

  RETURN jsonb_build_object(
    'vendor_name', v_canonical,
    'category', v_category,
    'below_threshold', false,
    'adoption_count', v_adoption,
    'avg_sentiment', v_avg_sentiment,
    'status_breakdown', jsonb_build_object(
      'stable', v_stable,
      'exploring', v_exploring,
      'left', v_left
    ),
    'switching_risk_pct', CASE
      WHEN v_adoption > 0 THEN ROUND(((v_exploring + v_left)::NUMERIC / v_adoption) * 100)
      ELSE 0
    END,
    'exit_reasons', v_exit_reasons,
    'category_market_share', CASE
      WHEN v_total_in_category > 0 THEN jsonb_build_object(
        'vendor_count', v_adoption,
        'category_total', v_total_in_category,
        'share_pct', ROUND((v_adoption::NUMERIC / v_total_in_category) * 100)
      )
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_tech_stack_intel(TEXT) TO authenticated;

-- ── 4. get_vendor_dashboard_intel ────────────────────────────
-- Partial T2: vendor isolation for all vendor sessions;
-- strip 'recommendations' key for non-T2 vendor sessions.
-- Full function body from 20260324920000 (most recent) preserved,
-- with vendor session guard prepended.

CREATE OR REPLACE FUNCTION public.get_vendor_dashboard_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_result         JSONB;
BEGIN
  -- Vendor session auth guard (Clerk/anon sessions pass through unchanged)
  IF public.vendor_tier() IS NOT NULL THEN
    -- Vendor isolation: vendor can only query own data
    IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
      RETURN '{}'::JSONB;
    END IF;
    -- Note: T1 vendors are allowed through — they get recommendations stripped below.
  END IF;

  -- Entity resolution
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
  -- get_vendor_actionable_insights is T2-gated: returns '[]' for non-T2 vendor sessions.
  -- For Clerk sessions it returns the full data (existing dealer dashboard behavior).
  v_recommendations := public.get_vendor_actionable_insights(p_vendor_name);

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
            AND vm.quote IS NOT NULL
          ORDER BY vm.created_at DESC
          LIMIT 6
        ) sq
      )
    )
    ORDER BY fg.mention_count DESC
  ), '[]'::JSONB) INTO v_feature_gaps
  FROM public.vendor_feature_gaps fg WHERE fg.vendor_name = v_canonical_name;

  -- Sentiment history (6 months) — entity-aware, with NPS tiers
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
    GROUP BY 1
  ) c ON c.month = d.month;

  v_result := jsonb_build_object(
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

  -- Strip T2-only 'recommendations' key for T1/unverified vendor sessions.
  -- Defense in depth: get_vendor_actionable_insights already returns '[]' for non-T2,
  -- but removing the key makes the T2 boundary explicit at the transport level.
  IF public.vendor_tier() IS NOT NULL AND public.vendor_tier() <> 'tier_2' THEN
    v_result := v_result - 'recommendations';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard_intel(TEXT) TO authenticated, anon, service_role;

-- ── 5. get_vendor_pulse_feed_v3 ──────────────────────────────
-- T1-safe: both tiers can view the feed. Guard is vendor isolation only.
-- This recreates the function from 20260304134000 + nps_tier fields
-- from 20260324200000, with the vendor isolation guard prepended.

CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v3(
  p_category TEXT DEFAULT NULL,
  p_vendor_name TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_product_line_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 40,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base JSONB;
  v_mentions JSONB;
BEGIN
  -- Vendor session isolation guard (T1-safe: both tiers allowed)
  -- Only fires when a vendor session is active (vendor_tier() IS NOT NULL).
  IF public.vendor_tier() IS NOT NULL THEN
    -- Vendor can only query their own feed — no cross-vendor reads.
    IF p_vendor_name IS NULL OR lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
      RETURN jsonb_build_object('mentions', '[]'::jsonb, 'total', 0);
    END IF;
  END IF;

  v_base := public.get_vendor_pulse_feed_v2(
    p_category,
    p_vendor_name,
    p_type,
    p_search,
    p_product_line_slug,
    p_limit,
    p_offset
  );

  SELECT COALESCE(
    jsonb_agg(
      (m - 'quote' - 'vendorName') || jsonb_build_object(
        'vendorName', COALESCE(ve.canonical_name, vm.vendor_name, m->>'vendorName'),
        'rawVendorName', vm.vendor_name,
        'quote', COALESCE(
          CASE WHEN vm.display_mode = 'rewritten_negative' THEN vm.display_text END,
          vm.quote,
          m->>'quote'
        ),
        'rawQuote', vm.quote,
        'displayMode', COALESCE(vm.display_mode, 'raw'),
        'qualityScore', vm.quality_score,
        'evidenceLevel', vm.evidence_level,
        'isOpinionHeavy', vm.is_opinion_heavy,
        'rewriteConfidence', vm.rewrite_confidence,
        'npsTier', vm.nps_tier,
        'sentimentScore', vm.sentiment_score
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM jsonb_array_elements(COALESCE(v_base->'mentions', '[]'::jsonb)) m
  LEFT JOIN public.vendor_mentions vm
    ON vm.id::TEXT = (m->>'id')
  LEFT JOIN public.vendor_entities ve
    ON ve.id = vm.vendor_entity_id;

  RETURN jsonb_set(v_base, '{mentions}', v_mentions, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_pulse_feed_v3(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, anon, service_role;
