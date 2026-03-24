-- ============================================================
-- Fix competitive movement: resolve other_vendor via entity lookup
--
-- Problem: get_vendor_switching_intel only excludes same-entity
-- products when they match a known alias via _norm_vendor().
-- AI enrichment can extract any vendor name variant (e.g.
-- "Tekion Digital Retail") that isn't in vendor_alias_mappings,
-- causing a vendor to show gains/losses from its own products.
--
-- Fix: Instead of relying solely on text normalization, also
-- resolve each other_vendor through resolve_vendor_family_name_only
-- and exclude when it resolves to the same entity_id.
--
-- Also adds missing Tekion aliases as an immediate data fix.
-- ============================================================

-- ── 1) Add missing Tekion product-line aliases ───────────────
INSERT INTO public.vendor_product_lines (vendor_entity_id, name, slug, is_active)
SELECT ve.id, v.name, v.slug, true
FROM public.vendor_entities ve
CROSS JOIN (
  VALUES
    ('Tekion Digital Retail', 'tekion-digital-retail')
) AS v(name, slug)
WHERE ve.canonical_name = 'Tekion'
ON CONFLICT (vendor_entity_id, name)
DO UPDATE SET slug = EXCLUDED.slug, is_active = true, updated_at = now();

INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, vendor_product_line_id, confidence, source)
SELECT
  a.alias_text,
  ve.id AS vendor_entity_id,
  vpl.id AS vendor_product_line_id,
  a.confidence,
  a.source
FROM (
  VALUES
    ('tekion digital retail', 'Tekion', 'tekion-digital-retail', 1.0::numeric, 'manual'),
    ('tekion digital', 'Tekion', 'tekion-digital-retail', 0.95::numeric, 'manual')
) AS a(alias_text, canonical_name, product_slug, confidence, source)
JOIN public.vendor_entities ve
  ON ve.canonical_name = a.canonical_name
JOIN public.vendor_product_lines vpl
  ON vpl.vendor_entity_id = ve.id
 AND vpl.slug = a.product_slug
ON CONFLICT (alias_text)
DO UPDATE SET
  vendor_entity_id = EXCLUDED.vendor_entity_id,
  vendor_product_line_id = EXCLUDED.vendor_product_line_id,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source;

-- ── 2) Rewrite get_vendor_switching_intel with entity-based exclusion ──
CREATE OR REPLACE FUNCTION public.get_vendor_switching_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  to_count BIGINT;
  from_count BIGINT;
  to_sources JSONB;
  from_destinations JSONB;
  self_norm TEXT := public._norm_vendor(p_vendor_name);
  v_entity_id UUID;
  v_entity_alias_norms TEXT[];
BEGIN
  -- Resolve to entity so we can exclude all same-entity product lines
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  -- Collect all normalized alias texts that belong to this entity
  IF v_entity_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT public._norm_vendor(am.alias_text))
    INTO v_entity_alias_norms
    FROM public.vendor_alias_mappings am
    WHERE am.vendor_entity_id = v_entity_id;
  END IF;

  -- Helper inline: _is_same_entity checks if other_vendor belongs to
  -- the same entity by:
  --   a) normalized text matches self or any alias, OR
  --   b) resolve_vendor_family_name_only resolves to same entity_id

  -- Count totals (exclude self-references and same-entity products)
  SELECT COUNT(*) INTO to_count
  FROM public.vendor_mentions vm
  WHERE vm.vendor_name = p_vendor_name
    AND vm.switching_signal->>'direction' = 'to'
    AND public._norm_vendor(vm.switching_signal->>'other_vendor') <> self_norm
    AND (
      v_entity_alias_norms IS NULL OR
      NOT (public._norm_vendor(vm.switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
    )
    AND (
      v_entity_id IS NULL OR
      NOT EXISTS (
        SELECT 1
        FROM public.resolve_vendor_family_name_only(vm.switching_signal->>'other_vendor') ov
        WHERE ov.vendor_entity_id = v_entity_id
      )
    );

  SELECT COUNT(*) INTO from_count
  FROM public.vendor_mentions vm
  WHERE vm.vendor_name = p_vendor_name
    AND vm.switching_signal->>'direction' = 'from'
    AND public._norm_vendor(vm.switching_signal->>'other_vendor') <> self_norm
    AND (
      v_entity_alias_norms IS NULL OR
      NOT (public._norm_vendor(vm.switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
    )
    AND (
      v_entity_id IS NULL OR
      NOT EXISTS (
        SELECT 1
        FROM public.resolve_vendor_family_name_only(vm.switching_signal->>'other_vendor') ov
        WHERE ov.vendor_entity_id = v_entity_id
      )
    );

  -- Aggregate to_sources (gained from)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vendor', d.display_name, 'count', d.cnt)
    ORDER BY d.cnt DESC
  ), '[]'::jsonb)
  INTO to_sources
  FROM (
    SELECT
      COALESCE(
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE public._norm_vendor(vm2.vendor_name) = grp.norm_key
         LIMIT 1),
        grp.best_variant
      ) AS display_name,
      grp.cnt
    FROM (
      SELECT
        public._norm_vendor(vm.switching_signal->>'other_vendor') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY vm.switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions vm
      WHERE vm.vendor_name = p_vendor_name
        AND vm.switching_signal->>'direction' = 'to'
        AND vm.switching_signal->>'other_vendor' IS NOT NULL
        AND public._norm_vendor(vm.switching_signal->>'other_vendor') <> self_norm
        AND (
          v_entity_alias_norms IS NULL OR
          NOT (public._norm_vendor(vm.switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
        )
        AND (
          v_entity_id IS NULL OR
          NOT EXISTS (
            SELECT 1
            FROM public.resolve_vendor_family_name_only(vm.switching_signal->>'other_vendor') ov
            WHERE ov.vendor_entity_id = v_entity_id
          )
        )
      GROUP BY public._norm_vendor(vm.switching_signal->>'other_vendor')
    ) grp
  ) d;

  -- Aggregate from_destinations (lost to)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vendor', d.display_name, 'count', d.cnt)
    ORDER BY d.cnt DESC
  ), '[]'::jsonb)
  INTO from_destinations
  FROM (
    SELECT
      COALESCE(
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE public._norm_vendor(vm2.vendor_name) = grp.norm_key
         LIMIT 1),
        grp.best_variant
      ) AS display_name,
      grp.cnt
    FROM (
      SELECT
        public._norm_vendor(vm.switching_signal->>'other_vendor') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY vm.switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions vm
      WHERE vm.vendor_name = p_vendor_name
        AND vm.switching_signal->>'direction' = 'from'
        AND vm.switching_signal->>'other_vendor' IS NOT NULL
        AND public._norm_vendor(vm.switching_signal->>'other_vendor') <> self_norm
        AND (
          v_entity_alias_norms IS NULL OR
          NOT (public._norm_vendor(vm.switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
        )
        AND (
          v_entity_id IS NULL OR
          NOT EXISTS (
            SELECT 1
            FROM public.resolve_vendor_family_name_only(vm.switching_signal->>'other_vendor') ov
            WHERE ov.vendor_entity_id = v_entity_id
          )
        )
      GROUP BY public._norm_vendor(vm.switching_signal->>'other_vendor')
    ) grp
  ) d;

  RETURN jsonb_build_object(
    'switched_to', to_count,
    'switched_from', from_count,
    'to_sources', to_sources,
    'from_destinations', from_destinations
  );
END;
$$;
