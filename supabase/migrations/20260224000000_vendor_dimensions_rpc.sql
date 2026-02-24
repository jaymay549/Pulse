-- RPC function to aggregate dimension/sentiment data for a vendor
CREATE OR REPLACE FUNCTION public.get_vendor_dimensions(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
  FROM (
    SELECT
      dimension,
      COUNT(*) AS mention_count,
      COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive_count,
      COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative_count,
      COUNT(*) FILTER (WHERE sentiment = 'mixed') AS mixed_count,
      COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE sentiment = 'positive') / NULLIF(COUNT(*), 0)
      ) AS positive_percent
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND dimension IS NOT NULL
      AND dimension != 'other'
    GROUP BY dimension
    ORDER BY COUNT(*) DESC
  ) d;
$$;
