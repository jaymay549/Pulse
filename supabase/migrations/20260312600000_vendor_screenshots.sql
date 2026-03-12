-- vendor_screenshots table
-- Stores product screenshots uploaded by claimed/approved vendors.
-- Linked by vendor_name (loose FK) to match the existing pattern.

CREATE TABLE IF NOT EXISTS public.vendor_screenshots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name  TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_screenshots ENABLE ROW LEVEL SECURITY;

-- Anyone can view screenshots on a vendor profile
CREATE POLICY "Public read vendor_screenshots"
  ON public.vendor_screenshots
  FOR SELECT
  USING (true);

-- Approved vendors can insert their own screenshots (max 8 enforced client-side)
CREATE POLICY "Vendors insert own screenshots"
  ON public.vendor_screenshots
  FOR INSERT
  WITH CHECK (
    vendor_name IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  );

-- Approved vendors can update sort_order on their own screenshots
CREATE POLICY "Vendors update own screenshots"
  ON public.vendor_screenshots
  FOR UPDATE
  USING (
    vendor_name IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  )
  WITH CHECK (true);

-- Approved vendors can delete their own screenshots
CREATE POLICY "Vendors delete own screenshots"
  ON public.vendor_screenshots
  FOR DELETE
  USING (
    vendor_name IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  );

-- Service role has full access
CREATE POLICY "Service role manage vendor_screenshots"
  ON public.vendor_screenshots
  FOR ALL
  TO service_role
  USING (true);

-- Index for profile page queries
CREATE INDEX IF NOT EXISTS idx_vendor_screenshots_vendor_name
  ON public.vendor_screenshots (vendor_name, sort_order ASC);

-- ---------------------------------------------------------------------------
-- Storage bucket for screenshot images
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-screenshots', 'vendor-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (bucket is public so CDN URLs work without signed tokens)
CREATE POLICY "Public read vendor screenshot objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-screenshots');

-- Approved vendors can upload to their own folder ({vendor_name}/*)
CREATE POLICY "Vendors upload screenshot objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-screenshots'
    AND split_part(name, '/', 1) IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  );

-- Approved vendors can delete from their own folder
CREATE POLICY "Vendors delete screenshot objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-screenshots'
    AND split_part(name, '/', 1) IN (
      SELECT vendor_name FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub')
        AND is_approved = true
    )
  );
