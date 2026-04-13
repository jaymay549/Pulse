---
phase: 02-admin-provisioning-tools
verified: 2026-04-13T19:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Complete end-to-end provisioning flow"
    expected: "Admin navigates to /admin/vendors, opens wizard, enters email/profile/tier, clicks Provision, sees success toast, and new vendor appears in table with correct tier badge color"
    why_human: "Cannot verify OTP email delivery, toast rendering, tier badge color rendering, or full wizard step flow without a running browser session"
  - test: "Resend Invite triggers new OTP"
    expected: "Admin clicks 'Resend Invite' on an existing vendor row, sees success toast, and vendor receives a new OTP email"
    why_human: "Cannot verify email delivery or toast rendering without a running browser session"
  - test: "Vendor Management appears in sidebar at index 2 (after Sales Targets, before AI Chat)"
    expected: "Sidebar shows: Dashboard, Sales Targets, Vendor Management, AI Chat, ... in that order"
    why_human: "Sidebar order is visually verified; DOM ordering requires a running browser"
  - test: "Wizard resets state on close"
    expected: "After provisioning or cancelling, reopening the wizard shows all fields blank at step 1"
    why_human: "State reset behavior requires interaction testing in a running browser"
---

# Phase 2: Admin Provisioning Tools Verification Report

**Phase Goal:** The sales team can provision vendor credentials, link them to existing vendor profiles, and assign tiers entirely through the admin panel
**Verified:** 2026-04-13T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can enter a vendor email, select a vendor profile from a searchable list, assign a tier (Unverified / Tier 1 / Tier 2), and trigger an OTP invite — all from the admin panel | VERIFIED | VendorWizardDialog.tsx implements 4-step wizard: Step 1 (email + regex validation), Step 2 (datalist autocomplete with `vendorProfiles.includes()` exact-match), Step 3 (Select with unverified/tier_1/tier_2), Step 4 (confirm + provision-vendor Edge Function call via fetchWithAuth) |
| 2 | The admin vendor list displays each vendor account with a color-coded tier badge (Unverified / T1 / T2) visible at a glance | VERIFIED | VendorTierBadge.tsx renders `bg-zinc-700` (Unverified), `bg-green-900/50` (T1), `bg-purple-900/50` (T2); used in VendorManagementPage table's Tier column |
| 3 | Admin can resend an OTP to an existing vendor with one click from the vendor list | VERIFIED | VendorManagementPage.tsx `handleResend()` calls provision-vendor Edge Function with `action: "resend"` via `fetchWithAuth`; per-row loading state via `resendingId` state |
| 4 | The `vendor_logins` table record correctly links the Supabase Auth UUID to the vendor profile and tier after provisioning | VERIFIED | Migration `20260413000000_create_vendor_logins.sql`: `user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`; provision-vendor Edge Function upserts `{ user_id: vendorUserId, vendor_name, tier }` with `onConflict: "user_id"` |

**Score:** 4/4 roadmap success criteria verified

### Plan Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | provision-vendor Edge Function creates a Supabase Auth user for a given email and inserts a vendor_logins row linking the UUID to vendor_name and tier | VERIFIED | `inviteUserByEmail` → extract `user.id` → `vendor_logins.upsert({ user_id, vendor_name, tier })` in provision-vendor/index.ts lines 70-118 |
| 2 | provision-vendor Edge Function rejects non-admin callers with a permission denied error | VERIFIED | `verifyAdmin(authToken)` decodes Clerk JWT, checks `payload.user_role === "admin"`, throws `"permission denied: admin role required"` on failure (lines 32-37) |
| 3 | admin_list_vendor_logins RPC returns vendor_logins rows joined with auth.users (email, last_sign_in_at) | VERIFIED | Migration SQL: `JOIN auth.users u ON u.id = vl.user_id`, returns `email, last_sign_in_at` columns |
| 4 | Re-provisioning an existing email does not fail — upserts vendor_logins and generates a new magic link | VERIFIED | If `inviteUserByEmail` returns "already been registered", falls back to `generateLink({ type: "magiclink" })` to get user_id; then upserts with `onConflict: "user_id"` |
| 5 | Admin can open the Vendor Management page from the sidebar and see a table of provisioned vendors | VERIFIED | AdminSidebar.tsx index 2: `{ to: "/admin/vendors", icon: Store, label: "Vendor Management" }`; App.tsx: lazy route `path="vendors"` → `VendorManagementPage`; page calls `supabase.rpc("admin_list_vendor_logins")` |
| 6 | Admin can click 'Provision Vendor' to open a 4-step wizard (email, link profile, set tier, confirm) | VERIFIED | VendorManagementPage "Provision Vendor" button sets `wizardOpen=true`; VendorWizardDialog renders 4 steps with step indicator |
| 7 | Wizard step 2 shows a searchable datalist of vendor profiles for linking | VERIFIED | Step 2: `<Input list="vendor-profiles-list">` + `<datalist>` fed by useQuery on `vendor_profiles.vendor_name`; exact-match validation: `vendorProfiles.includes(vendorName)` |
| 8 | Wizard step 3 lets admin pick Unverified/Tier 1/Tier 2 | VERIFIED | Step 3: shadcn `<Select>` with SelectItems: unverified/tier_1/tier_2; Next disabled until `tier` is set |
| 9 | Wizard completion calls provision-vendor Edge Function and shows success toast | VERIFIED | `provisionMutation.mutationFn` POSTs to `VITE_SUPABASE_URL/functions/v1/provision-vendor`; `onSuccess` calls `toast.success("Vendor provisioned. OTP invite sent to ${email}.")` |
| 10 | Each vendor row shows a color-coded tier badge (gray/green/purple per D-04) | VERIFIED | `<VendorTierBadge tier={vendor.tier} />` in table row; badge colors match spec |

