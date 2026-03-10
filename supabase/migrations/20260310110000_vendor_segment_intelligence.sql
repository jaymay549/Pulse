-- ============================================================
-- Vendor Segment Intelligence
-- Breaks down sentiment by dealer size, role, geography, OEM mix
-- ============================================================

-- 1) Segment scores table
CREATE TABLE IF NOT EXISTS public.vendor_segment_scores (
  vendor_name TEXT NOT NULL,
  segment_axis TEXT NOT NULL,       -- size, role, geo, oem
  segment_bucket TEXT NOT NULL,     -- e.g. "6+ rooftops", "Owners"
  mention_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  positive_pct INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_name, segment_axis, segment_bucket)
);

ALTER TABLE public.vendor_segment_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vendor_segment_scores"
  ON public.vendor_segment_scores FOR SELECT
  USING (true);

CREATE POLICY "Service role manage vendor_segment_scores"
  ON public.vendor_segment_scores FOR ALL
  TO service_role
  USING (true);

-- 2) OEM classification helper
CREATE OR REPLACE FUNCTION public._classify_oem_mix(p_oems TEXT[])
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_domestic INTEGER := 0;
  v_import INTEGER := 0;
  v_luxury INTEGER := 0;
  v_independent INTEGER := 0;
  v_total INTEGER := 0;
  v_oem TEXT;
  v_clean TEXT;
BEGIN
  IF p_oems IS NULL OR array_length(p_oems, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH v_oem IN ARRAY p_oems LOOP
    -- Strip escaped quotes and whitespace from Airtable import artifacts
    v_clean := lower(trim(both '"' from trim(v_oem)));
    v_clean := regexp_replace(v_clean, '[\\"'']', '', 'g');
    v_clean := trim(v_clean);

    IF v_clean = '' THEN CONTINUE; END IF;

    v_total := v_total + 1;

    -- Domestic
    IF v_clean ~ '(chevrolet|gmc|buick|cadillac|ford|lincoln|chrysler|dodge|jeep|ram|stellantis|general motors)' THEN
      v_domestic := v_domestic + 1;
    -- Luxury
    ELSIF v_clean ~ '(bmw|mercedes|lexus|porsche|audi|bentley|rolls.royce|lamborghini|genesis|mini|alfa romeo)' THEN
      v_luxury := v_luxury + 1;
    -- Independent
    ELSIF v_clean ~ '(independent|used|non.franchise)' THEN
      v_independent := v_independent + 1;
    -- Import (everything else that's a known brand)
    ELSIF v_clean ~ '(toyota|honda|acura|nissan|infiniti|hyundai|kia|subaru|mazda|volkswagen|vw|volvo|polestar|fiat|tesla|rivian|lucid|vinfast)' THEN
      v_import := v_import + 1;
    END IF;
  END LOOP;

  IF v_total = 0 THEN RETURN NULL; END IF;

  -- If independent is dominant, that's a distinct segment
  IF v_independent > 0 AND v_independent >= v_domestic AND v_independent >= v_import AND v_independent >= v_luxury THEN
    RETURN 'Independent';
  END IF;

  -- Dominant = more than 50% of classified OEMs
  IF v_domestic > (v_domestic + v_import + v_luxury) / 2 THEN RETURN 'Domestic'; END IF;
  IF v_import > (v_domestic + v_import + v_luxury) / 2 THEN RETURN 'Import'; END IF;
  IF v_luxury > (v_domestic + v_import + v_luxury) / 2 THEN RETURN 'Luxury'; END IF;

  RETURN 'Mixed';
END;
$$;

-- 3) Compute function
CREATE OR REPLACE FUNCTION public.compute_vendor_segments(p_vendor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_min_bucket INTEGER := 3;
BEGIN
  -- Clear existing rows for this vendor
  DELETE FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name;

  -- SIZE axis
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    p_vendor_name,
    'size',
    CASE
      WHEN m.rooftops = 1 THEN '1 rooftop'
      WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops'
      WHEN m.rooftops >= 6 THEN '6+ rooftops'
    END AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0
         ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER
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
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    p_vendor_name,
    'role',
    m.role_band AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0
         ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER
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
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    p_vendor_name,
    'geo',
    m.region AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0
         ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER
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
  INSERT INTO public.vendor_segment_scores (vendor_name, segment_axis, segment_bucket, mention_count, positive_count, warning_count, positive_pct, computed_at)
  SELECT
    p_vendor_name,
    'oem',
    public._classify_oem_mix(m.oems) AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    count(*) FILTER (WHERE vm.type = 'warning'),
    CASE WHEN count(*) = 0 THEN 0
         ELSE ROUND(count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC / count(*) * 100)::INTEGER
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

-- 4) RPC
CREATE OR REPLACE FUNCTION public.get_vendor_segment_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  -- Total attributed mentions for this vendor
  SELECT count(*) INTO v_total
  FROM public.vendor_mentions vm
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND vm.member_id IS NOT NULL;

  -- Build axes object
  SELECT jsonb_build_object(
    'size', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct
    ) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name AND segment_axis = 'size'), '[]'::jsonb),
    'role', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct
    ) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name AND segment_axis = 'role'), '[]'::jsonb),
    'geo', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct
    ) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name AND segment_axis = 'geo'), '[]'::jsonb),
    'oem', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'bucket', segment_bucket, 'mentions', mention_count, 'positive_pct', positive_pct
    ) ORDER BY positive_pct DESC) FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name AND segment_axis = 'oem'), '[]'::jsonb)
  ) INTO v_axes;

  -- Compute standout: find axis with biggest spread between highest and lowest positive_pct
  FOR v_axis_rec IN
    SELECT segment_axis,
           max(positive_pct) as max_pct,
           min(positive_pct) as min_pct,
           max(positive_pct) - min(positive_pct) as spread
    FROM public.vendor_segment_scores
    WHERE vendor_name = p_vendor_name
    GROUP BY segment_axis
    HAVING count(*) >= 2
    ORDER BY spread DESC
    LIMIT 1
  LOOP
    IF v_axis_rec.spread > v_best_spread THEN
      v_best_spread := v_axis_rec.spread;
      v_best_axis := v_axis_rec.segment_axis;

      SELECT segment_bucket, positive_pct INTO v_high_bucket, v_high_pct
      FROM public.vendor_segment_scores
      WHERE vendor_name = p_vendor_name AND segment_axis = v_best_axis
      ORDER BY positive_pct DESC LIMIT 1;

      SELECT segment_bucket, positive_pct INTO v_low_bucket, v_low_pct
      FROM public.vendor_segment_scores
      WHERE vendor_name = p_vendor_name AND segment_axis = v_best_axis
      ORDER BY positive_pct ASC LIMIT 1;

      v_standout := v_high_bucket || ' dealers rate you ' || v_best_spread || ' points higher than ' || v_low_bucket || ' dealers.';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_attributed', v_total,
    'standout', v_standout,
    'axes', v_axes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_vendor_segments(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_segment_intel(TEXT) TO service_role;

-- 5) Add segments to the daily refresh function
CREATE OR REPLACE FUNCTION public.refresh_all_vendor_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor RECORD;
  v_cat RECORD;
  v_vendor_count INTEGER := 0;
  v_cat_count INTEGER := 0;
  v_gap_count INTEGER := 0;
  v_seg_count INTEGER := 0;
