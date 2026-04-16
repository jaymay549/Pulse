# Domain Pitfalls: Vendor Auth and Tiering

**Domain:** Dual auth (Clerk + Supabase Auth), magic link flows, tier-based RLS
**Researched:** 2026-04-13
**Confidence:** HIGH — all pitfalls grounded in existing codebase evidence, not speculation

---

## Critical Pitfalls

Mistakes that cause data exposure, broken auth, or rewrites.

---

### Pitfall 1: Supabase localStorage Auth Collides With Clerk's Own Session

**What goes wrong:** `src/integrations/supabase/client.ts` creates a Supabase client with `storage: localStorage, persistSession: true`. When Supabase Auth magic link is added, Supabase will write its own session tokens to localStorage under keys like `sb-<project>-auth-token`. Clerk also writes its session to localStorage. On a page load the app may initialise the wrong auth context — for example a Clerk-authed admin navigating to the vendor dashboard could pick up a stale vendor Supabase session if both are stored in localStorage without namespace separation.

**Why it happens:** The shared `supabase` singleton (from `client.ts`) already has `persistSession: true`. If the same client instance is re-used for vendor magic link authentication, Supabase Auth will overwrite or mix session state.

**Consequences:** Clerk-authenticated admins may inadvertently get read through a vendor RLS lens (or vice versa). The `useClerkSupabase` hook creates a separate client with an `accessToken` factory — but if any component still imports the shared `supabase` singleton after a vendor login event fires `onAuthStateChange`, those components will use the vendor session instead of the Clerk JWT.

**Prevention:**
- Vendor Supabase Auth must use a **separate, isolated Supabase client instance** — not the shared singleton in `client.ts`. Create `src/lib/vendorSupabase.ts` that never shares `storage` with the Clerk-authenticated client.
- Configure the vendor client with `storageKey: 'vendor-auth'` so its localStorage key does not collide with Clerk's or the default Supabase session key.
- Never import the shared `supabase` singleton in vendor-auth code paths.

**Warning signs:** Admin sees 403 errors on RPCs after testing vendor login; `auth.jwt()` returns vendor claims when an admin RPC is called; console shows duplicate Supabase client instantiations.

**Phase:** Auth phase (Phase 1).

---

### Pitfall 2: auth.uid() Returns NULL for Clerk-Authed Users — and New Vendor Policies Will Be Written the Same Way

**What goes wrong:** The existing codebase has a known split: early migrations use `auth.uid()` (which returns the Supabase `auth.users.id`), but later migrations corrected this to `auth.jwt() ->> 'sub'` because Clerk JWTs have a `sub` that is a Clerk user ID string (`user_2abc...`), not a UUID in `auth.users`. This was explicitly documented in migration `20260324930000_fix_vendor_responses_for_mentions.sql`:

> "Existing policies used auth.uid() instead of Clerk's auth.jwt()->>'sub'."

Vendor RLS policies will be the third auth identity system. When writing new policies for vendor tier gating, there is a high risk of writing `auth.uid()` by habit, which will return the vendor's Supabase Auth UUID (correct for Supabase Auth users), but will break if the same policy is evaluated against a Clerk JWT (returns NULL). Policies written with `auth.jwt() ->> 'sub'` will work for Clerk but break for Supabase Auth vendor sessions.

**Why it happens:** Three identity systems now exist: Supabase Auth (UUID in `auth.users`), Clerk (string `sub`), and the vendor's Supabase Auth session (a new UUID in `auth.users`). Policies cannot use the same identity claim for all three without branching logic.

**Consequences:** Vendor tier policies silently return zero rows (RLS denies access instead of returning 403, so vendors see empty dashboards with no error). Or worse, the wrong rows are returned if `auth.uid()` accidentally matches an unrelated Supabase Auth user.

**Prevention:**
- Define an explicit convention at migration authoring time: vendor tier policies use `auth.uid()` (valid because vendors are real Supabase Auth users), and a comment in each policy states which auth system it targets.
- Use a helper function (`get_vendor_tier(p_user_id uuid)`) that takes `auth.uid()` as input and looks up the vendor tier from a `vendor_logins` table — never inline tier logic into every policy.
- Add a column check in `EXPLAIN (ANALYZE)` output as part of acceptance testing: verify policies return rows for a test vendor session before shipping.

