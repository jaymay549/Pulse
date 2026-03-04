-- ============================================================
-- Vendor Family Seed Data
-- Seeds canonical vendor families, product lines, and aliases.
-- Safe to re-run (idempotent via ON CONFLICT).
-- ============================================================

-- ── 1) Canonical vendor entities ─────────────────────────────
INSERT INTO public.vendor_entities (canonical_name, slug, is_active)
VALUES
  ('CDK', 'cdk', true),
  ('Cox Automotive', 'cox-automotive', true),
  ('Reynolds and Reynolds', 'reynolds-and-reynolds', true)
ON CONFLICT (canonical_name)
DO UPDATE SET
  slug = EXCLUDED.slug,
  is_active = true,
  updated_at = now();

-- ── 2) Product lines ─────────────────────────────────────────
-- CDK
INSERT INTO public.vendor_product_lines (vendor_entity_id, name, slug, is_active)
SELECT ve.id, v.name, v.slug, true
FROM public.vendor_entities ve
CROSS JOIN (
  VALUES
    ('Elead', 'elead'),
    ('Roadster', 'roadster'),
    ('Fortellis', 'fortellis'),
    ('CDK CRM', 'cdk-crm'),
    ('CDK DMS', 'cdk-dms'),
    ('CDK Service', 'cdk-service'),
    ('CDK Digital Retail', 'cdk-digital-retail')
) AS v(name, slug)
WHERE ve.canonical_name = 'CDK'
ON CONFLICT (vendor_entity_id, name)
DO UPDATE SET
  slug = EXCLUDED.slug,
  is_active = true,
  updated_at = now();

-- Cox Automotive
INSERT INTO public.vendor_product_lines (vendor_entity_id, name, slug, is_active)
SELECT ve.id, v.name, v.slug, true
FROM public.vendor_entities ve
CROSS JOIN (
  VALUES
    ('Dealertrack', 'dealertrack'),
    ('VinSolutions', 'vinsolutions'),
    ('vAuto', 'vauto'),
    ('Xtime', 'xtime'),
    ('AutoTrader', 'autotrader')
) AS v(name, slug)
WHERE ve.canonical_name = 'Cox Automotive'
ON CONFLICT (vendor_entity_id, name)
DO UPDATE SET
  slug = EXCLUDED.slug,
  is_active = true,
  updated_at = now();

-- Reynolds and Reynolds
INSERT INTO public.vendor_product_lines (vendor_entity_id, name, slug, is_active)
SELECT ve.id, v.name, v.slug, true
FROM public.vendor_entities ve
CROSS JOIN (
  VALUES
    ('ReyRey DMS', 'reyrey-dms'),
    ('Reynolds CRM', 'reynolds-crm'),
    ('Retail Management System', 'retail-management-system')
) AS v(name, slug)
WHERE ve.canonical_name = 'Reynolds and Reynolds'
ON CONFLICT (vendor_entity_id, name)
DO UPDATE SET
  slug = EXCLUDED.slug,
  is_active = true,
  updated_at = now();

-- ── 3) Alias mappings (parent-level + product-level) ─────────
-- Parent-level aliases
INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, vendor_product_line_id, confidence, source)
SELECT a.alias_text, ve.id, NULL::uuid, a.confidence, a.source
FROM public.vendor_entities ve
JOIN (
  VALUES
    -- CDK parent aliases
    ('cdk', 'CDK', 1.0::numeric, 'manual'),
    ('cdk global', 'CDK', 1.0::numeric, 'manual'),
    ('cdkglobal', 'CDK', 0.98::numeric, 'manual'),
    ('cdk north america', 'CDK', 0.95::numeric, 'manual'),

    -- Cox parent aliases
    ('cox automotive', 'Cox Automotive', 1.0::numeric, 'manual'),
    ('cox auto', 'Cox Automotive', 0.96::numeric, 'manual'),
    ('cox', 'Cox Automotive', 0.90::numeric, 'manual'),

    -- Reynolds parent aliases
    ('reynolds and reynolds', 'Reynolds and Reynolds', 1.0::numeric, 'manual'),
    ('reynolds & reynolds', 'Reynolds and Reynolds', 1.0::numeric, 'manual'),
    ('reynolds', 'Reynolds and Reynolds', 0.94::numeric, 'manual'),
    ('reyrey', 'Reynolds and Reynolds', 0.97::numeric, 'manual')
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
    -- CDK product lines
    ('elead', 'CDK', 'elead', 1.0::numeric, 'manual'),
    ('e lead', 'CDK', 'elead', 0.98::numeric, 'manual'),
    ('cdk elead', 'CDK', 'elead', 1.0::numeric, 'manual'),
    ('roadster', 'CDK', 'roadster', 1.0::numeric, 'manual'),
    ('cdk roadster', 'CDK', 'roadster', 0.99::numeric, 'manual'),
    ('fortellis', 'CDK', 'fortellis', 1.0::numeric, 'manual'),
    ('cdk crm', 'CDK', 'cdk-crm', 1.0::numeric, 'manual'),
    ('cdk dms', 'CDK', 'cdk-dms', 1.0::numeric, 'manual'),
    ('cdk service', 'CDK', 'cdk-service', 0.96::numeric, 'manual'),
    ('cdk digital retail', 'CDK', 'cdk-digital-retail', 1.0::numeric, 'manual'),

    -- Cox product lines
    ('dealertrack', 'Cox Automotive', 'dealertrack', 1.0::numeric, 'manual'),
    ('vinsolutions', 'Cox Automotive', 'vinsolutions', 1.0::numeric, 'manual'),
    ('vin solutions', 'Cox Automotive', 'vinsolutions', 0.99::numeric, 'manual'),
    ('vauto', 'Cox Automotive', 'vauto', 1.0::numeric, 'manual'),
    ('v auto', 'Cox Automotive', 'vauto', 0.98::numeric, 'manual'),
    ('xtime', 'Cox Automotive', 'xtime', 1.0::numeric, 'manual'),
    ('x time', 'Cox Automotive', 'xtime', 0.97::numeric, 'manual'),
    ('autotrader', 'Cox Automotive', 'autotrader', 1.0::numeric, 'manual'),
    ('auto trader', 'Cox Automotive', 'autotrader', 0.99::numeric, 'manual'),

    -- Reynolds product lines
    ('reyrey dms', 'Reynolds and Reynolds', 'reyrey-dms', 1.0::numeric, 'manual'),
    ('reynolds dms', 'Reynolds and Reynolds', 'reyrey-dms', 0.97::numeric, 'manual'),
    ('reynolds crm', 'Reynolds and Reynolds', 'reynolds-crm', 1.0::numeric, 'manual'),
    ('retail management system', 'Reynolds and Reynolds', 'retail-management-system', 1.0::numeric, 'manual'),
    ('rms', 'Reynolds and Reynolds', 'retail-management-system', 0.92::numeric, 'manual')
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

-- ── 4) Backfill existing mentions ────────────────────────────
DO $$
BEGIN
  PERFORM public.backfill_vendor_mentions_family();
EXCEPTION
  WHEN undefined_function THEN
    -- If the foundation migration isn't present for any reason, no-op.
    RAISE NOTICE 'backfill_vendor_mentions_family() not found; skipping backfill';
END;
$$;
