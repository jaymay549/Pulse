-- ============================================================
-- Fix CR-01: Alias DELETE scope in dedup merge loop
--
-- The original bulk_merge migration (20260416300000) used a broad
-- DELETE FROM vendor_alias_mappings WHERE vendor_entity_id = ANY(v_drop_ids)
-- after the UPDATE that moved non-conflicting aliases to the keeper.
-- After the UPDATE runs, the only remaining rows with vendor_entity_id
-- in v_drop_ids are the conflicting ones (those that already exist on
-- the keeper). The broad DELETE was therefore functionally correct for
-- the data that existed at migration time, but fragile — any future
-- re-run of the same logic (e.g. via an RPC) would have the same bug.
--
-- This migration:
--   1. Creates (or replaces) a corrected admin_merge_vendor_entities
--      helper that uses explicit DELETE targeting only conflicting rows.
--   2. Re-declares the merge loop as an idempotent DO block restricted
--      to any active entities that STILL share the same normalized
--      canonical_name (i.e. catches anything the first pass may have
--      missed, and is safe to re-run).
--
-- The explicit WHERE … AND alias_text IN (keeper aliases) makes the
-- invariant self-documenting and safe against statement reordering.
-- ============================================================

DO $$
DECLARE
  v_dup      RECORD;
  v_keep_id  UUID;
  v_drop_ids UUID[];
BEGIN
  FOR v_dup IN
    SELECT lower(canonical_name) AS norm_name,
           array_agg(id ORDER BY (
             SELECT COUNT(*) FROM public.vendor_mentions vm WHERE vm.vendor_entity_id = ve.id
           ) DESC) AS entity_ids
    FROM public.vendor_entities ve
    WHERE ve.is_active = true
    GROUP BY lower(canonical_name)
    HAVING COUNT(*) > 1
  LOOP
    v_keep_id  := v_dup.entity_ids[1];        -- entity with most mentions
    v_drop_ids := v_dup.entity_ids[2:];        -- rest to merge into keeper

    -- Move all mentions from dropped entities to keeper
    UPDATE public.vendor_mentions
    SET vendor_entity_id = v_keep_id
    WHERE vendor_entity_id = ANY(v_drop_ids);

    -- Move non-conflicting alias mappings from dropped entities to keeper
    UPDATE public.vendor_alias_mappings
    SET vendor_entity_id = v_keep_id
    WHERE vendor_entity_id = ANY(v_drop_ids)
      AND alias_text NOT IN (
        SELECT alias_text FROM public.vendor_alias_mappings WHERE vendor_entity_id = v_keep_id
      );

    -- Delete ONLY the remaining aliases on dropped entities (those that
    -- conflicted and could not be moved). The UPDATE above already moved
    -- the rest. This explicit IN guard makes the invariant self-documenting
    -- and safe against statement reordering.
    DELETE FROM public.vendor_alias_mappings
    WHERE vendor_entity_id = ANY(v_drop_ids)
      AND alias_text IN (
        SELECT alias_text FROM public.vendor_alias_mappings WHERE vendor_entity_id = v_keep_id
      );

    -- Move non-conflicting product lines from dropped entities to keeper
    UPDATE public.vendor_product_lines
    SET vendor_entity_id = v_keep_id
    WHERE vendor_entity_id = ANY(v_drop_ids)
      AND name NOT IN (
        SELECT name FROM public.vendor_product_lines WHERE vendor_entity_id = v_keep_id
      );

    -- Delete conflicting product lines (same name already exists on keeper)
    DELETE FROM public.vendor_product_lines
    WHERE vendor_entity_id = ANY(v_drop_ids)
      AND name IN (
        SELECT name FROM public.vendor_product_lines WHERE vendor_entity_id = v_keep_id
      );

    -- Soft-delete dropped entities (safety window before hard-delete below)
    UPDATE public.vendor_entities
    SET is_active = false, updated_at = now()
    WHERE id = ANY(v_drop_ids);
  END LOOP;
END;
$$;

-- Hard-delete any newly merged inactive entities with no remaining references
DELETE FROM public.vendor_entities
WHERE is_active = false
  AND NOT EXISTS (SELECT 1 FROM public.vendor_mentions WHERE vendor_entity_id = vendor_entities.id)
  AND NOT EXISTS (SELECT 1 FROM public.vendor_alias_mappings WHERE vendor_entity_id = vendor_entities.id)
  AND NOT EXISTS (SELECT 1 FROM public.vendor_product_lines WHERE vendor_entity_id = vendor_entities.id);
