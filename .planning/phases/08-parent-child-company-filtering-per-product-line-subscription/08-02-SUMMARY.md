---
phase: "08-parent-child-company-filtering-per-product-line-subscription"
plan: "02"
subsystem: admin-ui
tags: [vendor-wizard, product-subscriptions, admin-panel, crud]
dependency_graph:
  requires:
    - vendor_product_subscriptions junction table (08-01)
    - admin_upsert/delete/list_product_subscription RPCs (08-01)
    - resolve_vendor_family RPC (07 phase foundation)
    - provision-vendor Edge Function product_subscriptions support (08-01)
    - vendor_product_lines table (vendor_family_foundation migration)
  provides:
    - 5-step VendorWizardDialog with Products step (step 3)
    - VendorProductSubscriptionsPanel Sheet component for CRUD
    - Product count badge per vendor row in VendorManagementPage
  affects:
    - src/components/admin/vendor-management/VendorWizardDialog.tsx
    - src/pages/admin/VendorManagementPage.tsx
tech_stack:
  added: []
  patterns:
    - useQuery with resolve_vendor_family RPC for entity resolution in wizard
    - useMutation with admin RPCs for subscription CRUD
    - Sheet (shadcn) for side panel detail view
    - productCounts computed via useMemo from raw vendor_login_id counts mapped to vendor_name
key_files:
  created:
    - src/components/admin/vendor-management/VendorProductSubscriptionsPanel.tsx
  modified:
    - src/components/admin/vendor-management/VendorWizardDialog.tsx
    - src/pages/admin/VendorManagementPage.tsx
decisions:
  - "productCounts keyed by vendor_login_id then mapped to vendor_name via useMemo — avoids join complexity while staying reactive to both vendors and counts queries"
  - "Products step requires at least one selection to advance (D-03) — enforced via canAdvance check on Object.keys(selectedProducts).length > 0"
  - "Per-product tier defaults to the wizard's global tier value when checking a product, giving consistent behaviour (D-04)"
metrics:
  duration: "15m"
  completed: "2026-04-23"
  tasks_completed: 2
  files_changed: 3
---

# Phase 08 Plan 02: Admin Wizard Products Step and Subscription Panel Summary

**One-liner:** Extended 5-step provisioning wizard with entity-resolved product line checkboxes and a Sheet side panel for post-provisioning subscription CRUD with per-product tier control.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend VendorWizardDialog with Products step | 79b9a9a | src/components/admin/vendor-management/VendorWizardDialog.tsx |
| 2 | Create VendorProductSubscriptionsPanel and add badge + detail trigger | 79a6935 | src/components/admin/vendor-management/VendorProductSubscriptionsPanel.tsx, src/pages/admin/VendorManagementPage.tsx |

## What Was Built

### VendorWizardDialog: 5-step wizard with Products step
- Wizard expanded from 4 steps (Email, Profile, Tier, Confirm) to 5 steps (Email, Profile, Tier, Products, Confirm)
- New `selectedProducts` state: `Record<string, string>` mapping product_line slug to tier
- Entity resolution: `resolve_vendor_family` RPC fetches `vendor_entity_id` from vendor name
- Product lines query: `vendor_product_lines` filtered by `vendor_entity_id` and `is_active`
- Products step (step 3): checkboxes with per-product tier selectors; empty state if no entity or no lines configured
- canAdvance for step 3 requires `Object.keys(selectedProducts).length > 0` (D-03)
- Progress bar and navigation use `steps.length` instead of hardcoded `4`
- Confirm step (step 4) shows product count in summary row
- provisionMutation body includes `product_subscriptions` array sent to Edge Function
- handleClose resets `selectedProducts`

### VendorProductSubscriptionsPanel: Side panel for subscription CRUD
- shadcn `Sheet` component, 360-400px wide
- `admin_list_product_subscriptions` RPC fetches current subscriptions on open
- Per-subscription tier: inline `Select` calls `admin_upsert_product_subscription` on change
- Delete button calls `admin_delete_product_subscription`
- "Add product line" flow: resolves entity via `resolve_vendor_family`, fetches all product lines, shows only unsubscribed ones in a Select; adds with default `tier_1`
- All mutations invalidate `admin-product-subscriptions`, `admin-vendor-logins`, and `admin-vendor-product-counts`

### VendorManagementPage: Badge count and detail panel trigger
- `rawProductCounts` query fetches all `vendor_product_subscriptions` rows, counts by `vendor_login_id`
- `productCounts` computed via `useMemo` maps counts to `vendor_name` via the vendors list
- Product badge rendered on both multi-login group header row and single-login flat row
- Badge click sets `detailVendor` state, opening `VendorProductSubscriptionsPanel`
- Panel renders at page bottom with `open={!!detailVendor}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] productCounts query approach changed from join to two-step computation**
- **Found during:** Task 2
- **Issue:** Plan suggested `vendor_logins!inner(vendor_name)` join but Supabase auto-generated types don't include `vendor_product_subscriptions` (new table), causing type errors
- **Fix:** Fetch only `vendor_login_id` from `vendor_product_subscriptions`, then map to `vendor_name` via `useMemo` using the already-loaded `vendors` list
- **Files modified:** src/pages/admin/VendorManagementPage.tsx
- **Commit:** 79a6935

## Known Stubs

None — all data flows are wired to live RPCs and Supabase queries.

## Threat Flags

No new threat surface beyond the plan's threat model. All admin RPCs (admin_upsert/delete/list_product_subscription) were created in plan 01 with SECURITY DEFINER and GRANT EXECUTE TO authenticated.

## Self-Check: PASSED

- [x] `src/components/admin/vendor-management/VendorProductSubscriptionsPanel.tsx` exists
- [x] `src/components/admin/vendor-management/VendorWizardDialog.tsx` modified
- [x] `src/pages/admin/VendorManagementPage.tsx` modified
- [x] Commit 79b9a9a exists (Task 1 — wizard)
- [x] Commit 79a6935 exists (Task 2 — panel + badge)
- [x] `npm run build` passes
