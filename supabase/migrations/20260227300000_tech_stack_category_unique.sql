-- ============================================================
-- Fix unique constraint on user_tech_stack to include category.
-- The old constraint UNIQUE(user_id, vendor_name) prevented the
-- same vendor from appearing in multiple categories (e.g. BKD.ai
-- in both CRM and AI). The new constraint allows this.
-- ============================================================

-- Backfill any NULL categories to 'Other' so the new constraint works
UPDATE public.user_tech_stack
SET category = 'Other'
WHERE category IS NULL;

-- Make category NOT NULL going forward
ALTER TABLE public.user_tech_stack
  ALTER COLUMN category SET NOT NULL;

-- Drop old constraint and add new one
ALTER TABLE public.user_tech_stack
  DROP CONSTRAINT IF EXISTS user_tech_stack_user_id_vendor_name_key;

ALTER TABLE public.user_tech_stack
  ADD CONSTRAINT user_tech_stack_user_vendor_category_key
  UNIQUE (user_id, vendor_name, category);
