-- Add mentions_90d to sales opportunity signals RPC
-- Must drop first because return type is changing

DROP FUNCTION IF EXISTS get_sales_opportunity_signals(INTEGER);

CREATE OR REPLACE FUNCTION get_sales_opportunity_signals(
  p_min_mentions INTEGER DEFAULT 3
)
RETURNS TABLE (
  vendor_name         TEXT,
  total_mentions      BIGINT,
  mentions_30d        BIGINT,
  mentions_90d        BIGINT,
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
      COUNT(*)                                     AS total_cnt,
      COUNT(*) FILTER (WHERE vm.created_at >= NOW() - INTERVAL '30 days') AS cnt_30d,
      COUNT(*) FILTER (WHERE vm.created_at >= NOW() - INTERVAL '90 days') AS cnt_90d,
      COUNT(*) FILTER (WHERE vm.type = 'positive')  AS pos_cnt,
      COUNT(*) FILTER (WHERE vm.type IN ('negative', 'warning')) AS neg_cnt,
      COUNT(*) FILTER (WHERE vm.type = 'neutral')    AS neu_cnt,
      COUNT(*) FILTER (WHERE vm.type = 'mixed')      AS mix_cnt,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'promoter')  AS pro_cnt,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'detractor') AS det_cnt,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'passive')   AS pas_cnt
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
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_mentions vm2
        LEFT JOIN public.vendor_entities ve2 ON ve2.id = vm2.vendor_entity_id
        WHERE vm2.member_id = vm.member_id
          AND COALESCE(ve2.canonical_name, vm2.vendor_name) = COALESCE(ve.canonical_name, vm.vendor_name)
          AND vm2.dimension IN ('adopted', 'support', 'reliable', 'integrates', 'worth_it')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_tech_stack uts
        JOIN public.members m ON m.clerk_user_id = uts.user_id
        WHERE m.id = vm.member_id
          AND lower(uts.vendor_name) = lower(COALESCE(ve.canonical_name, vm.vendor_name))
          AND uts.is_current = true
      )
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  ),
  gaps AS (
    SELECT vfg.vendor_name AS v_name, COUNT(*) AS gap_count
    FROM public.vendor_feature_gaps vfg
    GROUP BY vfg.vendor_name
  )
  SELECT
    ma.v_name                                    AS vendor_name,
    ma.total_cnt                                 AS total_mentions,
    ma.cnt_30d                                   AS mentions_30d,
    ma.cnt_90d                                   AS mentions_90d,
    ma.pos_cnt                                   AS positive_count,
    ma.neg_cnt                                   AS negative_count,
    ma.neu_cnt                                   AS neutral_count,
    ma.mix_cnt                                   AS mixed_count,
    ma.pro_cnt                                   AS promoter_count,
    ma.det_cnt                                   AS detractor_count,
    ma.pas_cnt                                   AS passive_count,
    vms.health_score                             AS health_score,
    vic.trend_direction                          AS trend_direction,
    vic.top_dimension                            AS top_dimension,
    COALESCE(g.gap_count, 0)                     AS feature_gap_count,
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
  LEFT JOIN gaps g ON g.v_name = ma.v_name
  LEFT JOIN confirmed c ON c.v_name = ma.v_name
  LEFT JOIN likely l ON l.v_name = ma.v_name
  LEFT JOIN mentioned_only mo ON mo.v_name = ma.v_name
  ORDER BY ma.cnt_30d DESC;
END;
$$;
