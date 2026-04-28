# Architecture: Dual Auth Integration (Clerk + Supabase Auth)

**Domain:** Vendor authentication and tier-based access on an existing Clerk-authenticated SaaS
**Researched:** 2026-04-13
**Overall confidence:** HIGH (based on direct codebase analysis + Supabase Auth documentation patterns)

---

## Current Auth Architecture

### How Clerk Auth Works Today

Clerk is the single identity provider. Its JWT tokens are passed to Supabase via a custom
`accessToken` callback in `useClerkSupabase()`. Supabase is configured as a third-party auth
consumer (`supabase/config.toml`: `[auth.third_party.clerk]`).

Because `auth.uid()` returns NULL with Clerk JWTs (Clerk user IDs are strings like `user_XXXX`,
not UUIDs), all RLS policies use `auth.jwt() ->> 'sub'` to identify the caller. Custom JWT
claims are injected by Clerk's session template:

```
role          → "authenticated"
user_role     → {{user.public_metadata.circles.role}}   (admin check)
user_tier     → {{user.public_metadata.circles.tier}}   (tier gating)
vendor_*      → {{org.public_metadata.vendor.*}}        (org-scoped vendor access)
org_id        → included automatically by Clerk
```

Two Supabase clients exist in parallel:

| Client | Location | Token source | Used for |
|--------|----------|--------------|----------|
| Anon client | `src/integrations/supabase/client.ts` | None (anon key only) | Unauthenticated reads, admin settings |
| Clerk-enhanced client | `useClerkSupabase()` | Clerk session JWT | RLS-protected operations, vendor dashboard |

### Problem This Milestone Solves

`VendorDashboardPage` currently guards itself with `isAuthenticated` from `useClerkAuth()`,
which checks for a Clerk session. The new vendor logins (Supabase magic link) have no Clerk
identity — they are Supabase Auth users, not Clerk users. Without changes, those users would
hit the `Navigate to="/vendors"` redirect and never see the dashboard.

---

## Recommended Dual Auth Architecture

The two auth systems run in completely parallel tracks. They never share session state, never
call each other, and Supabase RLS distinguishes them by JWT issuer.

### Component Map

```
Browser
├── ClerkProvider (wraps entire app — unchanged)
│   ├── useClerkAuth()         → dealer/admin identity + tier (unchanged)
│   ├── useClerkSupabase()     → Supabase client with Clerk JWT (unchanged)
│   └── AdminGuard             → checks isAdmin from Clerk metadata (unchanged)
│
└── VendorAuthProvider [NEW]   → wraps /vendor-dashboard route only
    ├── useVendorSession()     [NEW] → reads Supabase Auth session for vendor
    ├── supabaseVendorClient   [NEW] → Supabase client using Supabase Auth session
    └── VendorGuard            [NEW] → redirects to /vendor-login if no vendor session
```

### Supabase Client Strategy

Three Supabase client instances, each with a different token source:

| Client | Token source | Auth.uid() behavior | Used for |
|--------|-------------|---------------------|----------|
| Anon client | None | NULL | Public reads |
| `useClerkSupabase()` | Clerk JWT | NULL (uses `auth.jwt()->>sub`) | Dealer/admin operations |
| `useSupabaseVendorClient()` [NEW] | Supabase Auth session | UUID from auth.users | Vendor-authenticated reads |

The vendor client is a standard `createClient()` with Supabase's native session management
(`persistSession: true`, `autoRefreshToken: true`). Magic link authentication populates this
session automatically — no custom token plumbing needed.

### Session Storage

| Session type | Storage | Scope |
|--------------|---------|-------|
| Clerk (dealer/admin) | Browser memory (Clerk SDK manages) | All routes |
| Supabase Auth (vendor) | localStorage (key: `sb-*-auth-token`) | Vendor routes only |

These two localStorage keys do not conflict because Clerk manages its own storage namespace.
The Supabase anon client (`src/integrations/supabase/client.ts`) also uses localStorage but
for the Supabase Auth session — this is fine because the anon client and the vendor client
will be the same client instance for vendors.

**Critical realization:** The existing anon `supabase` client in
`src/integrations/supabase/client.ts` already has `persistSession: true` and `autoRefreshToken: true`.
When a vendor clicks a magic link and Supabase Auth sets the session, this existing client
will have that session automatically. A vendor client does not need to be a new client instance —
it can be the existing anon client after the session is populated.

