-- ============================================================
-- Backfill: Tag unresolved vendor_mentions with their entity
-- using existing vendor_alias_mappings, then normalize names.
-- ============================================================

-- 1) Tag mentions that match a known alias but have no entity set
UPDATE public.vendor_mentions vm
SET vendor_entity_id = am.vendor_entity_id,
    vendor_product_line_id = COALESCE(vm.vendor_product_line_id, am.vendor_product_line_id)
FROM public.vendor_alias_mappings am
WHERE lower(vm.vendor_name) = am.alias_text
  AND vm.vendor_entity_id IS NULL;

-- 2) Normalize vendor_name to canonical spelling
UPDATE public.vendor_mentions vm
SET vendor_name = ve.canonical_name
FROM public.vendor_entities ve
WHERE vm.vendor_entity_id = ve.id
  AND vm.vendor_name IS DISTINCT FROM ve.canonical_name;

-- 3) Run the full family backfill (fuzzy matching via resolve_vendor_family)
SELECT public.backfill_vendor_mentions_family();
