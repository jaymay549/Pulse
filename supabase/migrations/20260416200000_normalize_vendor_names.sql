-- ============================================================
-- Normalize Vendor Names Across All Tables
--
-- Establishes consistent casing and whitespace normalization
-- across every table that stores a vendor name as TEXT:
--
--   vendor_entities.canonical_name       → title case (initcap)
--   vendor_alias_mappings.alias_text     → lowercase trimmed
--   vendor_mentions.vendor_name          → title case (initcap)
--   vendor_metadata.vendor_name          → title case (initcap)
--   vendor_profiles.vendor_name          → title case (initcap)
--
-- After normalizing canonical_name values, canonical names are
-- re-registered as lowercase aliases so exact-match resolution
-- continues to work regardless of input casing.
--
-- All updates use IS DISTINCT FROM to be idempotent — re-running
-- this migration will produce zero row updates after the first run.
--
-- NOTE (T-07-01): initcap() may produce wrong casing for acronyms
-- (e.g., "CDK" → "Cdk"). Acronym-correct canonical names should be
-- set via admin_merge_vendors, which takes user-supplied canonical
-- names and propagates them to all mentions.
--
-- NOTE (T-07-02): if two vendor_entities rows normalize to the same
-- canonical_name (very unlikely), the UPDATE will raise a UNIQUE
-- constraint violation — a signal that those entities should be
-- merged first via admin_merge_vendors.
-- ============================================================

-- ── Step 1: Reusable normalization helper ─────────────────────
CREATE OR REPLACE FUNCTION public._normalize_vendor_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT initcap(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

GRANT EXECUTE ON FUNCTION public._normalize_vendor_name(TEXT) TO authenticated, anon, service_role;

-- ── Step 2: Normalize vendor_entities.canonical_name ─────────
UPDATE public.vendor_entities
SET canonical_name = public._normalize_vendor_name(canonical_name),
    slug           = public._slugify_vendor_token(public._normalize_vendor_name(canonical_name)),
    updated_at     = now()
WHERE canonical_name IS DISTINCT FROM public._normalize_vendor_name(canonical_name);

-- ── Step 3: Normalize vendor_alias_mappings.alias_text ───────
-- Aliases are always kept lowercase + trimmed for consistent
-- case-insensitive exact matching in resolve_vendor_family.
-- Duplicate aliases that arise after lowercasing are resolved
-- by keeping the higher-confidence row (ON CONFLICT below handles
-- newly-inserted aliases; existing duplicates remain — Plan 02
-- will handle those via merge).
UPDATE public.vendor_alias_mappings
SET alias_text = lower(trim(regexp_replace(alias_text, '\s+', ' ', 'g')))
WHERE alias_text IS DISTINCT FROM lower(trim(regexp_replace(alias_text, '\s+', ' ', 'g')));

-- ── Step 4: Normalize vendor_mentions.vendor_name ────────────
UPDATE public.vendor_mentions
SET vendor_name = public._normalize_vendor_name(vendor_name)
WHERE vendor_name IS DISTINCT FROM public._normalize_vendor_name(vendor_name);

-- ── Step 5: Normalize vendor_metadata.vendor_name ────────────
UPDATE public.vendor_metadata
SET vendor_name = public._normalize_vendor_name(vendor_name)
WHERE vendor_name IS DISTINCT FROM public._normalize_vendor_name(vendor_name);

-- ── Step 6: Normalize vendor_profiles.vendor_name ────────────
UPDATE public.vendor_profiles
SET vendor_name = public._normalize_vendor_name(vendor_name),
    updated_at  = now()
WHERE vendor_name IS DISTINCT FROM public._normalize_vendor_name(vendor_name);

-- ── Step 7: Re-register canonical names as lowercase aliases ──
-- After normalization, canonical names may have changed. Ensure
-- each canonical name is registered as a lowercase alias so
-- resolve_vendor_family continues to resolve by exact match.
INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, confidence, source)
SELECT lower(ve.canonical_name), ve.id, 1.0, 'normalization'
FROM public.vendor_entities ve
WHERE NOT EXISTS (
  SELECT 1 FROM public.vendor_alias_mappings am
  WHERE am.alias_text = lower(ve.canonical_name)
    AND am.vendor_entity_id = ve.id
)
ON CONFLICT (alias_text) DO UPDATE
  SET vendor_entity_id = EXCLUDED.vendor_entity_id,
      confidence       = GREATEST(vendor_alias_mappings.confidence, EXCLUDED.confidence);
