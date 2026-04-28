-- ============================================================
-- Enable RLS on vendor_mentions with tier-gated policies.
--
-- vendor_mentions currently has NO RLS (table predates migration-managed
-- schema, created by WAM backend). Enabling RLS without policies would
-- block ALL access including the existing dealer-facing public feed.
--
-- This migration adds all necessary policies in the same transaction:
--   1. anon policy: preserves public read (dealer feed at /vendors, /vendors/:slug)
--   2. authenticated policy: preserves Clerk dealer reads (NULL vendor_tier branch)
--                            + gates vendor sessions to T2-only own-vendor data
--
-- Critical design notes:
--   - vendor_tier() IS NULL branch: required because Clerk sessions have no
--     vendor_logins row. Without this branch, NULL = 'tier_2' evaluates to
--     NULL (denied) in SQL, silently blocking all authenticated dealer reads.
--     See Phase 3 Research Pitfall 2.
--   - lower() on both sides: vendor_logins.vendor_name comes from vendor_profiles
--     exact match; vendor_mentions.vendor_name is normalized by canonical_vendor_name_case().
--     Casing may differ (e.g., "Tekion" vs "TEKION"). See Research Pitfall 4.
--   - service_role bypasses RLS by default in Supabase — WAM backend writes
--     are unaffected by these policies.
-- ============================================================

-- Enable RLS (currently off — table predates migration-managed schema)
ALTER TABLE public.vendor_mentions ENABLE ROW LEVEL SECURITY;

-- ── Policy 1: Preserve existing anon read behavior ────────────
-- Dealer public feed (/vendors, /vendors/:slug) uses the anon key.
-- Must remain open after RLS is enabled.
CREATE POLICY "Public read vendor_mentions"
  ON public.vendor_mentions FOR SELECT
  TO anon
  USING (true);

-- ── Policy 2: Authenticated reads (Clerk dealers + vendor sessions) ─
-- Two cases:
--   a) Clerk-authenticated dealer: vendor_tier() returns NULL (no vendor_logins
--      row for Clerk UIDs) → pass through, preserving existing dealer behavior.
--   b) Vendor session: must be tier_2 AND querying own vendor data only.
--      T1 vendor sessions get zero rows (tier_1 != tier_2).
--      Cross-vendor reads blocked: lower(vendor_name) = lower(auth_vendor_name()).
CREATE POLICY "Authenticated read vendor_mentions"
  ON public.vendor_mentions FOR SELECT
  TO authenticated
  USING (
    -- Clerk sessions (vendor_tier() is NULL for Clerk JWTs): preserve public read
    public.vendor_tier() IS NULL
    OR
    -- Vendor sessions: T2 only, own vendor data only (case-insensitive match)
    (
      public.vendor_tier() = 'tier_2'
      AND lower(vendor_name) = lower(public.auth_vendor_name())
    )
  );

COMMENT ON TABLE public.vendor_mentions IS
  'AI-extracted vendor mentions from WhatsApp dealer conversations. '
  'RLS enabled (20260413300000): anon and Clerk reads are public; '
  'vendor sessions restricted to T2 tier, own vendor data only.';
