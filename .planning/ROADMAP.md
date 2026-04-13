# Roadmap: Vendor Tiering System

## Overview

Three phases that mirror three hard dependencies: vendors can't be provisioned until auth exists, RLS can't be validated until provisioned vendors exist. Phase 1 delivers the auth primitive (vendor login, session isolation, route guard). Phase 2 delivers sales team autonomy (admin provisioning UI, tier assignment). Phase 3 delivers the revenue boundary (RLS tier gating enforced at the database level, frontend locked sections).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Vendor Auth Primitives** - Vendor can log in via OTP and land on the dashboard with an isolated Supabase Auth session (completed 2026-04-13)
- [x] **Phase 2: Admin Provisioning Tools** - Sales team can create, link, and tier vendor accounts without engineering involvement (completed 2026-04-13)
- [x] **Phase 3: Tier-Gated Data Access** - RLS enforces T1/T2 data boundaries at the database level; frontend shows locked sections for out-of-tier features (completed 2026-04-13)

## Phase Details

### Phase 1: Vendor Auth Primitives
**Goal**: Vendors can authenticate via OTP email and access the vendor dashboard with a session that is completely isolated from the existing Clerk auth system
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09
**Success Criteria** (what must be TRUE):
  1. Vendor enters their email at `/vendor-login`, receives a 6-digit OTP, enters it, and lands on `/vendor-dashboard` authenticated
  2. Vendor session persists across page reloads and browser restarts without re-authentication
  3. An unauthenticated user navigating directly to `/vendor-dashboard` is redirected to `/vendor-login`
  4. An admin user (Clerk-authenticated) can still access `/vendor-dashboard` without a vendor session (existing behavior preserved)
  5. An expired or invalid OTP shows a clear error with a "request a new link" call to action; an unknown email (not provisioned) shows a "contact your sales rep" message
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Vendor auth foundation: isolated Supabase client, useVendorSupabaseAuth hook, vendor_logins migration
- [x] 01-02-PLAN.md — Vendor login page (two-step email/OTP flow) and nav entry point
- [x] 01-03-PLAN.md — VendorAuthGuard, route wiring, VendorDashboardPage dual-auth integration

**UI hint**: yes

### Phase 2: Admin Provisioning Tools
**Goal**: The sales team can provision vendor credentials, link them to existing vendor profiles, and assign tiers entirely through the admin panel
**Depends on**: Phase 1
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06
**Success Criteria** (what must be TRUE):
  1. Admin can enter a vendor email, select a vendor profile from a searchable list, assign a tier (Unverified / Tier 1 / Tier 2), and trigger an OTP invite — all from the admin panel
  2. The admin vendor list displays each vendor account with a color-coded tier badge (Unverified / T1 / T2) visible at a glance
  3. Admin can resend an OTP to an existing vendor with one click from the vendor list
  4. The `vendor_logins` table record correctly links the Supabase Auth UUID to the vendor profile and tier after provisioning
**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Backend: provision-vendor Edge Function + admin_list_vendor_logins RPC migration
- [x] 02-02-PLAN.md — Frontend: Vendor Management admin page with data table, 4-step wizard, sidebar + route wiring

**UI hint**: yes

### Phase 3: Tier-Gated Data Access
**Goal**: Vendor data access is enforced at the database level — Tier 1 vendors see market intel and positivity leaderboard only; Tier 2 vendors see all T1 content plus granular mentions, insights, and action plans; no vendor sees another vendor's data
**Depends on**: Phase 2
**Requirements**: TIER-01, TIER-02, TIER-03, TIER-04, TIER-05, TIER-06, TIER-07
**Success Criteria** (what must be TRUE):
  1. A Tier 1 vendor can see market intel and the positivity/ranking leaderboard for their segment; attempting to access T2 data via direct API call returns no rows (not a frontend-only block)
  2. A Tier 2 vendor can see all T1 content plus granular dimension insights, mentions, and action plans
  3. A vendor authenticated as Vendor A cannot see Vendor B's data under any circumstances, including direct RPC calls
  4. The frontend renders locked or hidden sections for features outside the vendor's tier (no data visible, not just greyed out)
**Plans:** 3/3 plans complete

Plans:
- [x] 03-01-PLAN.md — Database migrations: vendor_tier() + auth_vendor_name() functions, vendor_mentions RLS, T2 RPC auth guards
- [x] 03-02-PLAN.md — Frontend client dispatch: useVendorDataClient hook, update all section components to use vendorSupabase for vendor sessions
- [x] 03-03-PLAN.md — Frontend tier gating: sidebar T2 section filtering, VendorDashboardPage tier propagation + section render guards

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Vendor Auth Primitives | 3/3 | Complete    | 2026-04-13 |
| 2. Admin Provisioning Tools | 2/2 | Complete    | 2026-04-13 |
| 3. Tier-Gated Data Access | 3/3 | Complete   | 2026-04-13 |
