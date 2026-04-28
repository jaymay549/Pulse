# Quick Task 260428-pe3: Summary

## Task
CAR-21: Add competitive movement tracking to vendor dashboard in Market Intel, Dealer Signals, and Intelligence Hub

## What Was Done

### Task 1: Created shared hook and components
- `src/hooks/useVendorSwitchingIntel.ts` — Shared React Query hook wrapping `get_vendor_switching_intel` RPC
- `src/components/vendor-dashboard/CompetitiveMovementCard.tsx` — Two components:
  - `CompetitiveMovementCard` — Full view with "Gained from" / "Lost to" columns (max 5 vendors each)
  - `CompetitiveMovementCompact` — Summary view for Intelligence Hub with net trend and top 3 vendors

### Task 2: Integrated into three dashboard sections
- **Market Intel** (`DashboardIntel.tsx`) — Full card after competitor comparison table
- **Dealer Signals** (`DashboardDealerSignals.tsx`) — Full card after exit reasons section
- **Intelligence Hub** (`VendorCommandCenter.tsx`) — Compact summary in a 3-column insights grid

## Commits
- `38fff51` — feat(quick-260428-pe3): add shared hook and competitive movement components
- `8b1efbb` — feat(quick-260428-pe3): integrate competitive movement into dashboard sections

## Verification
- Build passes (`npm run build`)
- Components gracefully return null when no switching data exists
- All three views share the same query key for consistent data
