# Phase 1: Vendor Auth Primitives - Research

**Researched:** 2026-04-13
**Domain:** Supabase Auth OTP email flow + isolated session client + React route guard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — user deferred all implementation decisions to Claude.

### Claude's Discretion
- **D-01:** Login page UX — OTP input flow, branding, error states, messaging for unknown emails
- **D-02:** Session & auth isolation — separate Supabase client instance, storageKey strategy, dual-auth detection on /vendor-dashboard
- **D-03:** Route guard behavior — VendorAuthGuard redirect flow, admin bypass logic (AUTH-05), session expiry handling
- **D-04:** Nav entry point — where the vendor login button lives, visibility rules, placement

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Vendor can enter email at `/vendor-login` and receive a magic link/OTP to authenticate | `signInWithOtp({ email, options: { shouldCreateUser: false } })` — two-step form: email → 6-digit OTP entry |
| AUTH-02 | Vendor clicking magic link lands authenticated on `/vendor-dashboard` with a valid Supabase Auth session | `verifyOtp({ email, token, type: 'email' })` returns session; `onAuthStateChange` triggers navigation |
| AUTH-03 | Vendor Supabase Auth session is isolated from Clerk session (separate client instance, no cross-contamination) | `createClient` with `storageKey: 'vendor-auth'` creates fully isolated localStorage namespace |
| AUTH-04 | Unauthenticated users accessing `/vendor-dashboard` are redirected to `/vendor-login` via VendorAuthGuard | `VendorAuthGuard` component checks `useVendorSupabaseAuth()` session state, redirects if null |
| AUTH-05 | Admin users (Clerk auth) can still access `/vendor-dashboard` without vendor auth (existing behavior preserved) | `VendorAuthGuard` checks `isAdmin` from `useClerkAuth()` first — bypass if true |
| AUTH-06 | Expired or invalid magic link shows clear error message with CTA to request a new link | `verifyOtp` returns `AuthApiError`; error.message distinguishes "Token has expired" vs "User not found" |
| AUTH-07 | Nav bar shows a vendor login button (next to admin) for testing purposes | `Navigation.tsx` accepts `customCta` prop or inline addition of `/vendor-login` link |
| AUTH-08 | Vendor session expiry redirects to `/vendor-login` with re-auth prompt | `onAuthStateChange` fires `SIGNED_OUT` event on token expiry; hook navigates to `/vendor-login?expired=true` |
| AUTH-09 | `shouldCreateUser: false` prevents self-registration — only admin-provisioned emails can log in | `signInWithOtp` option `shouldCreateUser: false` is confirmed supported — non-existing emails get error |
</phase_requirements>

---

## Summary

This phase adds a second authentication identity system that runs completely in parallel with the existing Clerk auth. The mechanism is Supabase Auth's built-in email OTP (6-digit code delivered to email), using a vendor-specific Supabase client instance with an isolated `storageKey` so the vendor session never bleeds into the Clerk-managed localStorage namespace.

The critical architectural insight: `vendor_profiles.user_id` is already TEXT and holds Clerk IDs (`user_XXXX`). The new vendor Supabase Auth system produces UUID-based `auth.uid()`. These are different identity namespaces. Phase 1 introduces a `vendor_logins` table that maps `Supabase Auth UUID → vendor_name + tier`, acting as the bridge. `vendor_profiles` is NOT modified in Phase 1 — it remains Clerk-owned. The vendor dashboard page needs minimal surgery: add a dual-auth check so it accepts either `isAdmin` (Clerk) or a valid vendor Supabase session.

The storageKey isolation pattern is officially supported by Supabase JS and is the standard way to run two auth clients in the same browser. The `shouldCreateUser: false` option on `signInWithOtp` is confirmed supported and prevents self-registration. The existing `InputOTP` shadcn component (backed by `input-otp` package) is already in the codebase and handles the 6-slot OTP UI.

