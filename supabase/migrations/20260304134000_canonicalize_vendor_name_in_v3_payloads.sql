-- ============================================================
-- Canonicalize vendorName in v3 feed/profile payloads
-- Prevents search/autocomplete from surfacing family aliases
-- like "CDK Global" when canonical is "CDK".
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v3(
  p_category TEXT DEFAULT NULL,
  p_vendor_name TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_product_line_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 40,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_base JSONB;
  v_mentions JSONB;
BEGIN
  v_base := public.get_vendor_pulse_feed_v2(
    p_category,
    p_vendor_name,
    p_type,
    p_search,
    p_product_line_slug,
    p_limit,
    p_offset
  );

  SELECT COALESCE(
    jsonb_agg(
      (m - 'quote' - 'vendorName') || jsonb_build_object(
        'vendorName', COALESCE(ve.canonical_name, vm.vendor_name, m->>'vendorName'),
        'rawVendorName', vm.vendor_name,
        'quote', COALESCE(
          CASE WHEN vm.display_mode = 'rewritten_negative' THEN vm.display_text END,
          vm.quote,
          m->>'quote'
        ),
        'rawQuote', vm.quote,
        'displayMode', COALESCE(vm.display_mode, 'raw'),
        'qualityScore', vm.quality_score,
        'evidenceLevel', vm.evidence_level,
        'isOpinionHeavy', vm.is_opinion_heavy,
        'rewriteConfidence', vm.rewrite_confidence
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM jsonb_array_elements(COALESCE(v_base->'mentions', '[]'::jsonb)) m
  LEFT JOIN public.vendor_mentions vm
    ON vm.id::TEXT = (m->>'id')
  LEFT JOIN public.vendor_entities ve
    ON ve.id = vm.vendor_entity_id;

  RETURN jsonb_set(v_base, '{mentions}', v_mentions, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_profile_v3(
  p_vendor_name TEXT,
  p_product_line_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_base JSONB;
  v_mentions JSONB;
BEGIN
  v_base := public.get_vendor_profile_v2(p_vendor_name, p_product_line_slug);

  SELECT COALESCE(
    jsonb_agg(
      (m - 'quote' - 'vendorName') || jsonb_build_object(
        'vendorName', COALESCE(ve.canonical_name, vm.vendor_name, m->>'vendorName'),
        'rawVendorName', vm.vendor_name,
        'quote', COALESCE(
          CASE WHEN vm.display_mode = 'rewritten_negative' THEN vm.display_text END,
          vm.quote,
          m->>'quote'
        ),
        'rawQuote', vm.quote,
        'displayMode', COALESCE(vm.display_mode, 'raw'),
        'qualityScore', vm.quality_score,
        'evidenceLevel', vm.evidence_level,
        'isOpinionHeavy', vm.is_opinion_heavy,
        'rewriteConfidence', vm.rewrite_confidence
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM jsonb_array_elements(COALESCE(v_base->'mentions', '[]'::jsonb)) m
  LEFT JOIN public.vendor_mentions vm
    ON vm.id::TEXT = (m->>'id')
  LEFT JOIN public.vendor_entities ve
    ON ve.id = vm.vendor_entity_id;

  RETURN jsonb_set(v_base, '{mentions}', v_mentions, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_pulse_feed_v3(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_profile_v3(TEXT, TEXT) TO authenticated, anon, service_role;
