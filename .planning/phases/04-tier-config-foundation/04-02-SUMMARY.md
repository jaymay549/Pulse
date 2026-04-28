---
phase: 04-tier-config-foundation
plan: 02
subsystem: admin-tier-config-ui
tags: [admin, tier-config, react-query, ui]
dependency_graph:
  requires: [04-01]
  provides: [admin-tier-config-page, useTierConfig-hook]
  affects: [admin-sidebar, app-routes]
tech_stack:
  added: []
  patterns: [optimistic-updates, rpc-cast-pattern]
key_files:
  created:
    - src/hooks/useTierConfig.ts
    - src/pages/admin/TierConfigPage.tsx
  modified:
    - src/components/admin/AdminSidebar.tsx
    - src/App.tsx
decisions:
  - Used `(supabase.rpc as any)()` cast for untyped RPCs — consistent with plan guidance and avoids modifying auto-generated types
  - Placed Tier Config nav item after Vendor Management in sidebar for logical grouping
metrics:
  duration: ~3min
  completed: 2026-04-15T17:50:00Z
  tasks: 3
  files: 4
---

# Phase 04 Plan 02: Admin Tier Config Page Summary

Admin tier config page with grouped grid UI and React Query hook for viewing/toggling component visibility per vendor tier, with optimistic updates and immediate database persistence.

## What Was Built

### useTierConfig Hook (`src/hooks/useTierConfig.ts`)
- `useTierConfig()` — React Query hook returning `configs`, `isLoading`, `error`, `updateVisibility`
- Fetches via `get_tier_component_config` RPC (query key: `["tier-component-config"]`)
- Mutates via `upsert_tier_component_config` RPC with optimistic cache updates
- Rollback on error with toast notification; invalidate on success
- `getVisibility()` helper — looks up visibility for a tier+component pair, defaults to `"full"`

### TierConfigPage (`src/pages/admin/TierConfigPage.tsx`)
- Grouped table: 11 components organized into 3 groups (Analytics & Insights, Engagement & Activity, Presence & Catalog)
- 3 tier columns: Tier 1 ($12K), Tier 2 ($25K), Test (Demo)
- Each cell is a Select dropdown with full/gated/hidden options
- Color-coded triggers: green (full), amber (gated), red (hidden)
- Test tier column separated with dashed left border
- Loading spinner and error state with retry button
- Dark admin theme matching existing admin pages

### Route & Sidebar Wiring
- Lazy import + `/admin/tier-config` route in App.tsx (inside AdminGuard/AdminLayout)
- "Tier Config" nav item with Sliders icon in AdminSidebar after Vendor Management

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c43592c | Create useTierConfig hook and TierConfigPage |
| 2 | 58d9e5e | Wire tier-config route and sidebar navigation |
| 3 | (checkpoint) | Build verification passed |

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
