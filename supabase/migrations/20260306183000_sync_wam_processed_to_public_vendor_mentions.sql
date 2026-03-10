-- ============================================================
-- Sync WAM processed mentions -> public.vendor_mentions
-- Ensures app-facing vendor search/feed stays current even if
-- upstream processing writes only to wam.vendor_mentions_processed.
-- ============================================================

-- 1) Upsert helper for a single processed row
CREATE OR REPLACE FUNCTION public.sync_single_wam_processed_mention(
  p_id TEXT,
  p_vendor_name TEXT,
  p_category TEXT,
  p_sentiment TEXT,
  p_snippet_anon TEXT,
  p_headline TEXT,
  p_dimension TEXT,
  p_conversation_time TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type public.review_type;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Map sentiment to existing enum used by public.vendor_mentions.
  -- Positive stays positive; everything else becomes warning.
  v_type := CASE
    WHEN lower(coalesce(p_sentiment, '')) = 'positive' THEN 'positive'::public.review_type
    ELSE 'warning'::public.review_type
  END;

  v_created_at := COALESCE(NULLIF(p_conversation_time, '')::timestamptz, now());

  INSERT INTO public.vendor_mentions (
    id,
    vendor_name,
    category,
    type,
    title,
    quote,
    explanation,
    dimension,
    conversation_time,
    created_at,
    source,
    is_hidden
  )
  VALUES (
    p_id,
    p_vendor_name,
    COALESCE(NULLIF(p_category, ''), 'other'),
    v_type,
    COALESCE(NULLIF(p_headline, ''), 'Vendor mention'),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_dimension, ''), 'other'),
    v_created_at,
    v_created_at,
    'community',
    false
  )
  ON CONFLICT (id) DO UPDATE
  SET
    vendor_name = EXCLUDED.vendor_name,
    category = EXCLUDED.category,
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    quote = EXCLUDED.quote,
    explanation = EXCLUDED.explanation,
    dimension = EXCLUDED.dimension,
    conversation_time = EXCLUDED.conversation_time,
    created_at = LEAST(public.vendor_mentions.created_at, EXCLUDED.created_at),
    source = EXCLUDED.source,
    is_hidden = false;
END;
$$;

-- 2) Trigger wrapper
CREATE OR REPLACE FUNCTION public.sync_wam_processed_mention_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.sync_single_wam_processed_mention(
    NEW.id,
    NEW.vendor_name,
    NEW.category,
    NEW.sentiment,
    NEW.snippet_anon,
    NEW.headline,
    NEW.dimension,
    NEW.conversation_time
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger idempotently
DROP TRIGGER IF EXISTS trg_sync_wam_processed_to_public_mentions ON wam.vendor_mentions_processed;
CREATE TRIGGER trg_sync_wam_processed_to_public_mentions
AFTER INSERT OR UPDATE OF vendor_name, category, sentiment, snippet_anon, headline, dimension, conversation_time
ON wam.vendor_mentions_processed
FOR EACH ROW
EXECUTE FUNCTION public.sync_wam_processed_mention_trigger();

-- 3) Backfill helper to sync historical processed rows
CREATE OR REPLACE FUNCTION public.backfill_wam_processed_mentions_to_public(
  p_limit INTEGER DEFAULT 20000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_synced INTEGER := 0;
BEGIN
  WITH candidates AS (
    SELECT
      w.id,
      w.vendor_name,
      w.category,
      w.sentiment,
      w.snippet_anon,
      w.headline,
      w.dimension,
      w.conversation_time
    FROM wam.vendor_mentions_processed w
    LEFT JOIN public.vendor_mentions p
      ON p.id = w.id
    WHERE p.id IS NULL
    ORDER BY NULLIF(w.conversation_time, '')::timestamptz DESC NULLS LAST, w.id DESC
    LIMIT COALESCE(p_limit, 20000)
  )
  INSERT INTO public.vendor_mentions (
    id,
    vendor_name,
    category,
    type,
    title,
    quote,
    explanation,
    dimension,
    conversation_time,
    created_at,
    source,
    is_hidden
  )
  SELECT
    c.id,
    c.vendor_name,
    COALESCE(NULLIF(c.category, ''), 'other'),
    CASE
      WHEN lower(coalesce(c.sentiment, '')) = 'positive' THEN 'positive'::public.review_type
      ELSE 'warning'::public.review_type
    END,
    COALESCE(NULLIF(c.headline, ''), 'Vendor mention'),
    COALESCE(NULLIF(c.snippet_anon, ''), ''),
    COALESCE(NULLIF(c.snippet_anon, ''), ''),
    COALESCE(NULLIF(c.dimension, ''), 'other'),
    COALESCE(NULLIF(c.conversation_time, '')::timestamptz, now()),
    COALESCE(NULLIF(c.conversation_time, '')::timestamptz, now()),
    'community',
    false
  FROM candidates c
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_synced = ROW_COUNT;
  RETURN v_synced;
END;
$$;

-- Run a first backfill immediately
SELECT public.backfill_wam_processed_mentions_to_public(50000);

-- Grants
GRANT EXECUTE ON FUNCTION public.sync_single_wam_processed_mention(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_wam_processed_mentions_to_public(INTEGER) TO service_role;
