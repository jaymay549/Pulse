-- ============================================================
-- Prevent cross-vendor merges caused by context-based mapping
-- - Introduces strict (name-only) family resolver
-- - Replaces trigger/backfill mapping to strict behavior
-- - Repairs existing incorrect vendor_entity_id assignments
-- - Hardens feed/list RPC canonicalization output
-- ============================================================

-- 1) Strict resolver: only exact alias/canonical/slug matches.
CREATE OR REPLACE FUNCTION public.resolve_vendor_family_name_only(
  p_vendor_name TEXT
)
RETURNS TABLE (
  vendor_entity_id UUID,
  vendor_product_line_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := NULLIF(trim(coalesce(p_vendor_name, '')), '');
  IF v_name IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Exact alias match first.
  RETURN QUERY
  SELECT am.vendor_entity_id, am.vendor_product_line_id
  FROM public.vendor_alias_mappings am
  WHERE lower(am.alias_text) = lower(v_name)
  ORDER BY am.confidence DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Exact canonical name or slug match.
  RETURN QUERY
  SELECT ve.id, NULL::UUID
  FROM public.vendor_entities ve
  WHERE lower(ve.canonical_name) = lower(v_name)
     OR lower(ve.slug) = lower(public._slugify_vendor_token(v_name))
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::UUID, NULL::UUID;
END;
$$;

-- 2) Trigger mapping now uses strict resolver only.
CREATE OR REPLACE FUNCTION public.apply_vendor_family_mapping()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_id UUID;
  v_product_line_id UUID;
BEGIN
  SELECT r.vendor_entity_id, r.vendor_product_line_id
  INTO v_entity_id, v_product_line_id
  FROM public.resolve_vendor_family_name_only(NEW.vendor_name) r
  LIMIT 1;

  NEW.vendor_entity_id := v_entity_id;
  NEW.vendor_product_line_id := v_product_line_id;

  RETURN NEW;
END;
$$;

-- 3) Backfill helper rewritten to strict behavior.
CREATE OR REPLACE FUNCTION public.backfill_vendor_mentions_family(p_limit INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH expected AS (
    SELECT
      vm.id,
      r.vendor_entity_id,
      r.vendor_product_line_id
    FROM public.vendor_mentions vm
    LEFT JOIN LATERAL public.resolve_vendor_family_name_only(vm.vendor_name) r
      ON TRUE
    ORDER BY vm.id DESC
    LIMIT COALESCE(p_limit, 2147483647)
  )
  UPDATE public.vendor_mentions vm
  SET
    vendor_entity_id = e.vendor_entity_id,
    vendor_product_line_id = e.vendor_product_line_id
  FROM expected e
  WHERE vm.id = e.id
    AND (
      vm.vendor_entity_id IS DISTINCT FROM e.vendor_entity_id OR
      vm.vendor_product_line_id IS DISTINCT FROM e.vendor_product_line_id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 4) Repair existing incorrect mappings immediately.
SELECT public.backfill_vendor_mentions_family(200000);

-- 5) Harden vendors-list RPC fallback resolver to strict name-only.
CREATE OR REPLACE FUNCTION public.get_vendor_pulse_vendors_list_v2()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH scoped AS (
    SELECT
      vm.vendor_name,
      vm.vendor_entity_id
    FROM public.vendor_mentions vm
    WHERE vm.is_hidden = false
  ),
  resolved AS (
    SELECT
      s.vendor_name,
      COALESCE(
        s.vendor_entity_id,
        rf.vendor_entity_id
      ) AS resolved_entity_id
    FROM scoped s
    LEFT JOIN LATERAL public.resolve_vendor_family_name_only(
      s.vendor_name
    ) rf
      ON s.vendor_entity_id IS NULL
  ),
  grouped AS (
    SELECT
      COALESCE(ve.canonical_name, r.vendor_name) AS name,
      COUNT(*)::INTEGER AS count
    FROM resolved r
    LEFT JOIN public.vendor_entities ve
      ON ve.id = r.resolved_entity_id
    GROUP BY COALESCE(ve.canonical_name, r.vendor_name)
  )
  SELECT jsonb_build_object(
    'vendors',
    COALESCE(
      jsonb_agg(
        jsonb_build_object('name', g.name, 'count', g.count)
        ORDER BY g.count DESC
      ),
      '[]'::jsonb
    )
  )
  FROM grouped g;
$$;

-- 6) Harden v3 feed/profile display canonicalization.
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
        'vendorName', COALESCE(
          CASE
            WHEN ve.id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM public.resolve_vendor_family_name_only(vm.vendor_name) rv
               WHERE rv.vendor_entity_id = ve.id
             )
            THEN ve.canonical_name
            ELSE NULL
          END,
          vm.vendor_name,
          m->>'vendorName'
        ),
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
        'vendorName', COALESCE(
          CASE
            WHEN ve.id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM public.resolve_vendor_family_name_only(vm.vendor_name) rv
               WHERE rv.vendor_entity_id = ve.id
             )
            THEN ve.canonical_name
            ELSE NULL
          END,
          vm.vendor_name,
          m->>'vendorName'
        ),
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

GRANT EXECUTE ON FUNCTION public.resolve_vendor_family_name_only(TEXT) TO authenticated, anon, service_role;
