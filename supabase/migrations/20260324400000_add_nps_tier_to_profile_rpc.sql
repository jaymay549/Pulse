-- ============================================================
-- Add nps_tier and sentimentScore to profile v3 mention payloads
-- ============================================================

DO $$
DECLARE
  v_func_body TEXT;
BEGIN
  SELECT prosrc INTO v_func_body
  FROM pg_proc
  WHERE proname = 'get_vendor_profile_v3'
    AND pronamespace = 'public'::regnamespace;

  -- Add npsTier and sentimentScore after rewriteConfidence
  v_func_body := replace(
    v_func_body,
    '''rewriteConfidence'', vm.rewrite_confidence',
    '''rewriteConfidence'', vm.rewrite_confidence, ''npsTier'', vm.nps_tier, ''sentimentScore'', vm.sentiment_score'
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_vendor_profile_v3(
      p_vendor_name TEXT,
      p_product_line_slug TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$%s$fn$',
    v_func_body
  );
END;
$$;
