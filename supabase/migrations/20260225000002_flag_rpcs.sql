-- ============================================================
-- Flag & Moderation RPCs
-- ============================================================

-- Rate limit check: flags this month for a vendor profile
CREATE OR REPLACE FUNCTION public.get_vendor_flag_count_this_month(
  p_vendor_profile_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM mention_flags
    WHERE vendor_profile_id = p_vendor_profile_id
      AND created_at >= date_trunc('month', now())
  );
END;
$$;

-- Admin: uphold a flag (hides the mention)
CREATE OR REPLACE FUNCTION public.admin_uphold_flag(
  p_flag_id UUID,
  p_admin_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mention_id INTEGER;
BEGIN
  IF (auth.jwt() ->> 'user_role') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  UPDATE mention_flags
  SET status = 'upheld',
      reviewed_by = p_admin_user_id,
      reviewed_at = now()
  WHERE id = p_flag_id
  RETURNING mention_id INTO v_mention_id;

  IF v_mention_id IS NULL THEN
    RAISE EXCEPTION 'Flag not found';
  END IF;

  UPDATE vendor_mentions
  SET is_hidden = true
  WHERE id = v_mention_id;
END;
$$;

-- Admin: dismiss a flag (mention stays visible)
CREATE OR REPLACE FUNCTION public.admin_dismiss_flag(
  p_flag_id UUID,
  p_admin_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'user_role') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  UPDATE mention_flags
  SET status = 'dismissed',
      reviewed_by = p_admin_user_id,
      reviewed_at = now()
  WHERE id = p_flag_id;
END;
$$;

-- Admin: get all pending flagged mentions
CREATE OR REPLACE FUNCTION public.admin_get_flagged_mentions()
RETURNS TABLE (
  flag_id UUID,
  mention_id INTEGER,
  vendor_name TEXT,
  headline TEXT,
  quote TEXT,
  mention_type TEXT,
  mention_source TEXT,
  flag_reason TEXT,
  flag_note TEXT,
  flag_status TEXT,
  flagged_by_vendor TEXT,
  flagged_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'user_role') != 'admin' THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    mf.id        AS flag_id,
    vm.id        AS mention_id,
    vm.vendor_name,
    vm.headline,
    vm.quote,
    vm.type      AS mention_type,
    vm.source    AS mention_source,
    mf.reason    AS flag_reason,
    mf.note      AS flag_note,
    mf.status    AS flag_status,
    vp.vendor_name AS flagged_by_vendor,
    mf.created_at AS flagged_at
  FROM mention_flags mf
  JOIN vendor_mentions vm ON mf.mention_id = vm.id
  JOIN vendor_profiles vp ON mf.vendor_profile_id = vp.id
  WHERE mf.status = 'pending'
  ORDER BY mf.created_at ASC;
END;
$$;
