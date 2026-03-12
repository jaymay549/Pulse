-- ============================================================
-- Fix Feature Gaps: group by dimension instead of AI-generated title
--
-- The vendor_mentions.title field contains AI-generated dealer-perspective
-- summaries ("Avoid CDK X", "Beware Y", "Replace Z") that are written for
-- dealer consumption and are not useful as vendor improvement items.
--
-- Solution: group warning mentions by dimension instead of title.
-- This produces consistent, vendor-actionable labels like
-- "Support & training", "Product reliability", "Pricing & value".
--
-- The gap_label now stores the human-readable dimension name.
-- The mapped_metric and is_emerging logic remain unchanged.
-- ============================================================

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
      -- Use dimension as the group key; derive a vendor-appropriate label
      dimension AS gap_dimension,
      CASE dimension
        WHEN 'reliable'   THEN 'Product reliability'
        WHEN 'integrates' THEN 'Integration quality'
        WHEN 'support'    THEN 'Support & training'
        WHEN 'adopted'    THEN 'Adoption & onboarding'
        WHEN 'worth_it'   THEN 'Pricing & value'
        ELSE initcap(dimension)
      END AS gap_label,
      COUNT(*) AS mention_count,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND type = 'warning'
      AND is_hidden = false
      AND created_at >= now() - INTERVAL '90 days'
      AND dimension IS NOT NULL
      AND dimension NOT IN ('other', '')
    GROUP BY dimension
    HAVING COUNT(*) >= 1
    ORDER BY COUNT(*) DESC
    LIMIT 8
  LOOP
    -- Trend: compare last 30d vs prior 30d within this dimension
    SELECT COUNT(*) INTO v_recent_count
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND dimension = v_gap.gap_dimension
      AND type = 'warning' AND is_hidden = false
      AND created_at >= now() - INTERVAL '30 days';

    SELECT COUNT(*) INTO v_prior_count
    FROM public.vendor_mentions
    WHERE (
      (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
      (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
    )
      AND dimension = v_gap.gap_dimension
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

    v_mapped := CASE v_gap.gap_dimension
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
      'id',              id,
      'gap_label',       gap_label,
      'mention_count',   mention_count,
      'first_seen',      first_seen,
      'last_seen',       last_seen,
      'trend_direction', trend_direction,
      'mapped_metric',   mapped_metric,
      'is_emerging',     is_emerging
    )
    ORDER BY mention_count DESC
  ), '[]'::JSONB) INTO v_result
  FROM public.vendor_feature_gaps WHERE vendor_name = v_canonical_name;

  RETURN v_result;
END;
$$;

-- Re-run feature gap computation with new dimension-based grouping
SELECT public.refresh_all_vendor_metrics();

GRANT EXECUTE ON FUNCTION compute_vendor_feature_gaps(TEXT) TO authenticated, anon, service_role;
