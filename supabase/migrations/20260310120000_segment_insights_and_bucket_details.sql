-- ============================================================
-- Segment Insights & Bucket Details
-- Adds qualitative insights and per-bucket wins/flags
-- ============================================================

-- 1) Bucket details table (top 3 wins + top 3 flags per bucket)
CREATE TABLE IF NOT EXISTS public.vendor_segment_bucket_details (
  vendor_name TEXT NOT NULL,
  segment_axis TEXT NOT NULL,
  segment_bucket TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'positive' or 'warning'
  dimension TEXT NOT NULL,
  headline TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_segment_bucket_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vendor_segment_bucket_details"
  ON public.vendor_segment_bucket_details FOR SELECT
  USING (true);

CREATE POLICY "Service role manage vendor_segment_bucket_details"
  ON public.vendor_segment_bucket_details FOR ALL
  TO service_role
  USING (true);

-- 2) Insights table
CREATE TABLE IF NOT EXISTS public.vendor_segment_insights (
  vendor_name TEXT NOT NULL,
  insight_type TEXT NOT NULL,    -- gap, pain, strength, divergence
  segment_axis TEXT NOT NULL,
  segment_bucket TEXT,           -- nullable for cross-bucket insights
  dimension TEXT NOT NULL,
  headline TEXT NOT NULL,
  detail TEXT,
  severity INTEGER NOT NULL DEFAULT 2,
  mention_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_segment_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vendor_segment_insights"
  ON public.vendor_segment_insights FOR SELECT
  USING (true);

CREATE POLICY "Service role manage vendor_segment_insights"
  ON public.vendor_segment_insights FOR ALL
  TO service_role
  USING (true);

-- 3) Updated compute function with bucket details + insight detection
CREATE OR REPLACE FUNCTION public.compute_vendor_segments(p_vendor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_min_bucket INTEGER := 3;
  v_rec RECORD;
  v_axis TEXT;
  v_dim_rec RECORD;
  v_bucket_a RECORD;
  v_bucket_b RECORD;
  v_top_headline TEXT;
  v_detail_headlines TEXT[];
BEGIN
  -- Clear existing rows for this vendor
  DELETE FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name;
  DELETE FROM public.vendor_segment_bucket_details WHERE vendor_name = p_vendor_name;
  DELETE FROM public.vendor_segment_insights WHERE vendor_name = p_vendor_name;

  -- ===== BAR DATA (unchanged logic, fixed rooftops filter) =====

  -- SIZE axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT p_vendor_name, 'size',
    CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END AS bucket,
    count(*), count(*) FILTER (WHERE vm.type = 'positive'), count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END, now()
  FROM public.vendor_mentions vm JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND m.rooftops IS NOT NULL AND m.rooftops >= 1
  GROUP BY bucket HAVING count(*) >= v_min_bucket;

  -- ROLE axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT p_vendor_name, 'role', m.role_band AS bucket,
    count(*), count(*) FILTER (WHERE vm.type = 'positive'), count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END, now()
  FROM public.vendor_mentions vm JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND m.role_band IS NOT NULL AND m.role_band <> '' AND m.role_band <> 'Unknown'
  GROUP BY m.role_band HAVING count(*) >= v_min_bucket;

  -- GEO axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT p_vendor_name, 'geo', m.region AS bucket,
    count(*), count(*) FILTER (WHERE vm.type = 'positive'), count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END, now()
  FROM public.vendor_mentions vm JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND m.region IS NOT NULL AND m.region <> ''
  GROUP BY m.region HAVING count(*) >= v_min_bucket;

  -- OEM axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT p_vendor_name, 'oem', public._classify_oem_mix(m.oems) AS bucket,
    count(*), count(*) FILTER (WHERE vm.type = 'positive'), count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0 ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER END, now()
  FROM public.vendor_mentions vm JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND m.oems IS NOT NULL AND array_length(m.oems, 1) > 0 AND public._classify_oem_mix(m.oems) IS NOT NULL
  GROUP BY public._classify_oem_mix(m.oems) HAVING count(*) >= v_min_bucket;

  -- ===== BUCKET DETAILS (top 3 wins + top 3 flags per bucket) =====

  FOR v_rec IN
    SELECT segment_axis, segment_bucket FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name
  LOOP
    -- Top 3 positive headlines
    INSERT INTO public.vendor_segment_bucket_details (vendor_name, segment_axis, segment_bucket, type, dimension, headline, computed_at)
    SELECT DISTINCT ON (vm.headline) p_vendor_name, v_rec.segment_axis, v_rec.segment_bucket, 'positive', vm.dimension, vm.headline, now()
    FROM public.vendor_mentions vm
    JOIN public.members m ON m.id = vm.member_id
    WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND vm.type = 'positive' AND vm.headline IS NOT NULL AND vm.headline <> ''
      AND CASE v_rec.segment_axis
        WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
        WHEN 'role' THEN m.role_band
        WHEN 'geo' THEN m.region
        WHEN 'oem' THEN public._classify_oem_mix(m.oems)
      END = v_rec.segment_bucket
    ORDER BY vm.headline, vm.conversation_time DESC
    LIMIT 3;

    -- Top 3 warning headlines
    INSERT INTO public.vendor_segment_bucket_details (vendor_name, segment_axis, segment_bucket, type, dimension, headline, computed_at)
    SELECT DISTINCT ON (vm.headline) p_vendor_name, v_rec.segment_axis, v_rec.segment_bucket, 'warning', vm.dimension, vm.headline, now()
    FROM public.vendor_mentions vm
    JOIN public.members m ON m.id = vm.member_id
    WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND vm.type = 'warning' AND vm.headline IS NOT NULL AND vm.headline <> ''
      AND CASE v_rec.segment_axis
        WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
        WHEN 'role' THEN m.role_band
        WHEN 'geo' THEN m.region
        WHEN 'oem' THEN public._classify_oem_mix(m.oems)
      END = v_rec.segment_bucket
    ORDER BY vm.headline, vm.conversation_time DESC
    LIMIT 3;
  END LOOP;

  -- ===== INSIGHT DETECTION =====

  -- PAIN CLUSTER: bucket + dimension where 3+ warnings exist
  FOR v_rec IN
    SELECT ss.segment_axis, ss.segment_bucket, vm.dimension, count(*) as warn_count
    FROM public.vendor_segment_scores ss
    JOIN public.vendor_mentions vm ON vm.vendor_name = ss.vendor_name AND vm.is_hidden = false AND vm.type = 'warning'
      AND vm.headline IS NOT NULL AND vm.dimension IS NOT NULL AND vm.dimension <> 'other'
    JOIN public.members m ON m.id = vm.member_id
    WHERE ss.vendor_name = p_vendor_name
      AND vm.vendor_name = p_vendor_name
      AND CASE ss.segment_axis
        WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
        WHEN 'role' THEN m.role_band
        WHEN 'geo' THEN m.region
        WHEN 'oem' THEN public._classify_oem_mix(m.oems)
      END = ss.segment_bucket
    GROUP BY ss.segment_axis, ss.segment_bucket, vm.dimension
    HAVING count(*) >= 3
    ORDER BY count(*) DESC
  LOOP
    -- Get top headline for detail
    SELECT vm.headline INTO v_top_headline
    FROM public.vendor_mentions vm
    JOIN public.members m ON m.id = vm.member_id
    WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND vm.type = 'warning'
      AND vm.dimension = v_rec.dimension AND vm.headline IS NOT NULL
      AND CASE v_rec.segment_axis
        WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
        WHEN 'role' THEN m.role_band
        WHEN 'geo' THEN m.region
        WHEN 'oem' THEN public._classify_oem_mix(m.oems)
      END = v_rec.segment_bucket
    ORDER BY vm.conversation_time DESC LIMIT 1;

    INSERT INTO public.vendor_segment_insights (vendor_name, insight_type, segment_axis, segment_bucket, dimension, headline, detail, severity, mention_count, computed_at)
    VALUES (
      p_vendor_name, 'pain', v_rec.segment_axis, v_rec.segment_bucket, v_rec.dimension,
      v_rec.segment_bucket || ' flag ' || replace(v_rec.dimension, '_', ' ') || ' issues (' || v_rec.warn_count || ' mentions)',
      v_top_headline, 3, v_rec.warn_count, now()
    );
  END LOOP;

  -- STRENGTH SIGNAL: bucket + dimension where 3+ positives exist
  FOR v_rec IN
    SELECT ss.segment_axis, ss.segment_bucket, vm.dimension, count(*) as pos_count
    FROM public.vendor_segment_scores ss
    JOIN public.vendor_mentions vm ON vm.vendor_name = ss.vendor_name AND vm.is_hidden = false AND vm.type = 'positive'
      AND vm.headline IS NOT NULL AND vm.dimension IS NOT NULL AND vm.dimension <> 'other'
    JOIN public.members m ON m.id = vm.member_id
    WHERE ss.vendor_name = p_vendor_name
      AND vm.vendor_name = p_vendor_name
      AND CASE ss.segment_axis
        WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
        WHEN 'role' THEN m.role_band
        WHEN 'geo' THEN m.region
        WHEN 'oem' THEN public._classify_oem_mix(m.oems)
      END = ss.segment_bucket
    GROUP BY ss.segment_axis, ss.segment_bucket, vm.dimension
    HAVING count(*) >= 3
    ORDER BY count(*) DESC
  LOOP
    SELECT vm.headline INTO v_top_headline
    FROM public.vendor_mentions vm
    JOIN public.members m ON m.id = vm.member_id
    WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND vm.type = 'positive'
      AND vm.dimension = v_rec.dimension AND vm.headline IS NOT NULL
      AND CASE v_rec.segment_axis
        WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
        WHEN 'role' THEN m.role_band
        WHEN 'geo' THEN m.region
        WHEN 'oem' THEN public._classify_oem_mix(m.oems)
      END = v_rec.segment_bucket
    ORDER BY vm.conversation_time DESC LIMIT 1;

    INSERT INTO public.vendor_segment_insights (vendor_name, insight_type, segment_axis, segment_bucket, dimension, headline, detail, severity, mention_count, computed_at)
    VALUES (
      p_vendor_name, 'strength', v_rec.segment_axis, v_rec.segment_bucket, v_rec.dimension,
      v_rec.segment_bucket || ' highlight ' || replace(v_rec.dimension, '_', ' ') || ' (' || v_rec.pos_count || ' mentions)',
      v_top_headline, 1, v_rec.pos_count, now()
    );
  END LOOP;

  -- SEGMENT GAP: within an axis, find dimension where top bucket positive_pct differs from bottom by 15+ pts
  FOREACH v_axis IN ARRAY ARRAY['size','role','geo','oem'] LOOP
    FOR v_dim_rec IN
      SELECT vm.dimension,
        max(ss.positive_pct) as max_pct, min(ss.positive_pct) as min_pct,
        max(ss.positive_pct) - min(ss.positive_pct) as spread
      FROM public.vendor_segment_scores ss
      JOIN public.vendor_mentions vm ON vm.vendor_name = p_vendor_name AND vm.is_hidden = false
        AND vm.dimension IS NOT NULL AND vm.dimension <> 'other'
      JOIN public.members m ON m.id = vm.member_id
        AND CASE ss.segment_axis
          WHEN 'size' THEN CASE WHEN m.rooftops = 1 THEN '1 rooftop' WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops' WHEN m.rooftops >= 6 THEN '6+ rooftops' END
          WHEN 'role' THEN m.role_band
          WHEN 'geo' THEN m.region
          WHEN 'oem' THEN public._classify_oem_mix(m.oems)
        END = ss.segment_bucket
      WHERE ss.vendor_name = p_vendor_name AND ss.segment_axis = v_axis
      GROUP BY vm.dimension
      HAVING count(DISTINCT ss.segment_bucket) >= 2 AND max(ss.positive_pct) - min(ss.positive_pct) >= 15
      ORDER BY spread DESC
      LIMIT 1
    LOOP
      -- Find high and low buckets for this axis
      SELECT segment_bucket, positive_pct INTO v_bucket_a
      FROM public.vendor_segment_scores
      WHERE vendor_name = p_vendor_name AND segment_axis = v_axis
      ORDER BY positive_pct DESC LIMIT 1;

      SELECT segment_bucket, positive_pct INTO v_bucket_b
      FROM public.vendor_segment_scores
      WHERE vendor_name = p_vendor_name AND segment_axis = v_axis
      ORDER BY positive_pct ASC LIMIT 1;

      INSERT INTO public.vendor_segment_insights (vendor_name, insight_type, segment_axis, segment_bucket, dimension, headline, detail, severity, mention_count, computed_at)
      VALUES (
        p_vendor_name, 'gap', v_axis, NULL, v_dim_rec.dimension,
        v_bucket_a.segment_bucket || ' rate you ' || v_dim_rec.spread || ' points higher than ' || v_bucket_b.segment_bucket,
        'Biggest gap is in ' || replace(v_dim_rec.dimension, '_', ' '),
        2, 0, now()
      );
    END LOOP;
  END LOOP;

END;
$$;

-- 4) Updated RPC with insights + bucket details
CREATE OR REPLACE FUNCTION public.get_vendor_segment_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_axes JSONB;
  v_insights JSONB;
