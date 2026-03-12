-- Split "dms-crm" into "dms" and "crm" categories.
--
-- Strategy:
--   • Pure DMS vendors → category = 'dms'
--   • Pure CRM vendors → category = 'crm'
--   • Dual-positioned vendors (CDK, DealerSocket, Dealertrack, Frazer) keep 'dms-crm'
--
-- The updated RPC treats 'dms-crm' as matching BOTH the 'dms' and 'crm' filter pills,
-- so dual vendors surface correctly under either category.

-- ── 1. Classify vendor_mentions ──────────────────────────────────────────────

UPDATE public.vendor_mentions
SET category = 'dms'
WHERE category = 'dms-crm'
  AND (
    vendor_name ILIKE '%reynolds%'
    OR vendor_name ILIKE '%tekion%'
    OR vendor_name ILIKE '%quorum%'
    OR vendor_name ILIKE '%auto/mate%'
    OR vendor_name ILIKE '%automate%'
    OR vendor_name ILIKE '%pbs systems%'
    OR vendor_name ILIKE '%pbsystems%'
  );

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE category = 'dms-crm'
  AND (
    vendor_name ILIKE '%vinsolutions%'
    OR vendor_name ILIKE '%vin solutions%'
    OR vendor_name ILIKE '%elead%'
    OR vendor_name ILIKE '%dealerpeak%'
    OR vendor_name ILIKE '%activix%'
    OR vendor_name ILIKE '%dominion vue%'
    OR vendor_name ILIKE '%cardesk%'
    OR vendor_name ILIKE '%bkd%'
  );

-- ── 2. Classify vendor_profiles ──────────────────────────────────────────────

UPDATE public.vendor_profiles
SET category = 'dms'
WHERE category = 'dms-crm'
  AND (
    vendor_name ILIKE '%reynolds%'
    OR vendor_name ILIKE '%tekion%'
    OR vendor_name ILIKE '%quorum%'
    OR vendor_name ILIKE '%auto/mate%'
    OR vendor_name ILIKE '%automate%'
    OR vendor_name ILIKE '%pbs systems%'
    OR vendor_name ILIKE '%pbsystems%'
  );

UPDATE public.vendor_profiles
SET category = 'crm'
WHERE category = 'dms-crm'
  AND (
    vendor_name ILIKE '%vinsolutions%'
    OR vendor_name ILIKE '%vin solutions%'
    OR vendor_name ILIKE '%elead%'
    OR vendor_name ILIKE '%dealerpeak%'
    OR vendor_name ILIKE '%activix%'
    OR vendor_name ILIKE '%dominion vue%'
    OR vendor_name ILIKE '%cardesk%'
    OR vendor_name ILIKE '%bkd%'
  );

-- ── 3. Classify vendor_metadata (if table exists) ────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_metadata'
  ) THEN
    UPDATE public.vendor_metadata
    SET category = 'dms'
    WHERE category = 'dms-crm'
      AND (
        vendor_name ILIKE '%reynolds%'
        OR vendor_name ILIKE '%tekion%'
        OR vendor_name ILIKE '%quorum%'
        OR vendor_name ILIKE '%auto/mate%'
        OR vendor_name ILIKE '%automate%'
        OR vendor_name ILIKE '%pbs systems%'
        OR vendor_name ILIKE '%pbsystems%'
      );

    UPDATE public.vendor_metadata
    SET category = 'crm'
    WHERE category = 'dms-crm'
      AND (
        vendor_name ILIKE '%vinsolutions%'
        OR vendor_name ILIKE '%vin solutions%'
        OR vendor_name ILIKE '%elead%'
        OR vendor_name ILIKE '%dealerpeak%'
        OR vendor_name ILIKE '%activix%'
        OR vendor_name ILIKE '%dominion vue%'
        OR vendor_name ILIKE '%cardesk%'
        OR vendor_name ILIKE '%bkd%'
      );
  END IF;
END $$;

-- ── 4. Update get_vendor_pulse_feed_v2 to support inclusive dms/crm filtering ─
--
-- When p_category = 'dms': match category IN ('dms', 'dms-crm')
-- When p_category = 'crm': match category IN ('crm', 'dms-crm')
-- Category counts: merge dms-crm counts into both dms and crm buckets.

CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v2(
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
  v_entity_id UUID;
  v_product_line_id UUID;
  v_total_count INTEGER;
  v_total_positive_count INTEGER;
  v_total_warning_count INTEGER;
  v_total_system_count INTEGER;
  v_has_more BOOLEAN;
  v_mentions JSONB;
  v_category_counts JSONB;
BEGIN
  IF p_vendor_name IS NOT NULL THEN
    SELECT r.vendor_entity_id INTO v_entity_id
    FROM public.resolve_vendor_family(p_vendor_name) r
    LIMIT 1;
  END IF;

  IF p_product_line_slug IS NOT NULL AND p_product_line_slug <> '' THEN
    SELECT vpl.id INTO v_product_line_id
    FROM public.vendor_product_lines vpl
    WHERE vpl.slug = p_product_line_slug
      AND (v_entity_id IS NULL OR vpl.vendor_entity_id = v_entity_id)
    LIMIT 1;
  END IF;

  -- ── total counts ────────────────────────────────────────────────────────────
  WITH base AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND (
        p_category IS NULL
        OR vm.category = p_category
        OR (p_category IN ('dms', 'crm') AND vm.category = 'dms-crm')
      )
      AND (
        p_vendor_name IS NULL OR
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name)) OR
        (ve.id IS NULL AND lower(vm.vendor_name) LIKE '%' || lower(p_vendor_name) || '%')
      )
      AND (
        p_search IS NULL OR
        lower(coalesce(vm.vendor_name, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.title, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.quote, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.explanation, '')) LIKE '%' || lower(p_search) || '%'
      )
      AND (
        v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id
      )
  ),
  typed AS (
    SELECT *
    FROM base
    WHERE (p_type IS NULL OR type = p_type)
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE type = 'positive')::INTEGER,
    COUNT(*) FILTER (WHERE type = 'warning')::INTEGER,
    COUNT(*) FILTER (WHERE type = 'system')::INTEGER
  INTO
    v_total_count,
    v_total_positive_count,
    v_total_warning_count,
    v_total_system_count
  FROM typed;

  -- ── category counts (dms-crm merged into both dms and crm) ─────────────────
  WITH base AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND (
        p_category IS NULL
        OR vm.category = p_category
        OR (p_category IN ('dms', 'crm') AND vm.category = 'dms-crm')
      )
      AND (
        p_vendor_name IS NULL OR
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name)) OR
        (ve.id IS NULL AND lower(vm.vendor_name) LIKE '%' || lower(p_vendor_name) || '%')
      )
      AND (
        p_search IS NULL OR
        lower(coalesce(vm.vendor_name, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.title, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.quote, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.explanation, '')) LIKE '%' || lower(p_search) || '%'
      )
      AND (
        v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id
      )
  )
  SELECT COALESCE(
    jsonb_object_agg(cat, cnt),
    '{}'::jsonb
  )
  INTO v_category_counts
  FROM (
    -- All categories except dms/crm/dms-crm count as-is
    SELECT category AS cat, COUNT(*)::INTEGER AS cnt
    FROM base
    WHERE category NOT IN ('dms', 'crm', 'dms-crm')
    GROUP BY category
    UNION ALL
    -- dms pill = pure dms + dual dms-crm vendors
    SELECT 'dms'::TEXT, COUNT(*)::INTEGER
    FROM base WHERE category IN ('dms', 'dms-crm')
    UNION ALL
    -- crm pill = pure crm + dual dms-crm vendors
    SELECT 'crm'::TEXT, COUNT(*)::INTEGER
    FROM base WHERE category IN ('crm', 'dms-crm')
  ) cc
  WHERE cc.cnt > 0;

  -- ── paginated mention rows ───────────────────────────────────────────────────
  WITH base AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND (
        p_category IS NULL
        OR vm.category = p_category
        OR (p_category IN ('dms', 'crm') AND vm.category = 'dms-crm')
      )
      AND (
        p_vendor_name IS NULL OR
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name)) OR
        (ve.id IS NULL AND lower(vm.vendor_name) LIKE '%' || lower(p_vendor_name) || '%')
      )
      AND (
        p_search IS NULL OR
        lower(coalesce(vm.vendor_name, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.title, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.quote, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.explanation, '')) LIKE '%' || lower(p_search) || '%'
      )
      AND (
        v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id
      )
  ),
  typed AS (
    SELECT *
    FROM base
    WHERE (p_type IS NULL OR type = p_type)
    ORDER BY conversation_time DESC NULLS LAST, id DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'vendorName', t.vendor_name,
        'title', t.title,
        'quote', t.quote,
        'explanation', t.explanation,
        'type', t.type,
        'category', t.category,
        'conversationTime', t.conversation_time
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM typed t;

  v_has_more := (p_offset + p_limit) < COALESCE(v_total_count, 0);

  RETURN jsonb_build_object(
    'mentions', v_mentions,
    'totalCount', COALESCE(v_total_count, 0),
    'totalPositiveCount', COALESCE(v_total_positive_count, 0),
    'totalWarningCount', COALESCE(v_total_warning_count, 0),
    'totalSystemCount', COALESCE(v_total_system_count, 0),
    'categoryCounts', COALESCE(v_category_counts, '{}'::jsonb),
    'page', floor(p_offset / GREATEST(p_limit, 1))::INTEGER + 1,
    'pageSize', p_limit,
    'hasMore', v_has_more
  );
END;
$$;
