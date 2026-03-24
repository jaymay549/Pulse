-- ============================================================
-- Add nps_tier and sentimentScore to feed mention payloads
-- Patches v3 feed RPC and v2 feed RPC to include these fields.
-- ============================================================

-- ── 1. Patch get_vendor_pulse_feed_v3 to include nps_tier ────
-- v3 enriches v2 output by joining vendor_mentions.
-- Add nps_tier and sentimentScore to the jsonb_build_object.

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_pulse_feed_v3'
    AND pronamespace = 'public'::regnamespace;

  -- Add nps_tier and sentimentScore after rewriteConfidence
  v_func_body := replace(
    v_func_body,
    '''rewriteConfidence'', vm.rewrite_confidence',
    '''rewriteConfidence'', vm.rewrite_confidence, ''npsTier'', vm.nps_tier, ''sentimentScore'', vm.sentiment_score'
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v3(
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

-- ── 2. Patch get_vendor_pulse_feed_v2 to include nps_tier ────
-- v2 builds mentions directly. Add to the jsonb_build_object.

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_pulse_feed_v2'
    AND pronamespace = 'public'::regnamespace;

  -- Add nps_tier and sentimentScore after conversationTime
  v_func_body := replace(
    v_func_body,
    '''conversationTime'', t.conversation_time',
    '''conversationTime'', t.conversation_time, ''npsTier'', t.nps_tier, ''sentimentScore'', t.sentiment_score'
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
