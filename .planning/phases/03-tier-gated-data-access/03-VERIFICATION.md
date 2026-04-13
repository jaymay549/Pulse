---
phase: 03-tier-gated-data-access
verified: 2026-04-13T21:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Log in as a T1 vendor at /vendor-login, then check sidebar sections"
    expected: "Sidebar shows exactly: Intelligence, Overview, Market Intel, Segments, Categories, Screenshots, Edit Profile. Does NOT show: Discussions, Dimensions, Dealer Signals, Demo Requests."
    why_human: "Sidebar filtering is runtime behavior depending on live vendor session + tier value from vendor_logins table. Cannot verify without a live T1 vendor session."
  - test: "Log in as a T2 vendor at /vendor-login, then check sidebar sections and navigate to Mentions"
    expected: "Sidebar shows all 11 sections. Mentions tab loads data for this vendor only — no other vendor's mentions visible."
    why_human: "Full T2 visibility and vendor isolation require a live T2 vendor session against the real database."
  - test: "Confirm vendor isolation: while logged in as Vendor A, attempt to call get_vendor_dimensions('VendorB') directly (via DevTools or curl) with the Vendor A JWT"
    expected: "RPC returns '[]' (empty array) — cross-vendor read is blocked at the database level."
    why_human: "DB-level guard enforcement requires testing against a running Supabase instance with actual vendor JWTs."
  - test: "Confirm that the dealer-facing /vendors page still loads vendor mention data after the RLS migration"
    expected: "Public vendor feed loads normally — anon policy on vendor_mentions preserves pre-RLS behavior."
    why_human: "RLS regression test requires a browser with no auth session checking the live /vendors page."
---

# Phase 3: Tier-Gated Data Access Verification Report

**Phase Goal:** Vendor data access is enforced at the database level — Tier 1 vendors see market intel and positivity leaderboard only; Tier 2 vendors see all T1 content plus granular mentions, insights, and action plans; no vendor sees another vendor's data
**Verified:** 2026-04-13T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | T1 vendor is blocked from T2 data via direct API call (not frontend-only) | VERIFIED | `vendor_tier()` SECURITY DEFINER reads `vendor_logins.tier` via `auth.uid()`; `vendor_mentions` RLS policy `USING (vendor_tier() = 'tier_2' AND ...)` blocks T1 reads at the DB layer; T2 RPC guards (`get_vendor_dimensions`, `get_vendor_actionable_insights`, `get_vendor_tech_stack_intel`) return `'[]'` for non-T2 vendor sessions. Three migration files confirmed substantive. |
| 2 | T2 vendor can see all T1 content plus granular mentions, insights, and action plans | VERIFIED | T2 vendor sessions pass the `vendor_tier() = 'tier_2'` predicate in `vendor_mentions` RLS and all T2 RPC guards. T1 sections (`intelligence`, `overview`, `segments`, `intel`, `categories`, `screenshots`, `profile`) are not gated in any guard. `VendorDashboardPage.tsx` line 124: `isT2 = !vendorTier \|\| vendorTier === "tier_2"` — T2 vendors satisfy both DB and UI conditions. |
| 3 | Vendor A cannot see Vendor B's data under any circumstances including direct RPC calls | VERIFIED | All 5 vendor-facing RPCs (`get_vendor_dimensions`, `get_vendor_actionable_insights`, `get_vendor_tech_stack_intel`, `get_vendor_dashboard_intel`, `get_vendor_pulse_feed_v3`) have `IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN RETURN empty`. `vendor_mentions` RLS has `lower(vendor_name) = lower(public.auth_vendor_name())` in the authenticated policy. Isolation is enforced at DB level, not frontend. |
| 4 | Frontend renders hidden sections for out-of-tier features (no data visible, not just greyed out) | VERIFIED | `T2_ONLY_SECTIONS` constant in `VendorDashboardSidebar.tsx` (line 29–34) filters nav items from DOM. `VendorDashboardPage.tsx` guards T2 section renders with `&& isT2` (lines 185, 188, 189, 192) — components never mount for T1 vendors, not merely hidden. |

**Score:** 4/4 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260413200000_vendor_tier_function.sql` | `vendor_tier()` and `auth_vendor_name()` SECURITY DEFINER functions | VERIFIED | Both functions exist, use `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated`, query `vendor_logins WHERE user_id = auth.uid()` |
| `supabase/migrations/20260413300000_vendor_mentions_rls.sql` | RLS policies on vendor_mentions | VERIFIED | `ENABLE ROW LEVEL SECURITY` present; anon policy `USING (true)`; authenticated policy with `vendor_tier() IS NULL` Clerk pass-through branch and `vendor_tier() = 'tier_2' AND lower(vendor_name) = lower(public.auth_vendor_name())` T2 vendor branch |
| `supabase/migrations/20260413400000_t2_rpc_guards.sql` | Auth guards on T2-only SECURITY DEFINER RPCs | VERIFIED | All 5 RPCs present: `get_vendor_dimensions`, `get_vendor_actionable_insights`, `get_vendor_tech_stack_intel`, `get_vendor_dashboard_intel`, `get_vendor_pulse_feed_v3`. 13 occurrences of `vendor_tier()`. 6 vendor isolation checks via `lower(p_vendor_name) <> lower(public.auth_vendor_name())`. `recommendations` key stripped via `v_result - 'recommendations'` (line 699). |
| `src/hooks/useVendorDataClient.ts` | Hook returning `vendorSupabase` for vendor sessions, Clerk client for dealer/admin | VERIFIED | Exports `useVendorDataClient`, condition `isVendorAuth && !isClerkAuth` returns `vendorSupabase`, otherwise returns Clerk client |
| `src/components/vendor-dashboard/DashboardMentions.tsx` | Updated to use `useVendorDataClient` | VERIFIED | Line 12: `import { useVendorDataClient }`, line 77: `const supabase = useVendorDataClient()` |
| `src/components/vendor-dashboard/DashboardDimensions.tsx` | Updated to use `useVendorDataClient` | VERIFIED | Line 16: `import { useVendorDataClient }`, line 95: `const supabase = useVendorDataClient()` |
| `src/components/vendor-dashboard/VendorDashboardSidebar.tsx` | Tier-filtered sidebar navigation | VERIFIED | `tier?: string` prop, `T2_ONLY_SECTIONS` constant, `shouldHideT2` filter, `filteredItems.filter(...)`, empty groups skipped with `if (filteredItems.length === 0) return null` |
| `src/components/vendor-dashboard/VendorDashboardLayout.tsx` | Tier prop forwarding to sidebar | VERIFIED | `tier?: string` in props interface; `tier={tier}` passed to both mobile Sheet and desktop sidebar instances (lines 54, 71) |
| `src/pages/VendorDashboardPage.tsx` | Tier extraction and propagation + section render guard | VERIFIED | `vendorTier = vendorLoginProfile?.tier` (line 120); `isT2 = !vendorTier \|\| vendorTier === "tier_2"` (line 124); `tier={vendorTier}` passed to `VendorDashboardLayout` (line 169); T2 sections guarded with `&& isT2` (lines 185, 188, 189, 192) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `vendor_tier()` | `vendor_logins.tier` | `SELECT tier WHERE user_id = auth.uid()` | WIRED | Line 26 of migration 20260413200000: `WHERE user_id = auth.uid()` confirmed |
| `vendor_mentions` RLS | `vendor_tier()` | USING clause checks `vendor_tier() = 'tier_2'` | WIRED | Line 52 of migration 20260413300000: `public.vendor_tier() = 'tier_2'` confirmed in USING clause |
| `useVendorDataClient` | `vendorSupabase` | `isVendorAuth && !isClerkAuth` condition | WIRED | Lines 24–26 of `useVendorDataClient.ts`: condition present and returns `vendorSupabase` |
| `DashboardMentions.tsx` | `useVendorDataClient` | import and call | WIRED | Import at line 12, call at line 77 |
| `VendorDashboardPage` | `VendorDashboardLayout` | `tier` prop | WIRED | Line 169: `tier={vendorTier}` |
| `VendorDashboardLayout` | `VendorDashboardSidebar` | `tier` prop | WIRED | Lines 54 and 71: `tier={tier}` on both sidebar instances |
| `VendorDashboardSidebar` | `T2_ONLY_SECTIONS` | filter on tier | WIRED | Lines 102–103: `filteredItems = group.items.filter(item => !shouldHideT2 \|\| !T2_ONLY_SECTIONS.includes(item.id))` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VendorDashboardSidebar.tsx` | `tier` (prop) | `vendorLoginProfile?.tier` from `vendor_logins` table query in `VendorDashboardPage` (line 96–100) | Yes — queries real `vendor_logins` table via `vendorSupabase` with `auth.uid()` | FLOWING |
| `DashboardMentions.tsx` | `supabase` (client) | `useVendorDataClient()` returning `vendorSupabase` for vendor sessions | Yes — routes through Supabase Auth JWT where `auth.uid()` resolves to vendor's user_id, enabling RLS | FLOWING |
| `vendor_tier()` function | `tier` | `vendor_logins WHERE user_id = auth.uid()` | Yes — SECURITY DEFINER reads real DB row | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — core enforcement is SQL migrations and React components. No runnable CLI entry points or API endpoints to test without starting the dev server and a live Supabase instance. Runtime behavior requires human verification (see Human Verification section below).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TIER-01 | 03-01, 03-02 | RLS base predicate: vendor sees only own data (`vendor_logins.user_id = auth.uid()`) | SATISFIED | `vendor_tier()` and `auth_vendor_name()` both use `WHERE user_id = auth.uid()`. All vendor-facing RPCs check `lower(p_vendor_name) <> lower(auth_vendor_name())`. RLS on `vendor_mentions` uses `lower(vendor_name) = lower(auth_vendor_name())`. |
| TIER-02 | 03-03 | T1 vendors see market intel and positivity/ranking leaderboard | SATISFIED | T1 sections (`intelligence`, `overview`, `segments`, `intel`, `categories`, `screenshots`, `profile`) are not in `T2_ONLY_SECTIONS` and have no `&& isT2` render guard in `VendorDashboardPage`. |
| TIER-03 | 03-01, 03-03 | T1 vendors cannot access action plans, "what people are saying", actionable data segments | SATISFIED | `vendor_mentions` RLS blocks T1 sessions from reading mentions table. `get_vendor_actionable_insights` returns `'[]'` for non-T2 vendor sessions. `get_vendor_dashboard_intel` strips `recommendations` key for non-T2. Frontend: `mentions`, `dimensions`, `dealer-signals`, `demo-requests` guarded with `&& isT2`. |
| TIER-04 | 03-01, 03-03 | T2 vendors see all T1 content plus granular dimension insights, mentions, action plans | SATISFIED | T2 vendor sessions pass all RLS predicates and RPC tier guards. `isT2` is true for `vendorTier === "tier_2"` — all T2 section renders are enabled. |
| TIER-05 | 03-01 | Tier gating enforced at DB level via RLS (not just frontend) | SATISFIED | `vendor_mentions` has RLS enabled with T2-only vendor policy. 5 SECURITY DEFINER RPCs have vendor auth guards at the SQL level. `vendor_tier()` is SECURITY DEFINER — cannot be spoofed by frontend. |
| TIER-06 | 03-03 | Frontend renders locked/hidden sections (no data leaks via API) | SATISFIED | `T2_ONLY_SECTIONS` filters nav items from sidebar DOM. Section renders guarded with `&& isT2` — T2 components never mount for T1 vendors (no data fetching triggered). |
| TIER-07 | 03-01 | `vendor_tier()` SECURITY DEFINER function for RLS without circular dependency | SATISFIED | `vendor_tier()` in `20260413200000_vendor_tier_function.sql`: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated`. Used in both RLS policies and SECURITY DEFINER RPC guards. |

**All 7 Phase 3 requirements are SATISFIED by verified code.**

No orphaned requirements found. All TIER-01 through TIER-07 are claimed by plans 03-01, 03-02, 03-03 and evidence found in codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, stub implementations, hardcoded empty returns, or placeholder comments detected in the three migration files or the four modified frontend files.

Note: `DashboardDemoRequests.tsx` uses `(supabase as any)` on lines 89 and 102 — this is a TypeScript workaround for a table not in the generated types, not a stub. Data flows through `useVendorDataClient()` correctly.

### Human Verification Required

#### 1. T1 Vendor Sidebar Visibility

**Test:** Log in as a T1 vendor at `/vendor-login`, observe sidebar navigation
**Expected:** Sidebar shows exactly 7 sections: Intelligence, Overview, Market Intel, Segments, Categories, Screenshots, Edit Profile. Sections NOT shown: Discussions (mentions), Dealer Signals, Demo Requests, Dimensions (Feature Matrix)
**Why human:** `shouldHideT2 = tier && tier !== "tier_2"` evaluation requires a live vendor session with `tier = "tier_1"` from the `vendor_logins` table in the actual Supabase instance.

#### 2. T2 Vendor Data Visibility + Vendor Isolation

**Test:** Log in as a T2 vendor at `/vendor-login`, navigate to Mentions tab, verify data
**Expected:** All 11 sidebar sections visible. Mentions shows only this vendor's mentions — no other vendor's data visible in any section.
**Why human:** T2 RLS policy enforcement and vendor isolation require a live Supabase session. The data flowing through `vendorSupabase` with a real vendor JWT is required to verify `auth_vendor_name()` resolves correctly and filters apply.

#### 3. DB-Level Cross-Vendor Block

**Test:** While authenticated as Vendor A, open browser DevTools Network tab. Find a call to `get_vendor_dimensions` or `get_vendor_actionable_insights`. Note the `p_vendor_name` parameter. Try calling the same RPC with a different vendor name (e.g., via `curl` with the Vendor A JWT or by modifying the network request).
**Expected:** The spoofed RPC call returns `[]` or `{}` — not Vendor B's data.
**Why human:** Requires a live vendor JWT and ability to make raw RPC calls against the Supabase instance.

#### 4. Dealer Feed Regression Check

**Test:** In an incognito/private browser window (no auth), navigate to `/vendors`
**Expected:** Vendor mention feed loads normally — the `anon` RLS policy on `vendor_mentions` preserves public read behavior after RLS was enabled.
**Why human:** Migration regression check requires the Supabase migration to be applied and the live database to be queried. Cannot verify without a running instance.

### Gaps Summary

No structural gaps found. All 4 observable truths are VERIFIED by code inspection. All 7 requirements have implementation evidence. All key links are wired. No anti-patterns detected.

The `human_needed` status reflects that DB-level security enforcement (RLS, SECURITY DEFINER RPCs) cannot be fully validated by static code inspection alone — a live Supabase instance with actual vendor JWTs is required to confirm the security contracts hold at runtime. This is expected for a security-focused database phase.

---

_Verified: 2026-04-13T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
