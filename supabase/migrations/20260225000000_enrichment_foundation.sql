-- ============================================================
-- Vendor Enrichment Pipeline: Foundation Schema
-- Adds source tracking, external review queue, mention flags,
-- vendor custom content, and auto-summary columns.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add source tracking + hidden flag to vendor_mentions
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_review_id UUID;

-- Validate source values
ALTER TABLE public.vendor_mentions
  ADD CONSTRAINT chk_vendor_mentions_source
  CHECK (source IN ('community', 'external'));

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_hidden
  ON public.vendor_mentions (vendor_name, is_hidden);

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_source
  ON public.vendor_mentions (source);

-- ────────────────────────────────────────────────────────────
-- 2. External review queue
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.external_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  source TEXT NOT NULL
    CHECK (source IN ('g2', 'capterra', 'trustradius', 'reddit', 'google')),
  raw_text TEXT NOT NULL,
  raw_rating NUMERIC,
  source_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'transformed', 'rejected', 'duplicate')),
  error_message TEXT,
  transformed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ext_review_queue_status
  ON public.external_review_queue (status);
CREATE INDEX idx_ext_review_queue_vendor
  ON public.external_review_queue (vendor_name);

ALTER TABLE public.external_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage review queue"
  ON public.external_review_queue
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- ────────────────────────────────────────────────────────────
-- 3. Mention flags (vendor moderation)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mention_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id INTEGER NOT NULL,
  vendor_profile_id UUID NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('inaccurate', 'unfair', 'outdated', 'spam', 'other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'upheld', 'dismissed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mention_flags_status
  ON public.mention_flags (status);
CREATE INDEX idx_mention_flags_mention
  ON public.mention_flags (mention_id);
CREATE INDEX idx_mention_flags_vendor
  ON public.mention_flags (vendor_profile_id);

ALTER TABLE public.mention_flags ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own flags
CREATE POLICY "Vendors can read own flags"
  ON public.mention_flags FOR SELECT
  USING (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub') AND is_approved = true
    )
  );

-- Vendors can create flags
CREATE POLICY "Vendors can create flags"
  ON public.mention_flags FOR INSERT
  WITH CHECK (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub') AND is_approved = true
    )
  );

-- Admins can manage all flags
CREATE POLICY "Admins can manage all flags"
  ON public.mention_flags
  USING ((auth.jwt() ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

-- ────────────────────────────────────────────────────────────
-- 4. Vendor custom content (self-reported)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_custom_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL UNIQUE,
  highlights TEXT[],
  customer_segments TEXT[],
  integration_partners TEXT[],
  custom_description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vendor_custom_content_vendor
  ON public.vendor_custom_content (vendor_name);

ALTER TABLE public.vendor_custom_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read custom content"
  ON public.vendor_custom_content FOR SELECT
  USING (true);

CREATE POLICY "Vendors can manage own content"
  ON public.vendor_custom_content
  FOR ALL
  USING (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub') AND is_approved = true
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = (auth.jwt() ->> 'sub') AND is_approved = true
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5. Extend vendor_metadata with auto-summary columns
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.vendor_metadata
  ADD COLUMN IF NOT EXISTS auto_summary TEXT,
  ADD COLUMN IF NOT EXISTS auto_products TEXT[],
  ADD COLUMN IF NOT EXISTS auto_segments TEXT[],
  ADD COLUMN IF NOT EXISTS auto_integrations TEXT[],
  ADD COLUMN IF NOT EXISTS auto_summary_generated_at TIMESTAMPTZ;
