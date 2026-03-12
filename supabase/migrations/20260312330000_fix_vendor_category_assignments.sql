-- Fix vendor category assignments that were missed by the initial split migration.
-- The previous migration only updated rows with category = 'dms-crm'.
-- This migration explicitly assigns categories for known vendors regardless of prior value.

-- ── CRM-only vendors ─────────────────────────────────────────────────────────

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%bkd%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%vinsolutions%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%vin solutions%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%elead%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%dealerpeak%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%activix%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%dominion vue%'
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_mentions
SET category = 'crm'
WHERE vendor_name ILIKE '%cardesk%'
  AND category IS DISTINCT FROM 'crm';

-- ── DMS-only vendors ─────────────────────────────────────────────────────────

UPDATE public.vendor_mentions
SET category = 'dms'
WHERE vendor_name ILIKE '%reynolds%'
  AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_mentions
SET category = 'dms'
WHERE vendor_name ILIKE '%tekion%'
  AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_mentions
SET category = 'dms'
WHERE vendor_name ILIKE '%quorum%'
  AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_mentions
SET category = 'dms'
WHERE (vendor_name ILIKE '%auto/mate%' OR vendor_name ILIKE '%automate%')
  AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_mentions
SET category = 'dms'
WHERE (vendor_name ILIKE '%pbs systems%' OR vendor_name ILIKE '%pbsystems%')
  AND category IS DISTINCT FROM 'dms';

-- ── Mirror to vendor_profiles ─────────────────────────────────────────────────

UPDATE public.vendor_profiles SET category = 'crm'
WHERE vendor_name ILIKE '%bkd%' AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'crm'
WHERE (vendor_name ILIKE '%vinsolutions%' OR vendor_name ILIKE '%vin solutions%')
  AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'crm'
WHERE vendor_name ILIKE '%elead%' AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'crm'
WHERE vendor_name ILIKE '%dealerpeak%' AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'crm'
WHERE vendor_name ILIKE '%activix%' AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'crm'
WHERE vendor_name ILIKE '%dominion vue%' AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'crm'
WHERE vendor_name ILIKE '%cardesk%' AND category IS DISTINCT FROM 'crm';

UPDATE public.vendor_profiles SET category = 'dms'
WHERE vendor_name ILIKE '%reynolds%' AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_profiles SET category = 'dms'
WHERE vendor_name ILIKE '%tekion%' AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_profiles SET category = 'dms'
WHERE vendor_name ILIKE '%quorum%' AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_profiles SET category = 'dms'
WHERE (vendor_name ILIKE '%auto/mate%' OR vendor_name ILIKE '%automate%')
  AND category IS DISTINCT FROM 'dms';

UPDATE public.vendor_profiles SET category = 'dms'
WHERE (vendor_name ILIKE '%pbs systems%' OR vendor_name ILIKE '%pbsystems%')
  AND category IS DISTINCT FROM 'dms';
