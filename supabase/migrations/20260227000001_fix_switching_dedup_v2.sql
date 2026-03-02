-- Fix switching intelligence dedup: strip ALL non-alphanumeric chars before grouping
-- so "drive centric" / "DriveCentric" / "Drive-Centric" all become "drivecentric".
-- Also resolves display name from the canonical vendor_mentions.vendor_name table.

CREATE OR REPLACE FUNCTION public.get_vendor_switching_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  to_count BIGINT;
  from_count BIGINT;
  to_sources JSONB;
  from_destinations JSONB;
BEGIN
  -- Count totals
  SELECT COUNT(*) INTO to_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'to';

  SELECT COUNT(*) INTO from_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'from';

  -- Aggregate to_sources with aggressive normalization
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vendor', d.display_name, 'count', d.cnt)
    ORDER BY d.cnt DESC
  ), '[]'::jsonb)
  INTO to_sources
  FROM (
    SELECT
      COALESCE(
        -- Try to find a canonical vendor_name using the same normalization
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE regexp_replace(lower(vm2.vendor_name), '[^a-z0-9]', '', 'g') = grp.norm_key
         LIMIT 1),
        grp.best_variant
      ) AS display_name,
      grp.cnt
    FROM (
      SELECT
        regexp_replace(lower(switching_signal->>'other_vendor'), '[^a-z0-9]', '', 'g') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'to'
        AND switching_signal->>'other_vendor' IS NOT NULL
      GROUP BY regexp_replace(lower(switching_signal->>'other_vendor'), '[^a-z0-9]', '', 'g')
    ) grp
  ) d;

  -- Aggregate from_destinations with aggressive normalization
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vendor', d.display_name, 'count', d.cnt)
    ORDER BY d.cnt DESC
  ), '[]'::jsonb)
  INTO from_destinations
  FROM (
    SELECT
      COALESCE(
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE regexp_replace(lower(vm2.vendor_name), '[^a-z0-9]', '', 'g') = grp.norm_key
         LIMIT 1),
        grp.best_variant
      ) AS display_name,
      grp.cnt
    FROM (
      SELECT
        regexp_replace(lower(switching_signal->>'other_vendor'), '[^a-z0-9]', '', 'g') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'from'
        AND switching_signal->>'other_vendor' IS NOT NULL
      GROUP BY regexp_replace(lower(switching_signal->>'other_vendor'), '[^a-z0-9]', '', 'g')
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
