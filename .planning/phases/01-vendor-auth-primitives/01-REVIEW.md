---
phase: 01-vendor-auth-primitives
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/App.tsx
  - src/components/Navigation.tsx
  - src/components/vendor-auth/VendorAuthGuard.tsx
  - src/hooks/useVendorSupabaseAuth.ts
  - src/integrations/supabase/vendorClient.ts
  - src/pages/VendorDashboardPage.tsx
  - src/pages/VendorLoginPage.tsx
  - supabase/migrations/20260413000000_create_vendor_logins.sql
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase introduces vendor authentication primitives: a dedicated Supabase client (`vendorClient.ts`), an OTP login page, an auth hook, a guard component, a dashboard page with dual-auth (Clerk admin + vendor Supabase), and a `vendor_logins` migration. The overall architecture is sound — auth isolation via a separate `storageKey` is the correct approach, and `shouldCreateUser: false` correctly prevents email enumeration-style registration.

Four warnings were found: a misleading UX on intentional sign-out, fragile rate-limit error detection, a missing `updated_at` trigger in the migration, and unsafe non-null assertions in the dashboard query. Four informational items were also identified.

---

## Warnings

### WR-01: Intentional sign-out shows misleading "session expired" message

**File:** `src/hooks/useVendorSupabaseAuth.ts:35`
**Issue:** The `SIGNED_OUT` event handler unconditionally redirects to `/vendor-login?expired=true`. This fires for both intentional sign-out (user clicks "Log Out") and genuine session expiry. A vendor who explicitly signs out will land on the login page with a banner saying "Your session has expired", which is incorrect and confusing.
**Fix:** Distinguish intentional sign-out from expiry. One approach: set a flag before calling `signOut()`, then check it in the event handler.
```typescript
// In useVendorSupabaseAuth.ts
const intentionalSignOut = useRef(false);

// In signOut:
signOut: async () => {
  intentionalSignOut.current = true;
  await vendorSupabase.auth.signOut();
},

// In onAuthStateChange:
if (event === "SIGNED_OUT" && !currentSession) {
  const wasIntentional = intentionalSignOut.current;
  intentionalSignOut.current = false;
  navigate(wasIntentional ? "/vendor-login" : "/vendor-login?expired=true", { replace: true });
}
```

---

### WR-02: Rate-limit detection relies on fragile string matching

**File:** `src/pages/VendorLoginPage.tsx:43-44` and `108-109`
**Issue:** Rate-limit errors are detected by checking if the error message contains `"rate"` or `"60 seconds"`. Supabase error messages are not a stable API; they can change between library versions. If the message changes, the rate-limit branch silently falls through to the generic "email not registered" message, which is incorrect and could mislead the user.
**Fix:** Check the structured error code instead. Supabase's `AuthError` exposes a `status` field (HTTP 429 for rate limit). If `status` is available, prefer it.
```typescript
if (error) {
  // Prefer status code over message matching
  if ((error as any).status === 429 || error.message?.toLowerCase().includes("rate")) {
    setSendError("Too many attempts. Please wait a minute before requesting another code.");
  } else {
    setSendError("This email isn't registered. Contact your sales representative to get access.");
  }
  return;
}
```
Apply the same fix in `handleRequestNewCode` (lines 106-113).

---

### WR-03: `updated_at` column will never auto-update — no trigger defined

**File:** `supabase/migrations/20260413000000_create_vendor_logins.sql:12`
**Issue:** The `vendor_logins` table defines `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, but there is no trigger to update this column when a row is modified. After the initial insert, `updated_at` will permanently reflect the creation time, making it unreliable for auditing tier changes or detecting stale records.
**Fix:** Add a trigger using the standard `moddatetime` extension (already available in Supabase) or a custom trigger function:
```sql
-- At the end of the migration:
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendor_logins_set_updated_at
  BEFORE UPDATE ON public.vendor_logins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

### WR-04: Unsafe `vendorUser!.id` non-null assertion at query call site

