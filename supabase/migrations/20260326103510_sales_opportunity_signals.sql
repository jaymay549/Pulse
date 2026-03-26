-- Sales Opportunity Signals RPC
-- Returns one row per vendor with aggregated raw signals for the sales targets tool.
-- Scoring and ranking are handled in the frontend.

CREATE OR REPLACE FUNCTION get_sales_opportunity_signals(
  p_min_mentions INTEGER DEFAULT 3
)
RETURNS TABLE (
  vendor_name         TEXT,
  total_mentions      BIGINT,
  mentions_30d        BIGINT,
  positive_count      BIGINT,
  negative_count      BIGINT,
  neutral_count       BIGINT,
  mixed_count         BIGINT,
  promoter_count      BIGINT,
  detractor_count     BIGINT,
  passive_count       BIGINT,
  health_score        NUMERIC,
  trend_direction     TEXT,
  top_dimension       TEXT,
  feature_gap_count   BIGINT,
  category            TEXT,
  has_profile         BOOLEAN,
  confirmed_dealer_count BIGINT,
  likely_dealer_count    BIGINT,
  mentioned_only_count   BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH mention_agg AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS v_name,
      COUNT(*)                                     AS total_mentions,
      COUNT(*) FILTER (WHERE vm.created_at >= NOW() - INTERVAL '30 days') AS mentions_30d,
      COUNT(*) FILTER (WHERE vm.type = 'positive')  AS positive_count,
      COUNT(*) FILTER (WHERE vm.type IN ('negative', 'warning')) AS negative_count,
      COUNT(*) FILTER (WHERE vm.type = 'neutral')    AS neutral_count,
      COUNT(*) FILTER (WHERE vm.type = 'mixed')      AS mixed_count,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'promoter')  AS promoter_count,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'detractor') AS detractor_count,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'passive')   AS passive_count
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
    HAVING COUNT(*) >= p_min_mentions
  ),
  confirmed AS (
    SELECT
      COALESCE(ve.canonical_name, uts.vendor_name) AS v_name,
      COUNT(DISTINCT uts.user_id) AS cnt
    FROM public.user_tech_stack uts
    LEFT JOIN public.vendor_entities ve
      ON lower(ve.canonical_name) = lower(uts.vendor_name)
    WHERE uts.is_current = true
    GROUP BY COALESCE(ve.canonical_name, uts.vendor_name)
  ),
  likely AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS v_name,
      COUNT(DISTINCT vm.member_id) AS cnt
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.member_id IS NOT NULL
      AND vm.dimension IN ('adopted', 'support', 'reliable', 'integrates', 'worth_it')
      -- Exclude members already counted as confirmed users
      AND NOT EXISTS (
        SELECT 1 FROM public.user_tech_stack uts
        JOIN public.members m ON m.clerk_user_id = uts.user_id
        WHERE m.id = vm.member_id
          AND lower(uts.vendor_name) = lower(COALESCE(ve.canonical_name, vm.vendor_name))
          AND uts.is_current = true
      )
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  ),
  mentioned_only AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS v_name,
      COUNT(DISTINCT vm.member_id) AS cnt
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.member_id IS NOT NULL
      -- Only members whose ALL mentions for this vendor are 'other' dimension or 'neutral' type
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_mentions vm2
        LEFT JOIN public.vendor_entities ve2 ON ve2.id = vm2.vendor_entity_id
        WHERE vm2.member_id = vm.member_id
          AND COALESCE(ve2.canonical_name, vm2.vendor_name) = COALESCE(ve.canonical_name, vm.vendor_name)
          AND vm2.dimension IN ('adopted', 'support', 'reliable', 'integrates', 'worth_it')
      )
      -- Also exclude confirmed users
      AND NOT EXISTS (
        SELECT 1 FROM public.user_tech_stack uts
        JOIN public.members m ON m.clerk_user_id = uts.user_id
        WHERE m.id = vm.member_id
          AND lower(uts.vendor_name) = lower(COALESCE(ve.canonical_name, vm.vendor_name))
          AND uts.is_current = true
      )
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  )
  SELECT
    ma.v_name                                    AS vendor_name,
    ma.total_mentions,
    ma.mentions_30d,
    ma.positive_count,
    ma.negative_count,
    ma.neutral_count,
    ma.mixed_count,
    ma.promoter_count,
    ma.detractor_count,
    ma.passive_count,
    vms.health_score                             AS health_score,
    vic.trend_direction                          AS trend_direction,
    vic.top_dimension                            AS top_dimension,
    COALESCE(fg.gap_count, 0)                    AS feature_gap_count,
    vmd.category                                 AS category,
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE lower(vp.vendor_name) = lower(ma.v_name)
    )                                            AS has_profile,
    COALESCE(c.cnt, 0)                           AS confirmed_dealer_count,
    COALESCE(l.cnt, 0)                           AS likely_dealer_count,
    COALESCE(mo.cnt, 0)                          AS mentioned_only_count
  FROM mention_agg ma
  LEFT JOIN public.vendor_metric_scores vms ON vms.vendor_name = ma.v_name
  LEFT JOIN public.vendor_intelligence_cache vic ON vic.vendor_name = ma.v_name
  LEFT JOIN public.vendor_metadata vmd ON vmd.vendor_name = ma.v_name
  LEFT JOIN (
    SELECT vendor_name AS v_name, COUNT(*) AS gap_count
    FROM public.vendor_feature_gaps
    GROUP BY vendor_name
  ) fg ON fg.v_name = ma.v_name
  LEFT JOIN confirmed c ON c.v_name = ma.v_name
  LEFT JOIN likely l ON l.v_name = ma.v_name
  LEFT JOIN mentioned_only mo ON mo.v_name = ma.v_name
  ORDER BY ma.mentions_30d DESC;
END;
$$;
