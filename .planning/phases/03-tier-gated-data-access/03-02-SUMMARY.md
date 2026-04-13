---
phase: 03-tier-gated-data-access
plan: 02
subsystem: vendor-dashboard
tags: [vendor-auth, supabase-client, rls, session-routing]
dependency_graph:
  requires: [03-01]
  provides: [vendor-session-client-dispatch]
  affects: [vendor-dashboard-components, vendor-dashboard-hooks]
tech_stack:
  added: []
  patterns: [session-type-routing, hook-abstraction]
key_files:
  created:
    - src/hooks/useVendorDataClient.ts
  modified:
    - src/hooks/useVendorIntelligenceDashboard.ts
    - src/hooks/useVendorTechStackIntel.ts
    - src/components/vendor-dashboard/DashboardMentions.tsx
    - src/components/vendor-dashboard/DashboardDimensions.tsx
    - src/components/vendor-dashboard/DashboardIntel.tsx
    - src/components/vendor-dashboard/DashboardOverview.tsx
    - src/components/vendor-dashboard/DashboardScreenshots.tsx
    - src/components/vendor-dashboard/DashboardCategories.tsx
    - src/components/vendor-dashboard/DashboardEditProfile.tsx
    - src/components/vendor-dashboard/DashboardDemoRequests.tsx
    - src/components/vendor-dashboard/PulseBriefing.tsx
    - src/pages/VendorDashboardPage.tsx
decisions:
  - "useVendorDataClient returns vendorSupabase for isVendorAuth && !isClerkAuth; Clerk client otherwise — admin viewing vendor dashboard still uses Clerk client"
  - "DashboardDemoRequests moved from prop-based supabase to internal useVendorDataClient hook (Option A) for consistency with all other components"
  - "VendorDashboardPage retains useClerkSupabase (as clerkSupabase) only for the ownVendorProfile query which is a Clerk-user-only path"
  - "PulseBriefing was not in the original plan but uses RLS-gated RPCs inside DashboardOverview — auto-fixed as Rule 2 (missing critical fix)"
metrics:
  duration: 6min
  completed: "2026-04-13"
  tasks: 2
  files_modified: 12
requirements: [TIER-01, TIER-05]
---

# Phase 3 Plan 2: Client Dispatch Fix Summary

**One-liner:** Route all vendor dashboard RLS queries through vendorSupabase by centralizing client selection in a new `useVendorDataClient` hook.

## What Was Built

The critical client dispatch bug is fixed. Previously, all vendor dashboard components called `useClerkSupabase()`, which returns an anon-key client for vendor users (no Clerk session). This made `auth.uid()` NULL in RLS policies, rendering the tier enforcement from Plan 01 completely ineffective.

### New Hook: useVendorDataClient

`src/hooks/useVendorDataClient.ts` — returns the correct Supabase client based on session type:

- `isVendorAuth && !isClerkAuth` → returns `vendorSupabase` (vendor's Supabase Auth JWT, `auth.uid()` works)
- Otherwise → returns `clerkClient` (dealer/admin Clerk-scoped client)

The condition mirrors the pattern already established in `VendorDashboardPage` for detecting vendor-only sessions. Admin mode (`isClerkAuth` true) always gets the Clerk client.

### Updated Components and Hooks

All vendor dashboard data consumers now call `useVendorDataClient()` instead of `useClerkSupabase()`:

**Hooks:** `useVendorIntelligenceDashboard`, `useVendorTechStackIntel`

**Components:** `DashboardMentions`, `DashboardDimensions`, `DashboardIntel`, `DashboardOverview`, `DashboardScreenshots`, `DashboardCategories`, `DashboardEditProfile`, `DashboardDemoRequests`, `PulseBriefing`

### VendorDashboardPage Changes

- Removed `const supabase = useClerkSupabase()` and `supabase={supabase}` prop to `DashboardDemoRequests`
- Added back `useClerkSupabase` (as `clerkSupabase`) only for the `ownVendorProfile` query, which is a Clerk-user-only path (fetches profile by `user_id` for authenticated dealers)
- `DashboardDemoRequests` now calls `useVendorDataClient()` internally

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Fix] PulseBriefing.tsx also used useClerkSupabase**

- **Found during:** Task 2 verification grep
- **Issue:** `PulseBriefing.tsx` was not listed in the plan's file list but also imported and called `useClerkSupabase()`. It is rendered inside `DashboardOverview` and makes the same RLS-gated RPC calls (`get_vendor_profile_v3`, `get_vendor_dimensions`, `get_compared_vendors`) that require a valid `auth.uid()` for vendor sessions.
- **Fix:** Updated import from `useClerkSupabase` to `useVendorDataClient` and updated call site.
- **Files modified:** `src/components/vendor-dashboard/PulseBriefing.tsx`
- **Commit:** 852a163

## Verification

- Zero occurrences of `useClerkSupabase` in `src/components/vendor-dashboard/` (all replaced)
- Zero occurrences of `useClerkSupabase` in `useVendorIntelligenceDashboard.ts` and `useVendorTechStackIntel.ts`
- `npm run build` passes (3.10s, no compilation errors)
- No new lint errors introduced (pre-existing 180 errors in codebase are unrelated)

## Commits

- `ba70829` feat(03-02): create useVendorDataClient hook
- `852a163` feat(03-02): route all vendor dashboard components through useVendorDataClient

## Self-Check: PASSED