**Warning signs:** Vendor dashboard shows blank sections after successful magic link login; Supabase logs show RLS policy filter evaluating to empty; `auth.uid()` returns NULL in policy context for a Clerk-authed user hitting a vendor-only table.

**Phase:** RLS phase (Phase 3).

---

### Pitfall 3: Vendor Session Conflicts With Clerk-Authed Admin on the Same Browser Tab

**What goes wrong:** The sales team uses the admin panel (`/admin/*`) in the same browser where they also test the vendor magic link flow. Both are using the same browser's localStorage/cookies. When the admin clicks a vendor magic link to test, Supabase Auth establishes a session. The admin then navigates to `/admin` and Clerk is still active — but Supabase RLS now evaluates with the vendor session (from `onAuthStateChange`) if any component uses the shared `supabase` client rather than `useClerkSupabase`.

**Why it happens:** Supabase's `onAuthStateChange` fires globally across all Supabase client instances sharing the same storage. The shared singleton in `client.ts` has `persistSession: true` with no namespacing, so a vendor login event will trigger auth state changes across all listeners on that client.

**Consequences:** Admin RPCs silently fail or return wrong data; vendor tier RLS blocks admin-level reads because `auth.uid()` is now the vendor UUID, not the admin Clerk user. The `has_role(auth.uid(), 'admin')` check in early migration policies (`20260121213953`) will fail because the vendor UUID is not in the `user_roles` table.

**Prevention:**
- Vendor Supabase client must use `autoRefreshToken: false` if the admin console is in the same tab, OR use a dedicated `storageKey` so it never emits to listeners of the default client.
- Add an explicit "vendor session active" React context with a warning banner in admin views when a vendor session is detected in localStorage.
- In `AdminGuard`, assert that the Clerk session is valid AND that no vendor Supabase session is concurrently active.

**Warning signs:** Admin RPC calls 403 after a vendor login test; `auth.uid()` in Supabase returns a UUID that does not match the Clerk user's ID; admin dashboard shows empty state after vendor magic link test.

**Phase:** Auth phase (Phase 1).

---

### Pitfall 4: Magic Link Redirect URL Not Configured for All Environments

**What goes wrong:** Supabase magic link sends an email with a `redirectTo` URL. This must be added to Supabase's allowlist under Auth > URL Configuration. If not configured, the magic link lands on a generic Supabase page instead of the app. More specifically:
- Local dev: `http://localhost:8080/vendor-dashboard`
- Vercel preview deployments: `https://*.vercel.app/vendor-dashboard`
- Production: `https://cdgpulse.com/vendor-dashboard`

All three need to be allowlisted. Vercel preview branches generate dynamic subdomains — using a wildcard `https://*.vercel.app` is required but must be explicitly enabled in Supabase (it accepts wildcards). Missing even one causes the vendor to land on a broken Supabase callback page.

**Why it happens:** The app already has Clerk's `fallbackRedirectUrl` pattern (`src/pages/Auth.tsx`) which works automatically. Supabase magic link requires manual allowlist management, not a code change.

**Consequences:** Vendor clicks magic link, lands on `supabase.co` error page with "redirect_uri mismatch". They cannot log in without IT intervention.

**Prevention:**
- Add all three URL patterns to Supabase Auth > URL Configuration during Phase 1 setup, before any magic link testing.
- Document the allowlist in `.env.example` or a setup checklist for future developers.
- Test the full magic link flow in a Vercel preview branch before merging to `main`.

**Warning signs:** Local magic link works but staging/preview fails; Supabase Auth logs show `redirect_uri not in allowlist`.

**Phase:** Auth phase (Phase 1).

---

### Pitfall 5: Tier Stored in Two Places Gets Out of Sync

