-- ============================================================
-- Extend WAM sync to attribute mentions to members
-- ============================================================

-- 1) Replace sync function to accept + use member_id
CREATE OR REPLACE FUNCTION public.sync_single_wam_processed_mention(
  p_id TEXT,
  p_vendor_name TEXT,
  p_category TEXT,
  p_sentiment TEXT,
  p_snippet_anon TEXT,
  p_headline TEXT,
  p_dimension TEXT,
  p_conversation_time TEXT,
  p_member_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type public.review_type;
  v_created_at TIMESTAMPTZ;
BEGIN
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
    is_hidden,
    member_id
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
    false,
    p_member_id
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
    is_hidden = false,
    member_id = COALESCE(EXCLUDED.member_id, public.vendor_mentions.member_id);
END;
$$;

-- 2) Helper: resolve member_id from message_ids text
CREATE OR REPLACE FUNCTION public.resolve_member_from_message_ids(
  p_message_ids TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_ids INT[];
  v_sender_number TEXT;
  v_member_id UUID;
BEGIN
  -- Parse "[332,472,473]" text into int array
  IF p_message_ids IS NULL OR p_message_ids = '' THEN
    RETURN NULL;
  END IF;

  v_ids := string_to_array(
    trim(both '[]' from replace(p_message_ids, ' ', '')),
    ','
  )::INT[];

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get sender_number from the first message
  SELECT m.sender_number INTO v_sender_number
  FROM wam.messages m
  WHERE m.id = v_ids[1]
  LIMIT 1;

  IF v_sender_number IS NULL THEN
    RETURN NULL;
  END IF;

  -- Match to member by whatsapp_number
  SELECT mb.id INTO v_member_id
  FROM public.members mb
  WHERE mb.whatsapp_number = v_sender_number
  LIMIT 1;

  RETURN v_member_id;
END;
$$;

-- 3) Replace trigger wrapper to resolve member before sync
CREATE OR REPLACE FUNCTION public.sync_wam_processed_mention_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  v_member_id := public.resolve_member_from_message_ids(NEW.message_ids);

  PERFORM public.sync_single_wam_processed_mention(
    NEW.id,
    NEW.vendor_name,
    NEW.category,
    NEW.sentiment,
    NEW.snippet_anon,
    NEW.headline,
    NEW.dimension,
    NEW.conversation_time,
    v_member_id
  );
  RETURN NEW;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.sync_single_wam_processed_mention(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_member_from_message_ids(TEXT) TO service_role;
