-- ============================================================
-- Fix WR-03: Alias ON CONFLICT guard to prevent rerouting
--
-- Migration 20260416200000 step 7 used:
--   ON CONFLICT (alias_text) DO UPDATE
--     SET vendor_entity_id = EXCLUDED.vendor_entity_id, ...
--
-- This silently overwrites the vendor_entity_id of any existing alias
-- row that matched alias_text but belonged to a different entity,
-- rerouting all future mention lookups for that alias to the new entity.
--
-- This migration:
--   1. Repairs any aliases that may have been incorrectly rerouted by
--      the original migration by restoring them from vendor_entities
--      where we can determine the correct owner (alias_text matches
--      canonical_name of a different entity).
--   2. Re-runs the canonical-alias registration with the corrected
--      ON CONFLICT clause that only updates confidence (not entity_id),
--      so aliases that already belong to the correct entity get their
--      confidence refreshed without risk of rerouting.
--
-- NOTE: Step 1 can only repair aliases where the correct owner is
-- unambiguous (alias_text = lower(canonical_name) of exactly one
-- active entity). Ambiguous cases are left for manual review.
-- ============================================================

-- Step 1: Restore incorrectly rerouted aliases
-- An alias was potentially rerouted if:
--   - Its alias_text equals lower(canonical_name) of a DIFFERENT active entity
--   - The current vendor_entity_id does not match that entity
-- We can only safely repair cases where exactly one active entity owns
-- that canonical name as its own alias.
UPDATE public.vendor_alias_mappings am
SET vendor_entity_id = correct.id,
    confidence       = GREATEST(am.confidence, 1.0)
FROM (
  SELECT lower(ve.canonical_name) AS alias_text, ve.id
  FROM public.vendor_entities ve
  WHERE ve.is_active = true
    -- Only include canonical names that are unambiguously owned by one entity
    AND (
      SELECT COUNT(*) FROM public.vendor_entities ve2
      WHERE lower(ve2.canonical_name) = lower(ve.canonical_name)
        AND ve2.is_active = true
    ) = 1
) correct
WHERE am.alias_text = correct.alias_text
  AND am.vendor_entity_id IS DISTINCT FROM correct.id;

-- Step 2: Re-register canonical names as lowercase aliases using the
-- corrected conflict clause (update confidence only, not entity_id)
INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, confidence, source)
SELECT lower(ve.canonical_name), ve.id, 1.0, 'manual'
FROM public.vendor_entities ve
WHERE ve.is_active = true
ON CONFLICT (alias_text) DO UPDATE
  SET confidence = GREATEST(vendor_alias_mappings.confidence, EXCLUDED.confidence)
  WHERE vendor_alias_mappings.vendor_entity_id = EXCLUDED.vendor_entity_id;
