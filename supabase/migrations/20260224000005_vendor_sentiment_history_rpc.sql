-- Migration: Add RPC to return monthly sentiment history for a vendor
-- Used by the vendor dashboard "Sentiment Over Time" chart

CREATE OR REPLACE FUNCTION public.get_vendor_sentiment_history(
  p_vendor_name TEXT,
  p_months INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.month), '[]'::jsonb)
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
    WHERE vendor_name = p_vendor_name
      AND conversation_time >= date_trunc('month', now()) - (p_months || ' months')::interval
    GROUP BY date_trunc('month', conversation_time)
    ORDER BY date_trunc('month', conversation_time)
  ) m;
$$;