**Primary recommendation:** Create a vendor Supabase client with `storageKey: 'vendor-auth'`, implement a two-step `VendorLoginPage` (email → OTP), a `useVendorSupabaseAuth` hook following the same ergonomics as `useClerkAuth`, a `VendorAuthGuard` modeled after `AdminGuard`, and a `vendor_logins` migration.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.76.1` (latest 2.103.0) | Supabase Auth OTP, session management | Already in project; `signInWithOtp` + `verifyOtp` APIs are built-in |
| React 18 + TypeScript | 18.3.1 / 5.8.3 | Component/hook layer | Project standard |
| React Router DOM | 6.30.1 | `<Navigate>` redirect, `useNavigate` | Already in project |
| TanStack React Query | 5.83.0 | Async mutation state for OTP requests | Already in project; `useMutation` for OTP send/verify |
| Sonner | 1.7.4 | Toast notifications for auth events | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `input-otp` (via `InputOTP` shadcn) | 1.4.2 | 6-slot OTP input widget | Already installed; use for OTP entry step |
| `shadcn/ui` (Button, Input, Card) | project | Login page layout | All available; no new installs |
| Lucide React | 0.462.0 | `Loader2` spinner, icons | Project standard for loading states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase email OTP (6-digit) | Magic link (single click) | OTP is more reliable (works in all email clients, no link expiry with redirects); OTP matches AUTH-01 spec |
| Isolated `createClient` with `storageKey` | Context-level injection | Single client with flag is simpler but risks session collision; storageKey is the official pattern |
| `VendorAuthGuard` component | Route-level middleware | Guard component matches existing `AdminGuard` pattern exactly |

**Installation:** No new packages needed. All dependencies already in `package.json`. [VERIFIED: package.json grep]

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── integrations/supabase/
│   ├── client.ts              # Existing — DO NOT MODIFY
│   └── vendorClient.ts        # NEW — isolated vendor Supabase client (storageKey: 'vendor-auth')
├── hooks/
│   ├── useClerkAuth.ts        # Existing — DO NOT MODIFY
│   └── useVendorSupabaseAuth.ts  # NEW — vendor session hook (mirrors useClerkAuth ergonomics)
├── components/
│   └── vendor-auth/
│       └── VendorAuthGuard.tsx   # NEW — route guard (mirrors AdminGuard)
└── pages/
    └── VendorLoginPage.tsx    # NEW — two-step email → OTP page
```

### Pattern 1: Isolated Vendor Supabase Client

**What:** Create a second `createClient` instance with a unique `storageKey` to prevent session collision with the existing anon client (which Clerk uses).

**When to use:** Mandatory whenever two different auth systems share the same browser — multiple GoTrueClient instances with the same key produce undefined behavior.

**Example:**
```typescript
// src/integrations/supabase/vendorClient.ts
// Source: Supabase community docs — storageKey isolation pattern
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const vendorSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'vendor-auth',        // Isolated namespace in localStorage
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInURL: false,        // OTP flow doesn't use URL hash
  }
});
```

### Pattern 2: Two-Step OTP Flow

**What:** Step 1 collects email and calls `signInWithOtp`. Step 2 shows `InputOTP` and calls `verifyOtp`. Session is established on successful verify.

**When to use:** AUTH-01 + AUTH-02 requirements.

**Example:**
```typescript
// Step 1 — send OTP
const { error } = await vendorSupabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false,   // AUTH-09: reject non-provisioned emails
  },
});
// error.message === "Signups not allowed for this instance" when email not found
// or a rate-limit error when too many requests

// Step 2 — verify OTP
const { data, error } = await vendorSupabase.auth.verifyOtp({
  email,
  token: otpCode,             // 6-digit string from InputOTP
  type: 'email',
});
// data.session is non-null on success
```

### Pattern 3: useVendorSupabaseAuth Hook

**What:** A hook that wraps `vendorSupabase.auth.getSession()` + `onAuthStateChange` subscription. Follows the same return shape as `useClerkAuth` so consuming components have a consistent API.

**When to use:** All components and guards that need to know if a vendor is authenticated.

**Example:**
```typescript
// Returns shape mirrors useClerkAuth
export function useVendorSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize from persisted session
    vendorSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Subscribe to auth state changes (handles expiry, sign-out)
    const { data: { subscription } } = vendorSupabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    isLoading,
    isAuthenticated: !!session,
    session,
    user: session?.user ?? null,
    signOut: () => vendorSupabase.auth.signOut(),
  };
}
```

