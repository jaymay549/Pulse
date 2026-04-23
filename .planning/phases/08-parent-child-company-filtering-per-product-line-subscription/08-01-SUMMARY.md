---
phase: 08-parent-child-company-filtering-per-product-line-subscription
plan: "01"
subsystem: database
tags: [migrations, rls, security-definer, edge-function, vendor-subscriptions]
dependency_graph:
  requires:
    - vendor_logins table (20260413000000_create_vendor_logins.sql)
    - vendor_product_lines table (20260304120000_vendor_family_foundation.sql)
  provides:
    - vendor_product_subscriptions junction table
    - vendor_product_tier(slug) SECURITY DEFINER function
    - vendor_subscribed_slugs() SECURITY DEFINER function
    - admin_upsert_product_subscription() RPC
    - admin_delete_product_subscription() RPC
    - admin_list_product_subscriptions() RPC
    - provision-vendor Edge Function product_subscriptions support
  affects:
    - provision-vendor Edge Function (extended, backward compatible)
tech_stack:
  added: []
  patterns:
    - SECURITY DEFINER functions with REVOKE ALL + GRANT EXECUTE TO authenticated
    - Junction table with FK to parent PK (not unique column) for multi-login vendor orgs
    - Optional array field in Edge Function for backward-compatible provisioning
key_files:
  created:
    - supabase/migrations/20260423000000_vendor_product_subscriptions.sql
    - supabase/migrations/20260423100000_vendor_product_tier_functions.sql
  modified:
    - supabase/functions/provision-vendor/index.ts
decisions:
  - "FK to vendor_logins(id) not vendor_logins(user_id): enables multi-login vendor orgs where all logins share the same subscriptions via JOIN"
  - "vendor_product_tier() returns NULL for unsubscribed slugs (defense in depth per D-14): callers must handle NULL as 'no access'"
  - "No INSERT/UPDATE/DELETE RLS policies on vendor_product_subscriptions: admin writes go via service-role Edge Function only"
  - "product_subscriptions field in provision-vendor is optional: backward compatible when omitted"
metrics:
  duration: "8m"
  completed: "2026-04-23"
  tasks_completed: 3
  files_changed: 3
---

# Phase 08 Plan 01: Database Foundation for Per-Product-Line Subscriptions Summary

**One-liner:** Junction table `vendor_product_subscriptions` with 5 SECURITY DEFINER functions and backward-compatible Edge Function extension for per-product tier gating.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create vendor_product_subscriptions table migration | fa739a5 | supabase/migrations/20260423000000_vendor_product_subscriptions.sql |
| 2 | Create SECURITY DEFINER functions and admin RPCs migration | 7f2d666 | supabase/migrations/20260423100000_vendor_product_tier_functions.sql |
| 3 | Extend provision-vendor Edge Function to accept product subscriptions | 2ee5964 | supabase/functions/provision-vendor/index.ts |

## What Was Built

### Migration 1: vendor_product_subscriptions table
- Junction table linking `vendor_logins(id)` to `vendor_product_lines(id)` with per-product `tier`
- `CHECK (tier IN ('unverified', 'tier_1', 'tier_2'))` prevents invalid tier values (T-08-03)
- `UNIQUE (vendor_login_id, vendor_product_line_id)` enables `ON CONFLICT` upserts
- Two indexes for query performance on both FK columns
- RLS: vendor can SELECT own rows via `vendor_logins WHERE user_id = auth.uid()` join
- No authenticated INSERT/UPDATE/DELETE — admin writes are service-role only

### Migration 2: Five SECURITY DEFINER functions
- **`vendor_product_tier(slug)`** — returns tier for current session + product line slug; NULL if unsubscribed; satisfies T-08-01
- **`vendor_subscribed_slugs()`** — returns all subscribed product lines ordered by name; satisfies T-08-02
- **`admin_upsert_product_subscription(vendor_name, slug, tier)`** — upsert with ON CONFLICT
- **`admin_delete_product_subscription(vendor_name, slug)`** — targeted delete by vendor_name + slug
- **`admin_list_product_subscriptions(vendor_name)`** — read all subscriptions for admin UI
- All 5 functions: `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`

### Edge Function: provision-vendor extended
- New optional `product_subscriptions` array in request body
- After `vendor_logins` upsert: looks up `vendor_login_id`, iterates subscriptions
- Validates each tier against `VALID_TIERS`; silently skips unknown product line slugs (T-08-05)
- Response adds `subscriptions_created` count
- Fully backward compatible: existing callers without `product_subscriptions` continue to work

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no frontend components created in this plan.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model.

## Self-Check: PASSED

- [x] `supabase/migrations/20260423000000_vendor_product_subscriptions.sql` exists
- [x] `supabase/migrations/20260423100000_vendor_product_tier_functions.sql` exists
- [x] `supabase/functions/provision-vendor/index.ts` modified
- [x] Commit fa739a5 exists (Task 1)
- [x] Commit 7f2d666 exists (Task 2)
- [x] Commit 2ee5964 exists (Task 3)
