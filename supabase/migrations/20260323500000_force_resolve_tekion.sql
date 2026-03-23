-- ============================================================
-- Force-resolve all Tekion variants + diagnose unresolved
-- ============================================================

-- Diagnostic: show what Tekion mentions look like right now
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT vendor_name, vendor_entity_id IS NOT NULL AS has_entity, COUNT(*) AS cnt
    FROM public.vendor_mentions
    WHERE lower(vendor_name) LIKE '%tekion%'
       OR lower(vendor_name) LIKE '%twkion%'
       OR lower(vendor_name) LIKE '%teckion%'
    GROUP BY vendor_name, vendor_entity_id IS NOT NULL
    ORDER BY vendor_name
  LOOP
    RAISE NOTICE 'vendor_name="%", has_entity=%, count=%', rec.vendor_name, rec.has_entity, rec.cnt;
  END LOOP;
END;
$$;

-- Force-set entity_id for ALL Tekion-like mentions
UPDATE public.vendor_mentions
SET vendor_entity_id = (SELECT id FROM public.vendor_entities WHERE canonical_name = 'Tekion')
WHERE (
  lower(vendor_name) LIKE '%tekion%'
  OR lower(vendor_name) LIKE '%twkion%'
  OR lower(vendor_name) LIKE '%teckion%'
)
AND vendor_entity_id IS DISTINCT FROM (SELECT id FROM public.vendor_entities WHERE canonical_name = 'Tekion');

-- Also show total unresolved vendor_mentions count
DO $$
DECLARE
  v_unresolved INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.vendor_mentions WHERE is_hidden = false;
  SELECT COUNT(*) INTO v_unresolved FROM public.vendor_mentions WHERE is_hidden = false AND vendor_entity_id IS NULL;
  RAISE NOTICE 'Total mentions: %, Unresolved (no entity_id): %', v_total, v_unresolved;
END;
$$;
