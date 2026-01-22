-- Create a test vendor profile for notification testing (bypass RLS with migration)
-- Using a placeholder UUID that won't conflict

-- First, create a test auth user if one doesn't exist for testing purposes
-- We'll use the admin context to insert a test vendor profile

-- Insert test vendor profile directly
INSERT INTO public.vendor_profiles (
  id,
  vendor_name, 
  contact_email, 
  is_approved, 
  approved_at,
  user_id
)
SELECT 
  'a1234567-1234-1234-1234-123456789abc'::uuid,
  'Test Vendor Co', 
  'cdg@cardealershipguy.org', 
  true, 
  now(),
  id
FROM auth.users
LIMIT 1
ON CONFLICT (id) DO UPDATE SET contact_email = 'cdg@cardealershipguy.org';