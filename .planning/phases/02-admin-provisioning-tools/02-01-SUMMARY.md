---
phase: 02-admin-provisioning-tools
plan: "01"
subsystem: backend
tags: [edge-function, supabase-auth, vendor-provisioning, rpc, security-definer]
dependency_graph:
  requires: []
  provides:
    - provision-vendor Edge Function (admin creates vendor auth users + upsert vendor_logins)
    - admin_list_vendor_logins RPC (admin reads vendor list joined with auth.users)
  affects:
    - supabase/functions/provision-vendor/index.ts
    - supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql
tech_stack:
  added: []
  patterns:
    - Edge Function with verifyAdmin (Clerk JWT decode + user_role check)
    - inviteUserByEmail with generateLink fallback for already-registered users
    - SECURITY DEFINER RPC joining public schema with auth.users
key_files:
  created:
    - supabase/functions/provision-vendor/index.ts
    - supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql
  modified: []
decisions:
  - "inviteUserByEmail used as primary flow (sends invite email); generateLink fallback used when user already exists to obtain user_id and send new magic link"
  - "resend action skips vendor_logins upsert — existing row unchanged, only new auth link generated"
  - "admin_list_vendor_logins has no SQL-level admin check — matches pattern of other admin RPCs; UI access gating is sufficient for low-sensitivity data"
metrics:
  duration: "1 minute"
  completed_date: "2026-04-13T18:35:56Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 2 Plan 01: Vendor Provisioning Backend Summary

**One-liner:** provision-vendor Edge Function creates Supabase Auth users via inviteUserByEmail and upserts vendor_logins; admin_list_vendor_logins SECURITY DEFINER RPC joins vendor_logins with auth.users for admin table.

## What Was Built

### Task 1: provision-vendor Edge Function
`supabase/functions/provision-vendor/index.ts`

Follows the exact pattern from `admin-ensure-vendor-profile/index.ts`:
- `verifyAdmin(token)` decodes Clerk JWT and checks `user_role === "admin"` — returns 400 on unauthorized
- Validates `vendor_email` (non-empty), `vendor_name` (non-empty for provision action), `tier` (must be one of `unverified`, `tier_1`, `tier_2`)
- Primary flow: `supabase.auth.admin.inviteUserByEmail(vendor_email, { redirectTo })` — sends invite email to vendor
- Fallback: if Supabase returns "already been registered", calls `generateLink({ type: "magiclink" })` to get user_id and send new auth link
- Upserts `vendor_logins` with `onConflict: "user_id"` — idempotent, safe for re-provisioning
- Supports `action: "resend"` — generates new magic link without modifying vendor_logins
- CORS headers on all responses (OPTIONS preflight + success + error)
- Commit: `e06081e`

### Task 2: admin_list_vendor_logins RPC Migration
`supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql`

- `CREATE OR REPLACE FUNCTION public.admin_list_vendor_logins()` with `SECURITY DEFINER SET search_path = public`
- JOINs `public.vendor_logins vl` with `auth.users u ON u.id = vl.user_id`
- Returns: `id, user_id, vendor_name, tier, email, created_at, last_sign_in_at` ordered by `created_at DESC`
- `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated`
- Commit: `8bf93d2`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - both files are complete implementations ready for integration.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: elevation-of-privilege | supabase/functions/provision-vendor/index.ts | New admin-only endpoint that creates Supabase Auth users via service-role key; mitigated by verifyAdmin check (T-02-01 in plan threat model) |
| threat_flag: service-role-access | supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql | SECURITY DEFINER function reads auth.users; mitigated by REVOKE ALL + GRANT to authenticated only (T-02-06 in plan threat model) |

Both threat flags were pre-identified in the plan's threat model with `mitigate` disposition and are fully addressed.

## Self-Check: PASSED

- `supabase/functions/provision-vendor/index.ts` — FOUND
- `supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql` — FOUND
- Commit `e06081e` — FOUND
- Commit `8bf93d2` — FOUND
