-- Create storage bucket for vendor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-logos', 'vendor-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view vendor logos (public bucket)
CREATE POLICY "Vendor logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vendor-logos');

-- Allow verified vendors to upload their own logo
CREATE POLICY "Verified vendors can upload their logo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'vendor-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE user_id = auth.uid()
    AND is_approved = true
    AND id::text = (storage.foldername(name))[1]
  )
);

-- Allow verified vendors to update their own logo
CREATE POLICY "Verified vendors can update their logo"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'vendor-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE user_id = auth.uid()
    AND is_approved = true
    AND id::text = (storage.foldername(name))[1]
  )
);

-- Allow verified vendors to delete their own logo
CREATE POLICY "Verified vendors can delete their logo"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'vendor-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE user_id = auth.uid()
    AND is_approved = true
    AND id::text = (storage.foldername(name))[1]
  )
);