-- Add category column to user_tech_stack for vendor classification
ALTER TABLE public.user_tech_stack
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
    'CRM', 'DMS', 'Website', 'Appraisal', 'Fixed Ops', 'AI', 'Inventory', 'Other'
  ));
