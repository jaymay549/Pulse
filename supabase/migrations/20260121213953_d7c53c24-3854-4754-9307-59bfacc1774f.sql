-- Allow admins to view ALL vendor profiles (including unapproved)
CREATE POLICY "Admins can view all vendor profiles"
ON public.vendor_profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any vendor profile (for approving/rejecting)
CREATE POLICY "Admins can update any vendor profile"
ON public.vendor_profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete vendor profiles if needed
CREATE POLICY "Admins can delete vendor profiles"
ON public.vendor_profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));