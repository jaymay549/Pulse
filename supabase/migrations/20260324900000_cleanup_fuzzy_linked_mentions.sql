-- ============================================================
-- Cleanup mentions that were wrongly linked by fuzzy matching.
-- Clear vendor_entity_id where vendor_name doesn't have an
-- exact alias mapping or exact canonical name match.
-- ============================================================

UPDATE public.vendor_mentions vm
SET vendor_entity_id = NULL
WHERE vm.vendor_entity_id IS NOT NULL
  AND NOT EXISTS (
    -- Check exact alias mapping
    SELECT 1 FROM public.vendor_alias_mappings am
    WHERE am.vendor_entity_id = vm.vendor_entity_id
      AND lower(am.alias_text) = lower(vm.vendor_name)
  )
  AND NOT EXISTS (
    -- Check exact canonical name
    SELECT 1 FROM public.vendor_entities ve
    WHERE ve.id = vm.vendor_entity_id
      AND lower(ve.canonical_name) = lower(vm.vendor_name)
  );
