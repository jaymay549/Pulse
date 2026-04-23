---
phase: 08-parent-child-company-filtering-per-product-line-subscription
plan: "03"
subsystem: vendor-dashboard
tags: [react-context, product-line-switcher, tier-gating, vendor-dashboard]
dependency_graph:
  requires:
    - vendor_subscribed_slugs() SECURITY DEFINER function (from 08-01)
    - vendorClient.ts (vendorSupabase isolated client)
    - GatedCard.tsx (VendorTierProvider)
    - useTierConfigReadonly hook
  provides:
    - ActiveProductLineProvider (React Context for active product line state)
    - useActiveProductLine hook
    - VendorProductLineSwitcher header dropdown component
    - Product-specific tier resolution in VendorDashboardPage (D-12)
  affects:
    - VendorDashboardPage.tsx (tier resolution chain updated)
    - VendorDashboardLayout.tsx (switcher added to header)
tech_stack:
  added: []
  patterns:
    - React Context provider + consumer hook pattern
    - Inner component pattern to consume context inside the provider boundary
    - shadcn/ui Select for compact header dropdown
key_files:
  created:
    - src/hooks/useActiveProductLine.tsx
    - src/components/vendor-dashboard/VendorProductLineSwitcher.tsx
  modified:
    - src/pages/VendorDashboardPage.tsx
    - src/components/vendor-dashboard/VendorDashboardLayout.tsx
decisions:
  - "Extracted VendorDashboardInner component to consume useActiveProductLine() inside the provider boundary — avoids hook-outside-provider error while keeping main component logic in one file"
  - "ActiveProductLineProvider only fetches when isVendorAuth && !!vendorUserId — no-ops for admin mode and Clerk-auth vendor owners, keeping subscription data scoped to magic-link sessions"
  - "Tier resolution chain: activeProductLine?.tier first (D-12), then vendorLoginProfile?.tier, then resolvedTier — product-specific tier wins"
metrics:
  duration: "12m"
  completed: "2026-04-23"
  tasks_completed: 2
  files_changed: 4
---

# Phase 08 Plan 03: Product Line Context Hook and Header Switcher Summary

**One-liner:** React Context provider fetching vendor subscriptions via `vendor_subscribed_slugs()` RPC, with compact header dropdown and product-specific tier resolution replacing account-level tier as first priority.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useActiveProductLine context hook and VendorProductLineSwitcher component | a36658f | src/hooks/useActiveProductLine.tsx, src/components/vendor-dashboard/VendorProductLineSwitcher.tsx |
| 2 | Integrate ActiveProductLineProvider and switcher into VendorDashboardPage + Layout | 811d62e | src/pages/VendorDashboardPage.tsx, src/components/vendor-dashboard/VendorDashboardLayout.tsx |

## What Was Built

### useActiveProductLine.tsx
- `ActiveProductLineProvider` fetches subscriptions via `vendor_subscribed_slugs()` SECURITY DEFINER RPC using the isolated `vendorSupabase` client
- `useQuery` key includes `vendorUserId` so cache invalidates per vendor session
- `useEffect` auto-selects `subscriptions[0]` (already sorted alphabetically by SQL) on first load (D-09)
- No "All products" option — individual product lines only (D-10)
- Context exposes: `activeProductLine`, `setActiveProductLine`, `subscriptions`, `isLoading`

### VendorProductLineSwitcher.tsx
- `subscriptions.length <= 1` check: hidden when vendor has 0 or 1 subscription (D-10 / Open Question 2)
- shadcn/ui `Select` component with compact `h-8 text-xs` sizing for header placement
- `onValueChange` calls `setActiveProductLine` with the matched subscription object
- `min-w-[140px] max-w-[200px]` constrains width in header

### VendorDashboardPage.tsx
- Return block wrapped in `<ActiveProductLineProvider isVendorAuth={isVendorAuth} vendorUserId={vendorUser?.id}>`
- `VendorDashboardInner` inner component calls `useActiveProductLine()` — correctly inside provider boundary
- Tier resolution updated: `activeProductLine?.tier || vendorLoginProfile?.tier || resolvedTier || undefined`
- Admin full-access mode still returns `undefined` (sees everything — existing behavior preserved)
- Admin banner JSX preserved verbatim

### VendorDashboardLayout.tsx
- `VendorProductLineSwitcher` imported and rendered in header with `ml-auto` for right-alignment
- Placed after breadcrumb div, before header closes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — product line context is fully wired. `vendor_subscribed_slugs()` RPC returns live data from DB. Switcher renders real subscription data.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-08-09, T-08-10). Dropdown only shows subscriptions from the SECURITY DEFINER RPC scoped to `auth.uid()`.

## Self-Check: PASSED

- [x] `src/hooks/useActiveProductLine.tsx` exists
- [x] `src/components/vendor-dashboard/VendorProductLineSwitcher.tsx` exists
- [x] `ActiveProductLineProvider` in VendorDashboardPage.tsx (4 occurrences)
- [x] `activeProductLine?.tier` in tier resolution chain
- [x] `VendorProductLineSwitcher` in VendorDashboardLayout.tsx (2 occurrences)
- [x] Commit a36658f exists (Task 1)
- [x] Commit 811d62e exists (Task 2)
- [x] `npm run build` passes
