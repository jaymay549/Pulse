---
phase: quick-260417-ff7
plan: "01"
subsystem: admin-tier-preview
tags: [admin, tier-preview, vendor-dashboard, real-components]
dependency_graph:
  requires: [vendor_profiles table, vendor-dashboard components]
  provides: [live tier preview with real components]
  affects: [src/pages/admin/TierPreviewPage.tsx]
tech_stack:
  added: []
  patterns: [useQuery for vendor list, useClerkSupabase for authenticated queries]
key_files:
  modified:
    - src/pages/admin/TierPreviewPage.tsx
decisions:
  - "useClerkSupabase returns SupabaseClient directly (not destructured object) — plan had incorrect { client: supabase } destructuring"
  - "Kept VIS_WIRE for gated/full badge styling — reused rather than removing"
  - "Render components inline with if/else chain instead of COMPONENT_MAP to avoid JSX-in-object-value complexity"
metrics:
  duration: "~2m 19s"
  completed: "2026-04-17"
  tasks: 2
  files: 1
---

# Quick Task 260417-ff7: Replace Wireframe Placeholders in TierPreviewPage Summary

**One-liner:** Rewrote TierPreviewPage to render live vendor dashboard components with a vendor name selector querying vendor_profiles, replacing all WireCard/WirePlaceholder wireframe code.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add vendor name selector with data fetching | b70ce87 | TierPreviewPage.tsx |
| 2 | Replace wireframes with real dashboard components | b70ce87 | TierPreviewPage.tsx |

Both tasks were executed as a single atomic change since they modify the same file.

## What Was Built

- **Vendor selector:** A shadcn Select dropdown queries `vendor_profiles` (id, vendor_name) via `useClerkSupabase` + `useQuery`, defaults to the first vendor on load.
- **Real component rendering:** All 11 vendor dashboard sections now render live components (VendorCommandCenter, DashboardOverview, DashboardSegments, DashboardIntel, DashboardMentions, DashboardDimensions, DashboardDemoRequests, DashboardDealerSignals, DashboardScreenshots, DashboardCategories, DashboardEditProfile).
- **Visibility gating:** Hidden sections show the EyeOff placeholder; gated sections render the real component with an amber "Gated" badge overlay; full sections render directly.
- **Profile section:** Passes `vendorProfileId` from the selected vendor; mentions section passes both `vendorName` and `vendorProfileId`.
- **Empty state:** If no vendor is selected, a centered message instructs the admin to select a vendor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected useClerkSupabase usage**
- **Found during:** Task 1
- **Issue:** Plan specified `const { client: supabase } = useClerkSupabase()` but the hook returns a `SupabaseClient` directly (not an object with a `client` property).
- **Fix:** Used `const supabase = useClerkSupabase()` instead.
- **Files modified:** src/pages/admin/TierPreviewPage.tsx
- **Commit:** b70ce87

**2. [Rule 2 - Implementation choice] Inline component rendering instead of COMPONENT_MAP**
- **Found during:** Task 2
- **Issue:** Defining JSX elements (with closures over `setActiveSection`) inside a `Record<string, React.FC>` object requires careful typing and causes linting issues.
- **Fix:** Used a plain `if/else` chain in `renderComponent()` which is cleaner and avoids type complexity.
- **Files modified:** src/pages/admin/TierPreviewPage.tsx
- **Commit:** b70ce87

## Known Stubs

None — all components receive live `vendorName` and `vendorProfileId` props from the vendor selector.

## Threat Flags

None — this page is admin-only behind AdminGuard; no new network endpoints or trust boundary changes introduced.

## Self-Check: PASSED

- [x] `/Users/miguel/Pulse/src/pages/admin/TierPreviewPage.tsx` exists and is modified
- [x] Commit b70ce87 exists
- [x] TypeScript compiles with zero errors
- [x] Build succeeds (`✓ built in 3.66s`)
