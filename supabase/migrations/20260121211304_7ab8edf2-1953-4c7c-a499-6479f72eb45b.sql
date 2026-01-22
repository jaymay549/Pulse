-- Add verified_vendor to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verified_vendor';

-- Create vendor_profiles table (links verified vendors to their company)
CREATE TABLE public.vendor_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  company_website TEXT,
  company_logo_url TEXT,
  company_description TEXT,
  contact_email TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(vendor_name)
);

-- Enable RLS on vendor_profiles
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for vendor_profiles
CREATE POLICY "Users can view their own vendor profile"
ON public.vendor_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vendor profile"
ON public.vendor_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vendor profile (except approval fields)"
ON public.vendor_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND is_approved = (SELECT is_approved FROM public.vendor_profiles WHERE user_id = auth.uid())
);

-- Anyone can view approved vendor profiles (for displaying on review cards)
CREATE POLICY "Anyone can view approved vendor profiles"
ON public.vendor_profiles
FOR SELECT
USING (is_approved = true);

-- Create vendor_responses table
CREATE TABLE public.vendor_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES public.vendor_reviews(id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

-- Enable RLS on vendor_responses
ALTER TABLE public.vendor_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can view responses (public immediately)
CREATE POLICY "Anyone can view vendor responses"
ON public.vendor_responses
FOR SELECT
USING (true);

-- Verified vendors can insert responses ONLY for reviews about their company
CREATE POLICY "Verified vendors can respond to their company reviews"
ON public.vendor_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    JOIN public.vendor_reviews vr ON LOWER(vp.vendor_name) = LOWER(vr.vendor_name)
    WHERE vp.user_id = auth.uid()
    AND vp.is_approved = true
    AND vr.id = review_id
  )
);

-- Verified vendors can update their own responses
CREATE POLICY "Verified vendors can update their responses"
ON public.vendor_responses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE user_id = auth.uid()
    AND id = vendor_profile_id
    AND is_approved = true
  )
);

-- Verified vendors can delete their own responses
CREATE POLICY "Verified vendors can delete their responses"
ON public.vendor_responses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE user_id = auth.uid()
    AND id = vendor_profile_id
    AND is_approved = true
  )
);

-- Add trigger for updated_at on vendor_profiles
CREATE TRIGGER update_vendor_profiles_updated_at
BEFORE UPDATE ON public.vendor_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on vendor_responses
CREATE TRIGGER update_vendor_responses_updated_at
BEFORE UPDATE ON public.vendor_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();