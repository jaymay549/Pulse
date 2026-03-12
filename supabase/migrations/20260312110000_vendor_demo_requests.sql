-- Create vendor_demo_requests table
-- Stores demo requests submitted from vendor profile pages.
-- Linked by vendor_name (no FK) so requests can be captured even for unclaimed profiles.

CREATE TABLE IF NOT EXISTS public.vendor_demo_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name      TEXT        NOT NULL,
  requester_name   TEXT        NOT NULL,
  requester_email  TEXT        NOT NULL,
  requester_phone  TEXT,
  dealership_name  TEXT,
  location         TEXT,                        -- "City, State" freeform
  message          TEXT        NOT NULL,
  clerk_user_id    TEXT,                        -- NULL for guest submissions
  status           TEXT        NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new', 'contacted', 'completed', 'declined')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated guests) can submit a request
CREATE POLICY "Public insert vendor_demo_requests"
  ON public.vendor_demo_requests
  FOR INSERT
  WITH CHECK (true);

-- Vendors can read requests for their own vendor_name (matched via their approved profile)
CREATE POLICY "Vendors read own demo requests"
  ON public.vendor_demo_requests
  FOR SELECT
  USING (
    vendor_name IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  );

-- Vendors can update the status of their own requests
CREATE POLICY "Vendors update own demo request status"
  ON public.vendor_demo_requests
  FOR UPDATE
  USING (
    vendor_name IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  )
  WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role manage vendor_demo_requests"
  ON public.vendor_demo_requests
  FOR ALL
  TO service_role
  USING (true);

-- Index for vendor dashboard queries
CREATE INDEX IF NOT EXISTS idx_vendor_demo_requests_vendor_name
  ON public.vendor_demo_requests (vendor_name, created_at DESC);
