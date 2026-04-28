-- ============================================================
-- Vendor Dedup Audit RPC
-- Provides a comprehensive read-only audit of vendor data for
-- duplicate detection, unlinked mentions, orphan metadata,
-- and orphan profiles — the diagnostic foundation before
-- running any dedup/merge operations.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_audit_vendor_duplicates()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_duplicate_groups   JSONB;
  v_unlinked_vendors   JSONB;
  v_orphan_metadata    JSONB;
  v_orphan_profiles    JSONB;
  v_stats              JSONB;
BEGIN
  -- ── Duplicate groups ──────────────────────────────────────
  -- Groups where the same normalized name (lower + trim) has
  -- multiple distinct vendor_entity_id values (including NULL)
  -- OR multiple distinct raw spellings.
  WITH name_groups AS (
    SELECT lower(trim(vendor_name))   AS norm_name,
           vendor_entity_id,
           vendor_name,
           COUNT(*)::INTEGER          AS mention_count
    FROM public.vendor_mentions
    WHERE is_hidden = false
    GROUP BY lower(trim(vendor_name)), vendor_entity_id, vendor_name
  ),
  multi_entity_names AS (
    SELECT norm_name
    FROM name_groups
    GROUP BY norm_name
    HAVING COUNT(DISTINCT COALESCE(vendor_entity_id::TEXT, 'NULL')) > 1
        OR COUNT(DISTINCT vendor_name) > 1
  ),
  group_variants AS (
    SELECT
      ng.norm_name,
      jsonb_build_object(
        'vendor_name',      ng.vendor_name,
        'vendor_entity_id', ng.vendor_entity_id,
        'canonical_name',   ve.canonical_name,
        'mention_count',    ng.mention_count
      ) AS variant,
      ng.mention_count
    FROM name_groups ng
    JOIN multi_entity_names men ON men.norm_name = ng.norm_name
    LEFT JOIN public.vendor_entities ve ON ve.id = ng.vendor_entity_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'normalized_name', g.norm_name,
        'variants',        g.variants,
        'total_mentions',  g.total_mentions
      )
      ORDER BY g.total_mentions DESC
    ),
    '[]'::JSONB
  )
  INTO v_duplicate_groups
  FROM (
    SELECT
      norm_name,
      jsonb_agg(variant ORDER BY mention_count DESC) AS variants,
      SUM(mention_count)::INTEGER                    AS total_mentions
    FROM group_variants
    GROUP BY norm_name
  ) g;

  -- ── Unlinked vendors ──────────────────────────────────────
  -- Distinct vendor_name values in vendor_mentions that have
  -- no vendor_entity_id, ordered by mention count descending.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'vendor_name',   u.vendor_name,
        'mention_count', u.mention_count
      )
      ORDER BY u.mention_count DESC
    ),
    '[]'::JSONB
  )
  INTO v_unlinked_vendors
  FROM (
    SELECT vendor_name,
           COUNT(*)::INTEGER AS mention_count
    FROM public.vendor_mentions
    WHERE is_hidden = false
      AND vendor_entity_id IS NULL
    GROUP BY vendor_name
  ) u;

  -- ── Orphan metadata ──────────────────────────────────────
  -- vendor_metadata rows whose vendor_name does not match any
  -- canonical_name or alias_text (case-insensitive).
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'vendor_name',     vm.vendor_name,
        'has_logo',        (vm.logo_url IS NOT NULL AND vm.logo_url <> ''),
        'has_description', (vm.description IS NOT NULL AND vm.description <> '')
      )
      ORDER BY vm.vendor_name
    ),
    '[]'::JSONB
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

  -- ── Orphan profiles ──────────────────────────────────────
  -- vendor_profiles rows whose vendor_name does not match any
  -- canonical_name or alias_text (case-insensitive).
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'vendor_name', vp.vendor_name,
        'user_id',     vp.user_id,
        'is_approved', vp.is_approved
      )
      ORDER BY vp.vendor_name
    ),
    '[]'::JSONB
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

  -- ── Stats ────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'total_mentions',        total_mentions,
    'linked_mentions',       linked_mentions,
    'unlinked_mentions',     total_mentions - linked_mentions,
    'total_entities',        total_entities,
    'total_aliases',         total_aliases,
    'duplicate_group_count', jsonb_array_length(v_duplicate_groups)
  )
  INTO v_stats
  FROM (
    SELECT
      (SELECT COUNT(*)::INTEGER FROM public.vendor_mentions WHERE is_hidden = false)  AS total_mentions,
      (SELECT COUNT(*)::INTEGER FROM public.vendor_mentions WHERE is_hidden = false AND vendor_entity_id IS NOT NULL) AS linked_mentions,
      (SELECT COUNT(*)::INTEGER FROM public.vendor_entities)  AS total_entities,
      (SELECT COUNT(*)::INTEGER FROM public.vendor_alias_mappings) AS total_aliases
  ) counts;

  RETURN jsonb_build_object(
    'duplicate_groups',  v_duplicate_groups,
    'unlinked_vendors',  v_unlinked_vendors,
    'orphan_metadata',   v_orphan_metadata,
    'orphan_profiles',   v_orphan_profiles,
    'stats',             v_stats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_audit_vendor_duplicates() TO authenticated, service_role;
