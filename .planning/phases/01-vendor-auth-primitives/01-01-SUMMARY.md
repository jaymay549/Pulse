---
phase: 01-vendor-auth-primitives
plan: 01
subsystem: auth
tags: [supabase, react, typescript, rls, postgresql, magic-link]

# Dependency graph
requires: []
provides:
  - Isolated vendor Supabase client (vendorClient.ts) with storageKey: 'vendor-auth'
  - useVendorSupabaseAuth hook: isLoading/isAuthenticated/session/user/signOut
  - vendor_logins migration: identity bridge between Supabase Auth UUID and vendor_name/tier
  - RLS policy: vendor can only read their own row via auth.uid() = user_id
affects:
  - 01-02 (vendor login page depends on vendorSupabase and useVendorSupabaseAuth)
  - 01-03 (route guard depends on useVendorSupabaseAuth.isAuthenticated)
  - 02-admin-provisioning (vendor_logins table is the target for admin INSERT)
  - 03-rls-tier-gating (vendor_logins.tier column drives RLS tier policies)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Isolated Supabase client per auth system: storageKey prevents session bleed between Clerk and vendor auth"
    - "detectSessionInURL: false on vendor client prevents hash interception from Clerk OAuth redirects"
    - "useVendorSupabaseAuth mirrors useClerkAuth ergonomics (isLoading/isAuthenticated/session/user/signOut)"
    - "SIGNED_OUT event handler for automatic session expiry redirect to /vendor-login?expired=true"

key-files:
  created:
    - src/integrations/supabase/vendorClient.ts
    - src/hooks/useVendorSupabaseAuth.ts
    - supabase/migrations/20260413000000_create_vendor_logins.sql
  modified: []

key-decisions:
  - "storageKey: 'vendor-auth' isolates vendor localStorage token from default Supabase anon client key used by Clerk integration"
  - "detectSessionInURL: false on vendor client prevents it from consuming Clerk OAuth callback hashes"
  - "vendor_logins tier column uses CHECK constraint (unverified/tier_1/tier_2) — not a foreign key to enum, allowing future tier additions via migration"
  - "No INSERT/UPDATE/DELETE RLS policies on vendor_logins — only service role can provision, preventing self-registration"

patterns-established:
  - "Vendor auth hook pattern: call getSession() on mount for initial state, then subscribe to onAuthStateChange for live updates"
  - "Session expiry handling: SIGNED_OUT + !currentSession triggers redirect to /vendor-login?expired=true"

requirements-completed: [AUTH-03, AUTH-08]

# Metrics
duration: 8min
completed: 2026-04-13
---

# Phase 1 Plan 01: Vendor Auth Primitives Summary

**Isolated vendor Supabase client with storageKey 'vendor-auth', useVendorSupabaseAuth hook with SIGNED_OUT expiry redirect, and vendor_logins table with tier-checked RLS**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-13T17:15:00Z
- **Completed:** 2026-04-13T17:23:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `vendorClient.ts` — isolated Supabase client that prevents session bleed with Clerk's default anon client by using a distinct localStorage key
- Created `useVendorSupabaseAuth.ts` — React hook matching `useClerkAuth` ergonomics, handles session expiry by navigating to `/vendor-login?expired=true` on SIGNED_OUT
- Created `supabase/migrations/20260413000000_create_vendor_logins.sql` — identity bridge table mapping Supabase Auth UUID to vendor_name and tier (unverified/tier_1/tier_2), with RLS self-read policy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create isolated vendor Supabase client and vendor_logins migration** - `cc043a3` (feat)
2. **Task 2: Create useVendorSupabaseAuth hook with session expiry navigation** - `bd97efb` (feat)

**Plan metadata:** (docs commit — separate, see below)

## Files Created/Modified
- `src/integrations/supabase/vendorClient.ts` — Vendor Supabase client with storageKey: 'vendor-auth' and detectSessionInURL: false
- `src/hooks/useVendorSupabaseAuth.ts` — Auth state hook: isLoading, isAuthenticated, session, user, signOut; SIGNED_OUT navigates to /vendor-login?expired=true
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — vendor_logins table DDL with RLS; maps Supabase Auth UUID to vendor identity

## Decisions Made
- `storageKey: 'vendor-auth'` is the key isolation mechanism — prevents vendor session from clobbering or reading the Supabase default key used by the Clerk integration
- `detectSessionInURL: false` is necessary because Clerk uses URL hashes for OAuth callbacks; vendor client must not consume them
- tier CHECK constraint chosen over enum type for forward compatibility (adding tier values doesn't require type recreation)
- No INSERT/UPDATE/DELETE policies on vendor_logins — only service role can provision rows, preventing vendor self-registration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The migration SQL will be applied to Supabase in a future step when the admin provisioning flow runs `supabase db push` or equivalent.

## Threat Surface Scan

No new security surface beyond what was documented in the plan's threat model. The three mitigated threats (T-01-01, T-01-02, T-01-03) are fully addressed:
- T-01-01: storageKey isolation implemented in vendorClient.ts
- T-01-02: RLS self-read policy in migration
- T-01-03: No INSERT/UPDATE/DELETE policies for authenticated role

## Next Phase Readiness
- vendorSupabase and useVendorSupabaseAuth are ready for 01-02 (vendor login page)
- vendor_logins table schema is ready for admin provisioning (Phase 2)
- Phase 3 RLS blocker still applies: SECURITY DEFINER RPC audit needed before tier-gating policies ship

## Self-Check: PASSED
- `src/integrations/supabase/vendorClient.ts` — FOUND
- `src/hooks/useVendorSupabaseAuth.ts` — FOUND
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — FOUND
- Task 1 commit `cc043a3` — FOUND
- Task 2 commit `bd97efb` — FOUND

---
*Phase: 01-vendor-auth-primitives*
*Completed: 2026-04-13*
