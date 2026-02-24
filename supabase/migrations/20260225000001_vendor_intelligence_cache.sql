-- ============================================================
-- Vendor Intelligence Cache
-- Replaces vendor_pulse_summaries with adaptive state support
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_intelligence_cache (
  vendor_name TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('rich', 'thin', 'empty')),
  summary_text TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'mixed', 'neutral')),
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  top_dimension TEXT,
  stats JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  mention_count_at_generation INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.vendor_intelligence_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read intelligence cache"
  ON public.vendor_intelligence_cache FOR SELECT
  USING (true);

-- Migrate existing data from vendor_pulse_summaries
INSERT INTO public.vendor_intelligence_cache (
  vendor_name,
  state,
  summary_text,
  stats,
  mention_count_at_generation,
  generated_at
)
SELECT
  vendor_name,
  CASE
    WHEN mention_count_at_generation >= 5 THEN 'rich'::TEXT
    WHEN mention_count_at_generation > 0 THEN 'thin'::TEXT
    ELSE 'empty'::TEXT
  END,
  summary_text,
  jsonb_build_object(
    'total', mention_count_at_generation,
    'positive', 0,
    'warnings', 0,
    'external_count', 0
  ),
  mention_count_at_generation,
  generated_at
FROM public.vendor_pulse_summaries
ON CONFLICT (vendor_name) DO NOTHING;

-- Mark old table as deprecated
COMMENT ON TABLE public.vendor_pulse_summaries
  IS 'DEPRECATED — replaced by vendor_intelligence_cache. Safe to drop after verification.';