**What goes wrong:** The current system stores tier in Clerk's org `publicMetadata` (`vendor.tier`). The new system needs a `vendor_logins` table in Supabase with a `tier` column for RLS to use. If an admin changes the tier in the admin panel, it must write to both Clerk's org metadata AND the Supabase `vendor_logins` row. If either write fails silently, the display tier (from Clerk) diverges from the enforced tier (from Supabase RLS).

The loose error handling noted in `CONCERNS.md` (40+ catch blocks that swallow errors) makes this a near-certainty for at least one upgrade operation.

**Consequences:** Vendor UI shows "Tier 2" but RLS only grants Tier 1 data — vendor sees a blank dashboard and blames the product. Or the reverse: Tier 1 vendor sees Tier 2 data because the Supabase row was updated but Clerk was not.

**Prevention:**
- Use a single source of truth: Supabase `vendor_logins.tier` is the authoritative value for RLS. Clerk metadata is the cache used for UI display only.
- Admin tier-change action must be an edge function or RPC that writes to Supabase first, and then writes to Clerk (or vice versa with a rollback). Never write to both from the frontend directly.
- Add an explicit test: after tier change, verify both the Supabase row and the UI-reported tier match before considering the operation successful.

**Warning signs:** Admin changes a vendor from T1 to T2 and the vendor still sees T1 content; a console error is swallowed during a Clerk metadata update.

**Phase:** Admin tools phase (Phase 2) and RLS phase (Phase 3).

---

### Pitfall 6: SECURITY DEFINER RPCs Bypass Vendor Tier RLS

**What goes wrong:** The codebase has 142 SECURITY DEFINER functions across 77 migration files. SECURITY DEFINER means the function runs with the privileges of the function owner (usually `postgres`/service role), bypassing RLS entirely. If any existing vendor dashboard RPC that currently ignores tier gating (because all vendors were previously equal) is called after the new tier system ships, it will return Tier 2 data to Tier 1 vendors.

Looking at the existing dashboard RPCs (e.g., `vendor_intelligence_platform` migration, `entity_aware_dashboard_rpcs`), many are SECURITY DEFINER and accept a `vendor_name` text parameter without any tier check. A Tier 1 vendor who discovers the RPC name can call it directly with their Supabase session and receive full Tier 2 data.

**Consequences:** Complete bypass of the $12K vs $25K tier gate. This is a billing-critical data exposure.

**Prevention:**
- All RPCs that return tiered data must add an explicit tier check at the top of the function body: `IF (SELECT tier FROM vendor_logins WHERE user_id = auth.uid()) != 'tier2' THEN RAISE EXCEPTION 'insufficient tier';`.
- Audit every SECURITY DEFINER function used in the vendor dashboard flow before shipping the RLS phase. Create a migration checklist that lists each function and its tier enforcement status.
- Do not rely on RLS policies alone for functions that already run as SECURITY DEFINER.

**Warning signs:** Tier 1 vendor is able to retrieve data from dashboard RPCs that should only be available to Tier 2; RPC parameter is `vendor_name TEXT` with no `user_id` or `tier` check.

**Phase:** RLS phase (Phase 3).

---

## Moderate Pitfalls

---

### Pitfall 7: Magic Link Token Consumed On First Redirect — Browser Back Breaks Re-Auth

**What goes wrong:** Supabase magic link tokens are one-time-use. If the browser navigates to the callback URL and then the user hits the back button (or the page throws an error before session is persisted), the token is consumed but no session was established. The user is stuck — the link is dead and they need a new one.

**Prevention:**
- On the vendor callback/landing route, catch auth errors immediately and show a "Link expired — request a new one" UI with a re-send button rather than a generic error.
- Persist the session to localStorage in the Supabase client (`persistSession: true` on the vendor client) before any redirects so that a soft reload after the callback still works.

**Warning signs:** Vendors report "the link doesn't work" when navigating back after landing; Supabase Auth logs show token already redeemed.

**Phase:** Auth phase (Phase 1).

---

### Pitfall 8: VendorDashboardPage Uses Clerk Auth — Route Guard Must Distinguish Two Auth Systems

