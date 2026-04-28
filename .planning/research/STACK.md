# Technology Stack: Vendor Auth & Tier-Based RLS

**Project:** CDG Pulse — Vendor Tiering System
**Researched:** 2026-04-13
**Scope:** Dual auth (Supabase magic link alongside Clerk), vendor session management, tier-based RLS
**Source basis:** Codebase analysis (migrations, hooks, client setup, routing). External web/docs tools unavailable in this session; recommendations grounded in live code evidence plus known `@supabase/supabase-js` v2 API (August 2025 knowledge cutoff).

---

## Recommended Stack

### Core Auth — No New Libraries Needed

| Technology | Version (current) | Purpose | Why |
|------------|-------------------|---------|-----|
| `@supabase/supabase-js` | 2.76.1 (already installed) | Supabase Auth magic link / OTP email, vendor session management | Already present. The base `supabase` client in `src/integrations/supabase/client.ts` already has `persistSession: true` and `storage: localStorage` — Supabase Auth session will live there automatically once a vendor signs in via OTP |
| `input-otp` | 1.4.2 (already installed) | 6-digit OTP input UI component | Already in `package.json`. Prefer email OTP (6-digit code) over magic link deep-link — avoids email client link-interception issues and works better for sales-team-provisioned accounts |
| `sonner` | 1.7.4 (already installed) | Toast feedback for magic link sent, OTP errors | Already used project-wide |
| `react-router-dom` | 6.30.1 (already installed) | Vendor-specific protected routes, `VendorAuthGuard` component | Already used for `AdminGuard` pattern — vendor guard follows the same shape |

### What NOT to Install

| Library | Why Not |
|---------|---------|
| `@supabase/auth-ui-react` | Opinionated UI that clashes with shadcn/ui design system. Build the two-step OTP form directly with existing `Input`, `Button`, `InputOTP` components |
| Any new auth provider (Auth0, Firebase, etc.) | Would be a third auth system. Two (Clerk + Supabase Auth) is the maximum for this codebase |
| `jose` / `jsonwebtoken` | Not needed. Supabase Auth JWT validation happens server-side in RLS; no client-side JWT parsing required |

---

## Architecture: Two Supabase Clients, Separate Namespaces

This is the pivotal architectural fact of the whole milestone, discovered from reading the existing client code.

### Existing Clients

**Base client** — `src/integrations/supabase/client.ts`
```ts
createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
})
```
This client manages its own Supabase Auth session in `localStorage`. **This is where the vendor Supabase Auth session lives.** When a vendor signs in via OTP, Supabase stores `sb-[project-ref]-auth-token` in `localStorage`. This is completely separate from Clerk's session.

**Clerk client** — `src/hooks/useClerkSupabase.ts`
```ts
createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => (await sessionRef.current?.getToken()) ?? null,
})
```
This client injects a Clerk JWT for every request. It does NOT manage a Supabase Auth session — `persistSession` defaults to false when `accessToken` is provided in v2.

**Conclusion:** The two clients coexist without conflict because they use different auth mechanisms. The base `supabase` client is the right one for all vendor auth operations.

### Session Separation — No Cookie or Storage Collision

- Clerk stores its session in `__clerk_db_jwt` cookies (managed by Clerk SDK)
- Supabase Auth stores its session in `localStorage` key `sb-[project-ref]-auth-token`
- No overlap. A dealer who is Clerk-authenticated and a vendor who is Supabase-authenticated can theoretically coexist in the same browser (different tabs/sessions), but in practice a user is one or the other.

**Confidence:** HIGH — verified from live client code and Supabase JS v2 documented behavior.

---

## Vendor Auth Flow — Email OTP (Preferred over Magic Link)

### Why OTP over Magic Link

| Consideration | Magic Link | Email OTP (6-digit code) |
|--------------|------------|--------------------------|
| Email client interception | Link may be opened in wrong browser/device | User types code — works anywhere |
| Admin-provisioned UX | Vendor must click link in correct browser session | Vendor can be on any device, type code |
| Implementation complexity | Same: `signInWithOtp({ email, options: { shouldCreateUser: false } })` | Same call, `options.emailRedirectTo` omitted |
| Supabase config | Requires setting site URL and redirect URLs | Simpler — no redirect URL required |

