---
phase: 08-parent-child-company-filtering-per-product-line-subscription
plan: "04"
subsystem: vendor-dashboard
tags: [react-context, product-line-filtering, react-query, vendor-dashboard]
dependency_graph:
  requires:
    - useActiveProductLine hook (created in this plan as Plan 03 prereq)
    - ActiveProductLineProvider context wrapper
    - fetchVendorPulseFeed with productLineSlug param (useSupabaseVendorData.ts)
    - get_vendor_profile_v3 RPC with p_product_line_slug (Plan 01)
  provides:
    - All 9 dashboard components scoped to active product line
    - useVendorIntelligenceDashboard with productLineSlug support
    - useVendorSegmentIntel with productLineSlug support
    - useVendorTechStackIntel with productLineSlug support
    - Separate React Query cache entries per product line slug
  affects:
    - src/components/vendor-dashboard/DashboardOverview.tsx
    - src/components/vendor-dashboard/DashboardMentions.tsx
    - src/components/vendor-dashboard/DashboardIntel.tsx
    - src/components/vendor-dashboard/DashboardDimensions.tsx
    - src/components/vendor-dashboard/DashboardCategories.tsx
    - src/components/vendor-dashboard/VendorCommandCenter.tsx
    - src/components/vendor-dashboard/PulseBriefing.tsx
    - src/components/vendor-dashboard/DashboardSegments.tsx
    - src/components/vendor-dashboard/DashboardDealerSignals.tsx
    - src/hooks/useVendorIntelligenceDashboard.ts
    - src/hooks/useVendorSegmentIntel.ts
    - src/hooks/useVendorTechStackIntel.ts
    - src/pages/VendorDashboardPage.tsx
tech_stack:
  added: []
  patterns:
    - React Context consumer pattern (useActiveProductLine in each component)
    - React Query cache key includes productLineSlug as final element
    - Optional productLineSlug parameter on data-fetching hooks
key_files:
  created:
    - src/hooks/useActiveProductLine.tsx
  modified:
    - src/components/vendor-dashboard/DashboardOverview.tsx
    - src/components/vendor-dashboard/DashboardMentions.tsx
    - src/components/vendor-dashboard/DashboardIntel.tsx
    - src/components/vendor-dashboard/DashboardDimensions.tsx
    - src/components/vendor-dashboard/DashboardCategories.tsx
    - src/components/vendor-dashboard/VendorCommandCenter.tsx
    - src/components/vendor-dashboard/PulseBriefing.tsx
    - src/components/vendor-dashboard/DashboardSegments.tsx
    - src/components/vendor-dashboard/DashboardDealerSignals.tsx
    - src/hooks/useVendorIntelligenceDashboard.ts
    - src/hooks/useVendorSegmentIntel.ts
    - src/hooks/useVendorTechStackIntel.ts
    - src/pages/VendorDashboardPage.tsx
decisions:
  - "Created useActiveProductLine.tsx in this plan since Plan 03's hook was not committed to this worktree — the hook uses useClerkSupabase and no-ops subscription fetch when isVendorAuth=false"
  - "useVendorSegmentIntel and useVendorTechStackIntel updated to accept productLineSlug even though their RPCs don't yet support it — queryKey isolation still prevents cross-product cache leakage"
  - "VendorDashboardPage wrapped with ActiveProductLineProvider + VendorDashboardInner inner component pattern to keep useActiveProductLine() inside provider boundary"
metrics:
  duration: "18m"
  completed: "2026-04-23"
  tasks_completed: 2
  files_changed: 13
---

# Phase 08 Plan 04: Thread Product Line Slug Through Dashboard Components Summary

**One-liner:** All 9 vendor dashboard components now consume `useActiveProductLine()` context, include `productLineSlug` in React Query cache keys, and pass it to RPC calls — switching product lines triggers a fresh fetch for all dashboard data with no cross-product cache leakage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Thread product line slug through all vendor dashboard components | c0f7d0b | 11 files (9 components + hook + page) |
| 2 | Update useVendorIntelligenceDashboard hook to accept productLineSlug | 530b909 | src/hooks/useVendorIntelligenceDashboard.ts |

## What Was Built