**File:** `src/pages/VendorDashboardPage.tsx:99`
**Issue:** The query function uses `vendorUser!.id` with a non-null assertion operator. While the `enabled: isVendorAuth && !!vendorUser?.id` guard should prevent this from running when `vendorUser` is null, the assertion bypasses TypeScript's null check entirely. If the `enabled` condition ever changes or is refactored incorrectly, this will throw a runtime error silently swallowed by React Query (which will show the query as errored rather than crashing, but the root cause will be obscure).
**Fix:** Use optional chaining with an explicit guard or restructure to make the null check explicit:
```typescript
queryFn: async () => {
  if (!vendorUser?.id) throw new Error("No vendor user ID");
  const { data, error } = await vendorSupabase
    .from("vendor_logins")
    .select("vendor_name, tier")
    .eq("user_id", vendorUser.id)
    .maybeSingle();
  // ...
},
```

---

## Info

### IN-01: Duplicate env var imports in VendorDashboardPage

**File:** `src/pages/VendorDashboardPage.tsx:10-11`
**Issue:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are imported from `import.meta.env` at the module level, but these are only used for the `admin-ensure-vendor-profile` edge function fetch (lines 55-65). The `vendorClient.ts` module already imports the same env vars for its own use. This is not harmful but creates a second access point that could drift (e.g., if the env var name changes, two places need updating).
**Fix:** Extract the edge function call to a utility or pass the URL/key down from a shared config constant. At minimum, co-locate the constants with their use or import from a shared config.

---

### IN-02: No admin INSERT policy documented in migration

**File:** `supabase/migrations/20260413000000_create_vendor_logins.sql:21-24`
**Issue:** The migration only defines a `SELECT` policy for vendors. The comment mentions "Created by admin provisioning (Phase 2)", implying an Edge Function with service-role will do the INSERT. This is correct (service-role bypasses RLS), but it is undocumented in the migration, making the intended access model less clear for future maintainers.
**Fix:** Add a comment in the migration to document that INSERT is performed exclusively by service-role Edge Functions and that no anon/authenticated INSERT policy is intentionally absent:
```sql
-- Note: INSERT is performed by service-role Edge Functions (admin provisioning in Phase 2).
-- No authenticated INSERT policy is defined intentionally — vendors cannot self-register.
```

---

### IN-03: `detectSessionInURL: false` silently prevents magic link login if flow is ever changed

**File:** `src/integrations/supabase/vendorClient.ts:17`
**Issue:** `detectSessionInURL: false` is correctly set to prevent this client from consuming Clerk OAuth redirect hashes. However, this also means if the auth flow is ever changed from OTP to magic link (email link), the magic link will silently fail to authenticate — the URL hash won't be processed by this client. There is no comment explaining the tradeoff.
**Fix:** Add a comment to make the constraint explicit:
```typescript
// detectSessionInURL: false — REQUIRED.
// Prevents this client from intercepting Clerk OAuth redirect hashes (e.g., /auth#access_token=...).
// IMPORTANT: This also means magic link emails (type=magiclink) will NOT work with this client.
// This client supports OTP (signInWithOtp + verifyOtp) only.
detectSessionInURL: false,
```

---

### IN-04: `_auth_token` sent in POST body rather than Authorization header

**File:** `src/pages/VendorDashboardPage.tsx:63`
**Issue:** The admin edge function fetch passes the Clerk JWT as `_auth_token` in the JSON body rather than as an `Authorization: Bearer <token>` header. This is a non-standard pattern. While it may work if the edge function is written to expect it, it deviates from convention and will not be automatically validated by Supabase's built-in JWT verification middleware.
**Fix:** Use the standard `Authorization` header pattern that Supabase Edge Functions expect:
```typescript
headers: {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${token}`,
},
body: JSON.stringify({ vendor_name: adminVendorParam }),
```
Verify the `admin-ensure-vendor-profile` edge function validates the token from the `Authorization` header, not the body.

---

_Reviewed: 2026-04-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
