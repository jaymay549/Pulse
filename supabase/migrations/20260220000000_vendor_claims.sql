-- vendor_claims: stores inbound vendor ownership requests
CREATE TABLE public.vendor_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  claimant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_claims ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own claim
CREATE POLICY "Authenticated users can insert their own claim"
  ON public.vendor_claims FOR INSERT TO authenticated
  WITH CHECK (claimant_user_id = auth.uid());

-- Users can view their own claims
CREATE POLICY "Users can view their own claims"
  ON public.vendor_claims FOR SELECT TO authenticated
  USING (claimant_user_id = auth.uid());

-- ── Admin RPCs (SECURITY DEFINER — bypass RLS for admin operations) ──────────

-- List all claims ordered newest first (admin only — caller checks role in app)
CREATE OR REPLACE FUNCTION public.get_vendor_claims()
RETURNS TABLE (
  id UUID, vendor_name TEXT, claimant_name TEXT,
  claimant_email TEXT, note TEXT, status TEXT,
  claimant_user_id UUID, created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, vendor_name, claimant_name, claimant_email,
         note, status, claimant_user_id, created_at
  FROM vendor_claims
  ORDER BY created_at DESC;
$$;

-- Approve a claim: creates vendor_profiles row + marks claim approved
CREATE OR REPLACE FUNCTION public.approve_vendor_claim(
  p_claim_id UUID,
  p_vendor_name TEXT,
  p_claimant_user_id UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO vendor_profiles (user_id, vendor_name, is_approved, approved_at)
  VALUES (p_claimant_user_id, p_vendor_name, true, now())
  ON CONFLICT (user_id)
  DO UPDATE SET vendor_name = EXCLUDED.vendor_name,
                is_approved = true,
                approved_at = now();

  UPDATE vendor_claims
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_claim_id;
END;
$$;

-- Reject a claim
CREATE OR REPLACE FUNCTION public.reject_vendor_claim(p_claim_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE vendor_claims
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_claim_id;
END;
$$;
