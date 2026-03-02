-- v3: Also filter self-references and normalize trailing 's' for plurals
-- e.g. "eleads" → "elead" matches "Elead"

CREATE OR REPLACE FUNCTION public._norm_vendor(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(lower(trim(t)), '[^a-z0-9]', '', 'g'),
    's$', '', 'g'  -- strip trailing s for plural matching
  );
$$;

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
  self_norm TEXT := public._norm_vendor(p_vendor_name);
BEGIN
  -- Count totals (exclude self-references)
  SELECT COUNT(*) INTO to_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'to'
    AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm;

  SELECT COUNT(*) INTO from_count
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND switching_signal->>'direction' = 'from'
    AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm;

  -- Aggregate to_sources (gained from)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('vendor', d.display_name, 'count', d.cnt)
    ORDER BY d.cnt DESC
  ), '[]'::jsonb)
  INTO to_sources
  FROM (
    SELECT
      COALESCE(
        (SELECT vm2.vendor_name
         FROM public.vendor_mentions vm2
         WHERE public._norm_vendor(vm2.vendor_name) = grp.norm_key
         LIMIT 1),
        grp.best_variant
      ) AS display_name,
      grp.cnt
    FROM (
      SELECT
        public._norm_vendor(switching_signal->>'other_vendor') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'to'
        AND switching_signal->>'other_vendor' IS NOT NULL
        AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm
      GROUP BY public._norm_vendor(switching_signal->>'other_vendor')
    ) grp
  ) d;

  -- Aggregate from_destinations (lost to)
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
         WHERE public._norm_vendor(vm2.vendor_name) = grp.norm_key
         LIMIT 1),
        grp.best_variant
      ) AS display_name,
      grp.cnt
    FROM (
      SELECT
        public._norm_vendor(switching_signal->>'other_vendor') AS norm_key,
        MODE() WITHIN GROUP (ORDER BY switching_signal->>'other_vendor') AS best_variant,
        COUNT(*) AS cnt
      FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'from'
        AND switching_signal->>'other_vendor' IS NOT NULL
        AND public._norm_vendor(switching_signal->>'other_vendor') <> self_norm
      GROUP BY public._norm_vendor(switching_signal->>'other_vendor')
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
