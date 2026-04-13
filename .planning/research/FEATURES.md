# Feature Landscape

**Domain:** Vendor portal with admin-managed magic link auth and tier-gated data access
**Project:** CDG Pulse — Vendor Auth & Tiering Milestone
**Researched:** 2026-04-13
**Confidence:** HIGH (grounded in existing codebase + domain knowledge of SaaS vendor portals)

---

## Context

CDG Pulse already has a working vendor dashboard at `/vendor-dashboard` with rich components
(DashboardIntel, DashboardMentions, DashboardOverview, ActionPlan, DashboardDimensions, etc.).
What does NOT yet exist: a way for vendors to authenticate into that dashboard independently,
admin tooling to create and manage vendor credentials, and RLS policies that enforce which
data each vendor tier can see.

The existing Clerk auth path (for dealers/admins) must remain entirely untouched.
This milestone adds a parallel Supabase Auth layer specifically for vendors.

---

## Table Stakes

Features users (vendors, admins) expect. Missing any one of these makes the system non-functional
or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Magic link send (admin-triggered) | Vendors cannot self-register; admin must initiate auth. Without this the vendor cannot log in at all. | Low | Supabase `signInWithOtp` called server-side (Edge Function or admin panel fetch). Email goes to vendor's business email. |
| Magic link consume + session creation | Vendor clicks emailed link, lands authenticated. Without this the auth loop never closes. | Medium | Supabase handles token exchange at `/auth/v1/verify`; app must handle the callback URL and persist the Supabase session separately from Clerk session. |
| Vendor-specific session storage | Supabase vendor session must not collide with Clerk session (dealers/admins). Without isolation, logging in as a vendor could corrupt dealer auth state. | Medium | Vendor session kept in a dedicated localStorage key or custom Supabase client instance distinct from the Clerk-enhanced client in `useClerkSupabase`. |
| Protected `/vendor-dashboard` route | After login, vendor lands on dashboard. Without route protection, unauthenticated users can access vendor data or vendors can't reach their dashboard. | Low | New `VendorAuthGuard` component; redirects to vendor login page if no vendor session present. |
| Vendor login page / entry point | Vendors need a landing page to start the magic link flow (enter email → receive link). Without this there is no user-facing trigger. | Low | Simple email-input form at `/vendor-login`. Dealer nav button for testing (already scoped in PROJECT.md). |
| Admin: create vendor login credentials | Sales team closes a deal, then provisions access. Without this, no vendor can ever receive a magic link. | Medium | Admin UI section (new tab in `/admin` or addition to AdminSettingsPage) that calls Supabase Admin API to create/invite a user with a specified email and associates them to a `vendor_profile`. |
| Admin: link vendor email to vendor profile | Vendor auth identity must be tied to the correct `vendor_profiles` row. Without this mapping, the dashboard cannot know which vendor's data to show. | Medium | A join table or column on `vendor_profiles` (`supabase_auth_user_id UUID`). Admin selects from existing vendor profiles when provisioning. |
| Admin: set vendor tier (Unverified / T1 / T2) | Tier determines what data the vendor sees. Without this, there is no way to enforce the pricing tiers. | Low | Tier stored in `vendor_profiles` or a `vendor_auth_users` table. Admin dropdown in provisioning UI. |
| RLS: Tier 1 data gates | T1 vendors ($12K) see market intel and positivity leaderboard. Without enforcement at DB level, frontend gating is trivially bypassed. | High | New RLS policies on `vendor_mentions`, `vendor_pulse_insights`, `vendor_metric_scores`. Policy checks `auth.uid()` → vendor tier via join. |
| RLS: Tier 2 data gates | T2 vendors ($25K) see T1 data plus granular mentions, action plans, insights. Must be enforced at DB level. | High | Extension of T1 policies; T2 unlocks full `vendor_mentions` rows (unredacted), `vendor_recommendations`, `vendor_feature_gaps`, action plan data. |
| Session expiry / re-auth | Magic links expire. Vendors need a clear path to request a new one when session lapses. Without this, a vendor with an expired session is stuck. | Low | Expired session redirect to `/vendor-login` with a "Request new link" CTA that calls the same magic link send flow. |
| Vendor sees only their own data | A vendor authenticated as "VendorA" must never see VendorB's data. This is a correctness requirement, not a feature. | High | RLS policies filter by `vendor_profiles.supabase_auth_user_id = auth.uid()` as the base predicate on top of tier checks. |

