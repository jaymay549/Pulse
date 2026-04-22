---
status: verifying
trigger: "vendor-dashboard-gating-broken: Vendor dashboard tier gating/hiding not working + white screen on Manage Profile click"
created: 2026-04-21T00:00:00Z
updated: 2026-04-21T00:10:00Z
---

## Current Focus

hypothesis: BOTH FIXES APPLIED — awaiting human verification.

Bug #1 fix: VendorAuthGuard now passes `isAuthenticated` (Clerk) as a third pass condition. Clerk vendor owners no longer get redirected to /vendor-login on client-side navigation.

Bug #2 fix: VendorDashboardPage now fetches tier from vendor_logins by vendor_name for Clerk-authenticated vendor owners (clerkVendorLogin query). vendorTier = adminResolvedTier || vendorLoginProfile?.tier || clerkVendorLogin?.tier.

test: Human verification — navigate from a vendor profile page to the dashboard and confirm no white screen; confirm gating/hiding applies.
expecting: Manage Profile navigates cleanly; tier-gated sections show blur+lock overlay; hidden sections absent.
next_action: Await human verify checkpoint response.

## Symptoms

expected:
1. Clicking Manage Profile navigates to vendor dashboard without white screen.
2. Once on dashboard, gated sections show blur + lock overlay; hidden sections absent from sidebar.
3. Works for all entry paths: admin mode (?vendor=X), magic-link vendor sessions, Clerk-authenticated vendors.

actual:
1. Clicking Manage Profile causes white screen — user must refresh to see dashboard.
2. On dashboard (after refresh), no tier gating or hiding applied. Everything shows as fully accessible.

errors: No specific error messages — just white screen on navigation and no visual gating.

