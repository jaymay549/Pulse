---
phase: 02-admin-provisioning-tools
plan: "02"
subsystem: frontend
tags: [admin, vendor-management, wizard, tier-badge, routing]
dependency_graph:
  requires:
    - 02-01 (provision-vendor Edge Function, admin_list_vendor_logins RPC)
  provides:
    - Admin Vendor Management page at /admin/vendors
    - VendorTierBadge reusable component
    - VendorWizardDialog 4-step provisioning wizard
  affects:
    - src/pages/admin/VendorManagementPage.tsx
    - src/components/admin/vendor-management/VendorWizardDialog.tsx
    - src/components/admin/vendor-management/VendorTierBadge.tsx
    - src/components/admin/AdminSidebar.tsx
    - src/App.tsx
tech_stack:
  added: []
  patterns:
    - useQuery with supabase.rpc for admin data tables
    - useMutation with fetchWithAuth for Edge Function calls
    - Multi-step wizard with controlled state and per-step validation
    - Native datalist autocomplete with exact-match validation (vendorProfiles.includes)
key_files:
  created:
    - src/components/admin/vendor-management/VendorTierBadge.tsx
    - src/components/admin/vendor-management/VendorWizardDialog.tsx
    - src/pages/admin/VendorManagementPage.tsx
  modified:
    - src/components/admin/AdminSidebar.tsx
    - src/App.tsx
decisions:
  - "VendorWizardDialog uses fetchWithAuth (not raw fetch) — token management is centralized in useClerkAuth hook, no need to pass _auth_token in body"
  - "Resend Invite uses inline async handler (not useMutation) to support per-row loading state via resendingId string state"
  - "Vendor profile autocomplete uses vendorProfiles.includes(vendorName) for exact-match validation per T-02-08 threat mitigation"
metrics:
  duration: "8 minutes"
  completed_date: "2026-04-13T18:40:32Z"
  tasks_completed: 1
  files_changed: 5
---

# Phase 2 Plan 02: Admin Vendor Management UI Summary

**One-liner:** Admin Vendor Management page at /admin/vendors with vendor data table, 4-step provisioning wizard (email → profile → tier → confirm), per-row Resend Invite, color-coded tier badges, sidebar nav entry, and lazy route wiring.

## What Was Built

### Task 1: VendorTierBadge, VendorWizardDialog, VendorManagementPage, route + sidebar

**`src/components/admin/vendor-management/VendorTierBadge.tsx`**

Reusable inline badge component with D-04 locked colors:
- Unverified: `bg-zinc-700 text-zinc-300` (muted gray)
- Tier 1: `bg-green-900/50 text-green-300 border border-green-700/50` (active green)
- Tier 2: `bg-purple-900/50 text-purple-300 border border-purple-700/50` (premium purple)

**`src/components/admin/vendor-management/VendorWizardDialog.tsx`**

4-step provisioning wizard with:
- Step 1: Email input with regex validation (`/.+@.+\..+/`)
- Step 2: Vendor profile datalist autocomplete with exact-match validation (`vendorProfiles.includes(vendorName)`) — mitigates T-02-08
- Step 3: shadcn Select for tier (unverified / tier_1 / tier_2)
- Step 4: Summary card + "Provision Vendor" CTA calling provision-vendor Edge Function via fetchWithAuth
- State reset on dialog close: `setStep(1); setEmail(""); setVendorName(""); setTier("")`
- Error handling: duplicate email shows specific "Use Resend Invite" message

**`src/pages/admin/VendorManagementPage.tsx`**

Admin page following MembersPage.tsx layout pattern:
- Header with "Vendor Management" h1 and "Provision Vendor" CTA
- Search input filtering by vendor name or email (client-side)
- Data table with columns: Vendor Name, Email, Tier (badge), Created, Last Login, Actions
- `useQuery` with `queryKey: ["admin-vendor-logins"]` calling `supabase.rpc("admin_list_vendor_logins")`
- Per-row "Resend Invite" button with individual loading state
- Empty state for zero vendors
- `VendorWizardDialog` wired with `queryClient.invalidateQueries` on success

**`src/components/admin/AdminSidebar.tsx`** (modified)

Added `Store` icon import and nav entry at index 2 (after Sales Targets, before AI Chat):
`{ to: "/admin/vendors", icon: Store, label: "Vendor Management" }`

**`src/App.tsx`** (modified)

Added lazy import and route:
```
const VendorManagementPage = lazy(() => import("./pages/admin/VendorManagementPage"));
<Route path="vendors" element={<Suspense fallback={<AdminFallback />}><VendorManagementPage /></Suspense>} />
```

### Task 2: Checkpoint (auto-approved in --auto mode)

Backend deployment checkpoint (apply migration + deploy Edge Function) was auto-approved. The provision-vendor Edge Function and admin_list_vendor_logins RPC were built in Plan 01 and are ready for deployment.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data sources are wired. The page calls real RPC and Edge Function endpoints built in Plan 01.

## Threat Flags

None — no new network endpoints or trust boundaries introduced beyond what the plan's threat model already covers. T-02-08 mitigation (`vendorProfiles.includes`) is implemented in VendorWizardDialog step 2.

## Self-Check: PASSED

- `src/components/admin/vendor-management/VendorTierBadge.tsx` — FOUND
- `src/components/admin/vendor-management/VendorWizardDialog.tsx` — FOUND
- `src/pages/admin/VendorManagementPage.tsx` — FOUND
- Commit `e65cc13` — FOUND
- `npm run build` — PASSED (no errors)
