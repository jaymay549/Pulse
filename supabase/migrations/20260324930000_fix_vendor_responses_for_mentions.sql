-- Fix vendor_responses RLS policies for vendor dashboard mention replies.
-- The table uses org_id + responder_user_id (not vendor_profile_id).
-- Existing policies (if any) used auth.uid() instead of Clerk's auth.jwt()->>'sub'.

-- Drop any existing policies (safe if already gone)
DROP POLICY IF EXISTS "Verified vendors can respond to their company reviews" ON public.vendor_responses;
DROP POLICY IF EXISTS "Verified vendors can respond to reviews or mentions" ON public.vendor_responses;
DROP POLICY IF EXISTS "Verified vendors can update their responses" ON public.vendor_responses;
DROP POLICY IF EXISTS "Verified vendors can delete their responses" ON public.vendor_responses;
DROP POLICY IF EXISTS "Anyone can view vendor responses" ON public.vendor_responses;

-- Recreate policies with Clerk auth (auth.jwt() ->> 'sub')
-- INSERT: user must have an approved vendor_profile matching their Clerk user ID
CREATE POLICY "Anyone can view vendor responses"
  ON public.vendor_responses FOR SELECT
  USING (true);

CREATE POLICY "Verified vendors can post responses"
  ON public.vendor_responses FOR INSERT
  WITH CHECK (
    responder_user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.user_id = (auth.jwt() ->> 'sub')
        AND vp.is_approved = true
    )
  );

CREATE POLICY "Verified vendors can update their responses"
  ON public.vendor_responses FOR UPDATE
  USING (
    responder_user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.user_id = (auth.jwt() ->> 'sub')
        AND vp.is_approved = true
    )
  );

CREATE POLICY "Verified vendors can delete their responses"
  ON public.vendor_responses FOR DELETE
  USING (
    responder_user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.user_id = (auth.jwt() ->> 'sub')
        AND vp.is_approved = true
    )
  );
