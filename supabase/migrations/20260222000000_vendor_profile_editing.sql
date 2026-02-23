-- Add editable profile fields
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS headquarters TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Create vendor-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-screenshots', 'vendor-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for vendor-screenshots (mirrors vendor-logos pattern)
CREATE POLICY "Vendor screenshots are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-screenshots');

CREATE POLICY "Verified vendors can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Verified vendors can delete their screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE vendor_profiles.user_id = (auth.jwt() ->> 'sub')
        AND vendor_profiles.is_approved = true
        AND vendor_profiles.id::text = (storage.foldername(name))[1]
    )
  );
