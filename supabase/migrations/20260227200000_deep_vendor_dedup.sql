-- ============================================================
-- Deep Vendor Deduplication
-- Auto-detects and merges all vendor name variants using
-- _norm_vendor() normalization, then rebuilds the vendors list
-- RPC to always return deduplicated results.
-- ============================================================

-- Re-create _merge_vendor helper
CREATE OR REPLACE FUNCTION _merge_vendor(p_old TEXT, p_new TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- vendor_mentions
  UPDATE public.vendor_mentions SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_intelligence_cache
  DELETE FROM public.vendor_intelligence_cache WHERE vendor_name = p_old
    AND EXISTS (SELECT 1 FROM public.vendor_intelligence_cache WHERE vendor_name = p_new);
  UPDATE public.vendor_intelligence_cache SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_metric_scores
  DELETE FROM public.vendor_metric_scores WHERE vendor_name = p_old;

  -- vendor_recommendations
  UPDATE public.vendor_recommendations SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_feature_gaps (has unique constraint on vendor_name + gap_label)
  DELETE FROM public.vendor_feature_gaps WHERE vendor_name = p_old;

  -- vendor_metadata (keep the canonical, delete the dupe)
  DELETE FROM public.vendor_metadata WHERE vendor_name = p_old
    AND EXISTS (SELECT 1 FROM public.vendor_metadata WHERE vendor_name = p_new);
  UPDATE public.vendor_metadata SET vendor_name = p_new WHERE vendor_name = p_old;

  -- vendor_custom_content
  DELETE FROM public.vendor_custom_content WHERE vendor_name = p_old
    AND EXISTS (SELECT 1 FROM public.vendor_custom_content WHERE vendor_name = p_new);
  UPDATE public.vendor_custom_content SET vendor_name = p_new WHERE vendor_name = p_old;

  -- user_tech_stack
  DELETE FROM public.user_tech_stack WHERE vendor_name = p_old
    AND EXISTS (
      SELECT 1 FROM public.user_tech_stack t2
      WHERE t2.vendor_name = p_new AND t2.user_id = user_tech_stack.user_id
    );
  UPDATE public.user_tech_stack SET vendor_name = p_new WHERE vendor_name = p_old;
END;
$$;

-- ── Auto-detect and merge duplicates ─────────────────────────
-- For each normalized group with >1 variant, keep the one with
-- the most mentions and merge the rest into it.
DO $$
DECLARE
  grp RECORD;
  dupe RECORD;
BEGIN
  -- Find all normalized groups that have multiple spellings
  FOR grp IN
    SELECT
      public._norm_vendor(vendor_name) AS norm_key,
      MODE() WITHIN GROUP (ORDER BY vendor_name) AS canonical
    FROM public.vendor_mentions
    GROUP BY public._norm_vendor(vendor_name)
    HAVING COUNT(DISTINCT vendor_name) > 1
  LOOP
    -- Merge every non-canonical variant into the canonical name
    FOR dupe IN
      SELECT DISTINCT vendor_name
      FROM public.vendor_mentions
      WHERE public._norm_vendor(vendor_name) = grp.norm_key
        AND vendor_name <> grp.canonical
    LOOP
      RAISE NOTICE 'Merging "%" → "%"', dupe.vendor_name, grp.canonical;
      PERFORM _merge_vendor(dupe.vendor_name, grp.canonical);
    END LOOP;
  END LOOP;
END;
$$;

-- ── Rebuild vendors list RPC with built-in dedup ─────────────
CREATE OR REPLACE FUNCTION public.get_vendor_pulse_vendors_list()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'vendors',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('name', v.display_name, 'count', v.total_count)
          ORDER BY v.total_count DESC
        )
        FROM (
          SELECT
            -- Pick display name: most common variant spelling
            MODE() WITHIN GROUP (ORDER BY vendor_name) AS display_name,
            COUNT(*) AS total_count
          FROM public.vendor_mentions
          GROUP BY public._norm_vendor(vendor_name)
          HAVING COUNT(*) > 0
        ) v
      ),
      '[]'::jsonb
    )
  );
END;
$$;

-- Clean up helper
DROP FUNCTION _merge_vendor(TEXT, TEXT);
