-- Copy vendor_metadata.logo_url → vendor_profiles.company_logo_url
-- for approved profiles that are missing a logo.

UPDATE public.vendor_profiles vp
SET company_logo_url = vm.logo_url
FROM public.vendor_metadata vm
WHERE lower(vm.vendor_name) = lower(vp.vendor_name)
  AND (vp.company_logo_url IS NULL OR vp.company_logo_url = '')
  AND vm.logo_url IS NOT NULL
  AND vm.logo_url <> '';