### Pattern 4: VendorAuthGuard with Dual-Auth Bypass

**What:** Route guard that allows access if EITHER (a) vendor Supabase session is valid OR (b) Clerk admin flag is true (AUTH-05).

**When to use:** Wrapping the `/vendor-dashboard` route.

**Example:**
```typescript
// Mirrors AdminGuard pattern exactly
const VendorAuthGuard = ({ children }) => {
  const { isLoading: clerkLoading, isAdmin } = useClerkAuth();
  const { isLoading: vendorLoading, isAuthenticated: isVendorAuth } = useVendorSupabaseAuth();

  if (clerkLoading || vendorLoading) {
    return <LoadingSpinner />;
  }

  // Admin bypass: Clerk admin can always access vendor dashboard
  if (isAdmin) return <>{children}</>;

  // Vendor auth: valid vendor session passes
  if (isVendorAuth) return <>{children}</>;

  // Neither: redirect to vendor login
  return <Navigate to="/vendor-login" replace />;
};
```

### Pattern 5: VendorDashboardPage Dual-Auth Identity Resolution

**What:** The dashboard must resolve *which* vendor is being viewed from two different auth sources. Currently it uses Clerk `user.id` to look up `vendor_profiles`. For vendor Supabase sessions, it should look up `vendor_logins` by `auth.uid()`.

**When to use:** `VendorDashboardPage.tsx` modification.

**Key insight:** The `vendorName` prop that drives all dashboard sub-components can come from either:
1. Admin: `?vendor=VendorName` query param (existing behavior)
2. Clerk vendor user: `vendor_profiles.vendor_name WHERE user_id = clerk_id` (existing behavior)
3. NEW — Vendor Supabase session: `vendor_logins.vendor_name WHERE user_id = auth.uid()`

### Anti-Patterns to Avoid
- **Sharing storageKey between clients:** The existing `supabase` client has no explicit `storageKey` — Supabase defaults to `sb-<project-ref>-auth-token`. The vendor client MUST use a different key. Never omit `storageKey` on the vendor client. [VERIFIED: existing client.ts + Supabase community docs]
- **Calling `detectSessionInURL: true` on vendor client:** OTP verification is done programmatically via `verifyOtp`, not via URL callback. Setting `detectSessionInURL: true` could cause the vendor client to accidentally intercept the Clerk OAuth redirect hash.
- **Modifying `vendor_profiles.user_id`:** This column stores Clerk IDs (TEXT, not UUID). The new `vendor_logins` table is the correct join point for Supabase Auth UUIDs. Do not add Supabase Auth UUIDs to `vendor_profiles.user_id`.
- **Checking `auth.uid()` in RLS for vendor access in Phase 1:** Phase 1 only adds the `vendor_logins` table and frontend auth. RLS policies on vendor data tables are Phase 3 work. Don't add RLS policies to existing tables in this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 6-digit OTP input | Custom input group with 6 `<input>` fields | `InputOTP` + `InputOTPGroup` + `InputOTPSlot` from `@/components/ui/input-otp` | Already installed; handles focus management, paste, keyboard navigation |
| OTP send/verify state machine | Custom useState + try/catch logic | `useMutation` from TanStack React Query | Handles loading/error/success states, matches project patterns |
| Session refresh | Manual token refresh polling | `autoRefreshToken: true` on Supabase client | Built-in; handles refresh token rotation automatically |
| "User not found" vs "expired OTP" distinction | Custom error code mapping | Read `error.message` from Supabase `AuthApiError` | Supabase returns descriptive messages; just render them with CTA |

**Key insight:** Every UI primitive and state management tool needed already exists in this codebase. Zero new packages.

---

## Common Pitfalls

### Pitfall 1: GoTrueClient Collision Warning
**What goes wrong:** Both the existing anon client and the new vendor client use the same default `storageKey`. Supabase logs a warning "Multiple GoTrueClient instances detected" and behavior is undefined — vendor sign-in can overwrite the Clerk-linked session.
**Why it happens:** The existing `client.ts` does not set `storageKey`, so it uses the project-default key. A second client without `storageKey` inherits the same key.
**How to avoid:** Always set `storageKey: 'vendor-auth'` on the vendor client. The existing client must NOT have `storageKey` added to it (that would break existing behavior).
**Warning signs:** Browser console shows "Multiple GoTrueClient instances detected in the same browser context."

