# Roadmap: Vendor Tiering System

## Milestones

- ✅ **v1.0 Vendor Auth & Tier Gating** - Phases 1-3 (shipped 2026-04-13)
- 🚧 **v1.1 Admin-Configurable Tier Gating** - Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 Vendor Auth & Tier Gating (Phases 1-3) - SHIPPED 2026-04-13</summary>

- [x] **Phase 1: Vendor Auth Primitives** - Vendor can log in via OTP and land on the dashboard with an isolated Supabase Auth session (completed 2026-04-13)
- [x] **Phase 2: Admin Provisioning Tools** - Sales team can create, link, and tier vendor accounts without engineering involvement (completed 2026-04-13)
- [x] **Phase 3: Tier-Gated Data Access** - RLS enforces T1/T2 data boundaries at the database level; frontend shows locked sections for out-of-tier features (completed 2026-04-13)

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

</details>

### v1.1 Admin-Configurable Tier Gating (In Progress)

**Milestone Goal:** Make tier visibility admin-configurable (not hardcoded) and implement granular T1/T2 data visibility with partial gating, blurred/locked upgrade CTAs, and a test tier for demos.

- [ ] **Phase 4: Tier Config Foundation** - Admin can configure per-tier component visibility via a config table and admin panel
- [ ] **Phase 5: Config-Driven Gating Engine** - Frontend reads tier config from DB and renders components as full, gated (blurred/locked), or hidden
- [ ] **Phase 6: T1/T2 Content Rules** - T1 vendors see teaser content with upgrade gates; T2 vendors see everything unlocked

## Phase Details

### Phase 4: Tier Config Foundation
**Goal**: Admins can define which dashboard components each tier sees, including a flexible test tier for demos, with config persisted to the database
**Depends on**: Phase 3
**Requirements**: DATA-01, ACONF-01, ACONF-02, ACONF-03, ACONF-04
**Success Criteria** (what must be TRUE):
  1. Admin opens the tier config panel and sees every vendor dashboard component listed with its current visibility setting (full / gated / hidden) for each tier
  2. Admin toggles a component from "full" to "gated" for Tier 1 and the change persists immediately — refreshing the page shows the updated setting
  3. Admin configures a "test" tier with a custom mix of visibility settings and saves it without affecting real T1/T2 configs
  4. The `tier_component_config` table contains one row per tier-component pair with the correct visibility value after admin saves
**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — Database: tier_component_config table, seed data (3 tiers x 11 components), upsert + get RPCs, TypeScript types
- [x] 04-02-PLAN.md — Admin UI: TierConfigPage with grouped visibility grid, useTierConfig hook, sidebar + route wiring

**UI hint**: yes

### Phase 5: Config-Driven Gating Engine
**Goal**: The vendor dashboard dynamically renders each component as full, gated (blurred with upgrade CTA), or hidden based on the vendor's tier and the config from the database — replacing all hardcoded tier checks
**Depends on**: Phase 4
**Requirements**: DATA-02, DYN-01, DYN-02, GATE-04
**Success Criteria** (what must be TRUE):
  1. A T1 vendor viewing a component marked "gated" in config sees a blurred/locked overlay with an upgrade CTA — not a blank space or hidden element
  2. An admin changes a component from "hidden" to "gated" in the config panel, and the next vendor page load reflects the change without a code deploy
  3. The hardcoded `T2_ONLY_SECTIONS` constant is no longer used — all visibility decisions flow from `tier_component_config`
  4. A T2 vendor sees all components marked "full" rendered normally with no gating artifacts
**Plans**: TBD
**UI hint**: yes

### Phase 6: T1/T2 Content Rules
**Goal**: T1 vendors see the correct teaser content per the CAR-13 spec (partial data with upgrade gates), and T2 vendors see all content fully unlocked
**Depends on**: Phase 5
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-05, GATE-06, GATE-07
**Success Criteria** (what must be TRUE):
  1. A T1 vendor sees health score, sentiment trend, NPS, benchmarking, discussion volume, dimensional breakdown, performance breakdown, pulse briefing, verified badge, and profile editing — all rendered fully
  2. A T1 vendor sees "What dealers are saying" with exactly 2 AI-summarized items visible and a "See all" button that prompts an upgrade gate
  3. A T1 vendor sees the competitor leaderboard sorted by positivity with their name highlighted; clicking "Why you rank here" prompts an upgrade gate
  4. A T2 vendor sees the full AI action plan, all dealer comments and conversations, audience segments, dealer signals, competitive breakdown, and integrations — all fully rendered with no gates
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Vendor Auth Primitives | v1.0 | 3/3 | Complete | 2026-04-13 |
| 2. Admin Provisioning Tools | v1.0 | 2/2 | Complete | 2026-04-13 |
| 3. Tier-Gated Data Access | v1.0 | 3/3 | Complete | 2026-04-13 |
| 4. Tier Config Foundation | v1.1 | 0/2 | In progress | - |
| 5. Config-Driven Gating Engine | v1.1 | 0/? | Not started | - |
| 6. T1/T2 Content Rules | v1.1 | 0/? | Not started | - |

### Phase 7: De-dupe and Normalize All Vendor Tenants

**Goal:** Audit and clean up all vendor tenants in the database — remove duplicates, normalize naming, and ensure each vendor has a single canonical profile before selling vendor tiers
**Requirements**: Identify duplicates across vendor_profiles/vendor_metadata/vendor_mentions; merge into canonical records preserving richest data; normalize vendor names (casing, whitespace, abbreviations); validate parent/child relationships; ensure all vendor_mentions point to valid non-duplicate profiles
**Depends on:** None (independent data cleanup, can run in parallel with Phases 4-6)
**Linear:** CAR-27
**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md — Audit RPC for duplicate detection + normalize vendor names across all tables
- [x] 07-02-PLAN.md — Bulk merge duplicate entities, backfill unlinked mentions, health check RPC

### Phase 8: Parent/Child Company Filtering

**Goal:** Vendors subscribe per product line with tier-per-product. Admin provisions product line subscriptions through the wizard. Vendor dashboard shows a product line switcher. RPCs scope data to the selected product line. RLS enforces subscription boundaries.
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, PROD-08, PROD-09, PROD-10, PROD-11, PROD-12, PROD-13, PROD-14
**Depends on:** Phase 7
**Linear:** CAR-20
**Plans:** 5 plans

Plans:
- [x] 08-01-PLAN.md — Database: vendor_product_subscriptions table, SECURITY DEFINER functions, admin RPCs, Edge Function extension
- [x] 08-02-PLAN.md — Admin: Wizard product line step, vendor detail panel for subscription CRUD, badge counts
- [x] 08-03-PLAN.md — Vendor dashboard: ActiveProductLine context, header switcher, product-specific tier resolution
- [ ] 08-04-PLAN.md — RPC threading: All dashboard components pass active product line slug, queryKey updates
- [x] 08-05-PLAN.md — [BLOCKING] Database schema push to live Supabase

**UI hint**: yes
