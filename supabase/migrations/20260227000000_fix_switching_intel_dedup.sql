-- Fix switching intelligence to deduplicate vendor names.
-- Groups by LOWER(TRIM(other_vendor)) so "drive centric" / "Drivecentric" merge.
-- Resolves display name from canonical vendor_mentions.vendor_name when possible.

CREATE OR REPLACE FUNCTION public.get_vendor_switching_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  to_count BIGINT;
  from_count BIGINT;
  to_sources JSONB;
  from_destinations JSONB;
BEGIN
  -- Count total switched-to
  SELECT COUNT(*) INTO to_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'to';

  -- Count total switched-from
  SELECT COUNT(*) INTO from_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'from';

  -- Aggregate to_sources with deduplication
  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.cnt DESC), '[]'::jsonb)
  INTO to_sources
  FROM (
    SELECT
      COALESCE(
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE LOWER(vm2.vendor_name) = grp.norm
         LIMIT 1),
        grp.best_variant
      ) AS vendor,
      grp.cnt
    FROM (
      SELECT
        LOWER(TRIM(switching_signal->>'other_vendor')) AS norm,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'to'
        AND switching_signal->>'other_vendor' IS NOT NULL
      GROUP BY LOWER(TRIM(switching_signal->>'other_vendor'))
    ) grp
  ) d;

  -- Aggregate from_destinations with deduplication
  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.cnt DESC), '[]'::jsonb)
  INTO from_destinations
  FROM (
    SELECT
      COALESCE(
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE LOWER(vm2.vendor_name) = grp.norm
         LIMIT 1),
        grp.best_variant
      ) AS vendor,
      grp.cnt
    FROM (
      SELECT
        LOWER(TRIM(switching_signal->>'other_vendor')) AS norm,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'from'
        AND switching_signal->>'other_vendor' IS NOT NULL
      GROUP BY LOWER(TRIM(switching_signal->>'other_vendor'))
    ) grp
  ) d;

  RETURN jsonb_build_object(
    'switched_to', to_count,
    'switched_from', from_count,
    'to_sources', to_sources,
    'from_destinations', from_destinations
  );
END;
$$;