### Pitfall 2: shouldCreateUser: false Error Not Surfaced to User
**What goes wrong:** When `signInWithOtp` with `shouldCreateUser: false` is called for a non-provisioned email, Supabase returns an error with message like `"For security purposes, you can only request this once every 60 seconds"` or `"Signups not allowed"` — the exact message varies by Supabase version. Swallowing the error shows no feedback.
**Why it happens:** `signInWithOtp` does not throw — it returns `{ data, error }`.
**How to avoid:** Always check the `error` from `signInWithOtp` and display a "contact your sales rep" message for non-provisioned emails. Use a custom message, not the raw Supabase error string, since error wording can be opaque.
**Warning signs:** OTP request appears to succeed (no error shown) but email is never received.

### Pitfall 3: VendorDashboardPage Redirect Loop
**What goes wrong:** `VendorDashboardPage` currently has `if (!isAuthenticated || !vendorProfile) { return <Navigate to="/vendors" replace />; }` at line 130. If a vendor Supabase session is present but the existing `isAuthenticated` (Clerk) check is false, the page redirects before the vendor identity can be resolved.
**Why it happens:** The page only checks Clerk auth state today. Adding the `VendorAuthGuard` wrapper is not enough — the inner `VendorDashboardPage` also needs its early-return guard updated.
**How to avoid:** Modify the `if (!isAuthenticated || !vendorProfile)` guard to also accept `isVendorAuth` before redirecting. Add a `useVendorSupabaseAuth()` call inside `VendorDashboardPage` with vendor profile lookup via `vendor_logins`.
**Warning signs:** Vendor logs in successfully but immediately gets redirected to `/vendors`.

### Pitfall 4: Session Expiry Race on Mount
**What goes wrong:** `VendorAuthGuard` reads session state from the hook, which initializes as `isLoading: true`. Before `getSession()` resolves, `isAuthenticated` is `false`, causing a momentary redirect to `/vendor-login`.
**Why it happens:** Async initialization of session from localStorage.
**How to avoid:** The guard must render a loading state (Loader2 spinner) while `isLoading` is true, just like `AdminGuard` does.
**Warning signs:** Valid vendor sessions cause a flash of the login page on hard refresh.

### Pitfall 5: OTP expiry is 1 hour by default; magic link may arrive in spam
**What goes wrong:** Email arrives in spam, vendor doesn't see it within expiry window, tries old OTP after expiry.
**Why it happens:** Email deliverability + default expiry config.
**How to avoid:** The error UI must clearly say "code expired — request a new one" with a button wired to `signInWithOtp` again. AUTH-06 requirement.
**Warning signs:** AUTH-06 test fails.

---

## Code Examples

Verified patterns from official sources and codebase:

### Supabase signInWithOtp with shouldCreateUser: false
```typescript
// Source: supabase.com/docs/guides/auth/auth-email-passwordless [CITED]
const { data, error } = await vendorSupabase.auth.signInWithOtp({
  email: vendorEmail,
  options: {
    shouldCreateUser: false,
  },
});
if (error) {
  // Display "contact your sales rep" for unknown email
  // Display rate limit message if too frequent
}
// On success: no session yet — wait for OTP entry
```

### Supabase verifyOtp for email type
```typescript
// Source: supabase.com/docs/reference/javascript/auth-verifyotp [CITED]
const { data, error } = await vendorSupabase.auth.verifyOtp({
  email: vendorEmail,
  token: sixDigitCode,
  type: 'email',
});
if (error) {
  // error.message: "Token has expired or is invalid"
  // Show error + "request new code" CTA
}
if (data.session) {
  // Session established — navigate to /vendor-dashboard
  navigate('/vendor-dashboard');
}
```

### InputOTP component usage (already in codebase)
```tsx
// Source: src/components/ui/input-otp.tsx [VERIFIED: file read]
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

<InputOTP
  maxLength={6}
  value={otp}
  onChange={setOtp}
  onComplete={(value) => handleVerify(value)}
>
  <InputOTPGroup>
    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
  </InputOTPGroup>
</InputOTP>
```

