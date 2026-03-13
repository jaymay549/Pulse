-- Add optional title and description to vendor screenshots
ALTER TABLE public.vendor_screenshots
  ADD COLUMN IF NOT EXISTS title       TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;
