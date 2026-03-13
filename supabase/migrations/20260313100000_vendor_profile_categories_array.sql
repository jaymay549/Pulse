-- Add a categories array column to vendor_profiles
-- Allows vendors to self-declare multiple categories from the dashboard.
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- Seed from existing single category column
UPDATE public.vendor_profiles
SET categories = ARRAY[category]
WHERE category IS NOT NULL
  AND (categories IS NULL OR categories = '{}');