---

## Differentiators

Features that create competitive advantage or meaningfully improve the experience. Not expected
on day one, but worth building once table stakes are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Admin: visual tier status badge in vendor list | Sales team can see at a glance which vendors have which tier (Unverified / T1 / T2 / No Access). Reduces ops errors. | Low | Color-coded badge in the admin vendor management table. Scoped in PROJECT.md. |
| Admin: resend magic link button | If vendor says "I didn't get the email," admin can resend without recreating the user. Reduces friction during onboarding calls. | Low | Admin calls Supabase `generateLink` or `signInWithOtp` for the existing user. |
| Tier upgrade path (admin-initiated) | Sales closes an upsell from T1 → T2. Admin changes tier in one click; vendor immediately sees new data on next page load. | Low | Update tier column; RLS policies re-evaluate on next query. |
| Last login / activity indicator in admin | Sales team can see "vendor last logged in 14 days ago" — useful for engagement / renewal conversations. | Medium | `vendor_auth_users` table stores `last_sign_in_at` from Supabase auth events or webhook. |
| Locked/blurred sections for out-of-tier features | T1 vendors see that T2 features exist but are locked. Creates natural upsell surface without explicitly advertising. | Medium | Frontend-only blur/lock overlay on T2 sections when vendor is T1. Pairs with RLS so no actual data leaks. |
| Graceful "no access" state for unverified vendors | Admin can create a user record but leave them Unverified (no tier). Vendor can log in but sees a holding page explaining their access level and who to contact. | Low | Conditional render in `VendorAuthGuard` or dashboard root based on tier === "unverified". |
| Magic link expiry feedback | If vendor clicks an expired link, show a clear error with a CTA to request a new link rather than a generic Supabase error page. | Low | Handle the `#error=access_denied` hash in the auth callback component. |

---

## Anti-Features

Features to explicitly NOT build in this milestone (and why).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Self-serve vendor registration | PROJECT.md explicitly out of scope. Sales team controls who gets access — an open registration would let any vendor claim access, undermining the sales relationship. | Keep `/vendor-login` to magic-link-request only; no sign-up form visible to vendors. |
| Vendor password login | More credential management overhead for both admin (resets) and vendor (forgetting passwords). Magic link is simpler and better suited to a managed B2B portal. | Magic link only, always. |
| Vendor billing/payments in-portal | Payments are handled outside the platform per PROJECT.md. Building billing in-portal now would create premature complexity. | Tier is set manually by admin after deal closes offline. |
| Merging vendor Supabase session with Clerk session | Architecturally dangerous — would require forking the Clerk integration and risks breaking dealer/admin auth. The two auth systems must stay parallel. | Keep a separate Supabase client instance or session key for vendor auth. Never pass vendor JWT to Clerk-aware hooks. |
| Vendor can self-select their tier | Tier = pricing tier. Vendors setting their own tier would be a billing hole. Tier must only be settable by admin. | Admin-only tier assignment in the provisioning UI. |
| Real-time data subscriptions for vendors | Supabase realtime over RLS-filtered rows is complex to test correctly and not needed for vendor intelligence data (which updates nightly/daily). | Poll via React Query with a reasonable TTL (5-10 min). Add realtime only if vendors request it. |
| Mobile-optimized vendor experience | Out of scope per PROJECT.md. Adds responsive design complexity that slows down the core auth + gating work. | Web-only. Ensure it doesn't break on mobile but don't optimize for it. |
| Vendor-to-vendor comparison views | Vendors seeing competitor data is a separate product decision. Current dashboard already shows category-level benchmarks which is sufficient. | Keep existing category benchmark display; don't expose raw competitor mention data to vendor auth session. |

---

## Feature Dependencies