**Score:** 10/10 plan must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/functions/provision-vendor/index.ts` | Vendor provisioning Edge Function (create auth user + upsert vendor_logins) | VERIFIED | 133 lines; contains `verifyAdmin`, `inviteUserByEmail`, `generateLink` fallback, `vendor_logins` upsert with `onConflict: "user_id"` |
| `supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql` | SECURITY DEFINER RPC joining vendor_logins with auth.users | VERIFIED | 37 lines; contains `admin_list_vendor_logins`, `SECURITY DEFINER`, `JOIN auth.users`, `REVOKE ALL`, `GRANT EXECUTE TO authenticated` |
| `src/pages/admin/VendorManagementPage.tsx` | Admin vendor management page with table + wizard trigger | VERIFIED | 192 lines (min_lines: 100); contains `admin_list_vendor_logins` RPC call and provision-vendor Edge Function call |
| `src/components/admin/vendor-management/VendorWizardDialog.tsx` | 4-step provisioning wizard dialog | VERIFIED | 267 lines (min_lines: 100); contains step state, `setStep(1)` reset on close |
| `src/components/admin/vendor-management/VendorTierBadge.tsx` | Reusable tier badge component | VERIFIED | Contains `bg-green-900` (T1), `bg-purple-900` (T2), `bg-zinc-700` (Unverified) |
| `src/components/admin/AdminSidebar.tsx` | Vendor Management nav item at position 2 | VERIFIED | Index 2 in navItems array: `{ to: "/admin/vendors", icon: Store, label: "Vendor Management" }` |
| `src/App.tsx` | Lazy route for /admin/vendors | VERIFIED | `const VendorManagementPage = lazy(...)` + `<Route path="vendors" ...>` inside admin children |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `supabase/functions/provision-vendor/index.ts` | `public.vendor_logins` | upsert after auth user creation | WIRED | `supabase.from("vendor_logins").upsert({ user_id: vendorUserId, vendor_name, tier, ... }, { onConflict: "user_id" })` at line 102 |
| `supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql` | `auth.users` | SECURITY DEFINER JOIN | WIRED | `JOIN auth.users u ON u.id = vl.user_id` at line 29 |
| `src/pages/admin/VendorManagementPage.tsx` | `supabase.rpc('admin_list_vendor_logins')` | useQuery with queryKey ['admin-vendor-logins'] | WIRED | `supabase.rpc("admin_list_vendor_logins" as never)` in queryFn, queryKey: `["admin-vendor-logins"]`, result set to `vendors` state, rendered in table |
| `src/components/admin/vendor-management/VendorWizardDialog.tsx` | provision-vendor Edge Function | useMutation calling fetchWithAuth | WIRED | `fetchWithAuth(VITE_SUPABASE_URL + "/functions/v1/provision-vendor", { method: "POST", body: { vendor_email, vendor_name, tier, action: "provision" } })` |
| `src/components/admin/AdminSidebar.tsx` | `/admin/vendors` | navItems array entry | WIRED | `{ to: "/admin/vendors", icon: Store, label: "Vendor Management" }` at navItems[2] |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VendorManagementPage.tsx` | `vendors` | `supabase.rpc("admin_list_vendor_logins")` → PostgreSQL JOIN of `vendor_logins` + `auth.users` | Yes — queries real DB tables via SECURITY DEFINER RPC | FLOWING |
| `VendorWizardDialog.tsx` | `vendorProfiles` | `supabase.from("vendor_profiles").select("vendor_name")` | Yes — queries real `vendor_profiles` table | FLOWING |
| `VendorWizardDialog.tsx` | provision result | `fetchWithAuth` POST to provision-vendor Edge Function | Yes — creates real auth users via `auth.admin.inviteUserByEmail` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces dist artifacts | `npm run build` | 0 errors, built in 3.00s | PASS |
| VendorManagementPage route registered | `grep "path=\"vendors\""` in App.tsx | Found: `<Route path="vendors" element={<Suspense fallback={<AdminFallback />}><VendorManagementPage /></Suspense>} />` | PASS |
| provision-vendor exports valid TypeScript | Build passes including this file | No TS errors | PASS |
| Sidebar nav at correct position | `grep -n "/admin/vendors" AdminSidebar.tsx` | Line 24 (index 2 in navItems, after Dashboard and Sales Targets) | PASS |
| fetchWithAuth passes Authorization header | `useClerkAuth.ts` `fetchWithAuth` | Sets `Authorization: Bearer <token>` header; Edge Function reads it via fallback `req.headers.get("Authorization")?.replace("Bearer ", "")` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 02-01, 02-02 | Admin can create vendor login credentials by entering a vendor email address | SATISFIED | provision-vendor Edge Function + wizard step 1 (email input) + step 4 (Provision CTA calling the function) |
| ADMIN-02 | 02-02 | Admin can link a new vendor login to an existing vendor profile from a searchable list | SATISFIED | Wizard step 2: datalist autocomplete from `vendor_profiles` table with `vendorProfiles.includes()` exact-match validation |
| ADMIN-03 | 02-02 | Admin can set vendor tier (Unverified / Tier 1 / Tier 2) during or after provisioning | SATISFIED | Wizard step 3: shadcn Select with unverified/tier_1/tier_2 options; tier stored in `vendor_logins` via upsert |
| ADMIN-04 | 02-02 | Admin vendor list shows color-coded tier badges for quick visual identification | SATISFIED | VendorTierBadge component with zinc-700 (unverified), green-900 (T1), purple-900 (T2) rendered in table |
| ADMIN-05 | 02-02 | Admin can resend magic link to a vendor with one click | SATISFIED | "Resend Invite" button per row calls provision-vendor with `action: "resend"` via `handleResend()` |
| ADMIN-06 | 02-01 | `vendor_logins` table links Supabase Auth user ID (UUID) to vendor profile and tier | SATISFIED | Migration `create_vendor_logins.sql`: `user_id UUID REFERENCES auth.users(id)`; `vendor_name TEXT`, `tier TEXT` columns |

