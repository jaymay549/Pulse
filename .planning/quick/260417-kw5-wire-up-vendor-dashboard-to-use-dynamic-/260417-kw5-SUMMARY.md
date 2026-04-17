---
phase: quick-260417-kw5
plan: 01
subsystem: vendor-dashboard
tags: [tier-config, vendor-dashboard, dynamic-gating]
dependency_graph:
  requires: [tier_component_config table, get_tier_component_config RPC, useTierConfig hook]
  provides: [config-driven vendor dashboard section visibility, config-driven sidebar nav filtering]
  affects: [VendorDashboardPage, VendorDashboardSidebar]
tech_stack:
  added: []
  patterns: [anon-client-config-read, config-driven-visibility, hook-reuse-shared-cache]
key_files:
  created: []
  modified:
    - src/hooks/useTierConfig.ts
    - src/pages/VendorDashboardPage.tsx
    - src/components/vendor-dashboard/VendorDashboardSidebar.tsx
decisions:
  - useTierConfigReadonly uses anon client so vendor magic-link sessions (no Clerk JWT) can read config; tier_component_config has no RLS so this is safe
  - Same QUERY_KEY reused so admin and vendor pages share React Query cache when both loaded in same session
  - getSectionVisibility helper returns "full" for undefined tier (admin mode), preserving existing admin-sees-all behavior
  - gated visibility treated same as full (component renders); RLS is the actual enforcement layer
metrics:
  duration: 8min
  completed_date: "2026-04-17T14:07:42Z"
  tasks: 2
  files: 3
---

# Quick Task 260417-kw5: Wire Vendor Dashboard to Config-Driven Tier Visibility

**One-liner:** Config-driven vendor dashboard section gating via `tier_component_config` DB rows replacing hardcoded `T2_ONLY_SECTIONS` and `isT2` boolean.

## What Was Done

Replaced hardcoded tier gating in the vendor-facing dashboard with dynamic configuration from the `tier_component_config` database table that Phase 4 introduced.

### Task 1 — `useTierConfigReadonly` hook + VendorDashboardPage

- Added `useTierConfigReadonly()` to `src/hooks/useTierConfig.ts` — uses the anon Supabase client so vendor magic-link sessions (which have no Clerk JWT) can read tier config. The `tier_component_config` table has no RLS, making this safe.
- Reuses the same `QUERY_KEY = ["tier-component-config"]` as `useTierConfig()` so admin pages and vendor dashboard share the React Query cache.
- Added `staleTime: 5 * 60 * 1000` (5 minutes) since config changes rarely.
- In `VendorDashboardPage.tsx`: removed `isT2` boolean variable, added `getSectionVisibility` helper that returns `"full"` for undefined tier (admin mode) and calls `getVisibility(configs, tier, sectionKey)` for vendor sessions.
- All 11 dashboard sections now gate via `getSectionVisibility(...) !== "hidden"` instead of `isT2 &&`.
- Commit: `66942ff`

### Task 2 — Config-driven sidebar nav filtering

- In `VendorDashboardSidebar.tsx`: removed `T2_ONLY_SECTIONS` constant (7 lines) and `shouldHideT2` variable.
- Added `useTierConfigReadonly()` hook call and replaced the filter predicate with `getVisibility(tierConfigs, tier as VendorTier, item.id) !== "hidden"`.
- Admin mode (undefined tier) short-circuits to `return true` preserving all nav items.
- Commit: `6c8da8c`

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `66942ff` | feat(quick-260417-kw5-01): wire vendor dashboard to config-driven tier visibility |
| 2 | `6c8da8c` | feat(quick-260417-kw5-02): replace T2_ONLY_SECTIONS sidebar with config-driven nav filtering |

## Verification

- TypeScript: clean (`npx tsc --noEmit --skipLibCheck` — no errors)
- Build: success (`npm run build` — 3.75s, no new warnings)
- No remaining references to `T2_ONLY_SECTIONS`, `isT2`, or `shouldHideT2` in the two modified files

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all sections wire directly to DB config.

## Self-Check: PASSED

- `src/hooks/useTierConfig.ts` — modified, `useTierConfigReadonly` export present
- `src/pages/VendorDashboardPage.tsx` — modified, `isT2` removed, `tierConfigs` in use
- `src/components/vendor-dashboard/VendorDashboardSidebar.tsx` — modified, `T2_ONLY_SECTIONS` removed
- Commits `66942ff` and `6c8da8c` confirmed in `git log`
