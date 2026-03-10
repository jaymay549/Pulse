-- ============================================================
-- Refresh all vendor intelligence metrics on a daily cron
-- Fixes: vendors with sufficient mentions but no computed scores
-- ============================================================

-- 1) Master refresh function: recomputes metrics, benchmarks, and feature gaps
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

  RETURN jsonb_build_object(
    'vendors_refreshed', v_vendor_count,
    'categories_refreshed', v_cat_count,
    'feature_gaps_refreshed', v_gap_count,
    'completed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_vendor_metrics() TO service_role;

-- 2) Schedule daily at 04:00 UTC via pg_cron
SELECT cron.schedule(
  'refresh-vendor-metrics',
  '0 4 * * *',
  $$SELECT public.refresh_all_vendor_metrics()$$
);

-- 3) Run immediately to backfill missing data
SELECT public.refresh_all_vendor_metrics();