reproduction:
1. Go to vendor's public profile page (e.g., /vendors/CDK%20Global)
2. Click MANAGE PROFILE button
3. Observe white screen (bug #1)
4. Refresh page
5. Observe all sections visible with no gating/hiding (bug #2)

started: After implementing tier component config system in admin panel.

## Eliminated

- hypothesis: RLS blocking tier_component_config reads
  evidence: Verified — no RLS on table, anon role has SELECT access, RPC works correctly
  timestamp: 2026-04-21T00:00:00Z

- hypothesis: tier_component_config table missing data
  evidence: Verified — data is correct in DB for tier_1, tier_2, test tiers
  timestamp: 2026-04-21T00:00:00Z

## Evidence

- timestamp: 2026-04-21T00:01:00Z
  checked: VendorDashboardPage.tsx line 152 — tier resolution
  found: vendorTier = adminResolvedTier || vendorLoginProfile?.tier. adminResolvedTier only set when isAdminMode && adminVendorView (defaults false). vendorLoginProfile query disabled when !isVendorAuth. Clerk-authenticated vendor owners (non-magic-link) have no vendorTier.
  implication: Bug #2 root cause confirmed. Clerk vendor owners get vendorTier=undefined → getSectionVisibility always returns "full" → no gating.

- timestamp: 2026-04-21T00:01:30Z
  checked: VendorProfile.tsx lines 641-654 — Manage Profile buttons
  found: Vendor owners (isVendorOwner) get Link to /vendor-dashboard. Admins get Link to /vendor-dashboard?vendor=X. Both use React Router Link (client-side nav).
  implication: Navigation itself is correct. White screen must occur after navigation.

- timestamp: 2026-04-21T00:02:00Z
  checked: App.tsx line 72 — /vendor-dashboard route
  found: Route wrapped in Suspense + VendorAuthGuard. Suspense fallback is a div with bg-slate-50 and a spinner. VendorAuthGuard allows isAdmin through immediately.
  implication: Suspense spinner shows bg-slate-50 (light gray), not white. White screen must be something else. The Suspense only fires on first load of chunk; after first navigation, chunk is cached.

- timestamp: 2026-04-21T00:02:30Z
  checked: useVendorSupabaseAuth.ts — onAuthStateChange handler
  found: SIGNED_OUT event with !currentSession → navigate("/vendor-login?expired=true"). detectSessionInURL: false on vendorClient. The hook uses useNavigate which requires router context.
  implication: Possible race: admin navigates to /vendor-dashboard, vendorSupabase.auth.getSession() resolves null (admin has no vendor session), isVendorAuth=false but isAdmin=true so VendorAuthGuard passes. Then VendorDashboardPage mounts. BUT: could the onAuthStateChange fire during navigation and cause a redirect loop? No — only fires on SIGNED_OUT with !session.

- timestamp: 2026-04-21T00:03:00Z
  checked: VendorDashboardPage.tsx — early return logic
  found: Line 204: if ((!isAuthenticated && !isVendorAuth) || !vendorProfile) return <Navigate to="/vendors" replace />. On initial client-side navigation: isAuthenticated=true (Clerk admin), isVendorAuth=false, vendorProfile=null (adminVendorProfile still loading). So condition: (false || true) = true → Navigate to /vendors. Then the page navigates away immediately. User sees /vendors briefly, then... wait, the redirect is to /vendors not a white screen.
  implication: Actually this IS the Bug #1 cause. When admin clicks Manage Profile and client-side navigates to /vendor-dashboard?vendor=X: VendorAuthGuard passes (isAdmin=true), page mounts, but adminVendorProfile is loading (adminLoading=true) so the loading spinner shows. BUT: isLoading check at line 161 is: isAdminMode ? adminLoading : ... So when adminLoading=true, a spinner shows, not a white screen. After adminLoading resolves, if adminVendorProfile is null (vendor profile not found or edge fn error), line 204 fires Navigate to /vendors. If it succeeds, the page renders. So the white screen timing might be: Suspense chunk load + auth check timing window.

- timestamp: 2026-04-21T00:04:00Z
  checked: VendorDashboardPage line 204 condition more carefully
  found: The condition is: (!isAuthenticated && !isVendorAuth) || !vendorProfile. For the isVendorOwner (Clerk vendor auth) path: isAuthenticated=true, isVendorAuth=false, ownVendorProfile fetching (ownLoading=true). isLoading = isAdminMode ? adminLoading : (isVendorAuth ? vendorLoginLoading : ownLoading). So isLoading = ownLoading = true. The spinner shows during loading. After ownLoading resolves, if user has a vendor profile → page renders. This path seems OK. But wait — does the Clerk vendor owner actually have a row in vendor_profiles? If not, ownVendorProfile=null → Navigate to /vendors.
  implication: Bug #1 for Clerk vendor owner path: if their vendor_profiles row isn't approved or doesn't exist, they get redirected to /vendors. But the report says "white screen" not redirect. Need to look for actual crash.

- timestamp: 2026-04-21T00:05:00Z
  checked: VendorDashboardPage — DashboardAIChat position
  found: Line 276 renders DashboardAIChat outside VendorDashboardLayout but inside the fragment. It's always rendered when the page passes auth checks. Could crash if vendorName="" and some internal hook throws.
  implication: Minor risk but vendorName="" is handled gracefully in most components.

- timestamp: 2026-04-21T00:05:30Z
  checked: ProfileProgressBar.tsx line 23
  found: HIDDEN_PATHS = ["/vendor-dashboard", "/admin"]. This hides a component from rendering on vendor dashboard. Not the cause.
  implication: Not related to white screen.

## Resolution

root_cause:
BUG #1 (white screen on navigation): VendorAuthGuard only allows isAdmin or isVendorAuth (magic-link Supabase session). Clerk-authenticated vendor owners (isAuthenticated=true but not admin and not magic-link) fail the guard and get redirected to /vendor-login immediately on client-side navigation. On hard page refresh, the page URL is served fresh and the Clerk auth resolves before the redirect fires, allowing the route to render — but VendorDashboardPage line 204 still sends them to /vendors if their vendorProfile isn't found via vendor_profiles. Fix: VendorAuthGuard must also pass Clerk-authenticated users who are not admins (they may be vendor owners); VendorDashboardPage already handles unauthorized users itself with its own redirect.

BUG #2 (no gating): vendorTier is always undefined for Clerk-authenticated vendor owners because the vendorLoginProfile query is disabled when !isVendorAuth and there is no alternative tier lookup for Clerk users. getSectionVisibility returns "full" when tier=undefined → no gating applied. Fix: Add a tier lookup query for Clerk-authenticated vendor owners by fetching from vendor_logins by vendor_name (matching from ownVendorProfile).

fix:
1. VendorAuthGuard: add isAuthenticated (Clerk) as a pass condition alongside isAdmin and isVendorAuth.
2. VendorDashboardPage: add a tier fetch query for Clerk vendor owners — when isAuthenticated && !isAdminMode && !isVendorAuth && ownVendorProfile, query vendor_logins by vendor_name to get the tier.

verification: (pending)
files_changed:
  - src/components/vendor-auth/VendorAuthGuard.tsx
  - src/pages/VendorDashboardPage.tsx
