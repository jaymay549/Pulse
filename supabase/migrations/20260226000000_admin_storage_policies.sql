-- ============================================================
-- Admin storage policies for vendor-logos and vendor-screenshots
-- Allows admins to upload/update/delete assets for any vendor.
-- ============================================================

-- vendor-logos: admin INSERT
CREATE POLICY "Admins can upload vendor logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-logos'
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- vendor-logos: admin UPDATE
CREATE POLICY "Admins can update vendor logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vendor-logos'
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- vendor-logos: admin DELETE
CREATE POLICY "Admins can delete vendor logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-logos'
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- vendor-screenshots: admin INSERT
CREATE POLICY "Admins can upload vendor screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- vendor-screenshots: admin UPDATE
CREATE POLICY "Admins can update vendor screenshots"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- vendor-screenshots: admin DELETE
CREATE POLICY "Admins can delete vendor screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-screenshots'
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );
