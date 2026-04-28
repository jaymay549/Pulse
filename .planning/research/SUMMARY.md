# Project Research Summary

**Project:** CDG Pulse — Vendor Auth & Tiering Milestone (CAR-7/8/9)
**Domain:** Dual auth integration (Clerk + Supabase Auth), admin-provisioned vendor credentials, tier-based RLS
**Researched:** 2026-04-13
**Confidence:** HIGH

## Executive Summary

CDG Pulse already has a rich vendor dashboard but vendors have no way to authenticate into it independently. This milestone adds a parallel Supabase Auth layer alongside the existing Clerk auth system, enabling admin-provisioned vendor logins via email OTP, and enforcing tier-based data access through RLS. The core constraint shaping every decision is that Clerk (for dealers/admins) and Supabase Auth (for vendors) must run as completely independent, non-interfering auth systems — same browser, same Supabase project, zero session bleed.

The recommended approach requires zero new npm packages. All needed libraries are already installed (`@supabase/supabase-js` 2.76.1, `input-otp` 1.4.2, `sonner`, `react-router-dom`). The build follows three clearly ordered phases: vendor auth primitives first (route guard, OTP login, session isolation), then admin tooling (provisioning UI, tier assignment), then RLS enforcement (tier-gated data access). This order is non-negotiable — nothing can be tested without the auth primitive, and RLS can only be validated once provisioning works end-to-end.

The dominant risk is session isolation. The existing anon Supabase client (`client.ts`) has `persistSession: true` — if vendor magic link auth uses the same client instance, a vendor login event fires `onAuthStateChange` globally and can corrupt the Clerk-authenticated admin's data fetching context. A dedicated vendor Supabase client with an isolated `storageKey` is mandatory, not optional. A secondary billing-critical risk is that many existing vendor dashboard RPCs are `SECURITY DEFINER` and bypass RLS entirely — they must receive explicit tier checks inside the function body before the RLS phase ships.

---

## Key Findings

### Recommended Stack

No new packages are needed. The entire auth flow is implementable using `@supabase/supabase-js` v2's `signInWithOtp` / `verifyOtp` APIs (OTP preferred over magic link deep-link, which suffers browser/device interception issues for sales-provisioned accounts). The two Supabase client instances that already exist — the anon client in `client.ts` and the Clerk-enhanced client in `useClerkSupabase` — serve as the template for a third vendor-specific client.

**Core technologies:**
- `@supabase/supabase-js` 2.76.1: Supabase Auth OTP send/verify + session management — already installed, no config changes needed beyond enabling Email OTP in Supabase Dashboard
- `input-otp` 1.4.2: 6-digit OTP input UI — already installed, already used in project
- `react-router-dom` 6.30.1: `VendorGuard` component following existing `AdminGuard` pattern — already installed
- `sonner` 1.7.4: Toast feedback for OTP sent / errors — already installed
- Two new Edge Functions (`vendor-invite`, `vendor-set-tier`): service-role admin operations following the existing `admin-ensure-vendor-profile` pattern

**New database object (single new table):**

A `vendor_logins` table (alternatively named `vendor_accounts` in ARCHITECTURE.md — same concept) links a Supabase Auth `auth.users.id` UUID to a `vendor_profiles.id` and stores the vendor's tier. This keeps vendor Supabase Auth UUIDs entirely separate from `vendor_profiles.user_id` (which stores Clerk text IDs and has conflicting existing RLS policies).

### Expected Features

**Must have (table stakes):**
- Admin-triggered email OTP send — no vendor can log in without admin provisioning; self-registration is explicitly out of scope
- OTP consume + session creation — the auth loop must close cleanly with a dedicated callback route
- Isolated vendor session storage — separate Supabase client with custom `storageKey`; session must not collide with Clerk
- `VendorGuard` on `/vendor-dashboard` — replaces the current Clerk-only redirect with a dual-path check (Clerk admin bypass OR vendor Supabase session)
- `/vendor-login` page with email + OTP form — using existing `InputOTP` and `Input` components
- Admin UI: create vendor login, link to vendor profile, assign tier (unverified/T1/T2)
- RLS own-data predicate — vendor authenticated as VendorA must never see VendorB data; this must ship before tier gates
- RLS Tier 1 gate — market intel and positivity leaderboard (the $12K offering)
- RLS Tier 2 gate — granular mentions, action plans, full insights (the $25K offering)
- Session expiry redirect to `/vendor-login` with re-request CTA

**Should have (differentiators):**
- Visual tier badge in admin vendor list — reduces ops errors during sales calls
- Admin resend OTP button — reduces friction when vendor says "I didn't get the email"
- Tier upgrade path (admin one-click T1 → T2) — immediate effect on next vendor page load
- Locked/blurred T2 sections for T1 vendors — natural upsell surface, frontend-only

