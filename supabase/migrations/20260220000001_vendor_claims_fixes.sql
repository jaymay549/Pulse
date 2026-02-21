-- Fix 1: Replace get_vendor_claims with admin-guarded version
CREATE OR REPLACE FUNCTION public.get_vendor_claims()
RETURNS TABLE (
  id UUID, vendor_name TEXT, claimant_name TEXT,
  claimant_email TEXT, note TEXT, status TEXT,
  claimant_user_id UUID, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  RETURN QUERY
    SELECT vc.id, vc.vendor_name, vc.claimant_name, vc.claimant_email,
           vc.note, vc.status, vc.claimant_user_id, vc.created_at
    FROM vendor_claims vc
    ORDER BY vc.created_at DESC;
END;
$$;

-- Fix 2: Replace approve_vendor_claim with admin-guarded version
CREATE OR REPLACE FUNCTION public.approve_vendor_claim(
  p_claim_id UUID,
  p_vendor_name TEXT,
  p_claimant_user_id UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

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

-- Fix 3: Replace reject_vendor_claim with admin-guarded version
CREATE OR REPLACE FUNCTION public.reject_vendor_claim(p_claim_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE vendor_claims
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_claim_id;
END;
$$;

-- Fix 4: updated_at trigger
CREATE TRIGGER update_vendor_claims_updated_at
BEFORE UPDATE ON public.vendor_claims
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fix 5: Performance indexes
CREATE INDEX idx_vendor_claims_status ON public.vendor_claims (status, created_at DESC);
CREATE INDEX idx_vendor_claims_claimant_user_id ON public.vendor_claims (claimant_user_id);
