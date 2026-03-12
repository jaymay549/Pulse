-- ============================================================
-- Fix get_vendor_segment_intel to include wins/flags per bucket
-- Root cause: function returned only {bucket, mentions, positive_pct}
-- but the frontend expects {wins: BucketDetail[], flags: BucketDetail[]}
-- where BucketDetail = {headline: string, dimension: string}.
-- Without wins/flags the buildThemeGroups function produces no output
-- and no cards are rendered.
-- ============================================================

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

  -- Count mentions that have an attributed member
  SELECT count(*) INTO v_total
  FROM public.vendor_mentions vm
  WHERE (
    (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
    (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
  )
    AND vm.is_hidden = false
    AND vm.member_id IS NOT NULL;

  -- Build axes: each bucket includes up to 5 wins and 5 flags
  -- sourced from actual mention titles (falls back to truncated quote)
  SELECT jsonb_build_object(
    'size', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'bucket', vss.segment_bucket,
          'mentions', vss.mention_count,
          'positive_pct', vss.positive_pct,
          'wins', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'positive'
                AND (CASE WHEN m2.rooftops = 1 THEN '1 rooftop'
                          WHEN m2.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops'
                          WHEN m2.rooftops >= 6 THEN '6+ rooftops' END) = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          ),
          'flags', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'warning'
                AND (CASE WHEN m2.rooftops = 1 THEN '1 rooftop'
                          WHEN m2.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops'
                          WHEN m2.rooftops >= 6 THEN '6+ rooftops' END) = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          )
        ) ORDER BY vss.positive_pct DESC
      )
      FROM public.vendor_segment_scores vss
      WHERE vss.vendor_name = v_canonical_name AND vss.segment_axis = 'size'
    ), '[]'::jsonb),

    'role', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'bucket', vss.segment_bucket,
          'mentions', vss.mention_count,
          'positive_pct', vss.positive_pct,
          'wins', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'positive'
                AND m2.role_band = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          ),
          'flags', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'warning'
                AND m2.role_band = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          )
        ) ORDER BY vss.positive_pct DESC
      )
      FROM public.vendor_segment_scores vss
      WHERE vss.vendor_name = v_canonical_name AND vss.segment_axis = 'role'
    ), '[]'::jsonb),

    'geo', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'bucket', vss.segment_bucket,
          'mentions', vss.mention_count,
          'positive_pct', vss.positive_pct,
          'wins', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'positive'
                AND m2.region = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          ),
          'flags', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'warning'
                AND m2.region = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          )
        ) ORDER BY vss.positive_pct DESC
      )
      FROM public.vendor_segment_scores vss
      WHERE vss.vendor_name = v_canonical_name AND vss.segment_axis = 'geo'
    ), '[]'::jsonb),

    'oem', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'bucket', vss.segment_bucket,
          'mentions', vss.mention_count,
          'positive_pct', vss.positive_pct,
          'wins', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'positive'
                AND public._classify_oem_mix(m2.oems) = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          ),
          'flags', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('headline', sub.headline, 'dimension', sub.dimension)), '[]'::jsonb)
            FROM (
              SELECT COALESCE(NULLIF(vm2.title, ''), LEFT(vm2.quote, 120)) AS headline,
                     COALESCE(vm2.dimension, 'other') AS dimension
              FROM public.vendor_mentions vm2
              JOIN public.members m2 ON m2.id = vm2.member_id
              WHERE (
                (v_entity_id IS NOT NULL AND vm2.vendor_entity_id = v_entity_id) OR
                (v_entity_id IS NULL AND lower(vm2.vendor_name) = lower(p_vendor_name))
              )
                AND vm2.is_hidden = false
                AND vm2.type = 'warning'
                AND public._classify_oem_mix(m2.oems) = vss.segment_bucket
              ORDER BY vm2.created_at DESC LIMIT 5
            ) sub
          )
        ) ORDER BY vss.positive_pct DESC
      )
      FROM public.vendor_segment_scores vss
      WHERE vss.vendor_name = v_canonical_name AND vss.segment_axis = 'oem'
    ), '[]'::jsonb)
  ) INTO v_axes;

  -- Find best spread axis for standout headline
  FOR v_axis_rec IN
    SELECT segment_axis,
           max(positive_pct) - min(positive_pct) AS spread
    FROM public.vendor_segment_scores
    WHERE vendor_name = v_canonical_name
    GROUP BY segment_axis
    HAVING count(*) >= 2
    ORDER BY spread DESC
    LIMIT 1
  LOOP
    IF v_axis_rec.spread > v_best_spread THEN
      v_best_spread := v_axis_rec.spread;
      v_best_axis   := v_axis_rec.segment_axis;
      SELECT segment_bucket, positive_pct INTO v_high_bucket, v_high_pct
        FROM public.vendor_segment_scores
        WHERE vendor_name = v_canonical_name AND segment_axis = v_best_axis
        ORDER BY positive_pct DESC LIMIT 1;
      SELECT segment_bucket, positive_pct INTO v_low_bucket, v_low_pct
        FROM public.vendor_segment_scores
        WHERE vendor_name = v_canonical_name AND segment_axis = v_best_axis
        ORDER BY positive_pct ASC LIMIT 1;
      v_standout := v_high_bucket || ' dealers rate you ' || v_best_spread
                    || ' points higher than ' || v_low_bucket || ' dealers.';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_attributed', v_total,
    'standout',         v_standout,
    'axes',             v_axes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_segment_intel(TEXT) TO authenticated, anon, service_role;
