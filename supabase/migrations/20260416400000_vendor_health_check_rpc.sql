-- ============================================================
-- Vendor Data Health Check RPC
--
-- Provides a comprehensive read-only report of vendor data quality
-- for use as both a post-migration validator (should return
-- healthy: true after Plan 02 Task 1 runs) and an ongoing
-- monitoring tool for admins.
--
-- Returns a JSONB object with:
--   healthy              — overall boolean (true = all checks pass)
--   total_mentions       — count of non-hidden vendor_mentions
--   linked_mentions      — count with non-NULL vendor_entity_id
--   unlinked_mentions    — count with NULL vendor_entity_id
--   link_rate_percent    — linked / total * 100 (1 decimal)
--   top_unlinked_names   — top 20 unlinked vendor names by frequency
--   orphan_metadata      — vendor_metadata rows not linked to any entity or alias
--   orphan_profiles      — vendor_profiles rows not linked to any entity or alias
--   duplicate_entities   — active vendor_entities with duplicate lower(canonical_name)
--   invalid_parent_child — product_lines referencing inactive or non-existent entities
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_vendor_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_mentions       INTEGER;
  v_linked_mentions      INTEGER;
  v_unlinked_mentions    INTEGER;
  v_unlinked_names       JSONB;
  v_orphan_metadata      JSONB;
  v_orphan_profiles      JSONB;
  v_duplicate_entities   JSONB;
  v_invalid_parent_child JSONB;
  v_healthy              BOOLEAN;
BEGIN
  -- ── Mention linkage counts ────────────────────────────────────
  SELECT COUNT(*) INTO v_total_mentions
  FROM public.vendor_mentions
  WHERE is_hidden = false;

  SELECT COUNT(*) INTO v_linked_mentions
  FROM public.vendor_mentions
  WHERE is_hidden = false
    AND vendor_entity_id IS NOT NULL;

  v_unlinked_mentions := v_total_mentions - v_linked_mentions;

  -- ── Top 20 unlinked vendor names by frequency ─────────────────
  SELECT COALESCE(
    jsonb_agg(row_to_json(t)::jsonb ORDER BY t.mention_count DESC),
    '[]'::jsonb
  )
  INTO v_unlinked_names
  FROM (
    SELECT vendor_name, COUNT(*) AS mention_count
    FROM public.vendor_mentions
    WHERE is_hidden = false
      AND vendor_entity_id IS NULL
    GROUP BY vendor_name
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ) t;

  -- ── Orphan vendor_metadata ─────────────────────────────────────
  -- vendor_metadata rows whose vendor_name does not match any
  -- active canonical_name or any alias_text (case-insensitive).
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('vendor_name', vm.vendor_name)),
    '[]'::jsonb
  )
  INTO v_orphan_metadata
  FROM public.vendor_metadata vm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vendor_entities ve
    WHERE lower(ve.canonical_name) = lower(vm.vendor_name)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_alias_mappings am
    WHERE lower(am.alias_text) = lower(vm.vendor_name)
  );

  -- ── Orphan vendor_profiles ─────────────────────────────────────
  -- vendor_profiles rows whose vendor_name does not match any
  -- active canonical_name or any alias_text (case-insensitive).
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('vendor_name', vp.vendor_name, 'user_id', vp.user_id)),
    '[]'::jsonb
  )
  INTO v_orphan_profiles
  FROM public.vendor_profiles vp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vendor_entities ve
    WHERE lower(ve.canonical_name) = lower(vp.vendor_name)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_alias_mappings am
    WHERE lower(am.alias_text) = lower(vp.vendor_name)
  );

  -- ── Duplicate active entities ──────────────────────────────────
  -- Active vendor_entities that share the same lower(canonical_name).
  -- Should be 0 after Plan 02 merge pass.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('canonical_name', lower(canonical_name), 'count', cnt)),
    '[]'::jsonb
  )
  INTO v_duplicate_entities
  FROM (
    SELECT lower(canonical_name) AS canonical_name, COUNT(*) AS cnt
    FROM public.vendor_entities
    WHERE is_active = true
    GROUP BY lower(canonical_name)
    HAVING COUNT(*) > 1
  ) t;

  -- ── Invalid parent/child relationships ────────────────────────
  -- vendor_product_lines referencing inactive or non-existent entities.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'product_line_id',   vpl.id,
      'product_line_name', vpl.name,
      'vendor_entity_id',  vpl.vendor_entity_id,
      'entity_active',     ve.is_active
    )),
    '[]'::jsonb
  )
  INTO v_invalid_parent_child
  FROM public.vendor_product_lines vpl
  LEFT JOIN public.vendor_entities ve ON ve.id = vpl.vendor_entity_id
  WHERE ve.id IS NULL OR ve.is_active = false;

  -- ── Overall health determination ──────────────────────────────
  -- healthy = true only when all four problem arrays are empty
  -- AND there are no unlinked mentions.
  v_healthy := (v_unlinked_mentions = 0)
    AND (v_orphan_metadata      = '[]'::jsonb)
    AND (v_orphan_profiles      = '[]'::jsonb)
    AND (v_duplicate_entities   = '[]'::jsonb)
    AND (v_invalid_parent_child = '[]'::jsonb);

  RETURN jsonb_build_object(
    'healthy',              v_healthy,
    'total_mentions',       v_total_mentions,
    'linked_mentions',      v_linked_mentions,
    'unlinked_mentions',    v_unlinked_mentions,
    'link_rate_percent',    CASE
                              WHEN v_total_mentions = 0 THEN 100
                              ELSE ROUND((v_linked_mentions::NUMERIC / v_total_mentions::NUMERIC) * 100, 1)
                            END,
    'top_unlinked_names',   v_unlinked_names,
    'orphan_metadata',      v_orphan_metadata,
    'orphan_profiles',      v_orphan_profiles,
    'duplicate_entities',   v_duplicate_entities,
    'invalid_parent_child', v_invalid_parent_child
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_vendor_health_check() TO authenticated, service_role;
