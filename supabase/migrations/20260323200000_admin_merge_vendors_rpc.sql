-- ============================================================
-- Admin Merge Vendors RPC
-- Consolidates vendor merge into the vendor_entities +
-- vendor_alias_mappings system so that future ingested mentions
-- are automatically resolved by the existing INSERT trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_merge_vendors(
  p_canonical_name TEXT,
  p_aliases TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID;
  v_slug TEXT;
  v_alias TEXT;
  v_alias_count INTEGER := 0;
  v_mention_count INTEGER := 0;
BEGIN
  -- 1) Ensure a vendor_entity exists for the canonical name
  v_slug := public._slugify_vendor_token(p_canonical_name);

  INSERT INTO public.vendor_entities (canonical_name, slug, is_active)
  VALUES (p_canonical_name, v_slug, true)
  ON CONFLICT (canonical_name) DO UPDATE
    SET is_active = true, updated_at = now()
  RETURNING id INTO v_entity_id;

  -- Handle slug conflict (different canonical_name, same slug)
  IF v_entity_id IS NULL THEN
    SELECT id INTO v_entity_id
    FROM public.vendor_entities
    WHERE canonical_name = p_canonical_name;
  END IF;

  -- 2) Register the canonical name itself as an alias (so exact matches resolve)
  INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, vendor_product_line_id, confidence, source)
  VALUES (lower(p_canonical_name), v_entity_id, NULL, 1.0, 'manual')
  ON CONFLICT (alias_text) DO UPDATE
    SET vendor_entity_id = EXCLUDED.vendor_entity_id,
        confidence = GREATEST(public.vendor_alias_mappings.confidence, EXCLUDED.confidence);

  -- 3) Register each alias variant
  FOREACH v_alias IN ARRAY p_aliases
  LOOP
    IF v_alias IS NOT NULL AND trim(v_alias) <> '' THEN
      INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, vendor_product_line_id, confidence, source)
      VALUES (lower(trim(v_alias)), v_entity_id, NULL, 1.0, 'manual')
      ON CONFLICT (alias_text) DO UPDATE
        SET vendor_entity_id = EXCLUDED.vendor_entity_id,
            confidence = GREATEST(public.vendor_alias_mappings.confidence, EXCLUDED.confidence);
      v_alias_count := v_alias_count + 1;
    END IF;
  END LOOP;

  -- 4) Point all existing vendor_mentions for these names to the entity
  UPDATE public.vendor_mentions
  SET vendor_entity_id = v_entity_id
  WHERE vendor_entity_id IS DISTINCT FROM v_entity_id
    AND (
      lower(vendor_name) = lower(p_canonical_name)
      OR lower(vendor_name) = ANY (
        SELECT lower(unnest) FROM unnest(p_aliases)
      )
    );
  GET DIAGNOSTICS v_mention_count = ROW_COUNT;

  -- 5) Normalize vendor_name on existing mentions to the canonical spelling
  UPDATE public.vendor_mentions
  SET vendor_name = p_canonical_name
  WHERE vendor_entity_id = v_entity_id
    AND vendor_name IS DISTINCT FROM p_canonical_name;

  RETURN jsonb_build_object(
    'entity_id', v_entity_id,
    'canonical_name', p_canonical_name,
    'aliases_registered', v_alias_count,
    'mentions_updated', v_mention_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_merge_vendors(TEXT, TEXT[]) TO authenticated, service_role;