Both use the same `supabase.auth.signInWithOtp()` API. The difference is whether the email contains a link or a code. OTP code is strictly better for this use case.

**Supabase config needed:** In Supabase Dashboard → Auth → Email → enable "Email OTP" (vs magic link). Set `options.shouldCreateUser: false` to prevent self-registration.

### Vendor Login Page — New Route

Add `/vendor-login` route (not inside AdminGuard, not inside Clerk auth wall). This is a standalone page.

```
Step 1: Enter email → supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
Step 2: Enter 6-digit code → supabase.auth.verifyOtp({ email, token, type: 'email' })
Step 3: On success → navigate('/vendor-dashboard')
```

Use the existing `InputOTP` component from `input-otp` (already installed) for step 2.

**Confidence:** HIGH — `signInWithOtp` and `verifyOtp` are stable Supabase Auth v2 APIs confirmed in `@supabase/supabase-js` 2.x.

---

## Vendor Session Management

### Hook: `useVendorSupabaseAuth`

New hook following the same pattern as `useClerkAuth` and `useVendorAuth`. Returns:

```ts
{
  isLoading: boolean,
  isAuthenticated: boolean,
  session: Session | null,
  user: User | null,            // Supabase Auth user
  vendorTier: 'unverified' | 'tier1' | 'tier2' | null,
  vendorName: string | null,    // from vendor_logins join
  signOut: () => Promise<void>,
}
```

The hook calls `supabase.auth.getSession()` on mount and listens to `supabase.auth.onAuthStateChange()`. It then fetches the vendor's tier from the `vendor_logins` table (see Database section) using the authenticated Supabase user's ID.

### Route Guard: `VendorAuthGuard`

New component mirroring `AdminGuard` exactly but checking `useVendorSupabaseAuth` instead of `useClerkAuth`. Wraps the `/vendor-dashboard` route.

The `/vendor-dashboard` route currently redirects unauthenticated users to `/vendors`. After this milestone it redirects to `/vendor-login` instead.

**Confidence:** HIGH — pattern is directly established by `AdminGuard.tsx` in the codebase.

---

## Database — New Tables and Extended Schema

### New Table: `vendor_logins`

This is the authoritative link between a Supabase Auth user and their vendor profile + tier.