**What goes wrong:** `VendorDashboardPage.tsx` currently guards access with `useClerkAuth()` and redirects to `/vendors` if not authenticated. After adding Supabase vendor auth, a vendor who has successfully authenticated via magic link will have no Clerk session — so the existing guard will redirect them away before they can see anything.

**Prevention:**
- The route guard for `/vendor-dashboard` must check both auth systems: `isClerkAuthenticated || isVendorSupabaseAuthenticated`.
- Create a `useVendorSession` hook that wraps the vendor Supabase client and returns an equivalent `isAuthenticated` / `user` shape, making the guard composable.
- Ensure the redirect target for unauthenticated visitors is the vendor login page (not `/vendors`), so vendors know where to go.

**Warning signs:** Vendor clicks magic link, session established, then immediately redirected to `/vendors`.

**Phase:** Auth phase (Phase 1).

---

### Pitfall 9: Admin Creates Vendor Credentials Using Email That Already Exists in Supabase Auth

**What goes wrong:** Supabase `auth.admin.inviteUserByEmail()` (or `signInWithOtp`) will fail or behave unexpectedly if the email is already registered in `auth.users` (e.g., a dealer who also happens to be a vendor contact). The call may succeed silently but the magic link goes to the existing user's session context, merging identities unexpectedly.

**Prevention:**
- Before creating a vendor login, the admin panel must call a lookup to check whether that email already exists in `auth.users`.
- If the email exists, surface a warning: "This email already has an account. Adding vendor access may affect their existing session."
- Use `supabase.auth.admin.inviteUserByEmail` (not `signInWithOtp`) for the initial create path — invite creates a new user if absent, and sends a magic link.

**Warning signs:** Vendor says they "already have an account" but cannot access the vendor dashboard; two vendor entries appear in `vendor_logins` for the same email.

**Phase:** Admin tools phase (Phase 2).

---

### Pitfall 10: React Query Cache Does Not Scope to Auth Identity

**What goes wrong:** TanStack Query is configured with a single `QueryClient` instance (`src/App.tsx`). If a Clerk-authed admin previews a vendor dashboard (`/vendor-dashboard?vendor=X`) and then a vendor logs in via magic link on the same tab, the React Query cache may serve admin-fetched data to the vendor (or vice versa), because query keys like `["my-vendor-profile", user?.id]` will be stale from the admin session.

**Prevention:**
- On vendor login and logout events, call `queryClient.clear()` to invalidate all cache entries.
- Scope vendor-specific query keys with the vendor's Supabase Auth `user.id` so that cache misses occur naturally when identity switches.

**Warning signs:** Vendor sees data from the admin's last viewed vendor profile immediately after login without a network request.

**Phase:** Auth phase (Phase 1).

---

## Minor Pitfalls

---

### Pitfall 11: Supabase Auth Email Rate Limiting Blocks Magic Link Resends

**What goes wrong:** Supabase enforces a rate limit on `signInWithOtp` calls per email address (default: one per 60 seconds, configurable in Supabase dashboard). If a vendor clicks "resend link" multiple times (which is expected UX), subsequent calls fail silently unless the UI surfaces the rate limit error.

**Prevention:**
- Catch the `429` / rate limit error from Supabase Auth and display: "Please wait 60 seconds before requesting another link."
- Disable the resend button for 60 seconds after each send.

**Phase:** Auth phase (Phase 1).

---

### Pitfall 12: vendor_profiles.user_id Was Designed for Clerk User IDs (Text), Not Supabase Auth UUIDs

**What goes wrong:** Migration `20260221000000_fix_user_id_text_types.sql` converted `user_id` columns to TEXT to accommodate Clerk's non-UUID user IDs. Supabase Auth produces real UUIDs. When vendor Supabase Auth users are created and their `auth.users.id` (UUID) is stored in `vendor_profiles.user_id` (TEXT), it works fine — but it means the column now contains two incompatible ID formats (Clerk string IDs and Supabase UUIDs). Any query that tries to join or compare them without type awareness will fail silently or return no rows.

