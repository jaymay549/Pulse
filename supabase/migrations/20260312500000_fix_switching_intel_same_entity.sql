-- Fix get_vendor_switching_intel to exclude same-entity product lines.
-- Previously, only text-normalization was used (_norm_vendor), so CDK product
-- lines like "Elead" and "Roadster" appeared as competitors on CDK's profile.
-- Now we also load all alias texts for the resolved entity and exclude them.

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

  -- Helper: returns TRUE when an other_vendor string should be excluded
  -- (matches self by text OR resolves to the same entity via alias)
  -- Used inline in every WHERE clause below.

  -- Count totals (exclude self-references and same-entity products)
  SELECT COUNT(*) INTO to_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'to'
    AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm
    AND (
      v_entity_alias_norms IS NULL OR
      NOT (public._norm_vendor(switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
    );

  SELECT COUNT(*) INTO from_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'from'
    AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm
    AND (
      v_entity_alias_norms IS NULL OR
      NOT (public._norm_vendor(switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
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
        public._norm_vendor(switching_signal->>'other_vendor') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'to'
        AND switching_signal->>'other_vendor' IS NOT NULL
        AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm
        AND (
          v_entity_alias_norms IS NULL OR
          NOT (public._norm_vendor(switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
        )
      GROUP BY public._norm_vendor(switching_signal->>'other_vendor')
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
        public._norm_vendor(switching_signal->>'other_vendor') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'from'
        AND switching_signal->>'other_vendor' IS NOT NULL
        AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm
        AND (
          v_entity_alias_norms IS NULL OR
          NOT (public._norm_vendor(switching_signal->>'other_vendor') = ANY(v_entity_alias_norms))
        )
      GROUP BY public._norm_vendor(switching_signal->>'other_vendor')
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