### AdminGuard pattern (reference for VendorAuthGuard)
```tsx
// Source: src/components/admin/AdminGuard.tsx [VERIFIED: file read]
const AdminGuard = ({ children }) => {
  const { isLoading, isAuthenticated, isAdmin } = useClerkAuth();
  if (isLoading) return <Loader2 spinner />;
  if (!isAuthenticated || !isAdmin) return <Navigate to="/vendors" replace />;
  return <>{children}</>;
};
```

### vendor_logins migration (new table needed)
```sql
-- New table: maps Supabase Auth UUID → vendor name + tier
-- auth.uid() will be UUID because this uses native Supabase Auth (not Clerk)
CREATE TABLE public.vendor_logins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'unverified'
    CHECK (tier IN ('unverified', 'tier_1', 'tier_2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_logins ENABLE ROW LEVEL SECURITY;

-- Vendor can read own row (auth.uid() works with native Supabase Auth)
CREATE POLICY "Vendor can read own login"
  ON public.vendor_logins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

---

## Critical Architecture Finding: Two Identity Namespaces

This is the most important thing the planner needs to know:

| Identity | Source | ID format | Storage in DB |
|----------|--------|-----------|---------------|
| Clerk dealer/admin | Clerk | `user_XXXX` (TEXT) | `vendor_profiles.user_id` (TEXT column) |
| Vendor Supabase Auth | Supabase Auth | UUID | `vendor_logins.user_id` (UUID column, new) |

The existing `vendor_profiles.user_id` column is TEXT and holds Clerk IDs. The migration `20260221000000_fix_user_id_text_types.sql` changed it from UUID to TEXT explicitly for Clerk compatibility. [VERIFIED: migration file read]

In `VendorDashboardPage`, the query `vendor_profiles WHERE user_id = user.id` uses the Clerk user ID. A vendor Supabase session must instead query `vendor_logins WHERE user_id = auth.uid()` to get the vendor name, then use that vendor name to drive the dashboard.

The `auth.uid()` function in Supabase RLS returns the UUID from `auth.users` for native Supabase Auth sessions. For Clerk JWT sessions, `auth.uid()` returns NULL (as documented in migration 20260221000000). This means Phase 1's new `vendor_logins` RLS policy correctly uses `auth.uid()` because vendor sessions ARE native Supabase Auth — the distinction is intentional and correct.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Magic link (single click, no code) | Email OTP (6-digit code) | Supabase ≥ 2.x supports both | OTP preferred for managed B2B portals — no redirect URL configuration needed in Supabase dashboard, works in email clients that block links |
| Magic link needs `emailRedirectTo` config | OTP: no redirect URL needed | Always | Avoids environment-specific redirect URL allowlisting (SEC-03 is v2) |

**Deprecated/outdated:**
- `signInWithMagicLink`: removed in supabase-js v2; replaced by `signInWithOtp` with email. [CITED: supabase.com/docs/guides/auth/auth-email-passwordless]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase `signInWithOtp` with `shouldCreateUser: false` returns an error (not silent success) for non-provisioned emails | Standard Stack / Code Examples | Low — multiple sources confirm this behavior. If Supabase returns silent success, users get "no email received" UX but no security breach |
| A2 | `auth.uid()` returns the Supabase Auth UUID for vendor sessions (i.e., the JWT `sub` claim is the UUID, not a Clerk ID) | Critical Architecture Finding | Low — native Supabase Auth sessions always set `auth.uid()` to the UUID from `auth.users`. Only Clerk JWTs make `auth.uid()` return NULL |
| A3 | The existing anon `supabase` client's default `storageKey` is `sb-<project-ref>-auth-token` | Standard Stack | Low — standard Supabase behavior. If different, the storageKey on the vendor client just needs to be any unique string |

---

## Open Questions

1. **Supabase email OTP template customization**
   - What we know: Supabase has a configurable email OTP template in the dashboard (Auth > Email Templates)
   - What's unclear: Whether the current project has a custom template configured
   - Recommendation: Plan should include a note that the planner/executor should verify the OTP email arrives with reasonable branding; if not, dashboard configuration is a manual step outside code

2. **VendorDashboardPage: vendor_logins lookup via service role or anon+RLS?**
   - What we know: The new `vendor_logins` table will have RLS `USING (auth.uid() = user_id)`. The vendor Supabase client has the vendor session, so `vendorSupabase.from('vendor_logins').select(...)` will work with the vendor JWT.
   - What's unclear: Whether the Supabase anon key allows reads on `vendor_logins` with RLS (yes, if the session is present in the vendor client)
   - Recommendation: Use `vendorSupabase.from('vendor_logins')` in the dashboard — the vendor JWT is carried automatically by the isolated client

3. **Error message for unknown email (AUTH-09)**
   - What we know: `shouldCreateUser: false` causes `signInWithOtp` to return an error when the email is not in `auth.users`
   - What's unclear: Exact error message text from Supabase (may differ between self-hosted and managed)
   - Recommendation: Treat any error from `signInWithOtp` when not rate-limited as "email not provisioned" and show "Contact your sales rep" — don't rely on specific error message text

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build / dev | Yes | v25.6.1 | — |
| npm | Package install | Yes | 11.9.0 | — |
| Playwright | E2E tests | Yes | 1.57.0 | — |
| Supabase JS client | Vendor auth | Yes | ^2.76.1 (latest 2.103.0) | — |
| `input-otp` package | OTP UI | Yes (via InputOTP shadcn component) | 1.4.2 | — |
| Supabase project (live) | OTP email delivery | Assumed available | — | Cannot test OTP delivery in CI without live project |

**Missing dependencies with no fallback:**
- Live Supabase project with email auth enabled — OTP email sending requires the live project. E2E tests for the full OTP flow require a test email inbox or Supabase Inbucket (local dev only).

**Missing dependencies with fallback:**
- E2E tests for email delivery: can be marked as manual-only smoke tests while unit/component tests cover the hook and guard logic.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.57.0 |
| Config file | `playwright.config.ts` (uses Lovable preset) |
| Quick run command | `npx playwright test e2e/ --reporter=line` |
| Full suite command | `npx playwright test` |

Note: No unit test framework is configured (`CLAUDE.md` confirms this). All automated tests are Playwright E2E. The `e2e/` directory does not exist yet — Wave 0 creates it.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Email form submits → OTP step appears | E2E smoke | `npx playwright test e2e/vendor-auth.spec.ts` | Wave 0 |
| AUTH-02 | Valid OTP → lands on /vendor-dashboard | E2E smoke (manual OTP step) | Manual-only — requires live email | Manual |
| AUTH-03 | Vendor session key isolated from Clerk session | E2E check `localStorage` keys | `npx playwright test e2e/vendor-auth.spec.ts` | Wave 0 |
| AUTH-04 | Unauthenticated → redirected to /vendor-login | E2E smoke | `npx playwright test e2e/vendor-auth.spec.ts` | Wave 0 |
| AUTH-05 | Admin (Clerk) → /vendor-dashboard accessible | E2E smoke (requires Clerk test user) | Manual-only — requires Clerk session | Manual |
| AUTH-06 | Invalid/expired OTP → error + CTA shown | E2E (mock error response) | `npx playwright test e2e/vendor-auth.spec.ts` | Wave 0 |
| AUTH-07 | Nav shows vendor login button | E2E visual check | `npx playwright test e2e/vendor-auth.spec.ts` | Wave 0 |
| AUTH-08 | Session expiry → redirected to /vendor-login | E2E (mock SIGNED_OUT event) | Manual-only — hard to trigger in test | Manual |
| AUTH-09 | Unknown email → "contact sales rep" message | E2E (mock signInWithOtp error) | `npx playwright test e2e/vendor-auth.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test e2e/vendor-auth.spec.ts --reporter=line`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `e2e/vendor-auth.spec.ts` — covers AUTH-01, AUTH-03, AUTH-04, AUTH-06, AUTH-07, AUTH-09
- [ ] `e2e/` directory — does not exist

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth OTP — built-in, no custom auth logic |
| V3 Session Management | yes | Supabase `persistSession: true` + `autoRefreshToken: true`; `storageKey` isolation |
| V4 Access Control | yes | `VendorAuthGuard` + dual-auth check; `shouldCreateUser: false` for registration prevention |
| V5 Input Validation | yes | Email validated by Supabase before OTP send; OTP is 6 numeric digits |
| V6 Cryptography | no | No custom crypto — Supabase handles JWT signing |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-registration by unknown vendor | Spoofing | `shouldCreateUser: false` on `signInWithOtp` |
| OTP brute force (6 digits = 1M combinations) | Tampering | Supabase rate limits OTP attempts and requests by default (1 request/60 sec); configurable |
| Session bleed between Clerk and vendor auth | Tampering | `storageKey: 'vendor-auth'` isolates localStorage namespace |
| Vendor accesses another vendor's data | Elevation of privilege | `vendor_logins` RLS `USING (auth.uid() = user_id)` — Phase 1 table-level only |
| Direct `/vendor-dashboard` access without auth | Spoofing | `VendorAuthGuard` with `Navigate to="/vendor-login"` redirect |
| OTP delivered to spam; phishing via lookalike link | Spoofing | OTP (code not link) mitigates phishing; user types code, not clicks link |

**Note:** Rate limiting on magic link requests (SEC-02) is a v2 requirement and out of scope for Phase 1. Supabase default rate limiting provides baseline protection.

---

## Sources

### Primary (HIGH confidence)
- Supabase JS `client.ts` codebase file — existing client pattern, storageKey absence confirmed [VERIFIED: file read]
- `src/components/admin/AdminGuard.tsx` — guard pattern to replicate [VERIFIED: file read]
- `src/hooks/useClerkAuth.ts` — return shape to mirror [VERIFIED: file read]
- `src/pages/VendorDashboardPage.tsx` — dual-auth insertion points [VERIFIED: file read]
- `supabase/migrations/20260221000000_fix_user_id_text_types.sql` — TEXT user_id, auth.uid() NULL for Clerk [VERIFIED: file read]
- `src/components/ui/input-otp.tsx` — InputOTP component available [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- [Supabase Passwordless Email Docs](https://supabase.com/docs/guides/auth/auth-email-passwordless) — `shouldCreateUser: false`, OTP expiry defaults, 6-digit code [CITED]
- [Supabase Auth Sessions Docs](https://supabase.com/docs/guides/auth/sessions) — token architecture, refresh tokens [CITED]
- Supabase community docs — `storageKey` isolation confirmed for running multiple clients [CITED: multiple community sources]

### Tertiary (LOW confidence)
- Exact error message text from `signInWithOtp` with `shouldCreateUser: false` for unknown email — behavior confirmed, exact string not verified in this session [ASSUMED: A3]

---

## Project Constraints (from CLAUDE.md)

All directives apply to this phase:

- **Auth separation:** Vendor auth must not interfere with existing Clerk auth flow — enforced by `storageKey: 'vendor-auth'` isolation
- **Supabase magic link:** Use Supabase Auth's built-in OTP/magic link — no custom email infrastructure
- **Brownfield:** Must integrate with existing codebase patterns (React 18, TypeScript, TanStack Query, shadcn/ui)
- **RLS:** Tier gating enforced at database level via RLS (Phase 3 concern; Phase 1 adds `vendor_logins` table with basic RLS only)
- **TypeScript strict mode is OFF** (`noImplicitAny: false`, `strictNullChecks: false`) — no need for null guards everywhere
- **Path alias:** Use `@/` for all imports, never relative paths
- **Hooks:** Named exports, return shape with `isLoaded/isAuthenticated/user`
- **Error logging:** `console.error("[VendorAuth] message:", error)` format
- **No unit test framework:** Tests are Playwright E2E only
- **shadcn components:** Do not edit `src/components/ui/` files manually

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json + supabase-js official docs
- Architecture patterns: HIGH — derived from reading actual codebase files + confirmed Supabase API
- Pitfalls: HIGH — derived from reading actual migration history and existing code
- Migration schema: HIGH — derived from existing migration patterns in codebase

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable APIs)
