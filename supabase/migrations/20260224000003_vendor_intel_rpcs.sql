-- Pricing intelligence aggregation
CREATE OR REPLACE FUNCTION public.get_vendor_pricing_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'data_points', COUNT(*),
    'mentions', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'amount', pricing_signal->>'amount',
          'terms', pricing_signal->>'terms',
          'unit_type', pricing_signal->>'unit_type'
        )
      ) FILTER (WHERE pricing_signal IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND pricing_signal IS NOT NULL;
$$;

-- Switching intelligence aggregation
CREATE OR REPLACE FUNCTION public.get_vendor_switching_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'switched_to', (
      SELECT COUNT(*) FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'to'
    ),
    'switched_from', (
      SELECT COUNT(*) FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'from'
    ),
    'to_sources', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'vendor', sub.other,
        'count', sub.cnt
      )), '[]'::jsonb)
      FROM (
        SELECT switching_signal->>'other_vendor' AS other, COUNT(*) AS cnt
        FROM public.vendor_mentions
        WHERE vendor_name = p_vendor_name
          AND switching_signal->>'direction' = 'to'
          AND switching_signal->>'other_vendor' IS NOT NULL
        GROUP BY switching_signal->>'other_vendor'
        ORDER BY cnt DESC
      ) sub
    ),
    'from_destinations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'vendor', sub.other,
        'count', sub.cnt
      )), '[]'::jsonb)
      FROM (
        SELECT switching_signal->>'other_vendor' AS other, COUNT(*) AS cnt
        FROM public.vendor_mentions
        WHERE vendor_name = p_vendor_name
          AND switching_signal->>'direction' = 'from'
          AND switching_signal->>'other_vendor' IS NOT NULL
        GROUP BY switching_signal->>'other_vendor'
        ORDER BY cnt DESC
      ) sub
    )
  );
$$;