This means the vendor Supabase client is:

```typescript
// vendor calls use the EXISTING anon client, which now has a session
import { supabase } from "@/integrations/supabase/client";
// After magic link login, supabase.auth.getSession() returns the vendor session
```

---

## RLS Policy Architecture for Vendor Tiers

### JWT Issuer Differentiation

Supabase RLS can see both Clerk JWTs and Supabase Auth JWTs. The difference is in `auth.role()`
and `auth.uid()`:

| JWT type | `auth.uid()` | `auth.jwt()->>sub` | `auth.role()` |
|----------|-------------|-------------------|----------------|
| Clerk JWT | NULL | Clerk user ID string | "authenticated" |
| Supabase Auth JWT | UUID | UUID string | "authenticated" |

RLS policies can distinguish these by checking whether `auth.uid()` is non-null (Supabase Auth
session) vs. using `auth.jwt()->>sub` for Clerk sessions. This is the key gate.

### Vendor Account Table (New)

A new `vendor_accounts` table links a Supabase Auth user (`auth.users.id`) to a
`vendor_profiles.id` and stores the vendor's tier:

```sql
CREATE TABLE public.vendor_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name   TEXT NOT NULL,
  tier          TEXT NOT NULL CHECK (tier IN ('unverified', 't1', 't2')),
  created_by    TEXT NOT NULL,  -- Clerk user_id of the admin who created it
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id)
);

ALTER TABLE public.vendor_accounts ENABLE ROW LEVEL SECURITY;

-- Vendor can read their own account record
CREATE POLICY "vendor_accounts_self_read"
  ON public.vendor_accounts FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Admin (Clerk) can manage all accounts
-- Edge function with service role handles inserts (admin creates via admin panel)
```

### RLS Policy Patterns for Tier Gating

Vendor tier information lives in `vendor_accounts`. RLS policies on data tables check
`vendor_accounts` via a join or a helper function:

```sql
-- Helper function (created once)
CREATE OR REPLACE FUNCTION public.vendor_tier()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT tier FROM public.vendor_accounts
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- T1 policy: vendor can read market intel (leaderboard, rankings)
CREATE POLICY "vendor_t1_market_intel_read"
  ON public.vendor_pulse_insights FOR SELECT
  USING (
    -- Clerk path: pro/executive dealers see everything
    (auth.uid() IS NULL AND (auth.jwt() ->> 'user_tier') IN ('pro', 'executive'))
    OR
    -- Supabase Auth path: vendor with T1 or T2 tier
    (auth.uid() IS NOT NULL AND public.vendor_tier() IN ('t1', 't2')
      AND vendor_name = (
        SELECT vendor_name FROM public.vendor_accounts
        WHERE auth_user_id = auth.uid()
      ))
  );

-- T2 policy: vendor can read mentions (granular data)
CREATE POLICY "vendor_t2_mentions_read"
  ON public.vendor_mentions FOR SELECT
  USING (
    -- Clerk path: pro/executive dealers
    (auth.uid() IS NULL AND (auth.jwt() ->> 'user_tier') IN ('pro', 'executive'))
    OR
    -- Supabase Auth path: T2 vendor only, scoped to own vendor
    (auth.uid() IS NOT NULL AND public.vendor_tier() = 't2'
      AND vendor_name = (
        SELECT vendor_name FROM public.vendor_accounts
        WHERE auth_user_id = auth.uid()
      ))
  );
```

**Important:** `auth.uid()` IS NULL with Clerk JWTs, so `auth.uid() IS NULL` is the reliable
discriminator for "this is a Clerk session." `auth.uid() IS NOT NULL` means "this is a Supabase
Auth session" (vendor magic link login).

### Existing Policies Must Not Break

Existing RLS policies use `auth.jwt() ->> 'sub'` for Clerk identity checks. Supabase Auth
sessions also populate `auth.jwt() ->> 'sub'` (with the UUID), but those policies check for
Clerk-format user IDs or `user_role = 'admin'`. Because no vendor will have `user_role = admin`
in their Supabase Auth JWT, the admin policies are safe.

The only risk is policies that use `auth.jwt() ->> 'sub'` to match `vendor_profiles.user_id`.
The existing `user_id` column is TEXT (changed from UUID in migration `20260221000000`), but
it stores Clerk user IDs (e.g., `user_XXXX`). Supabase Auth UUIDs will not match these values,
so vendor magic link users will not accidentally satisfy the `(auth.jwt() ->> 'sub') = user_id`
policies. This is safe by accident but should be documented.

