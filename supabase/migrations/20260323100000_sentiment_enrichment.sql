-- ============================================================
-- Sentiment Enrichment
-- Expands binary positive/warning to 4-value sentiment,
-- adds intensity score (1-5) and NPS tier.
-- ============================================================

-- ── Task 1: Expand review_type enum ─────────────────────────
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'negative';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'neutral';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'mixed';

-- ── New columns on vendor_mentions ──────────────────────────
ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS sentiment_score SMALLINT
    CHECK (sentiment_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS nps_tier TEXT
    CHECK (nps_tier IN ('promoter', 'passive', 'detractor'));

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_nps_tier
  ON public.vendor_mentions(nps_tier)
  WHERE nps_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_sentiment_score
  ON public.vendor_mentions(sentiment_score)
  WHERE sentiment_score IS NOT NULL;

-- ── Backfill warning → negative ─────────────────────────────
UPDATE public.vendor_mentions
  SET type = 'negative'
  WHERE type = 'warning';

-- ── Expand vendor_segment_scores ────────────────────────────
ALTER TABLE public.vendor_segment_scores
  ADD COLUMN IF NOT EXISTS negative_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neutral_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mixed_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.vendor_segment_scores
  SET negative_count = warning_count;

-- ── NPS tier derivation function ────────────────────────────
CREATE OR REPLACE FUNCTION public.derive_nps_tier(
  p_type public.review_type,
  p_score SMALLINT
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_type = 'positive' AND p_score >= 5 THEN
    RETURN 'promoter';
  ELSIF p_type IN ('negative', 'warning') THEN
    RETURN 'detractor';
  ELSIF p_type IN ('neutral', 'mixed') THEN
    RETURN 'passive';
  ELSIF p_type = 'positive' AND p_score <= 2 THEN
    RETURN 'detractor';
  ELSE
    RETURN 'passive';
  END IF;
END;
$$;

-- ============================================================
-- Task 2: Updated _compute_metric_score with weighted sentiment
-- ============================================================

CREATE OR REPLACE FUNCTION _compute_metric_score(
  p_vendor_name TEXT,
  p_dimensions TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
  v_positive INTEGER;
  v_negative INTEGER;
  v_neutral INTEGER;
  v_mixed INTEGER;
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
  v_avg_score NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*) FILTER (WHERE type IN ('negative', 'warning')),
    COUNT(*) FILTER (WHERE type = 'neutral'),
    COUNT(*) FILTER (WHERE type = 'mixed')
  INTO v_total, v_positive, v_negative, v_neutral, v_mixed
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  IF v_total < 5 THEN
    RETURN jsonb_build_object(
      'score', NULL,
      'mention_count', v_total,
      'below_threshold', true
    );
  END IF;

  -- 1. Weighted sentiment ratio (0-100)
  SELECT
    COALESCE(
      SUM(CASE
        WHEN type = 'positive' THEN COALESCE(sentiment_score, 3)
        ELSE 0
      END) /
      NULLIF(SUM(CASE
        WHEN type != 'neutral' THEN COALESCE(sentiment_score, 3)
        ELSE 0
      END), 0) * 100,
      CASE WHEN v_positive > 0 THEN (v_positive::NUMERIC / NULLIF(v_total - v_neutral, 0)) * 100 ELSE 0 END
    )
  INTO v_sentiment_ratio
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  -- 2. Volume confidence (0-100, log-scaled)
  v_volume_confidence := LEAST(100, LN(v_total + 1) / LN(2) * 20);

  -- 3. Recency bias (0-100)
  SELECT
    COALESCE(SUM(
      CASE WHEN type = 'positive'
        THEN EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))
             * COALESCE(sentiment_score, 3)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE WHEN type != 'neutral'
        THEN EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))
             * COALESCE(sentiment_score, 3)
        ELSE 0
      END
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
    COUNT(*) FILTER (WHERE type != 'neutral')
  INTO v_recent_positive, v_recent_total
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '30 days';

  SELECT
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*) FILTER (WHERE type != 'neutral')
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

  SELECT AVG(sentiment_score)
  INTO v_avg_score
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days'
    AND sentiment_score IS NOT NULL;

  RETURN jsonb_build_object(
    'score', v_score,
    'mention_count', v_total,
    'below_threshold', false,
    'sentiment_ratio', ROUND(v_sentiment_ratio, 1),
    'volume_confidence', ROUND(v_volume_confidence, 1),
    'recency_score', ROUND(v_recency_score, 1),
    'velocity_score', ROUND(v_velocity_score, 1),
    'positive_count', v_positive,
    'negative_count', v_negative,
    'neutral_count', v_neutral,
    'mixed_count', v_mixed,
    'avg_sentiment_score', ROUND(COALESCE(v_avg_score, 0), 1),
    'recent_mentions', v_recent_total,
    'prior_mentions', v_prior_total
  );
END;
$$;

