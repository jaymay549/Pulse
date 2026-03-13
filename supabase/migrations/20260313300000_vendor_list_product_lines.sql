-- ============================================================
-- Show product line names in vendor search list
-- Changes vendor list RPC to return product line names
-- (e.g. "VinSolutions") instead of parent entity names
-- (e.g. "Cox Automotive") when a product line is resolved.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vendor_pulse_vendors_list_v2()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH scoped AS (
    SELECT
      vm.vendor_name,
      vm.vendor_entity_id,
      vm.vendor_product_line_id,
      vm.title,
      vm.quote,
      vm.explanation
    FROM public.vendor_mentions vm
    WHERE vm.is_hidden = false
  ),
  resolved AS (
    SELECT
      s.vendor_name,
      COALESCE(
        s.vendor_entity_id,
        rf.vendor_entity_id
      ) AS resolved_entity_id,
      COALESCE(
        s.vendor_product_line_id,
        rf.vendor_product_line_id
      ) AS resolved_product_line_id
    FROM scoped s
    LEFT JOIN LATERAL public.resolve_vendor_family(
      s.vendor_name,
      s.title,
      s.quote,
      s.explanation
    ) rf
      ON s.vendor_entity_id IS NULL
  ),
  grouped AS (
    SELECT
      COALESCE(vpl.name, ve.canonical_name, r.vendor_name) AS name,
      COUNT(*)::INTEGER AS count
    FROM resolved r
    LEFT JOIN public.vendor_entities ve
      ON ve.id = r.resolved_entity_id
    LEFT JOIN public.vendor_product_lines vpl
      ON vpl.id = r.resolved_product_line_id
    GROUP BY COALESCE(vpl.name, ve.canonical_name, r.vendor_name)
  )
  SELECT jsonb_build_object(
    'vendors',
    COALESCE(
      jsonb_agg(
        jsonb_build_object('name', g.name, 'count', g.count)
        ORDER BY g.count DESC
      ),
      '[]'::jsonb
    )
  )
  FROM grouped g;
$$;
