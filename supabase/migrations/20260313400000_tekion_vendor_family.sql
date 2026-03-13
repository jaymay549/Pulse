-- ============================================================
-- Add Tekion as a vendor entity with alias mappings
-- Merges "Tekion", "Tekion CRM", "Tekion DMS", "twkion", etc.
-- into a single canonical "Tekion" entry in the vendor list.
-- ============================================================

-- ── 1) Canonical entity ────────────────────────────────────
INSERT INTO public.vendor_entities (canonical_name, slug, is_active)
VALUES ('Tekion', 'tekion', true)
ON CONFLICT (canonical_name)
DO UPDATE SET slug = EXCLUDED.slug, is_active = true, updated_at = now();

-- ── 2) Product lines ───────────────────────────────────────
INSERT INTO public.vendor_product_lines (vendor_entity_id, name, slug, is_active)
SELECT ve.id, v.name, v.slug, true
FROM public.vendor_entities ve
CROSS JOIN (
  VALUES
    ('Tekion DMS', 'tekion-dms'),
    ('Tekion CRM', 'tekion-crm')
) AS v(name, slug)
WHERE ve.canonical_name = 'Tekion'
ON CONFLICT (vendor_entity_id, name)
DO UPDATE SET slug = EXCLUDED.slug, is_active = true, updated_at = now();

-- ── 3) Alias mappings ──────────────────────────────────────
-- Parent-level aliases
INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, vendor_product_line_id, confidence, source)
SELECT a.alias_text, ve.id, NULL::uuid, a.confidence, a.source
FROM public.vendor_entities ve
JOIN (
  VALUES
    ('tekion', 'Tekion', 1.0::numeric, 'manual'),
    ('twkion', 'Tekion', 0.95::numeric, 'manual'),
    ('teckion', 'Tekion', 0.93::numeric, 'manual')
) AS a(alias_text, canonical_name, confidence, source)
  ON a.canonical_name = ve.canonical_name
ON CONFLICT (alias_text)
DO UPDATE SET
  vendor_entity_id = EXCLUDED.vendor_entity_id,
  vendor_product_line_id = EXCLUDED.vendor_product_line_id,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source;

-- Product-level aliases
INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, vendor_product_line_id, confidence, source)
SELECT
  a.alias_text,
  ve.id AS vendor_entity_id,
  vpl.id AS vendor_product_line_id,
  a.confidence,
  a.source
FROM (
  VALUES
    ('tekion dms', 'Tekion', 'tekion-dms', 1.0::numeric, 'manual'),
    ('tekion crm', 'Tekion', 'tekion-crm', 1.0::numeric, 'manual'),
    ('twkion crm', 'Tekion', 'tekion-crm', 0.94::numeric, 'manual'),
    ('twkion dms', 'Tekion', 'tekion-dms', 0.94::numeric, 'manual')
) AS a(alias_text, canonical_name, product_slug, confidence, source)
JOIN public.vendor_entities ve
  ON ve.canonical_name = a.canonical_name
JOIN public.vendor_product_lines vpl
  ON vpl.vendor_entity_id = ve.id
 AND vpl.slug = a.product_slug
ON CONFLICT (alias_text)
DO UPDATE SET
  vendor_entity_id = EXCLUDED.vendor_entity_id,
  vendor_product_line_id = EXCLUDED.vendor_product_line_id,
  confidence = EXCLUDED.confidence,
  source = EXCLUDED.source;

-- ── 4) Backfill existing mentions ──────────────────────────
DO $$
BEGIN
  PERFORM public.backfill_vendor_mentions_family();
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'backfill_vendor_mentions_family() not found; skipping backfill';
END;
$$;
