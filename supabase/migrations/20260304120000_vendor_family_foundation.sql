-- ============================================================
-- Vendor Family Foundation (generic canonical vendor + product line model)
-- Adds:
-- - Canonical vendor entities
-- - Product lines under each entity
-- - Alias mappings for normalization
-- - vendor_mentions foreign keys for entity/product line
-- - v2 RPCs that support product line filtering
-- ============================================================

-- ── Canonical entities ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_product_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_entity_id UUID NOT NULL REFERENCES public.vendor_entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_entity_id, name),
  UNIQUE (vendor_entity_id, slug)
);

CREATE TABLE IF NOT EXISTS public.vendor_alias_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_text TEXT NOT NULL UNIQUE,
  vendor_entity_id UUID NOT NULL REFERENCES public.vendor_entities(id) ON DELETE CASCADE,
  vendor_product_line_id UUID REFERENCES public.vendor_product_lines(id) ON DELETE SET NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_alias_mappings_lower_alias
  ON public.vendor_alias_mappings (lower(alias_text));

CREATE INDEX IF NOT EXISTS idx_vendor_product_lines_entity
  ON public.vendor_product_lines (vendor_entity_id);

-- ── Mention-level canonical references ───────────────────────
-- Some environments may have an older vendor_mentions schema.
-- Ensure text fields used by resolver/feed/profile RPCs exist.
ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS quote TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS conversation_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS vendor_entity_id UUID REFERENCES public.vendor_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_product_line_id UUID REFERENCES public.vendor_product_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_entity
  ON public.vendor_mentions (vendor_entity_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_product_line
  ON public.vendor_mentions (vendor_product_line_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_entity_product_line
  ON public.vendor_mentions (vendor_entity_id, vendor_product_line_id);

-- ── Resolver helpers ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._slugify_vendor_token(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

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
  v_blob TEXT;
BEGIN
  v_blob := lower(
    coalesce(p_vendor_name, '') || ' ' ||
    coalesce(p_title, '') || ' ' ||
    coalesce(p_quote, '') || ' ' ||
    coalesce(p_explanation, '')
  );

  -- 1) Exact alias match on vendor name first.
  SELECT am.vendor_entity_id, am.vendor_product_line_id
  INTO v_entity_id, v_product_line_id
  FROM public.vendor_alias_mappings am
  WHERE lower(am.alias_text) = lower(coalesce(p_vendor_name, ''))
  ORDER BY am.confidence DESC
  LIMIT 1;

  -- 2) Exact canonical vendor name.
  IF v_entity_id IS NULL THEN
    SELECT ve.id, NULL::UUID
    INTO v_entity_id, v_product_line_id
    FROM public.vendor_entities ve
    WHERE lower(ve.canonical_name) = lower(coalesce(p_vendor_name, ''))
    LIMIT 1;
  END IF;

  -- 3) Fuzzy token match by aliases in mention context.
  IF v_entity_id IS NULL THEN
    SELECT am.vendor_entity_id, am.vendor_product_line_id
    INTO v_entity_id, v_product_line_id
    FROM public.vendor_alias_mappings am
    WHERE v_blob LIKE '%' || lower(am.alias_text) || '%'
    ORDER BY length(am.alias_text) DESC, am.confidence DESC
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_entity_id, v_product_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_vendor_family_mapping()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_id UUID;
  v_product_line_id UUID;
BEGIN
  IF NEW.vendor_entity_id IS NULL OR NEW.vendor_product_line_id IS NULL THEN
    SELECT r.vendor_entity_id, r.vendor_product_line_id
    INTO v_entity_id, v_product_line_id
    FROM public.resolve_vendor_family(
      NEW.vendor_name,
      NEW.title,
      NEW.quote,
      NEW.explanation
    ) r
    LIMIT 1;

    IF NEW.vendor_entity_id IS NULL THEN
      NEW.vendor_entity_id := v_entity_id;
    END IF;
    IF NEW.vendor_product_line_id IS NULL THEN
      NEW.vendor_product_line_id := v_product_line_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_vendor_family_mapping ON public.vendor_mentions;
CREATE TRIGGER trg_apply_vendor_family_mapping
BEFORE INSERT OR UPDATE OF vendor_name, title, quote, explanation
ON public.vendor_mentions
FOR EACH ROW
EXECUTE FUNCTION public.apply_vendor_family_mapping();

