---
phase: 01-vendor-auth-primitives
plan: 02
subsystem: auth
tags: [supabase, otp, react, shadcn, navigation]

# Dependency graph
requires:
  - phase: 01-vendor-auth-primitives
    provides: "vendorClient.ts created here (plan created it since plan 01 runs in parallel)"
provides:
  - "VendorLoginPage.tsx: two-step email→OTP login page for vendors"
  - "vendorClient.ts: isolated Supabase client with storageKey: 'vendor-auth'"
  - "Navigation.tsx: Vendor Login button in desktop and mobile menus"
affects: [01-vendor-auth-primitives/01-03, VendorAuthGuard, VendorDashboardPage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step OTP flow: single Card with step state (email → otp) managed by useState"
    - "shouldCreateUser: false on signInWithOtp prevents self-registration (AUTH-09)"
    - "vendorSupabase.auth.verifyOtp with type: 'email' for code verification"
    - "?expired=true query param drives session-expired banner above card"

key-files:
  created:
    - src/pages/VendorLoginPage.tsx
    - src/integrations/supabase/vendorClient.ts
  modified:
    - src/components/Navigation.tsx

key-decisions:
  - "Created vendorClient.ts in this plan (plan 02) since plan 01 runs in parallel — avoids missing import blocker"
  - "Used simple useState for isSending/isVerifying instead of useMutation — simpler for two-operation form"
  - "Rate-limit detection uses case-insensitive 'rate' or '60 seconds' string match per RESEARCH.md pitfall guidance"

patterns-established:
  - "VendorLoginPage: two-step OTP in single Card, step managed by useState<'email'|'otp'>"
  - "Error display: <p role='alert' className='text-destructive text-sm mt-2'> for all auth errors"
  - "Session expired banner: bg-destructive/10 text-destructive above Card when ?expired=true"

requirements-completed: [AUTH-01, AUTH-02, AUTH-06, AUTH-07, AUTH-09]

# Metrics
duration: 15min
completed: 2026-04-13
---

# Phase 1 Plan 02: Vendor Login Page Summary

**Two-step email→OTP vendor login page with Supabase Auth (shouldCreateUser: false), isolated vendorClient, and Navigation entry point**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-13T17:03:00Z
- **Completed:** 2026-04-13T17:18:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- VendorLoginPage.tsx with two-step OTP flow: email entry calls signInWithOtp(shouldCreateUser: false), OTP entry calls verifyOtp, success navigates to /vendor-dashboard
- vendorClient.ts with isolated storageKey: 'vendor-auth' preventing session collision with Clerk auth
- Navigation.tsx updated with "Vendor Login" outline button in both desktop and mobile menus
- Full error handling: unknown email ("contact sales rep"), rate limit, expired/invalid OTP
- Session-expired banner shown when ?expired=true query param is present (AUTH-08 companion)
- Accessible: role="alert" on all errors, aria-hidden on Loader2 spinners

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VendorLoginPage with two-step email-to-OTP flow** - `462f0a5` (feat)
2. **Task 2: Add Vendor Login button to Navigation component** - `36476ac` (feat)

## Files Created/Modified

- `src/pages/VendorLoginPage.tsx` — Two-step vendor login page (email → OTP), 200+ lines
- `src/integrations/supabase/vendorClient.ts` — Isolated Supabase client with storageKey: 'vendor-auth'
- `src/components/Navigation.tsx` — Added Vendor Login outline button (desktop + mobile)

## Decisions Made

- Created `vendorClient.ts` in this plan rather than waiting for plan 01 (parallel wave) — plan instructions explicitly state executor must create it if plan 01 hasn't run yet. Avoids import resolution failure.
- Used simple `useState` for loading/error state instead of `useMutation` — the two operations (send, verify) are simple enough that TanStack Query adds no benefit here; simpler code is more readable.
- Rate-limit error detection uses case-insensitive string check for "rate" or "60 seconds" per RESEARCH.md pitfall guidance — Supabase error message text varies by version, so defensive matching is safer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created vendorClient.ts before VendorLoginPage**
- **Found during:** Task 1 (VendorLoginPage creation)
- **Issue:** VendorLoginPage imports from `@/integrations/supabase/vendorClient` which plan 01 creates. Since plans run in parallel, the file didn't exist yet.
- **Fix:** Created vendorClient.ts using the exact interface defined in the plan's `<interfaces>` block and RESEARCH.md Pattern 1
- **Files modified:** src/integrations/supabase/vendorClient.ts (created)
- **Verification:** Build passes; import resolves correctly
- **Committed in:** 462f0a5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing file)
**Impact on plan:** Essential for unblocking Task 1. The vendorClient.ts created here matches the exact interface plan 01 would create, so no conflict when plans merge.

## Issues Encountered

- Git state issue: initial `git reset --soft` left planning files staged for deletion from prior worktree branch. Resolved by `git restore --staged .planning/ CLAUDE.md` followed by `git checkout 0af451b -- .planning/ CLAUDE.md` to restore files from target commit. Task commits were clean after fix.

## Known Stubs

None — VendorLoginPage calls live Supabase Auth APIs (signInWithOtp, verifyOtp). No hardcoded data.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers.

## User Setup Required

None - no external service configuration required for this plan. Live Supabase OTP email delivery requires a configured Supabase project (assumed available per RESEARCH.md).

## Next Phase Readiness

- VendorLoginPage is the entry point for vendor auth; plan 03 (VendorAuthGuard + route wiring) can now wrap /vendor-dashboard
- vendorClient.ts is available for useVendorSupabaseAuth hook (plan 01 or 03)
- Navigation entry point is live — vendors can navigate to /vendor-login from any page

## Self-Check: PASSED

- src/pages/VendorLoginPage.tsx — FOUND
- src/integrations/supabase/vendorClient.ts — FOUND
- src/components/Navigation.tsx — FOUND
- .planning/phases/01-vendor-auth-primitives/01-02-SUMMARY.md — FOUND
- Commit 462f0a5 (Task 1) — FOUND
- Commit 36476ac (Task 2) — FOUND

---
*Phase: 01-vendor-auth-primitives*
*Completed: 2026-04-13*