```sql
CREATE TABLE public.vendor_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_uid UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  vendor_tier TEXT NOT NULL DEFAULT 'unverified'
    CHECK (vendor_tier IN ('unverified', 'tier1', 'tier2')),
  created_by UUID REFERENCES auth.users(id),  -- admin who created this
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why a new table rather than adding to `vendor_profiles`:** `vendor_profiles.user_id` was originally a Clerk/Supabase user ID column (from the original claim flow) but was made nullable and is now used for admin-side access. Mixing Supabase Auth UIDs for vendors into that column would conflict with the existing `auth.uid() = user_id` RLS policies written for Clerk-Supabase integration. A dedicated `vendor_logins` table is clean and avoids policy collisions.

**Confidence:** MEDIUM — the alternative of adding `supabase_auth_uid` to `vendor_profiles` is viable but creates policy ambiguity. New table is safer.

### Admin Creates Vendor Logins

Admin flow in the admin panel:
1. Admin invites a vendor email: calls `supabase.auth.admin.inviteUserByEmail(email)` **from an Edge Function** (not client-side — requires service role key)
2. Edge Function creates a row in `vendor_logins` linking the new `auth.users` UUID to the `vendor_profile_id` and setting `vendor_tier`
3. Vendor receives the OTP email and logs in

**Why Edge Function for invite:** The `auth.admin` API requires the service role key, which must never be sent to the browser. A Supabase Edge Function with `SUPABASE_SERVICE_ROLE_KEY` handles this securely.

**Confidence:** HIGH — established pattern in this codebase. The existing `admin-ensure-vendor-profile` Edge Function demonstrates the pattern.

---

## RLS — Tier-Based Access Control

### How Vendor JWT Works in RLS

When a vendor authenticates via Supabase Auth OTP, `supabase.auth.getSession()` returns a JWT. Inside that JWT:
- `auth.uid()` = the vendor's `supabase_auth_uid` (UUID in `auth.users`)
- `auth.jwt() ->> 'role'` = `'authenticated'`
- No custom claims by default (unlike Clerk which embeds tier in JWT)

**Therefore:** RLS policies for vendors must JOIN or look up `vendor_logins` to get the tier — they cannot read it from the JWT directly.

### Tier Check Pattern for RLS

```sql
-- Helper function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_vendor_tier(_uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vendor_tier FROM vendor_logins WHERE supabase_auth_uid = _uid LIMIT 1;
$$;
```

Then use in policies:
```sql
-- Example: Tier 1+ can read market intel
CREATE POLICY "Vendor tier1+ can read market intel"
  ON public.some_intel_table FOR SELECT
  USING (
    public.get_vendor_tier(auth.uid()) IN ('tier1', 'tier2')
  );
```

**Why SECURITY DEFINER function:** Prevents recursive RLS evaluation on `vendor_logins` when called inside another table's policy. This is the established pattern in this codebase — `has_role()` and `get_user_role()` both use this approach.

### Separating Vendor vs Dealer JWT in RLS

The existing RLS policies use `auth.jwt() ->> 'user_role'` and `auth.jwt() ->> 'sub'` for Clerk-authenticated users. Vendor Supabase Auth JWTs will NOT have these claims. This means:

- Existing Clerk-based policies are unaffected — they check for Clerk-specific claims that vendor JWTs won't carry
- Vendor policies check `auth.uid()` against `vendor_logins.supabase_auth_uid` — Clerk users will never match because `auth.uid()` for a Clerk user returns their Clerk sub-claim UUID, not a `vendor_logins` row

**Risk:** If a Clerk user's Clerk sub-claim UUID accidentally collides with a `vendor_logins.supabase_auth_uid`, they would get vendor tier access. The probability is negligible (UUIDs), but the mitigation is to check `EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())` to confirm the user is a real Supabase Auth user, or to add an `auth_provider` column to `vendor_logins`.

**Confidence:** MEDIUM — the separation logic is correct based on how Clerk's Supabase integration works (Clerk issues JWTs that Supabase validates via JWKS endpoint), but the exact claim names in vendor JWTs should be verified in Supabase Dashboard → Auth → JWT Settings after deployment.

---

## Admin Panel — Vendor Credential Management

### UI Location

Add a new section to the existing `/admin/claims` page or create `/admin/vendors` (preferred — cleaner separation). The admin UI needs:

1. Input: vendor email + vendor profile selector + tier selector
2. Button: "Create vendor login" → calls Edge Function
3. Table: list of `vendor_logins` rows with tier badges, created_at, last sign-in

### No New Libraries for Admin UI

All needed components already exist:
- `Select` (from Radix/shadcn) for tier selector
- `Input` for email
- `Button` for action
- `Badge` or status indicator using existing design system

---

## Edge Functions — New and Modified

| Function | Purpose | Auth Method |
|----------|---------|-------------|
| `vendor-invite` (new) | Admin invites vendor email, creates `vendor_logins` row | Clerk JWT (admin check via `auth.jwt() ->> 'user_role' = 'admin'`) |
| `vendor-set-tier` (new) | Admin updates tier for an existing `vendor_logins` row | Clerk JWT (admin check) |

Both functions follow the existing pattern from `admin-ensure-vendor-profile`: accept Clerk token for admin auth, use service role key for the privileged Supabase Auth operation.

**Confidence:** HIGH — exact pattern established in codebase.

---

## Environment Variables — No New Variables Needed

| Variable | Status | Notes |
|----------|--------|-------|
| `VITE_SUPABASE_URL` | Existing | Used by vendor auth client |
| `VITE_SUPABASE_ANON_KEY` | Existing | Used by vendor auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing (Edge Function secret) | Used by `vendor-invite` Edge Function |

The vendor auth flow uses the same Supabase project — no new URL or key needed.

---

## Installation

No new npm packages required. All necessary libraries are already installed.

```bash
# Nothing to install — all needed:
# - @supabase/supabase-js 2.76.1 (Supabase Auth OTP)
# - input-otp 1.4.2 (OTP code input UI)
# - sonner 1.7.4 (toast feedback)
# - react-router-dom 6.30.1 (vendor route guard)
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| OTP vs magic link | Email OTP (6-digit code) | Magic link (email link) | Magic link requires correct browser session; OTP works across devices. Same Supabase API call either way |
| Tier storage | `vendor_logins` table join in RLS | JWT custom claims | Custom claims require a custom JWT template in Supabase Auth settings AND a trigger to update JWT on tier change — more complex than a helper function |
| Tier storage | `vendor_logins` table join in RLS | Add column to `vendor_profiles` | `vendor_profiles.user_id` already has conflicting RLS policies; mixing Supabase Auth UIDs would require rewriting existing policies |
| Invite method | Edge Function with service role | Client-side `auth.admin.inviteUserByEmail` | `auth.admin` requires service role key — cannot be exposed in browser |
| Vendor login page | New standalone `/vendor-login` route | Reuse existing `/auth` page | The `/auth` page is Clerk-only; vendor auth is a completely different flow |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Dual client coexistence | HIGH | Verified from live `client.ts` and `useClerkSupabase.ts` code — separate auth mechanisms, no storage collision |
| OTP API (`signInWithOtp` / `verifyOtp`) | HIGH | Stable `@supabase/supabase-js` v2 API, unchanged across minor versions |
| `vendor_logins` table design | MEDIUM | Design is sound; the risk is whether existing `vendor_profiles.user_id` column causes confusion — documented and mitigatable |
| RLS tier-check pattern (helper function) | HIGH | Exact pattern used by `has_role()` and `get_user_role()` in existing migrations |
| JWT separation (Clerk vs Supabase Auth) | MEDIUM | Logic is correct based on how third-party JWT auth works in Supabase, but recommend verifying in Supabase Dashboard after deploy |
| Edge Function for admin invite | HIGH | Follows established pattern from `admin-ensure-vendor-profile` |
| No new npm installs needed | HIGH | Verified all required packages present in `package.json` |

