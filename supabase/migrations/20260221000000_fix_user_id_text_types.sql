-- ============================================================
-- Fix: Change UUID user ID columns to TEXT for Clerk compatibility
-- Clerk user IDs (user_XXXX) are strings, not UUIDs.
-- auth.uid() returns NULL with Clerk JWTs; use auth.jwt() ->> 'sub'.
--
-- PREREQUISITE: Add to Clerk JWT template (Dashboard > Sessions > Customize):
--   "user_role": "{{user.public_metadata.circles.role}}"
-- This enables DB-level admin checks in RPCs.
-- ============================================================

-- 1. Drop ALL policies that depend on vendor_profiles.user_id or vendor_claims.claimant_user_id
--    Must happen BEFORE ALTER COLUMN TYPE

-- vendor_claims
DROP POLICY IF EXISTS "Authenticated users can insert their own claim" ON public.vendor_claims;
DROP POLICY IF EXISTS "Users can view their own claims" ON public.vendor_claims;

-- vendor_profiles
DROP POLICY IF EXISTS "Users can view their own vendor profile" ON public.vendor_profiles;
DROP POLICY IF EXISTS "Users can insert their own vendor profile" ON public.vendor_profiles;
DROP POLICY IF EXISTS "Users can update their own vendor profile (except approval fiel" ON public.vendor_profiles;
DROP POLICY IF EXISTS "Admins can view all vendor profiles" ON public.vendor_profiles;
DROP POLICY IF EXISTS "Admins can update any vendor profile" ON public.vendor_profiles;
DROP POLICY IF EXISTS "Admins can delete vendor profiles" ON public.vendor_profiles;

-- vendor_responses_legacy (join on vendor_profiles.user_id)
DROP POLICY IF EXISTS "Verified vendors can respond to their company reviews" ON public.vendor_responses_legacy;
DROP POLICY IF EXISTS "Verified vendors can delete their responses" ON public.vendor_responses_legacy;
DROP POLICY IF EXISTS "Verified vendors can update their responses" ON public.vendor_responses_legacy;

-- storage.objects (join on vendor_profiles.user_id)
DROP POLICY IF EXISTS "Verified vendors can upload their logo" ON storage.objects;
DROP POLICY IF EXISTS "Verified vendors can update their logo" ON storage.objects;
DROP POLICY IF EXISTS "Verified vendors can delete their logo" ON storage.objects;

-- 2. Drop FK and UNIQUE constraints
ALTER TABLE public.vendor_claims
  DROP CONSTRAINT IF EXISTS vendor_claims_claimant_user_id_fkey,
  DROP CONSTRAINT IF EXISTS vendor_claims_reviewed_by_fkey;

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_user_id_fkey,
  DROP CONSTRAINT IF EXISTS vendor_profiles_user_id_key;

-- 3. Drop indexes that need rebuilding
DROP INDEX IF EXISTS public.uq_vendor_claims_user_vendor_pending;
DROP INDEX IF EXISTS public.idx_vendor_claims_claimant_user_id;

-- 4. Change column types UUID -> TEXT
ALTER TABLE public.vendor_claims
  ALTER COLUMN claimant_user_id TYPE TEXT,
  ALTER COLUMN reviewed_by TYPE TEXT;

ALTER TABLE public.vendor_profiles
  ALTER COLUMN user_id TYPE TEXT,
  ALTER COLUMN approved_by TYPE TEXT;

-- 5. Restore constraints and indexes
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_user_id_key UNIQUE (user_id);

CREATE INDEX idx_vendor_claims_claimant_user_id ON public.vendor_claims (claimant_user_id);
CREATE UNIQUE INDEX uq_vendor_claims_user_vendor_pending
  ON public.vendor_claims (claimant_user_id, vendor_name)
  WHERE status = 'pending';

-- ============================================================
-- 6. Recreate vendor_claims RLS using auth.jwt() ->> 'sub'
-- ============================================================
CREATE POLICY "Authenticated users can insert their own claim"
  ON public.vendor_claims FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'sub') = claimant_user_id);

CREATE POLICY "Users can view their own claims"
  ON public.vendor_claims FOR SELECT
  USING ((auth.jwt() ->> 'sub') = claimant_user_id);

