-- ============================================================
-- Remove fuzzy entity resolution to prevent cross-vendor linking
--
-- The fuzzy match (step 3) in resolve_vendor_family was matching
-- alias text in the full mention blob (vendor + title + quote),
-- which caused mentions to be linked to the wrong entity when
-- another vendor was mentioned in passing.
--
-- Now only exact matches on vendor_name are used. Fuzzy matches
-- are logged as suggestions for admin review.
-- ============================================================

-- ── Suggestions table for admin review ───────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_link_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  suggested_entity_id UUID NOT NULL REFERENCES public.vendor_entities(id),
  suggested_canonical TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'fuzzy',
  match_alias TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.vendor_link_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read vendor_link_suggestions"
  ON public.vendor_link_suggestions FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_vendor_link_suggestions_status
  ON public.vendor_link_suggestions(status) WHERE status = 'pending';

-- ── Replace resolve_vendor_family: exact match only ──────────
CREATE OR REPLACE FUNCTION public.resolve_vendor_family(
  p_vendor_name TEXT,
  p_title TEXT DEFAULT NULL,
  p_quote TEXT DEFAULT NULL,
  p_explanation TEXT DEFAULT NULL
)
RETURNS TABLE (
  vendor_entity_id UUID,
  vendor_product_line_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_entity_id UUID;
  v_product_line_id UUID;
BEGIN
  -- 1) Exact alias match on vendor name
  SELECT am.vendor_entity_id, am.vendor_product_line_id
  INTO v_entity_id, v_product_line_id
  FROM public.vendor_alias_mappings am
  WHERE lower(am.alias_text) = lower(coalesce(p_vendor_name, ''))
  ORDER BY am.confidence DESC
  LIMIT 1;

  -- 2) Exact canonical name match
  IF v_entity_id IS NULL THEN
    SELECT ve.id, NULL::UUID
    INTO v_entity_id, v_product_line_id
    FROM public.vendor_entities ve
    WHERE lower(ve.canonical_name) = lower(coalesce(p_vendor_name, ''))
    LIMIT 1;
  END IF;

  -- No fuzzy matching — prevents cross-vendor contamination.
  -- Fuzzy suggestions are handled separately via admin review.

  RETURN QUERY SELECT v_entity_id, v_product_line_id;
END;
$$;

-- ── Replace resolve_vendor_family_name_only: same fix ────────
CREATE OR REPLACE FUNCTION public.resolve_vendor_family_name_only(
  p_vendor_name TEXT
)
RETURNS TABLE (
  vendor_entity_id UUID,
  vendor_product_line_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_entity_id UUID;
  v_product_line_id UUID;
BEGIN
  -- 1) Exact alias match
  SELECT am.vendor_entity_id, am.vendor_product_line_id
  INTO v_entity_id, v_product_line_id
  FROM public.vendor_alias_mappings am
  WHERE lower(am.alias_text) = lower(coalesce(p_vendor_name, ''))
  ORDER BY am.confidence DESC
  LIMIT 1;

  -- 2) Exact canonical name
  IF v_entity_id IS NULL THEN
    SELECT ve.id, NULL::UUID
    INTO v_entity_id, v_product_line_id
    FROM public.vendor_entities ve
    WHERE lower(ve.canonical_name) = lower(coalesce(p_vendor_name, ''))
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_entity_id, v_product_line_id;
END;
$$;

-- ── RPC: Get pending link suggestions for admin ──────────────
CREATE OR REPLACE FUNCTION public.admin_get_link_suggestions(
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'mention_id', s.mention_id,
        'vendor_name', s.vendor_name,
        'suggested_entity_id', s.suggested_entity_id,
        'suggested_canonical', s.suggested_canonical,
        'match_type', s.match_type,
        'match_alias', s.match_alias,
        'created_at', s.created_at
      ) ORDER BY s.created_at DESC
    )
    FROM public.vendor_link_suggestions s
    WHERE s.status = 'pending'
    LIMIT p_limit
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_link_suggestions(INTEGER) TO authenticated, service_role;

-- ── RPC: Approve or reject a link suggestion ─────────────────
CREATE OR REPLACE FUNCTION public.admin_resolve_link_suggestion(
  p_suggestion_id UUID,
  p_action TEXT -- 'approve' or 'reject'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion RECORD;
BEGIN
  SELECT * INTO v_suggestion
  FROM public.vendor_link_suggestions
  WHERE id = p_suggestion_id AND status = 'pending';

  IF v_suggestion IS NULL THEN
    RETURN jsonb_build_object('error', 'Suggestion not found or already resolved');
  END IF;

  IF p_action = 'approve' THEN
    -- Link the mention to the suggested entity
    UPDATE public.vendor_mentions
    SET vendor_entity_id = v_suggestion.suggested_entity_id
    WHERE id = v_suggestion.mention_id;

    -- Register the alias for future auto-resolution
    INSERT INTO public.vendor_alias_mappings (alias_text, vendor_entity_id, confidence, source)
    VALUES (lower(v_suggestion.vendor_name), v_suggestion.suggested_entity_id, 0.9, 'admin_approved')
    ON CONFLICT (alias_text) DO UPDATE
      SET vendor_entity_id = EXCLUDED.vendor_entity_id,
          confidence = GREATEST(vendor_alias_mappings.confidence, EXCLUDED.confidence);
  END IF;

  UPDATE public.vendor_link_suggestions
  SET status = p_action || 'd', reviewed_at = now()
  WHERE id = p_suggestion_id;

  RETURN jsonb_build_object(
    'action', p_action,
    'vendor_name', v_suggestion.vendor_name,
    'suggestion_id', p_suggestion_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_link_suggestion(UUID, TEXT) TO authenticated, service_role;