-- ============================================================
-- Task 3: Updated get_vendor_dimensions and get_vendor_sentiment_history
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vendor_dimensions(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(d))
    FROM (
      SELECT
        dimension,
        COUNT(*) AS mention_count,
        COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE type IN ('negative', 'warning')) AS negative_count,
        COUNT(*) FILTER (WHERE type = 'mixed') AS mixed_count,
        COUNT(*) FILTER (WHERE type = 'neutral') AS neutral_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE type = 'positive')
          / NULLIF(COUNT(*) FILTER (WHERE type != 'neutral'), 0)
        ) AS positive_percent,
        ROUND(AVG(sentiment_score) FILTER (WHERE sentiment_score IS NOT NULL), 1) AS avg_intensity,
        COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoter_count,
        COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passive_count,
        COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractor_count
      FROM public.vendor_mentions
      WHERE (
        (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
      )
        AND is_hidden = false
        AND dimension IS NOT NULL
        AND dimension != 'other'
      GROUP BY dimension
      ORDER BY COUNT(*) DESC
    ) d
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_sentiment_history(
  p_vendor_name TEXT,
  p_months INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(m) ORDER BY m.month)
    FROM (
      SELECT
        to_char(date_trunc('month', conversation_time), 'YYYY-MM') AS month,
        COUNT(*) AS total_mentions,
        COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE type IN ('negative', 'warning')) AS negative_count,
        COUNT(*) FILTER (WHERE type = 'neutral') AS neutral_count,
        COUNT(*) FILTER (WHERE type = 'mixed') AS mixed_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE type = 'positive')
          / NULLIF(COUNT(*) FILTER (WHERE type != 'neutral'), 0)
        ) AS positive_percent,
        ROUND(AVG(sentiment_score) FILTER (WHERE sentiment_score IS NOT NULL), 1) AS avg_intensity,
        COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoter_count,
        COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passive_count,
        COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractor_count
      FROM public.vendor_mentions
      WHERE (
        (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
      )
        AND is_hidden = false
        AND conversation_time >= date_trunc('month', now()) - (p_months || ' months')::interval
      GROUP BY date_trunc('month', conversation_time)
      ORDER BY date_trunc('month', conversation_time)
    ) m
  ), '[]'::jsonb);
END;
$$;

-- ============================================================
-- Task 4: Updated compute_vendor_segments and get_vendor_dashboard_intel
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_vendor_segments(p_vendor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_min_bucket INTEGER := 3;
BEGIN
  DELETE FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name;

  -- SIZE axis
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'size',
    CASE
      WHEN m.rooftops = 1 THEN '1 rooftop'
      WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops'
      WHEN m.rooftops >= 6 THEN '6+ rooftops'
    END AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0, -- warning_count (deprecated, keep 0)
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.rooftops IS NOT NULL
  GROUP BY bucket
  HAVING count(*) >= v_min_bucket;

  -- ROLE axis
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'role', m.role_band AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0,
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.role_band IS NOT NULL AND m.role_band <> '' AND m.role_band <> 'Unknown'
  GROUP BY m.role_band
  HAVING count(*) >= v_min_bucket;

  -- GEO axis
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'geo', m.region AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0,
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.region IS NOT NULL AND m.region <> ''
  GROUP BY m.region
  HAVING count(*) >= v_min_bucket;

  -- OEM axis
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'oem', public._classify_oem_mix(m.oems) AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0,
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.oems IS NOT NULL AND array_length(m.oems, 1) > 0
    AND public._classify_oem_mix(m.oems) IS NOT NULL
  GROUP BY public._classify_oem_mix(m.oems)
  HAVING count(*) >= v_min_bucket;
END;
$$;

-- ── Updated get_vendor_dashboard_intel ───────────────────────
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

  -- Sentiment history for sparkline (6 months) — enriched with new types and NPS tiers
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', to_char(d.month, 'YYYY-MM'),
      'total_mentions', COALESCE(c.total, 0),
      'positive_count', COALESCE(c.positive, 0),
      'negative_count', COALESCE(c.neg, 0),
      'neutral_count', COALESCE(c.neut, 0),
      'mixed_count', COALESCE(c.mix, 0),
      'health_estimate', CASE
        WHEN COALESCE(c.total, 0) = 0 THEN NULL
        WHEN COALESCE(c.total - c.neut, 0) = 0 THEN NULL
        ELSE ROUND(c.positive::NUMERIC / (c.total - c.neut) * 100)
      END,
      'promoter_count', COALESCE(c.promoters, 0),
      'passive_count', COALESCE(c.passives, 0),
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
      COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoters,
      COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passives,
      COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractors
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

-- ============================================================
-- Task 5: Updated WAM sync with enriched sentiment
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_single_wam_processed_mention(
  p_id TEXT,
  p_vendor_name TEXT,
  p_category TEXT,
  p_sentiment TEXT,
  p_snippet_anon TEXT,
  p_headline TEXT,
  p_dimension TEXT,
  p_conversation_time TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_type public.review_type;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Map sentiment to expanded enum
  v_type := CASE lower(coalesce(p_sentiment, ''))
    WHEN 'positive' THEN 'positive'::public.review_type
    WHEN 'negative' THEN 'negative'::public.review_type
    WHEN 'neutral'  THEN 'neutral'::public.review_type
    WHEN 'mixed'    THEN 'mixed'::public.review_type
    ELSE 'negative'::public.review_type  -- fallback for unknown values
  END;

  v_created_at := COALESCE(NULLIF(p_conversation_time, '')::timestamptz, now());

  INSERT INTO public.vendor_mentions (
    id, vendor_name, category, type, title, quote, explanation,
    dimension, conversation_time, created_at, source, is_hidden
  )
  VALUES (
    p_id, p_vendor_name,
    COALESCE(NULLIF(p_category, ''), 'other'),
    v_type,
    COALESCE(NULLIF(p_headline, ''), 'Vendor mention'),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_dimension, ''), 'other'),
    v_created_at, v_created_at,
    'community', false
  )
  ON CONFLICT (id) DO UPDATE SET
    vendor_name = EXCLUDED.vendor_name,
    category = EXCLUDED.category,
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    quote = EXCLUDED.quote,
    explanation = EXCLUDED.explanation,
    dimension = EXCLUDED.dimension,
    conversation_time = EXCLUDED.conversation_time,
    created_at = LEAST(public.vendor_mentions.created_at, EXCLUDED.created_at),
    source = EXCLUDED.source,
    is_hidden = false;
END;
$$;
