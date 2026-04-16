-- Migration: tier_component_config
-- Phase 4 Plan 01: Tier Config Foundation
-- Creates admin-configurable tier-component visibility mappings

-- 1. Create tier_component_config table
CREATE TABLE public.tier_component_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL
    CHECK (tier IN ('tier_1', 'tier_2', 'test')),
  component_key TEXT NOT NULL
    CHECK (component_key IN (
      'intelligence', 'overview', 'segments', 'mentions', 'profile',
      'intel', 'dimensions', 'demo-requests', 'screenshots', 'categories',
      'dealer-signals'
    )),
  visibility TEXT NOT NULL DEFAULT 'full'
    CHECK (visibility IN ('full', 'gated', 'hidden')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tier, component_key)
);

-- No RLS enabled intentionally — this table is read by admin panel only.
-- Tier gating is a frontend-only layer on top of existing RLS safety net.
-- See PROJECT.md "Out of Scope" for rationale.
COMMENT ON TABLE public.tier_component_config IS
  'Admin-configurable tier-component visibility. No RLS — read by admin panel only. Phase 4 (v1.1).';

-- 2. Seed default rows: 3 tiers x 11 components = 33 rows

-- tier_1: 7 full, 4 hidden (matching current T2_ONLY_SECTIONS hardcoding)
INSERT INTO public.tier_component_config (tier, component_key, visibility) VALUES
  ('tier_1', 'intelligence',    'full'),
  ('tier_1', 'overview',        'full'),
  ('tier_1', 'segments',        'full'),
  ('tier_1', 'profile',         'full'),
  ('tier_1', 'intel',           'full'),
  ('tier_1', 'screenshots',     'full'),
  ('tier_1', 'categories',      'full'),
  ('tier_1', 'mentions',        'hidden'),
  ('tier_1', 'dimensions',      'hidden'),
  ('tier_1', 'dealer-signals',  'hidden'),
  ('tier_1', 'demo-requests',   'hidden');

-- tier_2: all 11 components full
INSERT INTO public.tier_component_config (tier, component_key, visibility) VALUES
  ('tier_2', 'intelligence',    'full'),
  ('tier_2', 'overview',        'full'),
  ('tier_2', 'segments',        'full'),
  ('tier_2', 'profile',         'full'),
  ('tier_2', 'intel',           'full'),
  ('tier_2', 'screenshots',     'full'),
  ('tier_2', 'categories',      'full'),
  ('tier_2', 'mentions',        'full'),
  ('tier_2', 'dimensions',      'full'),
  ('tier_2', 'dealer-signals',  'full'),
  ('tier_2', 'demo-requests',   'full');

-- test: copy tier_2 defaults (all full) — admin can customize later
INSERT INTO public.tier_component_config (tier, component_key, visibility) VALUES
  ('test', 'intelligence',    'full'),
  ('test', 'overview',        'full'),
  ('test', 'segments',        'full'),
  ('test', 'profile',         'full'),
  ('test', 'intel',           'full'),
  ('test', 'screenshots',     'full'),
  ('test', 'categories',      'full'),
  ('test', 'mentions',        'full'),
  ('test', 'dimensions',      'full'),
  ('test', 'dealer-signals',  'full'),
  ('test', 'demo-requests',   'full');

-- 3. Upsert RPC — persist individual cell changes from admin UI (ACONF-04)
CREATE OR REPLACE FUNCTION public.upsert_tier_component_config(
  p_tier TEXT,
  p_component_key TEXT,
  p_visibility TEXT
)
RETURNS public.tier_component_config
LANGUAGE sql
SECURITY INVOKER
AS $$
  INSERT INTO public.tier_component_config (tier, component_key, visibility, updated_at)
  VALUES (p_tier, p_component_key, p_visibility, now())
  ON CONFLICT (tier, component_key)
  DO UPDATE SET
    visibility = EXCLUDED.visibility,
    updated_at = now()
  RETURNING *;
$$;

COMMENT ON FUNCTION public.upsert_tier_component_config IS
  'Upserts a single tier-component visibility row. Called by admin tier config panel.';

-- 4. Get all config RPC — consistent data access through RPCs
CREATE OR REPLACE FUNCTION public.get_tier_component_config()
RETURNS SETOF public.tier_component_config
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT * FROM public.tier_component_config
  ORDER BY tier, component_key;
$$;

COMMENT ON FUNCTION public.get_tier_component_config IS
  'Returns all tier-component visibility config rows ordered by tier and component_key.';
