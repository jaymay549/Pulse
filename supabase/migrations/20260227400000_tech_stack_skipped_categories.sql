-- Add table to track skipped categories in the tech stack
CREATE TABLE IF NOT EXISTS public.user_tech_stack_skipped_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'CRM', 'DMS', 'Website', 'Appraisal', 'Fixed Ops', 'AI', 'Inventory', 'Other'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

ALTER TABLE public.user_tech_stack_skipped_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skipped categories"
  ON public.user_tech_stack_skipped_categories
  FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE INDEX idx_user_tech_stack_skipped_user
  ON public.user_tech_stack_skipped_categories(user_id);