BEGIN
  -- Recompute metrics for every vendor with 5+ non-hidden mentions
  FOR v_vendor IN
    SELECT vendor_name
    FROM public.vendor_mentions
    WHERE is_hidden = false
    GROUP BY vendor_name
    HAVING count(*) >= 5
    ORDER BY vendor_name
  LOOP
    PERFORM public.compute_vendor_metrics(v_vendor.vendor_name);
    v_vendor_count := v_vendor_count + 1;
  END LOOP;

  -- Recompute category benchmarks for every category that has vendors
  FOR v_cat IN
    SELECT DISTINCT category
    FROM public.vendor_metadata
    WHERE category IS NOT NULL AND category <> ''
  LOOP
    PERFORM public.compute_category_benchmarks(v_cat.category);
    v_cat_count := v_cat_count + 1;
  END LOOP;

  -- Recompute feature gaps for vendors with 10+ mentions
  FOR v_vendor IN
    SELECT vendor_name
    FROM public.vendor_mentions
    WHERE is_hidden = false
    GROUP BY vendor_name
    HAVING count(*) >= 10
    ORDER BY vendor_name
  LOOP
    PERFORM public.compute_vendor_feature_gaps(v_vendor.vendor_name);
    v_gap_count := v_gap_count + 1;
  END LOOP;

  -- Recompute segments for vendors with 3+ attributed mentions
  FOR v_vendor IN
    SELECT vendor_name
    FROM public.vendor_mentions
    WHERE is_hidden = false AND member_id IS NOT NULL
    GROUP BY vendor_name
    HAVING count(*) >= 3
    ORDER BY vendor_name
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

-- 6) Run segment computation now
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