**Defer to v2+:**
- Last login / activity indicator in admin
- Realtime Supabase subscriptions for vendor data (nightly intelligence data doesn't need it)
- Mobile-optimized vendor experience (explicitly out of scope per PROJECT.md)
- Vendor-to-vendor comparison views

### Architecture Approach

The recommended architecture runs Clerk and Supabase Auth in completely parallel tracks — no shared session state, no cross-system calls, and RLS distinguishes them by JWT issuer. The key discriminator in RLS is that `auth.uid()` returns NULL for Clerk JWTs (Clerk user IDs are strings, not Supabase UUIDs) but returns a real UUID for Supabase Auth vendor sessions. This makes `auth.uid() IS NOT NULL` the reliable signal for "this is a vendor session" in any RLS policy.

**Major components:**

1. `VendorAuthProvider` + `useVendorSession()` hook — wraps vendor routes only; listens to `supabase.auth.onAuthStateChange` on the isolated vendor client; returns session + tier from `vendor_logins`
2. `VendorLoginPage` + `VendorAuthCallback` route — OTP email input form and PKCE callback handler; pure Supabase Auth, no Clerk involvement
3. `VendorGuard` — gates `/vendor-dashboard`; passes through if `isAdmin` (Clerk) OR vendor Supabase session present
4. `vendor_logins` table + `get_vendor_tier(uid)` SECURITY DEFINER helper — authoritative tier source for all RLS policies; follows the exact pattern of existing `has_role()` helper
5. `create-vendor-account` / `vendor-set-tier` Edge Functions — service-role operations for admin provisioning; accept Clerk JWT for admin identity verification
6. `VendorAccountManager` admin component — sales team UI for provisioning without engineering involvement

### Critical Pitfalls

1. **Shared Supabase client session bleed** — If vendor magic link auth uses the existing anon client singleton, a vendor login event fires `onAuthStateChange` globally, corrupting the Clerk admin's data context. Fix: create a dedicated `src/lib/vendorSupabase.ts` client with `storageKey: 'vendor-auth'`. Never import the shared `supabase` singleton in vendor auth code paths.

2. **`SECURITY DEFINER` RPCs bypass RLS tier gates** — The codebase has 142 SECURITY DEFINER functions. Many existing vendor dashboard RPCs accept a `vendor_name TEXT` parameter with no tier check. A T1 vendor can call these directly and receive T2 data. Fix: audit every vendor dashboard RPC before the RLS phase ships; add explicit `IF get_vendor_tier(auth.uid()) != 'tier2' THEN RAISE EXCEPTION` checks inside each SECURITY DEFINER function body.

3. **`auth.uid()` vs `auth.jwt() ->> 'sub'` policy split** — The codebase already has a documented split: early migrations used `auth.uid()` (wrong for Clerk) and were later corrected to `auth.jwt() ->> 'sub'`. Adding vendor Supabase Auth creates a third identity system. Fix: establish and document the convention that vendor RLS policies use `auth.uid()` (valid Supabase Auth UUID) and Clerk policies use `auth.jwt() ->> 'sub'`. Comment every new policy with which auth system it targets.

4. **Magic link redirect URL not allowlisted for all environments** — Supabase requires the `emailRedirectTo` URL to be in the Auth allowlist. Three environments need entries: `http://localhost:8080/vendor-auth/callback`, `https://*.vercel.app/vendor-auth/callback`, and `https://cdgpulse.com/vendor-auth/callback`. Missing any one causes the vendor to land on a Supabase error page. Fix: add all three during Phase 1 setup, before the first magic link test.

5. **Tier stored in two places diverges** — Clerk org metadata currently stores vendor tier for UI display. Supabase `vendor_logins.tier` will be the RLS source of truth. If an admin updates tier through an incomplete flow, the two diverge silently. Fix: Supabase `vendor_logins.tier` is the single authoritative source; Clerk metadata is a display cache only. Admin tier-change must go through an Edge Function that writes to Supabase first, and the UI reads tier from the Supabase row.

---

## Implications for Roadmap

Based on combined research, the three-phase structure is well-justified by hard dependencies. No phase can be meaningfully tested without the previous one being functional. The existing CAR-7/8/9 ticket numbering from PROJECT.md maps cleanly to these phases.

### Phase 1: Vendor Auth Primitives (CAR-7)

**Rationale:** Nothing else can be built or tested until a vendor can authenticate. This phase establishes the auth primitive that all subsequent phases depend on. The `VendorGuard` must be in place before admin tooling (Phase 2) has anything to protect, and RLS (Phase 3) requires a real vendor session to validate against.

**Delivers:** A vendor can receive an OTP email (manually triggered by engineering for testing), enter the code, land on the vendor dashboard, and have their session persist across page reloads. The existing dashboard content loads without tier filtering.

**Addresses:** Vendor login page, OTP send/verify, session isolation, `VendorGuard`, `VendorAuthProvider`, `useVendorSession()`, `/vendor-auth/callback` route, `vendor_logins` table + migration, `vendor_tier()` RLS helper function.

**Avoids:** Session bleed (isolated `storageKey`), Redirect URL misconfiguration (add all environments to Supabase allowlist on day one), route guard blocking vendor magic link users, `vendor_profiles.user_id` type collision (new separate table).

**Research flag:** Standard patterns — `signInWithOtp` / `verifyOtp` are well-documented stable APIs. The `VendorGuard` pattern is directly established by `AdminGuard.tsx`. No additional phase research needed.

---

### Phase 2: Admin Provisioning Tools (CAR-8)

**Rationale:** Phase 1 can be tested with engineering-created vendor accounts in the Supabase Auth dashboard. Phase 2 makes provisioning autonomous for the sales team. It should come before RLS because tier assignment (set during provisioning) is what RLS enforces — there is nothing to test tier gates against until a real tiered vendor account exists.

**Delivers:** A sales team member can provision vendor credentials, assign tier, and link to a vendor profile entirely through the admin panel without engineering involvement. Tier badges make the current state of all vendor accounts visible at a glance.

**Addresses:** `VendorAccountManager` admin component, `vendor-invite` Edge Function, `vendor-set-tier` Edge Function, tier dropdown in provisioning form, visual tier badge in vendor list, resend OTP button.

**Avoids:** Duplicate email handling (check for existing `auth.users` before calling `inviteUserByEmail`), tier divergence between Clerk metadata and Supabase (Edge Function writes to Supabase first), NULL tier defaulting to access (NOT NULL constraint on `vendor_logins.tier`).

**Research flag:** Standard patterns — Edge Function admin auth follows `admin-ensure-vendor-profile`. No additional phase research needed.

---

### Phase 3: Tier-Gated RLS + Frontend Gating (CAR-9)

**Rationale:** This is the revenue-critical phase — T1 and T2 data boundaries must be enforced at the database level before any vendor goes live. It comes last because RLS validation requires a provisioned, tiered vendor session (from Phase 2) and a working auth flow (from Phase 1). Without both in place, RLS tests cannot be meaningful.

**Delivers:** T1 vendors ($12K) see market intel and positivity leaderboard; T2 vendors ($25K) see all T1 data plus granular mentions, action plans, and insights. Neither tier can access the other's data at the database level. The frontend shows locked/blurred sections for out-of-tier features, creating a visible upsell surface.

**Addresses:** RLS own-data predicate (vendor sees only their own data), T1 policies on `vendor_pulse_insights`, T2 policies on `vendor_mentions` and related tables, SECURITY DEFINER RPC audit, frontend tier-aware rendering, locked/blurred out-of-tier sections.

**Avoids:** SECURITY DEFINER RPC bypass (explicit tier checks inside function bodies), `auth.uid()` vs `auth.jwt() ->> 'sub'` confusion (documented convention, comments in every policy), NULL tier = access (deny-by-default in all policies).

**Research flag:** Deeper attention warranted here. The SECURITY DEFINER audit requires enumerating all vendor dashboard RPCs against a tier-enforcement checklist. Recommend a pre-implementation audit step as part of Phase 3 planning. The `vendor_name` matching between `vendor_logins.vendor_name` and `vendor_profiles.vendor_name` / `vendor_mentions.vendor_name` must be verified for exact casing before policies ship — silent empty results from a name mismatch are easy to miss.

---

### Phase Ordering Rationale

- Phase 1 before Phase 2: The Edge Functions in Phase 2 create `vendor_logins` rows — that table is defined in Phase 1. Admin UI in Phase 2 tests the auth flow defined in Phase 1.
- Phase 2 before Phase 3: RLS tier gates are only testable with real tiered vendor sessions. Phase 2 provides the provisioning path to create them without engineering effort.
- Own-data predicate before T1/T2 gates: Within Phase 3, the base "vendor sees only their data" predicate must be in place before tier predicates layer on top. Shipping tier gates without own-data isolation is a data exposure risk.
- SECURITY DEFINER audit before any Phase 3 RLS policy: Policies protect table access but not function access. The audit must happen before the first policy lands in production.

### Research Flags

**Needs careful attention during planning:**
- **Phase 3 (RLS):** SECURITY DEFINER RPC audit — enumerate all vendor dashboard RPCs, assess each one for tier enforcement. This is a billing-critical checklist, not a best-effort review.
- **Phase 3 (RLS):** `vendor_name` join validation — confirm exact string matching between `vendor_logins`, `vendor_profiles`, and `vendor_mentions` before writing policies.

**Standard patterns (planning can proceed directly):**
- **Phase 1 (Auth):** `signInWithOtp` / `verifyOtp` are stable, well-documented Supabase Auth v2 APIs. `VendorGuard` is a direct copy of `AdminGuard`. `vendor_tier()` SECURITY DEFINER helper follows `has_role()` in existing migrations.
- **Phase 2 (Admin tools):** Edge Function pattern established by `admin-ensure-vendor-profile`. Admin UI uses only existing shadcn/Radix components.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against live `package.json` and existing client code. No new packages needed — confirmed. |
| Features | HIGH | Derived from PROJECT.md requirements + existing codebase patterns. Anti-features grounded in explicit PROJECT.md out-of-scope section. |
| Architecture | HIGH | `auth.uid() IS NULL` for Clerk JWTs confirmed in migration comments. Dual-client coexistence verified from live `client.ts` and `useClerkSupabase.ts`. |
| Pitfalls | HIGH | All critical pitfalls grounded in live code evidence (migration comments, existing client config, CONCERNS.md error-handling audit). |

**Overall confidence:** HIGH

### Gaps to Address

- **Supabase Auth "Email OTP" vs magic link setting:** Must be verified in Supabase Dashboard before Phase 1 testing. The API call is the same (`signInWithOtp`), but the Dashboard setting controls whether the email delivers a link or a 6-digit code. Confirm OTP mode is enabled and that email templates carry CDG Pulse branding.

- **`shouldCreateUser: false` error shape:** The exact error returned when an unknown email attempts OTP login (`shouldCreateUser: false`) needs verification — it should produce a clear enough error for the frontend to display a "contact your sales rep" message rather than a generic failure.

- **`inviteUserByEmail` vs subsequent `signInWithOtp` behavior:** `inviteUserByEmail` creates the user and sends the first link. Subsequent admin "resend" calls will use `signInWithOtp` for an existing user. Confirm the two calls produce the same user experience for the vendor (same email template, same PKCE flow) so the admin resend path works identically.

- **`vendor_name` string matching:** Before Phase 3 RLS policies are written, run a query to verify that `vendor_profiles.vendor_name` values match exactly (case, spacing, aliases) against `vendor_mentions.vendor_name` values. Mismatches will cause silent empty datasets for vendors.

- **Vercel preview URL in Supabase allowlist:** Wildcard `https://*.vercel.app` must be explicitly tested in Supabase Auth allowlist configuration — verify Supabase accepts the wildcard format before a preview-branch test.

---

## Sources

### Primary (HIGH confidence — live codebase)
- `src/integrations/supabase/client.ts` — localStorage persistence config; dual-client architecture basis
- `src/hooks/useClerkSupabase.ts` — Clerk JWT Supabase client pattern; confirms `auth.uid() IS NULL` for Clerk
- `src/hooks/useClerkAuth.ts` — hook pattern replicated for `useVendorSession`
- `src/components/admin/AdminGuard.tsx` — route guard pattern replicated for `VendorGuard`
- `supabase/migrations/20260324930000_fix_vendor_responses_for_mentions.sql` — documented `auth.uid()` vs `jwt sub` split
- `supabase/migrations/20260221000000_fix_user_id_text_types.sql` — TEXT `user_id` column; confirms separate UUID column needed
- `supabase/migrations/20251027135752_*.sql` — `has_role()` SECURITY DEFINER helper; direct template for `vendor_tier()`
- `supabase/migrations/20260220000000_vendor_claims.sql` — FK to `auth.users` pattern
- `.planning/codebase/CONCERNS.md` — 40+ swallowed catch blocks; informs tier-sync risk
- `src/pages/VendorDashboardPage.tsx` — current Clerk-only guard that Phase 1 replaces
- `.planning/PROJECT.md` — milestone requirements and explicit out-of-scope constraints
- `package.json` — confirmed no new packages needed

### Secondary (HIGH confidence — stable documented APIs)
- `@supabase/supabase-js` v2 API: `signInWithOtp`, `verifyOtp`, `auth.admin.inviteUserByEmail`, `onAuthStateChange` — stable APIs unchanged across v2 minor versions (August 2025 knowledge cutoff)

---

*Research completed: 2026-04-13*
*Ready for roadmap: yes*
