-- ============================================================
-- Normalize vendor name casing across all vendors
-- - Backfills existing public.vendor_mentions to a single casing
--   per case-insensitive vendor key.
-- - Ensures WAM -> public sync uses the canonical casing.
-- ============================================================

-- 1) Canonical casing helper
CREATE OR REPLACE FUNCTION public.canonical_vendor_name_case(p_vendor_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_input TEXT;
  v_canonical TEXT;
  v_entity_id UUID;
BEGIN
  v_input := NULLIF(trim(coalesce(p_vendor_name, '')), '');
  IF v_input IS NULL THEN
    RETURN p_vendor_name;
  END IF;

  -- Prefer canonical vendor family name when mapped.
  BEGIN
    SELECT r.vendor_entity_id
    INTO v_entity_id
    FROM public.resolve_vendor_family(v_input, NULL, NULL, NULL) r
    LIMIT 1;

    IF v_entity_id IS NOT NULL THEN
      SELECT ve.canonical_name INTO v_canonical
      FROM public.vendor_entities ve
      WHERE ve.id = v_entity_id
      LIMIT 1;

      IF v_canonical IS NOT NULL AND v_canonical <> '' THEN
        RETURN v_canonical;
      END IF;
    END IF;
  EXCEPTION
    WHEN undefined_function THEN
      -- If resolve_vendor_family doesn't exist in an environment, fall back.
      NULL;
  END;

  -- Otherwise, use the most frequent existing casing in public.vendor_mentions.
  SELECT x.vendor_name
  INTO v_canonical
  FROM (
    SELECT vendor_name, COUNT(*) AS cnt
    FROM public.vendor_mentions
    WHERE lower(vendor_name) = lower(v_input)
    GROUP BY vendor_name
    ORDER BY cnt DESC, vendor_name ASC
    LIMIT 1
  ) x;

  RETURN COALESCE(v_canonical, v_input);
END;
$$;

-- 2) Backfill all existing vendor_mentions to canonical casing
WITH variants AS (
  SELECT
    lower(vendor_name) AS key_name,
    vendor_name,
    COUNT(*) AS cnt
  FROM public.vendor_mentions
  GROUP BY lower(vendor_name), vendor_name
),
chosen AS (
  SELECT DISTINCT ON (key_name)
    key_name,
    vendor_name AS canonical_name
  FROM variants
  ORDER BY key_name, cnt DESC, vendor_name ASC
)
UPDATE public.vendor_mentions vm
SET vendor_name = c.canonical_name
FROM chosen c
WHERE lower(vm.vendor_name) = c.key_name
  AND vm.vendor_name <> c.canonical_name;

-- 3) Enforce canonical casing on WAM sync function
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
  v_vendor_name TEXT;
BEGIN
  v_vendor_name := public.canonical_vendor_name_case(p_vendor_name);

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
    v_vendor_name,
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

-- 4) Re-run backfill through sync function so newly inserted rows also use canonical case
SELECT public.backfill_wam_processed_mentions_to_public(50000);

GRANT EXECUTE ON FUNCTION public.canonical_vendor_name_case(TEXT) TO service_role;
