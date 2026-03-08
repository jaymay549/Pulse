-- ============================================================
-- Link Clerk user to members row on first login
-- Called from the frontend after Clerk auth succeeds
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_clerk_to_member(
  p_clerk_user_id TEXT,
  p_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- First check if already linked
  SELECT id INTO v_member_id
  FROM public.members
  WHERE clerk_user_id = p_clerk_user_id;

  IF v_member_id IS NOT NULL THEN
    RETURN v_member_id;
  END IF;

  -- Try to link by email
  UPDATE public.members
  SET clerk_user_id = p_clerk_user_id,
      updated_at = now()
  WHERE lower(email) = lower(p_email)
    AND clerk_user_id IS NULL
  RETURNING id INTO v_member_id;

  RETURN v_member_id;  -- NULL if no match found
END;
$$;

-- Callable by authenticated users (they link themselves)
GRANT EXECUTE ON FUNCTION public.link_clerk_to_member(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_clerk_to_member(TEXT, TEXT) TO service_role;