---

## Open Questions / Flags for Phase Research

1. **Supabase Auth email sender config**: The project must have "Email OTP" enabled in Supabase Auth settings (not just magic link). Verify in Supabase Dashboard → Auth → Email templates. The OTP template may need branding.

2. **OTP expiry**: Default Supabase OTP expiry is 1 hour. For sales-provisioned vendors who may receive the OTP and not log in for a day, the admin may need to re-send. The admin panel should have a "Resend OTP" button that calls the same `vendor-invite` Edge Function.

3. **`vendor_profiles.user_id` ambiguity**: Existing policies use `auth.uid() = user_id` — this `user_id` references `auth.users.id`. After this milestone, a Supabase Auth vendor user's UUID will live in `vendor_logins.supabase_auth_uid`, not in `vendor_profiles.user_id`. Ensure the vendor dashboard's `ownVendorProfile` query (currently `eq("user_id", user!.id)`) uses the Clerk user ID for Clerk users and the `vendor_logins` join for vendor users — or consolidate into a single query path driven by auth type.

4. **`should_create_user: false` behavior**: Setting `shouldCreateUser: false` in `signInWithOtp` means if the email is NOT in `auth.users`, Supabase returns an error rather than creating a new user. Verify this is the right behavior — it prevents self-registration but also means the admin must invite before the vendor can log in (which is the intended behavior per PROJECT.md).

---

## Sources

All findings grounded in live codebase:
- `/Users/miguel/Pulse/src/integrations/supabase/client.ts` — base client session config
- `/Users/miguel/Pulse/src/hooks/useClerkSupabase.ts` — Clerk-authenticated client pattern
- `/Users/miguel/Pulse/src/hooks/useClerkAuth.ts` — auth hook pattern to replicate for vendor
- `/Users/miguel/Pulse/src/components/admin/AdminGuard.tsx` — route guard pattern to replicate
- `/Users/miguel/Pulse/supabase/migrations/20260121211304_*.sql` — vendor_profiles schema
- `/Users/miguel/Pulse/supabase/migrations/20251027135752_*.sql` — user_roles and has_role() pattern
- `/Users/miguel/Pulse/supabase/migrations/20260307000000_members_table.sql` — JWT claim RLS examples
- `/Users/miguel/Pulse/package.json` — confirmed no new packages needed
- `@supabase/supabase-js` v2 API knowledge (August 2025 cutoff)