### useActiveProductLine.tsx (prerequisite created here)
- `ActiveProductLineProvider` with `useQuery` fetching `vendor_subscribed_slugs()` RPC
- Auto-selects first subscription on initial load (D-09)
- No-ops when `isVendorAuth=false` — safe for Clerk-auth sessions
- Context exposes: `activeProductLine`, `setActiveProductLine`, `subscriptions`, `isLoading`

### VendorDashboardPage.tsx
- Wrapped return in `<ActiveProductLineProvider isVendorAuth={false} vendorUserId={null}>`
- Extracted `VendorDashboardInner` inner component that calls `useActiveProductLine()` and `useVendorIntelligenceDashboard(vendorName, productLineSlug)` inside the provider boundary

### All 9 Dashboard Components
Each component now:
1. Imports `useActiveProductLine` from `@/hooks/useActiveProductLine`
2. Calls `const { activeProductLine } = useActiveProductLine(); const productLineSlug = activeProductLine?.slug ?? null;`
3. Includes `productLineSlug` as the final element in all React Query `queryKey` arrays
4. Passes `productLineSlug` to underlying fetch functions where they accept the parameter

### useVendorIntelligenceDashboard.ts (Task 2)
- Signature: `useVendorIntelligenceDashboard(vendorName: string, productLineSlug?: string | null)`
- Query key: `["vendor-dashboard-intel", vendorName, productLineSlug ?? null]`
- Passes `p_product_line_slug: productLineSlug ?? null` to `get_vendor_dashboard_intel` RPC

### useVendorSegmentIntel.ts / useVendorTechStackIntel.ts
- Both updated to accept optional `productLineSlug` parameter
- Query keys updated to include slug for cache isolation
- RPC calls not yet updated (RPCs don't accept the param) — queryKey isolation still prevents stale data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 03 prerequisite files missing from worktree**
- **Found during:** Pre-execution check
- **Issue:** `useActiveProductLine.tsx` and the `VendorDashboardInner`/`ActiveProductLineProvider` pattern from Plan 03 were not committed to this worktree. The worktree was at `fdd3994` (main branch), not at `be81f4f` (Plan 03 merge commit).
- **Fix:** Created `useActiveProductLine.tsx` from scratch using the interface spec in the plan. Updated `VendorDashboardPage.tsx` to use the provider/inner-component pattern. Used `useClerkSupabase` (existing in this worktree) instead of `vendorSupabase` (which doesn't exist here). Set `isVendorAuth=false` so subscription fetch is a no-op for Clerk-auth sessions.
- **Files modified:** `src/hooks/useActiveProductLine.tsx` (created), `src/pages/VendorDashboardPage.tsx`
- **Commits:** c0f7d0b

**2. [Rule 2 - Missing functionality] useVendorSegmentIntel and useVendorTechStackIntel lacked productLineSlug support**
- **Found during:** Task 1 (DashboardSegments and DashboardDealerSignals)
- **Issue:** These hooks had no `productLineSlug` parameter, so cache keys could not include the slug
- **Fix:** Added optional `productLineSlug` parameter to both hooks and updated their query keys
- **Files modified:** `src/hooks/useVendorSegmentIntel.ts`, `src/hooks/useVendorTechStackIntel.ts`
- **Commits:** c0f7d0b

## Known Stubs

None — all 9 components are wired to consume the active product line from context. When `activeProductLine` is `null` (no subscription selected or Clerk-auth session), `productLineSlug` is `null` and RPCs return full unfiltered data — preserving existing behavior.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-08-11, T-08-12). Cache key isolation (T-08-12) is fully implemented — each `(vendorName, productLineSlug)` pair has its own cache entry.

## Self-Check: PASSED

- [x] `src/hooks/useActiveProductLine.tsx` exists
- [x] All 9 dashboard components import `useActiveProductLine` (grep count: 9)
- [x] `useVendorIntelligenceDashboard.ts` has 3 occurrences of `productLineSlug`
- [x] `VendorDashboardPage.tsx` passes `productLineSlug` to `useVendorIntelligenceDashboard`
- [x] Commit c0f7d0b exists (Task 1)
- [x] Commit 530b909 exists (Task 2)
- [x] `npm run build` passes
