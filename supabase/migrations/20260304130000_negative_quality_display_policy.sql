-- ============================================================
-- Negative Mention Display Policy
-- - Adds quality/rewrite fields to vendor_mentions
-- - Adds v3 RPC wrappers that surface display-aware quote payloads
-- ============================================================

ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'raw'
    CHECK (display_mode IN ('raw', 'rewritten_negative')),
  ADD COLUMN IF NOT EXISTS display_text TEXT,
  ADD COLUMN IF NOT EXISTS quality_score INTEGER
    CHECK (quality_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS evidence_level TEXT
    CHECK (evidence_level IN ('none', 'weak', 'moderate', 'strong')),
  ADD COLUMN IF NOT EXISTS is_opinion_heavy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rewrite_confidence NUMERIC(5,4)
    CHECK (rewrite_confidence >= 0 AND rewrite_confidence <= 1),
  ADD COLUMN IF NOT EXISTS rewrite_model_version TEXT,
  ADD COLUMN IF NOT EXISTS rewrite_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rewrite_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rewrite_status IN ('pending', 'done', 'failed'));

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_display_mode
  ON public.vendor_mentions(display_mode);

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_rewrite_status
  ON public.vendor_mentions(rewrite_status);

COMMENT ON COLUMN public.vendor_mentions.display_mode IS 'raw = show quote as-is; rewritten_negative = show display_text for warning mentions';
COMMENT ON COLUMN public.vendor_mentions.display_text IS 'AI-normalized display text for low-signal warning mentions';
COMMENT ON COLUMN public.vendor_mentions.quality_score IS '0-100 mention quality score used for ranking/filter decisions';
COMMENT ON COLUMN public.vendor_mentions.evidence_level IS 'none/weak/moderate/strong evidence level from enrichment';
COMMENT ON COLUMN public.vendor_mentions.is_opinion_heavy IS 'true when mention is mostly subjective/opinion without concrete evidence';

-- Backfill safe defaults on older rows.
UPDATE public.vendor_mentions
SET
  display_mode = 'raw',
  display_text = NULL,
  quality_score = COALESCE(quality_score, CASE WHEN type = 'warning' THEN 55 ELSE 70 END),
  evidence_level = COALESCE(evidence_level, CASE WHEN type = 'warning' THEN 'weak' ELSE 'moderate' END),
  is_opinion_heavy = COALESCE(is_opinion_heavy, false),
  rewrite_status = COALESCE(rewrite_status, 'pending')
WHERE
  quality_score IS NULL
  OR evidence_level IS NULL
  OR rewrite_status IS NULL;

-- ── v3 wrappers (display-aware payloads) ─────────────────────
CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v3(
  p_category TEXT DEFAULT NULL,
  p_vendor_name TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_product_line_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 40,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_base JSONB;
  v_mentions JSONB;
BEGIN
  v_base := public.get_vendor_pulse_feed_v2(
    p_category,
    p_vendor_name,
    p_type,
    p_search,
    p_product_line_slug,
    p_limit,
    p_offset
  );

  SELECT COALESCE(
    jsonb_agg(
      (m - 'quote') || jsonb_build_object(
        'quote', COALESCE(
          CASE WHEN vm.display_mode = 'rewritten_negative' THEN vm.display_text END,
          vm.quote,
          m->>'quote'
        ),
        'rawQuote', vm.quote,
        'displayMode', COALESCE(vm.display_mode, 'raw'),
        'qualityScore', vm.quality_score,
        'evidenceLevel', vm.evidence_level,
        'isOpinionHeavy', vm.is_opinion_heavy,
        'rewriteConfidence', vm.rewrite_confidence
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM jsonb_array_elements(COALESCE(v_base->'mentions', '[]'::jsonb)) m
  LEFT JOIN public.vendor_mentions vm
    ON vm.id::TEXT = (m->>'id');

  RETURN jsonb_set(v_base, '{mentions}', v_mentions, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_profile_v3(
  p_vendor_name TEXT,
  p_product_line_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_base JSONB;
  v_mentions JSONB;
BEGIN
  v_base := public.get_vendor_profile_v2(p_vendor_name, p_product_line_slug);

  SELECT COALESCE(
    jsonb_agg(
      (m - 'quote') || jsonb_build_object(
        'quote', COALESCE(
          CASE WHEN vm.display_mode = 'rewritten_negative' THEN vm.display_text END,
          vm.quote,
          m->>'quote'
        ),
        'rawQuote', vm.quote,
        'displayMode', COALESCE(vm.display_mode, 'raw'),
        'qualityScore', vm.quality_score,
        'evidenceLevel', vm.evidence_level,
        'isOpinionHeavy', vm.is_opinion_heavy,
        'rewriteConfidence', vm.rewrite_confidence
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM jsonb_array_elements(COALESCE(v_base->'mentions', '[]'::jsonb)) m
  LEFT JOIN public.vendor_mentions vm
    ON vm.id::TEXT = (m->>'id');

  RETURN jsonb_set(v_base, '{mentions}', v_mentions, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vendor_pulse_feed_v3(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_profile_v3(TEXT, TEXT) TO authenticated, anon, service_role;
