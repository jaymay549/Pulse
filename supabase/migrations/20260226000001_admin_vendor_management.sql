-- ============================================================
-- Admin vendor management: allow admins to create/edit profiles
-- for unclaimed vendors.
-- ============================================================

-- Make user_id nullable so admin-created profiles don't need an owner.
-- PostgreSQL UNIQUE allows multiple NULLs, so this is safe.
-- When a vendor later claims the profile, the claim flow sets user_id.
ALTER TABLE public.vendor_profiles ALTER COLUMN user_id DROP NOT NULL;

-- Allow admins to create vendor profiles (for unclaimed vendors)
CREATE POLICY "Admins can insert vendor profiles"
  ON public.vendor_profiles FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');
