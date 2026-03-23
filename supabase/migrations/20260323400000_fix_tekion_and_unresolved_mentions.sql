-- ============================================================
-- Fix unresolved mentions: re-run entity tagging using
-- resolve_vendor_family for all mentions missing entity_id
-- ============================================================

-- 1) Tag ALL unresolved mentions using resolve_vendor_family (fuzzy)
WITH to_update AS (
  SELECT vm.id,
         r.vendor_entity_id,
         r.vendor_product_line_id
  FROM public.vendor_mentions vm
  CROSS JOIN LATERAL public.resolve_vendor_family(
    vm.vendor_name, vm.title, vm.quote, vm.explanation
  ) r
  WHERE vm.vendor_entity_id IS NULL
    AND r.vendor_entity_id IS NOT NULL
)
UPDATE public.vendor_mentions vm
SET vendor_entity_id = tu.vendor_entity_id,
    vendor_product_line_id = COALESCE(vm.vendor_product_line_id, tu.vendor_product_line_id)
FROM to_update tu
WHERE vm.id = tu.id;

-- 2) Specifically fix any Tekion variants that slipped through
UPDATE public.vendor_mentions
SET vendor_entity_id = (SELECT id FROM public.vendor_entities WHERE canonical_name = 'Tekion')
WHERE lower(vendor_name) LIKE '%tekion%'
  AND vendor_entity_id IS NULL;

-- 3) Check: how many mentions still have no entity but match a known alias?
-- (logged for diagnostics, no action)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.vendor_mentions vm
  JOIN public.vendor_alias_mappings am ON lower(vm.vendor_name) = am.alias_text
  WHERE vm.vendor_entity_id IS NULL;

  IF v_count > 0 THEN
    RAISE NOTICE '% mentions still unresolved despite matching an alias', v_count;
  ELSE
    RAISE NOTICE 'All alias-matching mentions are resolved';
  END IF;
END;
$$;
