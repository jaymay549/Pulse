-- ============================================================
-- Auto-refresh gap AI insights nightly via pg_net + pg_cron
--
-- The daily SQL cron at 04:00 UTC refreshes feature gaps (SQL).
-- This cron at 05:00 UTC calls generate-vendor-intelligence for
-- each vendor that has feature gaps, refreshing the AI insights
-- after the feature gap data is fresh.
--
-- Uses net.http_post (pg_net extension) to invoke the Edge Function
-- vendor-by-vendor to avoid HTTP timeouts.
--
-- The anon key is sufficient — the Edge Function authenticates via
-- its own SUPABASE_SERVICE_ROLE_KEY env var for DB writes.
-- ============================================================

-- Helper: fire-and-forget HTTP call to the edge function for one vendor
CREATE OR REPLACE FUNCTION public.refresh_vendor_gap_insights(p_vendor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url    TEXT;
  v_key    TEXT;
BEGIN
  -- Read project URL and anon key from Supabase Vault / app settings
  -- These are set by Supabase automatically in the `app.settings` namespace
  v_url := current_setting('app.settings.edge_function_url', true);
  v_key := current_setting('app.settings.anon_key', true);

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'refresh_vendor_gap_insights: app.settings not configured — skipping %', p_vendor_name;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/generate-vendor-intelligence',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('vendor_name', p_vendor_name)
  );
END;
$$;

-- Master refresh: iterate all vendors that have at least one feature gap
-- and fire an async HTTP call per vendor. Runs at 05:00 UTC daily
-- (one hour after the SQL metrics cron at 04:00 UTC).
CREATE OR REPLACE FUNCTION public.refresh_all_vendor_gap_insights()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vendor  TEXT;
  v_count   INTEGER := 0;
BEGIN
  FOR v_vendor IN
    SELECT DISTINCT vendor_name
    FROM public.vendor_feature_gaps
    ORDER BY vendor_name
  LOOP
    PERFORM public.refresh_vendor_gap_insights(v_vendor);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Schedule daily at 05:00 UTC (after SQL metrics cron at 04:00)
SELECT cron.schedule(
  'refresh-vendor-gap-insights',
  '0 5 * * *',
  $$SELECT public.refresh_all_vendor_gap_insights()$$
);

GRANT EXECUTE ON FUNCTION public.refresh_vendor_gap_insights(TEXT)    TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_vendor_gap_insights()     TO service_role;
