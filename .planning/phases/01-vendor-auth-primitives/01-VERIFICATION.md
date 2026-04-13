---
phase: 01-vendor-auth-primitives
verified: 2026-04-13T18:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 2 human items pending
overrides_applied: 0
human_verification:
  - test: "Complete vendor OTP login flow end-to-end"
    expected: "Vendor enters email, receives 6-digit OTP via email, enters code, lands on /vendor-dashboard with session established"
    why_human: "Requires live Supabase Auth email delivery — cannot verify OTP is delivered or that verifyOtp produces a real session without a provisioned test email in the database"
  - test: "Vendor session persists across page reload and browser restart"
    expected: "After OTP login, vendor can close the browser, reopen it, navigate to /vendor-dashboard, and land on the dashboard without re-authenticating"
    why_human: "localStorage persistence requires a live session token — can only be confirmed in a real browser session after successful OTP login"
  - test: "supabase db push has been run to apply vendor_logins migration"
    expected: "vendor_logins table exists in Supabase with RLS enabled; vendor Supabase auth sessions can look up their own row"
    why_human: "Migration SQL file exists but there is no programmatic confirmation the migration was applied to the live database. Plan 03 summary noted this as a manual step for the developer."
---

# Phase 1: Vendor Auth Primitives — Verification Report

**Phase Goal:** Vendors can authenticate via OTP email and access the vendor dashboard with a session that is completely isolated from the existing Clerk auth system
**Verified:** 2026-04-13T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Vendor enters email at /vendor-login, receives 6-digit OTP, enters it, lands on /vendor-dashboard authenticated | VERIFIED | VendorLoginPage.tsx calls `signInWithOtp({shouldCreateUser:false})` then `verifyOtp({type:'email'})`, navigates to `/vendor-dashboard` on `data.session` present |
| 2 | Vendor session persists across page reloads and browser restarts without re-authentication | VERIFIED (code) / HUMAN (runtime) | vendorClient.ts has `persistSession: true`, `autoRefreshToken: true`, `storage: localStorage`; useVendorSupabaseAuth calls `getSession()` on mount to rehydrate. Runtime confirmation requires human test. |
| 3 | Unauthenticated user navigating directly to /vendor-dashboard is redirected to /vendor-login | VERIFIED | VendorAuthGuard checks `clerkLoading || vendorLoading` then `isAdmin` then `isVendorAuth`; falls through to `<Navigate to="/vendor-login" replace />` |
| 4 | Admin user (Clerk-authenticated) can still access /vendor-dashboard without a vendor session | VERIFIED | VendorAuthGuard checks `isAdmin` from `useClerkAuth()` before checking vendor auth; returns children on isAdmin=true |
| 5 | Expired/invalid OTP shows clear error with "request a new link" CTA; unknown email shows "contact sales rep" message | VERIFIED | VendorLoginPage renders `"That code is expired or invalid. Request a new code below."` with ghost `"Request a new code"` button; unknown email shows `"This email isn't registered. Contact your sales representative to get access."` |

