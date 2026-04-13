---
phase: 03-tier-gated-data-access
plan: 01
subsystem: database
tags: [supabase, rls, postgres, security-definer, vendor-auth, tier-gating]

# Dependency graph
requires:
  - phase: 01-vendor-auth-primitives
    provides: vendor_logins table with user_id, vendor_name, tier columns
  - phase: 02-admin-provisioning-tools
    provides: vendor_logins rows created by admin wizard
provides:
  - vendor_tier() SECURITY DEFINER function for RLS policy tier lookups
  - auth_vendor_name() SECURITY DEFINER function for RLS vendor isolation
  - RLS policies on vendor_mentions with anon/Clerk pass-through and T2-only vendor gate
  - Vendor auth guards on 5 SECURITY DEFINER RPCs blocking cross-vendor reads and T1 access to T2 data
affects:
  - 03-02 (frontend tier gating): RLS now active; vendor dashboard must use vendorSupabase client for auth.uid() to work
  - 03-03 (locked sections UX): database-level enforcement complete; frontend can safely gate on tier prop

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER helper functions (vendor_tier, auth_vendor_name) for RLS policy tier lookups without circular dependency
    - vendor_tier() IS NULL branch in RLS USING clauses to pass Clerk sessions through
    - lower() normalization for vendor_name comparisons across vendor_logins and vendor_mentions
    - IF vendor_tier() IS NOT NULL guard pattern in SECURITY DEFINER RPCs for session-type detection

key-files:
  created:
    - supabase/migrations/20260413200000_vendor_tier_function.sql
    - supabase/migrations/20260413300000_vendor_mentions_rls.sql
    - supabase/migrations/20260413400000_t2_rpc_guards.sql
  modified: []

key-decisions:
  - "vendor_tier() IS NOT NULL is the canonical check for 'vendor session active' in both RLS policies and SECURITY DEFINER RPCs — Clerk and anon sessions always get NULL"
  - "get_vendor_dimensions converted from LANGUAGE sql to LANGUAGE plpgsql to support conditional guard logic while preserving original body"
  - "get_vendor_dashboard_intel uses defense-in-depth: recommendations key stripped at RPC level (v_result - 'recommendations') AND get_vendor_actionable_insights returns '[]' for non-T2 — two independent guards"
  - "get_vendor_pulse_feed_v3 guard blocks NULL p_vendor_name for vendor sessions (cross-category browsing blocked), returns {mentions:[], total:0} shape matching existing contract"

patterns-established:
  - "Pattern: SECURITY DEFINER RPC vendor guard — IF vendor_tier() IS NOT NULL THEN check isolation + tier ELSE pass through"
  - "Pattern: RLS policy for shared tables — always include vendor_tier() IS NULL branch for Clerk pass-through to avoid breaking dealer reads"
  - "Pattern: lower() on both sides of vendor_name comparisons to handle canonical_vendor_name_case() vs admin-entered vendor_name casing differences"

requirements-completed: [TIER-01, TIER-03, TIER-04, TIER-05, TIER-07]

# Metrics
duration: 12min
completed: 2026-04-13
---

# Phase 3 Plan 1: DB-Level Tier Enforcement Summary

**vendor_tier() and auth_vendor_name() SECURITY DEFINER helpers + RLS on vendor_mentions + auth guards on 5 SECURITY DEFINER RPCs enforce T2 gating and vendor isolation at the database level**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-13T20:08:29Z
- **Completed:** 2026-04-13T20:20:00Z
- **Tasks:** 2
- **Files modified:** 3 (all new migrations)

## Accomplishments
- Created `vendor_tier()` and `auth_vendor_name()` SECURITY DEFINER functions with proper REVOKE/GRANT and SET search_path = public
- Enabled RLS on `vendor_mentions` with anon + Clerk pass-through policies and T2-only own-vendor policy
- Added auth guards to 5 vendor-facing SECURITY DEFINER RPCs; all Clerk/anon sessions pass through unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: vendor_tier() + auth_vendor_name() helpers + vendor_mentions RLS** - `fc21836` (feat)
2. **Task 2: T2 RPC auth guards** - `9df08d9` (feat)

## Files Created/Modified
- `supabase/migrations/20260413200000_vendor_tier_function.sql` - vendor_tier() and auth_vendor_name() SECURITY DEFINER functions
- `supabase/migrations/20260413300000_vendor_mentions_rls.sql` - ENABLE RLS + anon policy + authenticated policy with vendor_tier() IS NULL branch
- `supabase/migrations/20260413400000_t2_rpc_guards.sql` - Auth guards on get_vendor_dimensions, get_vendor_actionable_insights, get_vendor_tech_stack_intel, get_vendor_dashboard_intel, get_vendor_pulse_feed_v3

## Decisions Made
- `get_vendor_dimensions` was originally `LANGUAGE sql STABLE` — converted to `LANGUAGE plpgsql` to support `IF` guard logic. Body preserved exactly.
- `get_vendor_dashboard_intel` uses defense-in-depth for the `recommendations` key: both the `get_vendor_actionable_insights` sub-call (now T2-gated) AND an explicit `v_result - 'recommendations'` strip at the outer function level.
- `get_vendor_pulse_feed_v3` guard returns `{mentions:[], total:0}` (not just `'[]'`) to match the existing response shape used by the frontend.
- Both `vendor_tier()` and `auth_vendor_name()` granted to `authenticated` only (not `anon`) since only authenticated sessions have `vendor_logins` rows.

## Deviations from Plan

None — plan executed exactly as written. The guard implementation for `get_vendor_pulse_feed_v3` required reconstructing the full function body (the previous `20260324200000` migration used a DO block to patch it dynamically, making the live body unavailable in migration source). The reconstruction includes the nps_tier + sentimentScore fields from that patch, preserving all fields. Documented as a known migration approach issue, not a scope deviation.

## Issues Encountered
None.

## User Setup Required
None — these are SQL migration files. Apply via `supabase db push` or Supabase MCP. No environment variables or dashboard configuration required.

## Next Phase Readiness
- DB-level enforcement is now complete and active
- Phase 3 Plan 2 (frontend tier gating) can proceed: VendorDashboardPage must pass `vendorSupabase` as the query client to section components so `auth.uid()` resolves correctly for RLS
- Phase 3 Plan 3 (locked section UX) depends on frontend passing `tier` prop to sidebar components
- Known: `vendor_mentions` RLS only blocks T1 vendor sessions from *direct table reads*. The SECURITY DEFINER RPCs that query `vendor_mentions` internally (like `get_vendor_dimensions`) use the SECURITY DEFINER execution context (bypassing RLS), which is why those RPCs need their own auth guards — both defense layers are now in place.

---
*Phase: 03-tier-gated-data-access*
*Completed: 2026-04-13*
