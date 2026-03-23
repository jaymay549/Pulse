-- ============================================================
-- Expand review_type enum (must run in its own migration)
-- ALTER TYPE ADD VALUE cannot be used in a transaction with
-- statements that reference the new values.
-- ============================================================

-- Drop CHECK constraint that restricts type to old values
ALTER TABLE public.vendor_mentions
  DROP CONSTRAINT IF EXISTS vendor_mentions_type_check;

ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'negative';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'neutral';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'mixed';
