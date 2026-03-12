-- ============================================================
-- Make dashboard RPCs entity-aware
-- Fixes get_vendor_dimensions and get_vendor_sentiment_history
-- to use vendor_entity_id resolution (like the v2/v3 feed/profile)
-- so CDK family mentions (Elead, Roadster, etc.) are included.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vendor_dimensions(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(d))
    FROM (
      SELECT
        dimension,
        COUNT(*) AS mention_count,
        COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE type = 'warning') AS negative_count,
        0 AS mixed_count,
        0 AS neutral_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE type = 'positive') / NULLIF(COUNT(*), 0)
        ) AS positive_percent
      FROM public.vendor_mentions
      WHERE (
        (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
      )
        AND is_hidden = false
        AND dimension IS NOT NULL
        AND dimension != 'other'
      GROUP BY dimension
      ORDER BY COUNT(*) DESC
    ) d
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_sentiment_history(
  p_vendor_name TEXT,
  p_months INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(m) ORDER BY m.month)
    FROM (
      SELECT
        to_char(date_trunc('month', conversation_time), 'YYYY-MM') AS month,
        COUNT(*) AS total_mentions,
        COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE type = 'warning') AS warning_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE type = 'positive') / NULLIF(COUNT(*), 0)
        ) AS positive_percent
      FROM public.vendor_mentions
      WHERE (
        (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
      )
        AND is_hidden = false
        AND conversation_time >= date_trunc('month', now()) - (p_months || ' months')::interval
      GROUP BY date_trunc('month', conversation_time)
      ORDER BY date_trunc('month', conversation_time)
    ) m
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_dimensions(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_sentiment_history(TEXT, INTEGER) TO authenticated, anon, service_role;