**Score:** 5/5 truths verified (code complete; 3 items require human runtime confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/integrations/supabase/vendorClient.ts` | Isolated vendor Supabase client | VERIFIED | Exports `vendorSupabase` with `storageKey: 'vendor-auth'`, `detectSessionInURL: false`, `persistSession: true` |
| `src/hooks/useVendorSupabaseAuth.ts` | Vendor auth state hook | VERIFIED | Exports `useVendorSupabaseAuth()` with `isLoading`, `isAuthenticated`, `session`, `user`, `signOut`; SIGNED_OUT navigates to `/vendor-login?expired=true` |
| `supabase/migrations/20260413000000_create_vendor_logins.sql` | vendor_logins table definition | VERIFIED | Contains `CREATE TABLE public.vendor_logins`, `user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`, tier CHECK constraint, RLS enabled, self-read policy |
| `src/pages/VendorLoginPage.tsx` | Two-step vendor login page (email → OTP) | VERIFIED | 257 lines; two-step flow, all error states, session-expired banner, accessible role="alert" attributes |
| `src/components/Navigation.tsx` | Updated nav with vendor login button | VERIFIED | Lines 72 and 127 contain `href="/vendor-login"` for desktop and mobile menus with `variant="outline"` |
| `src/components/vendor-auth/VendorAuthGuard.tsx` | Route guard with dual-auth support | VERIFIED | Checks `isAdmin` (Clerk) bypass first, then `isVendorAuth` (vendor Supabase), redirects to `/vendor-login` |
| `src/pages/VendorDashboardPage.tsx` | Dashboard with vendor Supabase session identity resolution | VERIFIED | Imports `useVendorSupabaseAuth` and `vendorSupabase`; queries `vendor_logins` table; updated auth redirect guard accepts either Clerk or vendor session |
| `src/App.tsx` | Updated routes with /vendor-login and VendorAuthGuard wrapper | VERIFIED | Lazy imports for `VendorLoginPage` and `VendorAuthGuard`; `/vendor-login` route registered; `/vendor-dashboard` wrapped with `<VendorAuthGuard>` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useVendorSupabaseAuth.ts` | `vendorClient.ts` | `import { vendorSupabase }` | WIRED | Lines 21 and 30: `vendorSupabase.auth.getSession()` and `vendorSupabase.auth.onAuthStateChange` confirmed present |
| `VendorLoginPage.tsx` | `vendorClient.ts` | `vendorSupabase.auth.signInWithOtp/verifyOtp` | WIRED | Lines 34 and 69: `vendorSupabase.auth.signInWithOtp` and `vendorSupabase.auth.verifyOtp` confirmed present |
| `VendorLoginPage.tsx` | `/vendor-dashboard` | `navigate('/vendor-dashboard')` after verifyOtp | WIRED | Line 81: `navigate("/vendor-dashboard")` called after `data.session` is non-null |
| `VendorAuthGuard.tsx` | `useVendorSupabaseAuth.ts` | `import { useVendorSupabaseAuth }` | WIRED | Line 4 import + line 12 call confirmed |
| `VendorAuthGuard.tsx` | `useClerkAuth.ts` | `import { useClerkAuth }`, uses `isAdmin` | WIRED | Line 3 import + line 11 call confirmed |
| `VendorDashboardPage.tsx` | `vendorClient.ts` | `vendorSupabase.from('vendor_logins')` | WIRED | Lines 7-8 imports; line 97 query confirmed |
| `App.tsx` | `VendorLoginPage.tsx` | `lazy(() => import('./pages/VendorLoginPage'))` | WIRED | Line 36 confirmed |
| `App.tsx` | `VendorAuthGuard.tsx` | `lazy(() => import('./components/vendor-auth/VendorAuthGuard'))` | WIRED | Line 37 confirmed |

Note: gsd-tools key-link verification reported false negatives on regex patterns containing escaped backslashes. Manual grep confirmed all patterns are present.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VendorLoginPage.tsx` | `otp` state, `email` state | User input → `vendorSupabase.auth.signInWithOtp/verifyOtp` | Yes — live Supabase Auth API calls | FLOWING |
| `useVendorSupabaseAuth.ts` | `session` state | `vendorSupabase.auth.getSession()` + `onAuthStateChange` subscription | Yes — live Supabase Auth session from localStorage | FLOWING |
| `VendorDashboardPage.tsx` | `vendorLoginProfile` | `vendorSupabase.from("vendor_logins").select().eq("user_id", vendorUser.id).maybeSingle()` | Yes — real DB query with RLS guard; `enabled` condition prevents phantom calls | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — verification requires a live Supabase project with provisioned vendor credentials. The OTP flow cannot be exercised without an email address in `auth.users`. These behaviors are routed to human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-02 | Vendor can enter email at /vendor-login and receive OTP | SATISFIED | VendorLoginPage email step with `signInWithOtp` |
| AUTH-02 | 01-03 | Vendor clicking link lands authenticated on /vendor-dashboard | SATISFIED | verifyOtp success → navigate('/vendor-dashboard'); VendorDashboardPage accepts vendor Supabase session |
| AUTH-03 | 01-01 | Vendor Supabase Auth session isolated from Clerk session | SATISFIED | `storageKey: 'vendor-auth'` and `detectSessionInURL: false` in vendorClient.ts |
| AUTH-04 | 01-03 | Unauthenticated users redirected to /vendor-login via VendorAuthGuard | SATISFIED | VendorAuthGuard Navigate to /vendor-login when neither isAdmin nor isVendorAuth |
| AUTH-05 | 01-03 | Admin users can access /vendor-dashboard without vendor auth | SATISFIED | VendorAuthGuard checks isAdmin first; returns children bypassing vendor check |
| AUTH-06 | 01-02 | Expired/invalid OTP shows error with CTA to request new link | SATISFIED | "That code is expired or invalid. Request a new code below." + ghost "Request a new code" button |
| AUTH-07 | 01-02 | Nav bar shows vendor login button | SATISFIED | Navigation.tsx lines 72 and 127 — desktop and mobile with href="/vendor-login" |
| AUTH-08 | 01-01 | Session expiry redirects to /vendor-login with re-auth prompt | SATISFIED | SIGNED_OUT event in useVendorSupabaseAuth navigates to /vendor-login?expired=true; VendorLoginPage renders expired banner |
| AUTH-09 | 01-02 | shouldCreateUser: false prevents self-registration | SATISFIED | signInWithOtp called with `shouldCreateUser: false` at lines 34-38 and 99-104 in VendorLoginPage.tsx |

All 9 phase 1 requirements are satisfied in code. Requirements ADMIN-01 through ADMIN-06 and TIER-01 through TIER-07 are correctly mapped to Phases 2 and 3 and are not in scope.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `VendorLoginPage.tsx` | 158 | `placeholder="you@company.com"` | Info | HTML input placeholder attribute — not a code stub; expected UX pattern |

No blockers or warnings found. The single info-level match is an HTML input placeholder, not a code stub.

### Human Verification Required

#### 1. Complete Vendor OTP Login Flow End-to-End

**Test:** With the dev server running (`npm run dev`), navigate to `http://localhost:8080/vendor-login`. Enter a provisioned vendor email address (one that exists in Supabase `auth.users`) and click "Send Code". Wait for the 6-digit OTP email. Enter the code in the OTP input. Verify navigation lands on `/vendor-dashboard` with no console errors.

**Expected:** Session is established, vendor lands on /vendor-dashboard, and a `vendor-auth` key appears in browser DevTools → Application → Local Storage.

**Why human:** Requires live Supabase Auth OTP email delivery and a provisioned test email address. Cannot exercise the real verifyOtp → session creation path without these.

#### 2. Session Persistence Across Page Reload and Browser Restart

**Test:** After completing the OTP login flow (item 1 above), close the browser tab entirely (or quit the browser), then reopen and navigate directly to `http://localhost:8080/vendor-dashboard`.

**Expected:** Vendor lands on the dashboard without being redirected to /vendor-login — the persisted `vendor-auth` localStorage token is rehydrated by `getSession()` on mount.

**Why human:** Session persistence can only be confirmed with a live session token in localStorage; code analysis confirms `persistSession: true` is set but cannot simulate the rehydration path.

#### 3. Migration Applied to Live Database

**Test:** Run `supabase db push` from the project root (or confirm it was already run). Then verify in Supabase Dashboard → Table Editor that the `vendor_logins` table exists in the `public` schema with columns `id`, `user_id`, `vendor_name`, `tier`, `created_at`, `updated_at` and RLS enabled.

**Expected:** Table exists with the correct schema and the policy "Vendor can read own login" is listed under RLS policies.

**Why human:** The migration SQL file exists at `supabase/migrations/20260413000000_create_vendor_logins.sql` but there is no programmatic confirmation it has been applied to the live Supabase instance. Plan 03 summary explicitly notes this as a manual step.

### Gaps Summary

No automated gaps found. All 5 ROADMAP success criteria are satisfied in code. All 9 phase 1 requirements (AUTH-01 through AUTH-09) are implemented and wired. All 8 artifacts exist, are substantive, and are properly connected.

The 3 human verification items are runtime confirmation requirements — the code correctly implements all behaviors, but the end-to-end OTP flow and database migration application cannot be verified without human execution.

---

_Verified: 2026-04-13T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