---

## Component Boundaries

### New Components

| Component | Location | Responsibility | Communicates with |
|-----------|----------|---------------|-------------------|
| `VendorAuthProvider` | `src/components/vendor-auth/VendorAuthProvider.tsx` | Supabase Auth session state for vendors; listens to `supabase.auth.onAuthStateChange` | anon supabase client |
| `useVendorSession()` | `src/hooks/useVendorSession.ts` | Returns vendor Supabase Auth session + vendor_accounts record | VendorAuthProvider context |
| `VendorLoginPage` | `src/pages/VendorLoginPage.tsx` | Email input form; calls `supabase.auth.signInWithOtp()` | anon supabase client |
| `VendorAuthCallback` | Route handler at `/vendor-auth/callback` | Handles magic link redirect; Supabase Auth auto-processes PKCE exchange | anon supabase client |
| `VendorGuard` | `src/components/vendor-auth/VendorGuard.tsx` | Redirects to `/vendor-login` if no vendor session | useVendorSession() |
| Admin vendor account creator | `src/components/admin/VendorAccountManager.tsx` | Form: email + vendor name + tier → calls edge function | admin edge function |
| Edge function: `create-vendor-account` | `supabase/functions/create-vendor-account/` | Creates `auth.users` entry via `supabase.auth.admin.inviteUserByEmail()`, inserts `vendor_accounts` row | Supabase Admin API |

### Unchanged Components

| Component | Why unchanged |
|-----------|---------------|
| `ClerkProvider` | Clerk wraps the whole app; vendor routes are inside it but vendor auth ignores Clerk entirely |
| `useClerkAuth()` | Dealer/admin identity; vendor pages do not call this |
| `useClerkSupabase()` | Clerk-JWT Supabase client; vendor pages use the anon client |
| `AdminGuard` | Still checks Clerk `isAdmin`; admin creates vendor accounts via admin panel |
| `VendorDashboardPage` | Gets a new prop/context path: checks `useVendorSession()` instead of (or in addition to) `useClerkAuth()` |

---

## Data Flow

### 1. Admin Creates Vendor Account

```
Admin (Clerk authenticated) → AdminVendorAccountManager form
  → POST /functions/v1/create-vendor-account
      { email, vendor_name, tier, _auth_token: clerkJWT }
  → Edge function verifies admin (decodes Clerk JWT, checks user_role=admin)
  → supabase.auth.admin.inviteUserByEmail(email)  [creates auth.users row]
  → INSERT INTO vendor_accounts (auth_user_id, vendor_name, tier, created_by)
  → Returns { success: true, user_id: UUID }
  → Admin sees confirmation toast
```

### 2. Vendor Receives Magic Link and Logs In

```
Vendor receives email → clicks magic link
  → Browser navigates to /vendor-auth/callback?token=...
  → Supabase JS SDK auto-processes PKCE token exchange
  → Populates session in localStorage (key: sb-{project}-auth-token)
  → VendorAuthProvider.onAuthStateChange fires with SIGNED_IN event
  → useVendorSession() fetches vendor_accounts row for auth_user_id
  → VendorGuard sees valid session → allows /vendor-dashboard render
```

### 3. Vendor Requests Tier-Gated Data

```
VendorDashboardPage renders (vendor session active)
  → Calls fetchVendorPulseFeed(vendorName) using anon supabase client
  → Supabase receives request with Supabase Auth JWT in Authorization header
  → RLS policy evaluates: auth.uid() IS NOT NULL (Supabase Auth session)
  → public.vendor_tier() returns 't1' or 't2' from vendor_accounts
  → Policy allows/denies based on tier
  → Data returned (T2 sees mentions; T1 sees only aggregate intel)
```

### 4. Returning Vendor (Session Refresh)

```
Vendor opens app → anon supabase client checks localStorage
  → Session exists and not expired → auto-refreshes if within 1hr
  → VendorAuthProvider sees SIGNED_IN → useVendorSession() hydrates
  → /vendor-dashboard accessible immediately
  → If expired: redirected to /vendor-login
```

---

## Routing Architecture

Current `App.tsx` route for `/vendor-dashboard` has no auth guard — `VendorDashboardPage` handles its own redirect internally. The new architecture adds an outer guard:

```
/vendor-dashboard
  └── VendorGuard
        ├── No vendor session → redirect /vendor-login
        └── Has vendor session → render VendorDashboardPage

/vendor-login          [NEW]
  └── VendorLoginPage

/vendor-auth/callback  [NEW]
  └── VendorAuthCallback (can be minimal — Supabase SDK handles the exchange)
```

The existing Clerk-authenticated admin path (`isAdmin && ?vendor=VendorName`) to view the vendor
dashboard must remain unblocked. `VendorGuard` must pass through when `isAdmin` is true (Clerk
admin session). This means `VendorGuard` checks both auth paths:

```typescript
// VendorGuard logic
const { isAdmin } = useClerkAuth();        // Clerk path
const { session } = useVendorSession();   // Supabase Auth path

if (isAdmin) return <>{children}</>;       // Admin bypasses vendor guard
if (!session) return <Navigate to="/vendor-login" />;
return <>{children}</>;
```

---

## Critical Integration Points

### 1. Magic Link Redirect URL Configuration

Supabase magic link `emailRedirectTo` must point to `/vendor-auth/callback`. This URL must be
in the Supabase Auth "Redirect URLs" allowlist in the dashboard. For local development, add
`http://localhost:8080/vendor-auth/callback`. For production, add
`https://cdgpulse.com/vendor-auth/callback`.

