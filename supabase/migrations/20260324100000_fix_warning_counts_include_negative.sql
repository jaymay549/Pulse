-- ============================================================
-- Fix all RPCs that count type='warning' to also include 'negative'
-- After the sentiment enrichment migration renamed warning→negative,
-- these RPCs returned 0 concerns because they only checked 'warning'.
-- ============================================================

-- ── 1. Fix get_vendor_pulse_feed_v2 ──────────────────────────

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_pulse_feed_v2'
    AND pronamespace = 'public'::regnamespace;

  v_func_body := replace(
    v_func_body,
    'COUNT(*) FILTER (WHERE type = ''warning'')::INTEGER',
    'COUNT(*) FILTER (WHERE type IN (''warning'', ''negative''))::INTEGER'
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v2(
      p_category TEXT DEFAULT NULL,
      p_vendor_name TEXT DEFAULT NULL,
      p_type TEXT DEFAULT NULL,
      p_search TEXT DEFAULT NULL,
      p_product_line_slug TEXT DEFAULT NULL,
      p_limit INTEGER DEFAULT 40,
      p_offset INTEGER DEFAULT 0
    ) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$%s$fn$',
    v_func_body
  );
END;
$$;

-- ── 2. Fix get_vendor_profile_v2 ─────────────────────────────

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_profile_v2'
    AND pronamespace = 'public'::regnamespace;

  v_func_body := replace(
    v_func_body,
    'COUNT(*) FILTER (WHERE type = ''warning'')::INTEGER',
    'COUNT(*) FILTER (WHERE type IN (''warning'', ''negative''))::INTEGER'
  );

  v_func_body := replace(
    v_func_body,
    'COUNT(*) FILTER (WHERE type = ''warning'')::NUMERIC',
    'COUNT(*) FILTER (WHERE type IN (''warning'', ''negative''))::NUMERIC'
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_vendor_profile_v2(
      p_vendor_name TEXT,
      p_product_line_slug TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$%s$fn$',
    v_func_body
  );
END;
$$;

-- ── 3. Fix get_vendor_actionable_insights ─────────────────────

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_actionable_insights'
    AND pronamespace = 'public'::regnamespace;

  IF v_func_body IS NOT NULL THEN
    v_func_body := replace(
      v_func_body,
      'COUNT(*) FILTER (WHERE type = ''warning'')',
      'COUNT(*) FILTER (WHERE type IN (''warning'', ''negative''))'
    );

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.get_vendor_actionable_insights(
        p_vendor_name TEXT
      ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $fn$%s$fn$',
      v_func_body
    );
  END IF;
END;
$$;

-- ── 4. Fix get_vendor_sentiment_history (entity-aware) ───────

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_sentiment_history'
    AND pronamespace = 'public'::regnamespace;

  IF v_func_body IS NOT NULL THEN
    v_func_body := replace(
      v_func_body,
      'COUNT(*) FILTER (WHERE type = ''warning'')',
      'COUNT(*) FILTER (WHERE type IN (''warning'', ''negative''))'
    );

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.get_vendor_sentiment_history(
        p_vendor_name TEXT,
        p_months INTEGER DEFAULT 6
      ) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$%s$fn$',
      v_func_body
    );
  END IF;
END;
$$;