All 6 ADMIN-* requirements for Phase 2 are satisfied.

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| VendorWizardDialog.tsx | `placeholder` strings | Info | HTML input placeholder text — not code stubs |
| VendorManagementPage.tsx | `vendors = []` default | Info | React Query initial state before first fetch; immediately overwritten by real data from RPC |

### Human Verification Required

#### 1. End-to-End Provisioning Wizard

**Test:** Start dev server (`npm run dev`), log in as admin, navigate to `/admin/vendors`. Click "Provision Vendor". Complete all 4 steps: enter a real vendor email, select a vendor profile from the datalist, pick Tier 1, click "Provision Vendor" on step 4.
**Expected:** Success toast "Vendor provisioned. OTP invite sent to {email}." appears. New vendor row appears in the table with green T1 badge. Vendor receives an OTP invite email.
**Why human:** OTP email delivery, toast rendering, badge color rendering, and wizard step progression cannot be verified without a running browser session.

#### 2. Resend Invite

**Test:** On the Vendor Management page with at least one provisioned vendor, click the "Resend Invite" button on any vendor row.
**Expected:** Button shows spinner while loading, then returns to "Resend Invite" text. Toast "OTP invite resent to {email}." appears. Vendor receives a new OTP email.
**Why human:** Loading state animation, toast rendering, and OTP email delivery require a running browser session.

#### 3. Sidebar Position

**Test:** Log in as admin. Verify the left sidebar order: Dashboard, Sales Targets, Vendor Management, AI Chat, ...
**Expected:** "Vendor Management" appears at position 3 in the sidebar (index 2 in navItems), between Sales Targets and AI Chat.
**Why human:** Sidebar render order requires visual inspection in a running browser; DOM ordering analysis alone is insufficient to confirm visual position.

#### 4. Wizard State Reset

**Test:** Open the Provision Vendor wizard, fill in some fields, then close the dialog (click X or Escape). Immediately reopen the wizard.
**Expected:** All fields are blank (empty email, empty vendor name, no tier selected), wizard is back at Step 1.
**Why human:** React state reset behavior on close requires interaction testing in a running browser.

### Gaps Summary

No gaps found. All must-haves are verified at the code level. The phase goal is achievable — all backend infrastructure and frontend UI are correctly implemented and wired. The remaining items require human testing of the live application (email delivery, browser rendering, interactive flows).

---

_Verified: 2026-04-13T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