```typescript
await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/vendor-auth/callback`,
    shouldCreateUser: false, // CRITICAL: only allow pre-created accounts
  },
});
```

`shouldCreateUser: false` prevents vendors from self-registering — only admin-created accounts
can log in. This enforces the sales team credential creation flow.

### 2. Admin Creates via `inviteUserByEmail` (Not `createUser`)

`supabase.auth.admin.inviteUserByEmail(email)` sends the first magic link automatically AND
creates the `auth.users` row. Using `createUser` without `autoConfirm` would require separate
invitation. `inviteUserByEmail` is the correct call because:
- It creates a confirmed user (email_confirmed_at is set)
- Sends the magic link immediately
- The invite link and subsequent login links use the same PKCE flow

### 3. `vendor_accounts` Is the Tier Source of Truth

Supabase Auth session tells RLS "who is logged in." `vendor_accounts` tells RLS "what tier that
person has." These are separate reads. The `vendor_tier()` helper function must be `SECURITY
DEFINER` to bypass RLS on `vendor_accounts` itself (otherwise the policy evaluating tier would
need to read `vendor_accounts`, which itself has RLS — a circular dependency).

### 4. Supabase Auth Session and Clerk Session Coexistence

The anon Supabase client (`src/integrations/supabase/client.ts`) manages Supabase Auth sessions.
The `useClerkSupabase()` client creates a new client instance with a Clerk token accessor. These
are different client instances — they do not share session state.

When a dealer (Clerk) is logged in AND a vendor (Supabase Auth) is logged in on the same browser:
- The anon client has the vendor Supabase Auth session in localStorage
- The Clerk-enhanced client ignores the localStorage session (it uses the `accessToken` callback)
- This is safe — the two clients are independent

However, this edge case (same browser, both sessions) is unlikely in practice. Vendor and dealer
are different user populations. If it becomes an issue, namespace the Supabase Auth storage key
(using `createClient` with a custom `storageKey`).

### 5. Edge Function Authentication for Vendor Operations

The existing edge function pattern passes the Clerk JWT in a `_auth_token` body field to bypass
Supabase's JWT gateway (which expects Supabase Auth JWTs). Vendor edge function calls should
use the Supabase Auth JWT in the standard `Authorization: Bearer` header — no special handling
needed because Supabase's gateway accepts its own JWTs natively.

---

## Suggested Build Order

The components have clear dependencies. Build in this order to ensure each piece is independently
testable:

**Phase 1 — Vendor Auth (CAR-7)**

1. `create-vendor-account` edge function (service role; no frontend needed yet)
2. `vendor_accounts` migration (table + RLS + `vendor_tier()` helper)
3. `VendorLoginPage` + `VendorAuthCallback` route (pure Supabase Auth; no tier logic)
4. `VendorAuthProvider` + `useVendorSession()` hook
5. `VendorGuard` wrapping `/vendor-dashboard` (with admin bypass)
6. Verify: admin can create account, vendor receives email, magic link logs in, dashboard loads

**Phase 2 — Admin Tools (CAR-8)**

7. `VendorAccountManager` component in admin panel (calls edge function)
8. Admin panel UI: create vendor, assign to vendor_name, set tier, visual tier badge
9. Verify: sales team can provision credentials end-to-end without engineering

**Phase 3 — Tier-Gated RLS (CAR-9)**

10. New RLS policies on `vendor_pulse_insights` (T1 gate)
11. New RLS policies on `vendor_mentions` (T2 gate)
12. Frontend tier-aware rendering in VendorDashboardPage (show/hide sections by tier)
13. Verify: T1 vendor sees intel but not mentions; T2 sees both; unverified sees nothing

**Rationale for this order:**
- Phase 1 establishes the auth primitive — nothing else can be tested without it
- Phase 2 gives the sales team an autonomous workflow before RLS exists (tier defaults to `unverified`, which grants nothing sensitive)
- Phase 3 adds enforcement last, when the provisioning flow is already validated

---

## Architecture Anti-Patterns to Avoid

### Do Not Create a Separate Supabase Project for Vendor Auth

Tempting because it provides clean isolation, but it would require duplicating all vendor data
tables across projects and managing cross-project queries. Use a single Supabase project.

### Do Not Store Tier in Clerk Metadata for Vendor Supabase Auth Users

Vendors authenticated via Supabase Auth do not have Clerk identities. Tier must live in
`vendor_accounts` in the database, not in any Clerk-side metadata.

### Do Not Use the Clerk-Enhanced Client (`useClerkSupabase`) for Vendor Operations

The Clerk-enhanced client attaches Clerk JWTs. RLS policies that gate by `auth.uid()` will
evaluate NULL for Clerk sessions. Vendor data fetches must use the anon client (which holds the
Supabase Auth session).

### Do Not Check `isAuthenticated` from Clerk to Gate the Vendor Dashboard

`isAuthenticated` means "has a Clerk session" — vendors have no Clerk session. The vendor
dashboard guard must use `useVendorSession()` (Supabase Auth session) with a separate admin
bypass via `isAdmin` from Clerk.

### Do Not Allow `shouldCreateUser: true` on Magic Link OTP

This would allow any email address to create a vendor account by attempting login. The system
requires that admin pre-creates accounts. Always set `shouldCreateUser: false`.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Clerk + Supabase Auth coexistence | HIGH | auth.uid() IS NULL for Clerk JWTs is documented behavior; confirmed in migration comments |
| RLS discriminator (auth.uid() IS NULL) | HIGH | Confirmed by existing migration `20260221000000` comment |
| Magic link flow | HIGH | Standard Supabase Auth pattern; `shouldCreateUser: false` is documented |
| `vendor_tier()` helper function pattern | MEDIUM | Standard PostgreSQL SECURITY DEFINER pattern; circular RLS dependency is a known problem with this solution |
| `inviteUserByEmail` for admin provisioning | MEDIUM | Based on Supabase Auth Admin API docs knowledge; verify current behavior of `shouldCreateUser: false` on subsequent logins |
| Session coexistence (same browser) | MEDIUM | Independent client instances should be safe; not tested empirically |

---

## Gaps Requiring Phase-Specific Validation

1. **`supabase.auth.signInWithOtp` with `shouldCreateUser: false` behavior:** Confirm this
   returns a clean "not found" error rather than a confusing 422, so VendorLoginPage can show
   a helpful "contact your sales rep" message for unknown emails.

2. **Redirect URL for production Vercel deployment:** The magic link `emailRedirectTo` must
   handle Vercel preview URLs if vendors ever receive links while the app is on a preview
   deployment. Either hardcode the production URL or use an allowlist strategy.

3. **`vendor_accounts.vendor_name` vs `vendor_profiles.vendor_name` join:** The RLS policies
   above filter by `vendor_name` from `vendor_accounts`. Confirm this matches exactly (same
   casing, no aliases) against the existing `vendor_profiles.vendor_name` and
   `vendor_mentions.vendor_name` values. Name mismatches will silently return empty datasets.

4. **Existing anon client session behavior:** The current anon client
   (`src/integrations/supabase/client.ts`) is imported by admin pages that use the Clerk client
   for meaningful operations. If a vendor has a Supabase Auth session in localStorage, admin
   pages importing the anon client will have that session. This is unlikely to cause problems
   (admin pages use Clerk JWT client for writes) but should be verified.

---

*Architecture analysis: 2026-04-13 — based on codebase inspection of Pulse (branch: mig)*
