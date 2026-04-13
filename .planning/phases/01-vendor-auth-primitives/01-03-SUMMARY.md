---
phase: 01-vendor-auth-primitives
plan: 03
subsystem: auth
autonomous: false
tags: [react, typescript, react-router, supabase, auth-guard, rls]

# Dependency graph
requires:
  - phase: 01-vendor-auth-primitives
    plan: 01
    provides: "useVendorSupabaseAuth hook, vendorClient.ts"
  - phase: 01-vendor-auth-primitives
    plan: 02
    provides: "VendorLoginPage.tsx, /vendor-login route target"
provides:
  - "VendorAuthGuard.tsx: dual-auth route guard (Clerk admin bypass + vendor Supabase session)"
  - "App.tsx: /vendor-login route + VendorAuthGuard wrapping /vendor-dashboard"
  - "VendorDashboardPage.tsx: vendor_logins identity resolution for Supabase sessions"
affects:
  - 02-admin-provisioning (vendor_logins table now queried from dashboard; admin insert lands here)
  - 03-rls-tier-gating (VendorDashboardPage resolves tier from vendor_logins.tier)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-auth guard: check Clerk isAdmin first (bypass), then vendor Supabase isAuthenticated"
    - "vendorLoginProfile synthetic VendorProfileRow: id='vendor-session' avoids null vendorProfile guard"
    - "vendor_logins enabled condition: isVendorAuth && !isAuthenticated prevents query when Clerk user is logged in"

key-files:
  created:
    - src/components/vendor-auth/VendorAuthGuard.tsx
  modified:
    - src/App.tsx
    - src/pages/VendorDashboardPage.tsx

key-decisions:
  - "VendorAuthGuard checks isAdmin before isVendorAuth — admin bypass must take precedence to avoid requiring admins to hold a vendor Supabase session"
  - "vendor_logins query enabled only when isVendorAuth && !isAuthenticated — prevents unnecessary DB calls when Clerk auth handles identity"
  - "Synthetic VendorProfileRow (id: 'vendor-session') preserves existing vendorProfile interface contract without schema changes"

requirements-completed: [AUTH-04, AUTH-05, AUTH-02]

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 1 Plan 03: Route Guard and Dashboard Wiring Summary

**VendorAuthGuard with Clerk admin bypass, /vendor-login route in App.tsx, and vendor_logins identity resolution in VendorDashboardPage for vendor Supabase sessions**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-13T17:33:46Z
- **Completed:** 2026-04-13T17:36:49Z
- **Tasks:** 2 (of 3; Task 3 is checkpoint:human-verify requiring manual supabase db push)
- **Files modified:** 3

## Accomplishments

- Created `VendorAuthGuard.tsx` — route guard checking Clerk isAdmin first (admin bypass, AUTH-05), then vendor Supabase isAuthenticated (AUTH-04), redirecting to /vendor-login if neither
- Updated `App.tsx` — lazy imports for VendorLoginPage and VendorAuthGuard, /vendor-login route registered, /vendor-dashboard wrapped with VendorAuthGuard
- Updated `VendorDashboardPage.tsx` — vendor_logins query resolves vendor identity for Supabase sessions; auth redirect updated to accept either Clerk or vendor Supabase auth (AUTH-02)

## Task Commits

Each task committed atomically:

1. **Task 1: Create VendorAuthGuard with dual-auth bypass** — `60e74e0` (feat)
2. **Task 2: Wire routes in App.tsx and update VendorDashboardPage dual-auth** — `95f35d4` (feat)

## Files Created/Modified

- `src/components/vendor-auth/VendorAuthGuard.tsx` — Dual-auth guard: Loader2 while initializing, isAdmin bypass, isVendorAuth pass-through, /vendor-login redirect
- `src/App.tsx` — Added VendorLoginPage + VendorAuthGuard lazy imports, /vendor-login route, VendorAuthGuard wrapper on /vendor-dashboard
- `src/pages/VendorDashboardPage.tsx` — Added useVendorSupabaseAuth, vendorSupabase imports; vendor_logins query; updated isLoading/vendorProfile resolution; updated auth redirect guard

## Decisions Made

- VendorAuthGuard checks `isAdmin` before `isVendorAuth` — admin bypass must come first so admins are never required to hold a vendor Supabase session
- `vendor_logins` query `enabled` condition uses `isVendorAuth && !isAuthenticated` — avoids unnecessary Supabase calls when Clerk is handling identity; admin mode always excluded
- Synthetic `VendorProfileRow` (`id: 'vendor-session'`) bridges the gap between Supabase user UUID and the dashboard's VendorProfileRow interface without schema changes in this plan

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all paths reach live auth systems and live Supabase queries.

## User Setup Required

**supabase db push** must be run manually to apply the vendor_logins migration (created in plan 01-01) before vendor Supabase auth will function end-to-end. The migration file is at:
`supabase/migrations/20260413000000_create_vendor_logins.sql`

Run:
```bash
supabase db push
```

## Threat Surface Scan

No new threats beyond those documented in the plan's threat model. Mitigated threats addressed:
- T-01-09: VendorAuthGuard checks isAdmin (Clerk) OR isVendorAuth (Supabase vendor) — tokens are not interchangeable
- T-01-10: vendor_logins query uses vendorSupabase client with vendor JWT; RLS policy ensures auth.uid() = user_id
- T-01-11: Accepted — Phase 1 does not add RLS to vendor data tables; that is Phase 3
- T-01-12: Accepted — /vendor-login is a public route; standard pattern

## Self-Check: PASSED

- `src/components/vendor-auth/VendorAuthGuard.tsx` — FOUND
- `src/App.tsx` — FOUND (modified)
- `src/pages/VendorDashboardPage.tsx` — FOUND (modified)
- Task 1 commit `60e74e0` — FOUND
- Task 2 commit `95f35d4` — FOUND
- `npm run build` — PASSED
- `npx eslint` on modified files — PASSED (no new errors)

---
*Phase: 01-vendor-auth-primitives*
*Completed: 2026-04-13*