CREATE POLICY "Admins can view all vendor claims"
  ON public.vendor_claims FOR SELECT
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- ============================================================
-- 7. Recreate vendor_profiles RLS using auth.jwt() ->> 'sub'
-- ============================================================
CREATE POLICY "Users can view their own vendor profile"
  ON public.vendor_profiles FOR SELECT
  USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can insert their own vendor profile"
  ON public.vendor_profiles FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can update their own vendor profile"
  ON public.vendor_profiles FOR UPDATE
  USING ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK (
    (auth.jwt() ->> 'sub') = user_id
    AND is_approved = (
      SELECT vp.is_approved FROM vendor_profiles vp
      WHERE vp.user_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Admins can view all vendor profiles"
  ON public.vendor_profiles FOR SELECT
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "Admins can update any vendor profile"
  ON public.vendor_profiles FOR UPDATE
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY "Admins can delete vendor profiles"
  ON public.vendor_profiles FOR DELETE
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- ============================================================
-- 8. Recreate vendor_responses_legacy RLS using auth.jwt() ->> 'sub'
-- ============================================================
CREATE POLICY "Verified vendors can respond to their company reviews"
  ON public.vendor_responses_legacy FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM vendor_profiles vp
      JOIN vendor_reviews_legacy vr ON lower(vp.vendor_name) = lower(vr.vendor_name)
      WHERE vp.user_id = (auth.jwt() ->> 'sub')
        AND vp.is_approved = true
        AND vr.id = vendor_responses_legacy.review_id
    )
  );

CREATE POLICY "Verified vendors can update their responses"
  ON public.vendor_responses_legacy FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.id = vendor_responses_legacy.vendor_profile_id
        AND vendor_profiles.is_approved = true
    )
  );

CREATE POLICY "Verified vendors can delete their responses"
  ON public.vendor_responses_legacy FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.id = vendor_responses_legacy.vendor_profile_id
        AND vendor_profiles.is_approved = true
    )
  );

-- ============================================================
-- 9. Recreate storage.objects RLS using auth.jwt() ->> 'sub'
-- ============================================================
CREATE POLICY "Verified vendors can upload their logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-logos'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Verified vendors can update their logo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vendor-logos'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Verified vendors can delete their logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-logos'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- 10. Replace RPCs: auth.jwt() ->> 'sub' for user ID,
--     auth.jwt() ->> 'user_role' for admin check
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vendor_claims(p_status TEXT DEFAULT NULL)
RETURNS SETOF vendor_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'user_role') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  IF p_status IS NOT NULL THEN
    RETURN QUERY SELECT * FROM vendor_claims WHERE status = p_status ORDER BY created_at DESC;
  ELSE
    RETURN QUERY SELECT * FROM vendor_claims ORDER BY created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_vendor_claim(p_claim_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_name      TEXT;
  v_claimant_user_id TEXT;
BEGIN
  IF (auth.jwt() ->> 'user_role') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  SELECT vendor_name, claimant_user_id
    INTO v_vendor_name, v_claimant_user_id
    FROM vendor_claims
   WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim % not found or already processed', p_claim_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM vendor_profiles
     WHERE vendor_name = v_vendor_name
       AND user_id != v_claimant_user_id
       AND is_approved = true
  ) THEN
    RAISE EXCEPTION 'Vendor % is already claimed by another user', v_vendor_name;
  END IF;

  INSERT INTO vendor_profiles (user_id, vendor_name, is_approved, approved_at)
    VALUES (v_claimant_user_id, v_vendor_name, true, now())
    ON CONFLICT (user_id) DO UPDATE
      SET vendor_name = EXCLUDED.vendor_name,
          is_approved = true,
          approved_at = now();

  UPDATE vendor_claims
     SET status      = 'approved',
         reviewed_by = (auth.jwt() ->> 'sub'),
         reviewed_at = now()
   WHERE id = p_claim_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_vendor_claim(p_claim_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'user_role') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  UPDATE vendor_claims
     SET status      = 'rejected',
         reviewed_by = (auth.jwt() ->> 'sub'),
         reviewed_at = now()
   WHERE id = p_claim_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim % not found or already processed', p_claim_id;
  END IF;
END;
$$;