```
[Admin: create vendor credentials]
  → requires: vendor_profiles row to link to
  → blocks: all subsequent vendor auth features

[Admin: set vendor tier]
  → requires: vendor credentials provisioned
  → blocks: RLS tier policies (nothing to test against without a tiered user)

[Magic link send (admin-triggered)]
  → requires: Supabase Auth user created for vendor
  → blocks: [Magic link consume + session creation]

[Magic link consume + session creation]
  → requires: Supabase Auth callback URL registered + vendor session storage approach decided
  → blocks: [Protected /vendor-dashboard route], [RLS policies]

[Vendor-specific session storage]
  → requires: decision on storage key / client instance separation
  → blocks: [Protected /vendor-dashboard route], all data fetching from vendor session

[Protected /vendor-dashboard route]
  → requires: [Vendor-specific session storage], [Vendor login page]
  → blocks: vendor seeing dashboard at all

[RLS: Vendor sees only own data (base predicate)]
  → requires: vendor_profiles.supabase_auth_user_id column + vendor session working
  → blocks: [RLS: T1 gates], [RLS: T2 gates]
  → NOTE: must be implemented before T1/T2 gates or you have a data leak

[RLS: T1 gates]
  → requires: [RLS: base predicate], tier column readable in RLS context
  → blocks: T1 vendor experience being meaningful

[RLS: T2 gates]
  → requires: [RLS: T1 gates] (T2 is a superset of T1)
  → blocks: T2 vendor experience

[Locked/blurred sections for out-of-tier features] (differentiator)
  → requires: [Protected /vendor-dashboard route], vendor tier readable client-side
  → note: purely frontend, no dependency on RLS being complete
```

**Critical path:**

```
Admin provisions vendor (creates user + sets tier + links profile)
  → Admin sends magic link
    → Vendor clicks link → session created
      → Route guard checks session → dashboard loads
        → Data fetched with vendor Supabase client
          → RLS: own-data predicate filters
            → RLS: tier predicate filters
              → Vendor sees tier-appropriate data
```

---

## MVP Recommendation

**Phase 1 — Auth (CAR-7):** Vendor login page, magic link send (admin-triggered), magic link
consume + session creation, vendor-specific session storage, protected route guard.
This is independently testable: an admin can provision and log in a test vendor.

**Phase 2 — Admin Tools (CAR-8):** Admin UI for creating vendor credentials, linking to
vendor_profiles, setting tier, visual tier badge. This makes Phase 1 operationally usable
without hardcoding vendor emails in code.

**Phase 3 — RLS + Gating (CAR-9):** Base own-data RLS predicate, T1 gates, T2 gates.
Frontend locked/blurred sections for out-of-tier features (pairs with RLS enforcement).
This is the revenue-critical phase — T1 and T2 must be enforced before go-live.

**Defer entirely:**
- Last login / activity indicator — useful for sales but not blocking launch
- Realtime subscriptions — not needed for nightly intelligence data
- Mobile optimization — out of scope per PROJECT.md

---

## Confidence Notes

| Claim | Confidence | Reason |
|-------|------------|--------|
| Table stakes features | HIGH | Derived from PROJECT.md requirements + existing codebase patterns |
| Feature dependencies | HIGH | Logically derived from auth flow; no external source required |
| Supabase magic link mechanics | HIGH | Well-documented Supabase Auth capability; `signInWithOtp` is the standard path |
| RLS complexity rating "High" | HIGH | Existing RLS migration patterns in this codebase confirm complexity of layered policies |
| Anti-features rationale | HIGH | Directly grounded in PROJECT.md "Out of Scope" section |
| Differentiators | MEDIUM | Drawn from common B2B vendor portal patterns; not validated with actual vendor users |

---

## Sources

- `/Users/miguel/Pulse/.planning/PROJECT.md` — Milestone requirements, out-of-scope items, constraints
- `/Users/miguel/Pulse/.planning/codebase/ARCHITECTURE.md` — Auth architecture, RLS patterns, session handling
- `/Users/miguel/Pulse/src/utils/accessControl.ts` — Existing vendor access resolution logic
- `/Users/miguel/Pulse/src/utils/tierUtils.ts` — Existing tier enum and helper functions
- `/Users/miguel/Pulse/supabase/migrations/20251027135752_cd922597-5dbb-4ef2-815b-71b5c357043d.sql` — app_role enum, user_roles table, RLS patterns
- `/Users/miguel/Pulse/src/pages/VendorDashboardPage.tsx` — Existing dashboard route and admin mode pattern
- `/Users/miguel/Pulse/src/components/vendor-dashboard/` — Existing dashboard component inventory
- Supabase Auth documentation (training knowledge, HIGH confidence for magic link / OTP flows)
