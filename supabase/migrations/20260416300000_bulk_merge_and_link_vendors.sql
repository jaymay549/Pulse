-- ============================================================
-- Bulk Merge Duplicate Vendor Entities and Backfill Unlinked Mentions
--
-- This migration performs the actual deduplication pass after Plan 01
-- normalized all vendor name columns:
--
--   Step 1: Merge vendor_entities that share the same normalized
--           canonical_name (lower). Keep the entity with the most
--           mentions (richest data); soft-delete the rest.
--
--   Step 2: Register all unlinked vendor_mention names as aliases
--           where an exact (case-insensitive) match can be found
--           against an active vendor_entity canonical_name.
--
--   Step 3: Run backfill_vendor_mentions_family() to link all
--           vendor_mentions rows that now have alias coverage.
--
--   Step 4: Normalize vendor_name on all linked mentions to match
--           their entity's canonical_name (IS DISTINCT FROM makes
--           this idempotent).
--
--   Step 5: Hard-delete inactive (merged) entities that have zero
--           remaining references — mentions, aliases, product lines.
--
-- All steps run inside the migration transaction. If any step fails
-- the entire migration rolls back cleanly.
-- ============================================================

-- ── Step 1: Merge duplicate vendor_entities ───────────────────
-- After name normalization, two entities may share the same
-- lower(canonical_name). We keep the one with the most mentions
-- (richest data) and move all references from the others into it.
-- Dropped entities are soft-deleted (is_active = false) before
-- hard-deletion in Step 5, providing a safety window.
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

    -- Delete alias mappings that would conflict (already exist on keeper)
    DELETE FROM public.vendor_alias_mappings
    WHERE vendor_entity_id = ANY(v_drop_ids);

    -- Move non-conflicting product lines from dropped entities to keeper
    UPDATE public.vendor_product_lines
    SET vendor_entity_id = v_keep_id
    WHERE vendor_entity_id = ANY(v_drop_ids)
      AND name NOT IN (
        SELECT name FROM public.vendor_product_lines WHERE vendor_entity_id = v_keep_id
      );

    -- Delete conflicting product lines (same name already exists on keeper)
    DELETE FROM public.vendor_product_lines
    WHERE vendor_entity_id = ANY(v_drop_ids);

    -- Soft-delete dropped entities (safety window before hard-delete in Step 5)
    UPDATE public.vendor_entities
    SET is_active = false, updated_at = now()
    WHERE id = ANY(v_drop_ids);
  END LOOP;
END;
$$;

-- ── Step 2: Register unlinked vendor names as aliases ─────────
-- For any vendor_mention that is still unlinked (vendor_entity_id IS NULL),
-- if its vendor_name exactly matches (case-insensitive) the canonical_name
-- of an active vendor_entity, register that name as an alias so the
-- backfill in Step 3 can resolve it.
INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, confidence, source)
SELECT DISTINCT lower(vm.vendor_name), ve.id, 0.95, 'manual'
FROM public.vendor_mentions vm
JOIN public.vendor_entities ve
  ON lower(vm.vendor_name) = lower(ve.canonical_name)
WHERE vm.vendor_entity_id IS NULL
  AND ve.is_active = true
ON CONFLICT (alias_text) DO UPDATE
  SET vendor_entity_id = EXCLUDED.vendor_entity_id,
      confidence = GREATEST(vendor_alias_mappings.confidence, EXCLUDED.confidence);

-- ── Step 3: Backfill vendor_mentions using alias mappings ─────
-- Run backfill_vendor_mentions_family with no limit so every
-- unlinked mention whose vendor_name has an alias (registered
-- above or pre-existing) gets its vendor_entity_id set.
SELECT public.backfill_vendor_mentions_family(NULL);

-- ── Step 4: Normalize vendor_name on all linked mentions ──────
-- Ensure vendor_mentions.vendor_name matches the canonical spelling
-- of the linked entity. IS DISTINCT FROM makes this idempotent.
UPDATE public.vendor_mentions vm
SET vendor_name = ve.canonical_name
FROM public.vendor_entities ve
WHERE vm.vendor_entity_id = ve.id
  AND vm.vendor_name IS DISTINCT FROM ve.canonical_name
  AND ve.is_active = true;

-- ── Step 5: Hard-delete merged (inactive) entities ────────────
-- Remove inactive entities that have no remaining references.
-- Entities that still have mentions, aliases, or product lines
-- pointing to them are left in place (soft-deleted state) for
-- manual review.
DELETE FROM public.vendor_entities
WHERE is_active = false
  AND NOT EXISTS (SELECT 1 FROM public.vendor_mentions WHERE vendor_entity_id = vendor_entities.id)
  AND NOT EXISTS (SELECT 1 FROM public.vendor_alias_mappings WHERE vendor_entity_id = vendor_entities.id)
  AND NOT EXISTS (SELECT 1 FROM public.vendor_product_lines WHERE vendor_entity_id = vendor_entities.id);
