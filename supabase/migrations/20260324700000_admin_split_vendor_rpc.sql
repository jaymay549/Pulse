-- ============================================================
-- Admin Split Vendor RPC
-- Detaches vendor names from a vendor entity, undoing a merge.
-- Removes alias mappings and clears vendor_entity_id on mentions.
-- ============================================================

-- 1) Split: detach specific vendor names from an entity
CREATE OR REPLACE FUNCTION public.admin_split_vendor(
  p_vendor_names TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
  v_alias_count INTEGER := 0;
  v_mention_count INTEGER := 0;
BEGIN
  FOREACH v_name IN ARRAY p_vendor_names
  LOOP
    -- Remove alias mapping
    DELETE FROM public.vendor_alias_mappings
    WHERE alias_text = lower(trim(v_name));
    v_alias_count := v_alias_count + 1;

    -- Clear entity_id on mentions for this vendor name
    UPDATE public.vendor_mentions
    SET vendor_entity_id = NULL
    WHERE lower(vendor_name) = lower(trim(v_name))
      AND vendor_entity_id IS NOT NULL;
    GET DIAGNOSTICS v_mention_count = ROW_COUNT;
  END LOOP;

  RETURN jsonb_build_object(
    'split_count', array_length(p_vendor_names, 1),
    'aliases_removed', v_alias_count,
    'mentions_detached', v_mention_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_split_vendor(TEXT[]) TO authenticated, service_role;

-- 2) List entity members: show all vendors linked to an entity
CREATE OR REPLACE FUNCTION public.admin_get_entity_members(
  p_vendor_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID;
  v_canonical TEXT;
  v_members JSONB;
BEGIN
  -- Resolve entity
  SELECT ve.id, ve.canonical_name
  INTO v_entity_id, v_canonical
  FROM public.vendor_alias_mappings vam
  JOIN public.vendor_entities ve ON ve.id = vam.vendor_entity_id
  WHERE vam.alias_text = lower(p_vendor_name)
  LIMIT 1;

  IF v_entity_id IS NULL THEN
    -- Try direct entity lookup
    SELECT id, canonical_name
    INTO v_entity_id, v_canonical
    FROM public.vendor_entities
    WHERE lower(canonical_name) = lower(p_vendor_name);
  END IF;

  IF v_entity_id IS NULL THEN
    RETURN jsonb_build_object(
      'entity_id', NULL,
      'canonical_name', NULL,
      'members', '[]'::jsonb
    );
  END IF;

  -- Get all members: aliases + mention counts
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'vendor_name', m.vendor_name,
      'mention_count', m.cnt,
      'is_canonical', lower(m.vendor_name) = lower(v_canonical),
      'alias_source', COALESCE(vam.source, 'inferred')
    ) ORDER BY m.cnt DESC
  ), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT vendor_name, COUNT(*) AS cnt
    FROM public.vendor_mentions
    WHERE vendor_entity_id = v_entity_id
    GROUP BY vendor_name
  ) m
  LEFT JOIN public.vendor_alias_mappings vam
    ON vam.alias_text = lower(m.vendor_name)
    AND vam.vendor_entity_id = v_entity_id;

  RETURN jsonb_build_object(
    'entity_id', v_entity_id,
    'canonical_name', v_canonical,
    'members', v_members
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_entity_members(TEXT) TO authenticated, service_role;
