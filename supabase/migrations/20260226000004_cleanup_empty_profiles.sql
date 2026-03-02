-- Remove admin-created profiles with no data so RPC can recreate them seeded
DELETE FROM public.vendor_profiles
WHERE user_id IS NULL
  AND company_website IS NULL
  AND company_logo_url IS NULL
  AND tagline IS NULL
  AND company_description IS NULL;