**Prevention:**
- Vendor auth must store the `vendor_logins` table's `user_id` as `UUID` (referencing `auth.users.id`), separately from the existing `vendor_profiles.user_id` TEXT column which continues to hold Clerk IDs.
- Do not reuse `vendor_profiles.user_id` for vendor Supabase Auth user IDs.

**Phase:** Auth phase (Phase 1) — schema design.

---

### Pitfall 13: "Tier not set" Treated as Tier 1 Default Is a Billing Risk

**What goes wrong:** If the `tier` column in `vendor_logins` is nullable and a vendor row is created without a tier (e.g., admin forgets to set it), and the RLS policy defaults missing tier to "tier1 access", a Tier 1 vendor may accidentally be granted access without the $12K contract being closed.

Conversely, if no-tier defaults to "no access", a legitimate paying vendor has a broken dashboard and calls support.

**Prevention:**
- `vendor_logins.tier` should be NOT NULL with a CHECK constraint: `CHECK (tier IN ('tier1', 'tier2'))`.
- Admin panel must require tier selection before vendor creation can be submitted.
- RLS policies should treat NULL tier as no access (deny by default), so an incomplete record never grants data.

**Phase:** Admin tools phase (Phase 2).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Phase 1: Magic link auth setup | Redirect URL not allowlisted for all environments | Add all three environments to Supabase URL allowlist before first test |
| Phase 1: Supabase client isolation | Vendor session overwrites Clerk session in shared localStorage | Create a separate `vendorSupabase.ts` client with `storageKey: 'vendor-auth'` |
| Phase 1: Route guard | Clerk-only guard blocks vendor magic link users | Gate `/vendor-dashboard` on either Clerk auth OR vendor Supabase session |
| Phase 1: Schema design | Mixing Clerk text IDs and Supabase UUIDs in `vendor_profiles.user_id` | Create `vendor_logins` as a new table with `user_id UUID REFERENCES auth.users(id)` |
| Phase 2: Admin creates vendor | Email already exists in Supabase Auth | Check for existing user before calling `inviteUserByEmail` |
| Phase 2: Tier management | Tier stored in both Clerk metadata and Supabase diverges | Single source of truth in Supabase; Clerk metadata is display cache only |
| Phase 3: RLS tier gating | SECURITY DEFINER RPCs bypass RLS policies entirely | Audit all vendor dashboard RPCs; add explicit tier checks inside SECURITY DEFINER bodies |
| Phase 3: RLS identity | `auth.uid()` vs `auth.jwt() ->> 'sub'` split already exists in codebase | Document convention: vendor RLS uses `auth.uid()` (Supabase Auth UUID), Clerk RLS uses `auth.jwt() ->> 'sub'` |
| Phase 3: RLS default | NULL tier defaults to tier1 access | NOT NULL constraint on `vendor_logins.tier`; deny-by-default in policies |

---

## Sources

All findings are HIGH confidence, grounded in direct codebase analysis:

- `src/integrations/supabase/client.ts` — localStorage persistence configuration
- `src/hooks/useClerkSupabase.ts` — Clerk JWT to Supabase client pattern
- `src/hooks/useVendorAuth.ts` — Existing vendor auth via Clerk org metadata
- `src/pages/VendorDashboardPage.tsx` — Current Clerk-only route guard
- `src/components/admin/AdminGuard.tsx` — Admin guard pattern
- `supabase/migrations/20260324930000_fix_vendor_responses_for_mentions.sql` — Documented auth.uid() vs jwt sub split
- `supabase/migrations/20260304153000_fix_claim_link_admin_identity.sql` — Documented Clerk sub not being Supabase UUID
- `supabase/migrations/20260221000000_fix_user_id_text_types.sql` — TEXT user_id migration
- `supabase/migrations/20260220000000_vendor_claims.sql` — FK to auth.users pattern
- `.planning/codebase/CONCERNS.md` — Loose error handling (40+ swallowed catch blocks), no tier-access tests
- Supabase Auth documentation (training data, MEDIUM confidence): magic link token consumption, rate limiting, redirect URL allowlisting