BEGIN
  -- Total attributed mentions
  SELECT count(*) INTO v_total
  FROM public.vendor_mentions vm
  WHERE vm.vendor_name = p_vendor_name AND vm.is_hidden = false AND vm.member_id IS NOT NULL;

  -- Build axes with bucket details
  SELECT jsonb_build_object(
    'size', COALESCE((SELECT jsonb_agg(row_to_json(sub.*) ORDER BY sub.positive_pct DESC) FROM (
      SELECT ss.segment_bucket as bucket, ss.mention_count as mentions, ss.positive_pct,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'size' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'positive'), '[]'::jsonb) as wins,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'size' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'warning'), '[]'::jsonb) as flags
      FROM public.vendor_segment_scores ss WHERE ss.vendor_name = p_vendor_name AND ss.segment_axis = 'size'
    ) sub), '[]'::jsonb),
    'role', COALESCE((SELECT jsonb_agg(row_to_json(sub.*) ORDER BY sub.positive_pct DESC) FROM (
      SELECT ss.segment_bucket as bucket, ss.mention_count as mentions, ss.positive_pct,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'role' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'positive'), '[]'::jsonb) as wins,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'role' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'warning'), '[]'::jsonb) as flags
      FROM public.vendor_segment_scores ss WHERE ss.vendor_name = p_vendor_name AND ss.segment_axis = 'role'
    ) sub), '[]'::jsonb),
    'geo', COALESCE((SELECT jsonb_agg(row_to_json(sub.*) ORDER BY sub.positive_pct DESC) FROM (
      SELECT ss.segment_bucket as bucket, ss.mention_count as mentions, ss.positive_pct,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'geo' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'positive'), '[]'::jsonb) as wins,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'geo' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'warning'), '[]'::jsonb) as flags
      FROM public.vendor_segment_scores ss WHERE ss.vendor_name = p_vendor_name AND ss.segment_axis = 'geo'
    ) sub), '[]'::jsonb),
    'oem', COALESCE((SELECT jsonb_agg(row_to_json(sub.*) ORDER BY sub.positive_pct DESC) FROM (
      SELECT ss.segment_bucket as bucket, ss.mention_count as mentions, ss.positive_pct,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'oem' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'positive'), '[]'::jsonb) as wins,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('headline', bd.headline, 'dimension', bd.dimension))
          FROM public.vendor_segment_bucket_details bd
          WHERE bd.vendor_name = p_vendor_name AND bd.segment_axis = 'oem' AND bd.segment_bucket = ss.segment_bucket AND bd.type = 'warning'), '[]'::jsonb) as flags
      FROM public.vendor_segment_scores ss WHERE ss.vendor_name = p_vendor_name AND ss.segment_axis = 'oem'
    ) sub), '[]'::jsonb)
  ) INTO v_axes;

  -- Build insights array
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', insight_type,
    'axis', segment_axis,
    'bucket', segment_bucket,
    'dimension', dimension,
    'headline', headline,
    'detail', detail,
    'severity', severity,
    'mention_count', mention_count
  ) ORDER BY severity DESC, mention_count DESC), '[]'::jsonb)
  INTO v_insights
  FROM public.vendor_segment_insights
  WHERE vendor_name = p_vendor_name;

  RETURN jsonb_build_object(
    'total_attributed', v_total,
    'insights', v_insights,
    'axes', v_axes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_vendor_segments(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_segment_intel(TEXT) TO service_role;

-- 5) Recompute all segments with new logic
DO $$
DECLARE v_vendor RECORD;
BEGIN
  FOR v_vendor IN
    SELECT vendor_name
    FROM public.vendor_mentions
    WHERE is_hidden = false AND member_id IS NOT NULL
    GROUP BY vendor_name
    HAVING count(*) >= 3
  LOOP
    PERFORM public.compute_vendor_segments(v_vendor.vendor_name);
  END LOOP;
END;
$$;