CREATE OR REPLACE FUNCTION public.backfill_vendor_mentions_family(p_limit INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH to_update AS (
    SELECT vm.id,
           r.vendor_entity_id,
           r.vendor_product_line_id
    FROM public.vendor_mentions vm
    CROSS JOIN LATERAL public.resolve_vendor_family(vm.vendor_name, vm.title, vm.quote, vm.explanation) r
    WHERE (vm.vendor_entity_id IS NULL OR vm.vendor_product_line_id IS NULL)
      AND r.vendor_entity_id IS NOT NULL
    ORDER BY vm.id DESC
    LIMIT COALESCE(p_limit, 2147483647)
  )
  UPDATE public.vendor_mentions vm
  SET vendor_entity_id = tu.vendor_entity_id,
      vendor_product_line_id = COALESCE(vm.vendor_product_line_id, tu.vendor_product_line_id)
  FROM to_update tu
  WHERE vm.id = tu.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ── v2 Feed RPC (product-line aware) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_vendor_pulse_feed_v2(
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
  v_entity_id UUID;
  v_product_line_id UUID;
  v_total_count INTEGER;
  v_total_positive_count INTEGER;
  v_total_warning_count INTEGER;
  v_total_system_count INTEGER;
  v_has_more BOOLEAN;
  v_mentions JSONB;
  v_category_counts JSONB;
BEGIN
  IF p_vendor_name IS NOT NULL THEN
    SELECT r.vendor_entity_id INTO v_entity_id
    FROM public.resolve_vendor_family(p_vendor_name) r
    LIMIT 1;
  END IF;

  IF p_product_line_slug IS NOT NULL AND p_product_line_slug <> '' THEN
    SELECT vpl.id INTO v_product_line_id
    FROM public.vendor_product_lines vpl
    WHERE vpl.slug = p_product_line_slug
      AND (v_entity_id IS NULL OR vpl.vendor_entity_id = v_entity_id)
    LIMIT 1;
  END IF;

  WITH base AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND (p_category IS NULL OR vm.category = p_category)
      AND (
        p_vendor_name IS NULL OR
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name)) OR
        (ve.id IS NULL AND lower(vm.vendor_name) LIKE '%' || lower(p_vendor_name) || '%')
      )
      AND (
        p_search IS NULL OR
        lower(coalesce(vm.vendor_name, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.title, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.quote, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.explanation, '')) LIKE '%' || lower(p_search) || '%'
      )
      AND (
        v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id
      )
  ),
  typed AS (
    SELECT *
    FROM base
    WHERE (p_type IS NULL OR type = p_type)
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE type = 'positive')::INTEGER,
    COUNT(*) FILTER (WHERE type = 'warning')::INTEGER,
    COUNT(*) FILTER (WHERE type = 'system')::INTEGER
  INTO
    v_total_count,
    v_total_positive_count,
    v_total_warning_count,
    v_total_system_count
  FROM typed;

  WITH base AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND (p_category IS NULL OR vm.category = p_category)
      AND (
        p_vendor_name IS NULL OR
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name)) OR
        (ve.id IS NULL AND lower(vm.vendor_name) LIKE '%' || lower(p_vendor_name) || '%')
      )
      AND (
        p_search IS NULL OR
        lower(coalesce(vm.vendor_name, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.title, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.quote, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.explanation, '')) LIKE '%' || lower(p_search) || '%'
      )
      AND (
        v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id
      )
  )
  SELECT COALESCE(
    jsonb_object_agg(category, cnt),
    '{}'::jsonb
  )
  INTO v_category_counts
  FROM (
    SELECT category, COUNT(*)::INTEGER AS cnt
    FROM base
    GROUP BY category
  ) cc;

  WITH base AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
      AND (p_category IS NULL OR vm.category = p_category)
      AND (
        p_vendor_name IS NULL OR
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name)) OR
        (ve.id IS NULL AND lower(vm.vendor_name) LIKE '%' || lower(p_vendor_name) || '%')
      )
      AND (
        p_search IS NULL OR
        lower(coalesce(vm.vendor_name, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.title, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.quote, '')) LIKE '%' || lower(p_search) || '%' OR
        lower(coalesce(vm.explanation, '')) LIKE '%' || lower(p_search) || '%'
      )
      AND (
        v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id
      )
  ),
  typed AS (
    SELECT *
    FROM base
    WHERE (p_type IS NULL OR type = p_type)
    ORDER BY conversation_time DESC NULLS LAST, id DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'vendorName', t.vendor_name,
        'title', t.title,
        'quote', t.quote,
        'explanation', t.explanation,
        'type', t.type,
        'category', t.category,
        'conversationTime', t.conversation_time
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM typed t;

  v_has_more := (p_offset + p_limit) < COALESCE(v_total_count, 0);

  RETURN jsonb_build_object(
    'mentions', v_mentions,
    'totalCount', COALESCE(v_total_count, 0),
    'totalPositiveCount', COALESCE(v_total_positive_count, 0),
    'totalWarningCount', COALESCE(v_total_warning_count, 0),
    'totalSystemCount', COALESCE(v_total_system_count, 0),
    'categoryCounts', COALESCE(v_category_counts, '{}'::jsonb),
    'page', floor(p_offset / GREATEST(p_limit, 1))::INTEGER + 1,
    'pageSize', p_limit,
    'hasMore', v_has_more
  );
END;
$$;

-- ── v2 Vendor Profile RPC (product-line aware) ───────────────
CREATE OR REPLACE FUNCTION public.get_vendor_profile_v2(
  p_vendor_name TEXT,
  p_product_line_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID;
  v_entity_name TEXT;
  v_product_line_id UUID;
  v_mentions JSONB;
  v_categories TEXT[];
  v_stats JSONB;
  v_metadata JSONB;
  v_product_lines JSONB;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family(p_vendor_name) r
  LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT canonical_name INTO v_entity_name
    FROM public.vendor_entities
    WHERE id = v_entity_id;
  ELSE
    v_entity_name := p_vendor_name;
  END IF;

  IF p_product_line_slug IS NOT NULL AND p_product_line_slug <> '' THEN
    SELECT vpl.id INTO v_product_line_id
    FROM public.vendor_product_lines vpl
    WHERE vpl.slug = p_product_line_slug
      AND (v_entity_id IS NULL OR vpl.vendor_entity_id = v_entity_id)
    LIMIT 1;
  END IF;

  WITH scoped AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    WHERE vm.is_hidden = false
      AND (
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
      )
      AND (v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id)
  )
  SELECT jsonb_build_object(
      'totalMentions', COUNT(*)::INTEGER,
      'positiveCount', COUNT(*) FILTER (WHERE type = 'positive')::INTEGER,
      'warningCount', COUNT(*) FILTER (WHERE type = 'warning')::INTEGER,
      'positivePercent', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE type = 'positive')::NUMERIC / COUNT(*)::NUMERIC) * 100)::INTEGER END,
      'warningPercent', CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE type = 'warning')::NUMERIC / COUNT(*)::NUMERIC) * 100)::INTEGER END
    ),
    COALESCE(array_agg(DISTINCT category) FILTER (WHERE category IS NOT NULL), ARRAY[]::TEXT[])
  INTO v_stats, v_categories
  FROM scoped;

  WITH scoped AS (
    SELECT vm.*
    FROM public.vendor_mentions vm
    WHERE vm.is_hidden = false
      AND (
        (v_entity_id IS NOT NULL AND vm.vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vm.vendor_name) = lower(p_vendor_name))
      )
      AND (v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id)
    ORDER BY conversation_time DESC NULLS LAST, id DESC
    LIMIT 40
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'vendorName', s.vendor_name,
        'title', s.title,
        'quote', s.quote,
        'explanation', s.explanation,
        'type', s.type,
        'category', s.category,
        'conversationTime', s.conversation_time
      )
    ),
    '[]'::jsonb
  )
  INTO v_mentions
  FROM scoped s;

  SELECT jsonb_build_object(
    'website_url', vm.website_url,
    'logo_url', vm.logo_url,
    'description', vm.description,
    'category', vm.category,
    'linkedin_url', vm.linkedin_url,
    'banner_url', vm.banner_url,
    'tagline', vm.tagline,
    'headquarters', vm.headquarters
  )
  INTO v_metadata
  FROM public.vendor_metadata vm
  WHERE lower(vm.vendor_name) = lower(v_entity_name)
  LIMIT 1;

  IF v_entity_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', vpl.id,
          'name', vpl.name,
          'slug', vpl.slug,
          'mentionCount', COALESCE(ms.mention_count, 0)
        )
        ORDER BY COALESCE(ms.mention_count, 0) DESC, vpl.name ASC
      ),
      '[]'::jsonb
    )
    INTO v_product_lines
    FROM public.vendor_product_lines vpl
    LEFT JOIN (
      SELECT vendor_product_line_id, COUNT(*)::INTEGER AS mention_count
      FROM public.vendor_mentions
      WHERE is_hidden = false
        AND vendor_entity_id = v_entity_id
      GROUP BY vendor_product_line_id
    ) ms ON ms.vendor_product_line_id = vpl.id
    WHERE vpl.vendor_entity_id = v_entity_id
      AND vpl.is_active = true;
  ELSE
    v_product_lines := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'vendorName', v_entity_name,
    'stats', COALESCE(v_stats, '{}'::jsonb),
    'categories', COALESCE(to_jsonb(v_categories), '[]'::jsonb),
    'metadata', COALESCE(v_metadata, '{}'::jsonb),
    'insight', NULL,
    'mentions', COALESCE(v_mentions, '[]'::jsonb),
    'productLines', COALESCE(v_product_lines, '[]'::jsonb),
    'selectedProductLine', p_product_line_slug
  );
END;
$$;

-- ── v2 vendors list RPC (canonical-aware) ────────────────────
CREATE OR REPLACE FUNCTION public.get_vendor_pulse_vendors_list_v2()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'vendors',
    COALESCE(
      jsonb_agg(
        jsonb_build_object('name', x.name, 'count', x.count)
        ORDER BY x.count DESC
      ),
      '[]'::jsonb
    )
  )
  FROM (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS name,
      COUNT(*)::INTEGER AS count
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.is_hidden = false
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_vendor_family(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_vendor_mentions_family(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_pulse_feed_v2(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_profile_v2(TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_pulse_vendors_list_v2() TO authenticated, anon, service_role;
