-- Sales Vendor Dealers RPC
-- Returns dealer details for a specific vendor, for the sales targets expandable row.
-- SECURITY DEFINER to bypass RLS (admin-only feature).

CREATE OR REPLACE FUNCTION get_sales_vendor_dealers(
  p_vendor_name TEXT
)
RETURNS TABLE (
  member_id       UUID,
  member_name     TEXT,
  dealership_name TEXT,
  dealer_status   TEXT,
  sentiment       NUMERIC,
  rooftops        INTEGER,
  region          TEXT,
  switching       BOOLEAN,
  mention_count   BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY

  -- Confirmed users: have entry in user_tech_stack with is_current = true
  WITH confirmed_users AS (
    SELECT
      m.id AS mid,
      m.name AS mname,
      m.dealership_name AS mdealership,
      uts.sentiment_score AS msentiment,
      m.rooftops AS mrooftops,
      COALESCE(m.state, m.region) AS mregion,
      COALESCE(uts.switching_intent, false) AS mswitching,
      (
        SELECT COUNT(*) FROM public.vendor_mentions vm2
        LEFT JOIN public.vendor_entities ve2 ON ve2.id = vm2.vendor_entity_id
        WHERE vm2.member_id = m.id
          AND lower(COALESCE(ve2.canonical_name, vm2.vendor_name)) = lower(p_vendor_name)
      ) AS mcount
    FROM public.user_tech_stack uts
    JOIN public.members m ON m.clerk_user_id = uts.user_id
    LEFT JOIN public.vendor_entities ve ON lower(ve.canonical_name) = lower(uts.vendor_name)
    WHERE uts.is_current = true
      AND lower(COALESCE(ve.canonical_name, uts.vendor_name)) = lower(p_vendor_name)
  ),

  -- All members who mentioned this vendor
  mention_members AS (
    SELECT
      m.id AS mid,
      m.name AS mname,
      m.dealership_name AS mdealership,
      m.rooftops AS mrooftops,
      COALESCE(m.state, m.region) AS mregion,
      COUNT(*) AS mcount,
      AVG(vm.sentiment_score) AS msentiment,
      BOOL_OR(vm.dimension IN ('adopted', 'support', 'reliable', 'integrates', 'worth_it')) AS has_usage_dimension
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    JOIN public.members m ON m.id = vm.member_id
    WHERE lower(COALESCE(ve.canonical_name, vm.vendor_name)) = lower(p_vendor_name)
      AND vm.member_id IS NOT NULL
      -- Exclude confirmed users
      AND m.id NOT IN (SELECT mid FROM confirmed_users)
    GROUP BY m.id, m.name, m.dealership_name, m.rooftops, m.state, m.region
  )

  -- Confirmed users first
  SELECT
    cu.mid,
    cu.mname,
    cu.mdealership,
    'Confirmed User'::TEXT,
    cu.msentiment,
    cu.mrooftops,
    cu.mregion,
    cu.mswitching,
    cu.mcount
  FROM confirmed_users cu

  UNION ALL

  -- Likely users (have usage-implying dimensions)
  SELECT
    mm.mid,
    mm.mname,
    mm.mdealership,
    'Likely User'::TEXT,
    mm.msentiment,
    mm.mrooftops,
    mm.mregion,
    false,
    mm.mcount
  FROM mention_members mm
  WHERE mm.has_usage_dimension = true

  UNION ALL

  -- Mentioned only
  SELECT
    mm.mid,
    mm.mname,
    mm.mdealership,
    'Mentioned Only'::TEXT,
    mm.msentiment,
    mm.mrooftops,
    mm.mregion,
    false,
    mm.mcount
  FROM mention_members mm
  WHERE mm.has_usage_dimension = false;

END;
$$;
