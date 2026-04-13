# Phase 2: Admin Provisioning Tools - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin panel page for creating vendor login credentials, linking them to existing vendor profiles, setting tiers (Unverified / Tier 1 / Tier 2), and managing OTP invites. Sales team operates entirely from the admin panel — no engineering involvement needed.

</domain>

<decisions>
## Implementation Decisions

### Provisioning Flow
- **D-01:** Step-by-step wizard for creating vendor accounts — multi-step: 1) Enter vendor email 2) Search & link to existing vendor profile 3) Set tier (Unverified/T1/T2) 4) Confirm & auto-send OTP invite
- **D-02:** OTP invite auto-sends on wizard completion — no separate "Send Invite" step. Resend button available in vendor list.

### Vendor List Display
- **D-03:** Standard data table matching existing admin patterns — columns: vendor name, email, tier (color badge), created date, last login, actions
- **D-04:** Tier badge colors: Unverified = gray/muted, Tier 1 = green (active), Tier 2 = purple (premium)

### Admin Sidebar
- **D-05:** Sidebar label is "Vendor Management" — placed within the existing CDG Admin sidebar, after Sales Targets (position 3)

### Claude's Discretion
- Icon choice for "Vendor Management" sidebar item
- Wizard dialog vs full-page layout
- Search/autocomplete implementation for vendor profile linking
- Resend cooldown timing (if any)
- Table sort/filter capabilities

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Admin Panel Architecture
- `src/components/admin/AdminSidebar.tsx` — Sidebar nav pattern (icon + label, NavLink, dark theme)
- `src/components/admin/AdminLayout.tsx` — Admin page wrapper layout
- `src/components/admin/AdminGuard.tsx` — Route guard for admin pages
- `src/pages/admin/` — Existing admin pages (follow patterns from these)

### Phase 1 Auth Primitives (dependencies)
- `src/integrations/supabase/vendorClient.ts` — Isolated vendor Supabase client
- `src/hooks/useVendorSupabaseAuth.ts` — Vendor auth hook
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — vendor_logins table schema

### Vendor Data
- `src/hooks/useSupabaseVendorData.ts` — Vendor data fetching hooks (vendor_profiles queries)
- `src/integrations/supabase/types.ts` — Auto-generated Supabase types

### Requirements
- `.planning/REQUIREMENTS.md` — ADMIN-01 through ADMIN-06 define exact acceptance criteria

No external specs — requirements fully captured in REQUIREMENTS.md and PROJECT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminSidebar.tsx`: NavLink pattern with icon + label — add "Vendor Management" entry
- `AdminLayout.tsx`: Page wrapper with sidebar — new page follows same pattern
- shadcn/ui Table, Dialog, Input, Select, Button components — all available
- `useClerkSupabase()`: Authenticated Supabase client for admin operations
- Existing admin pages (VendorQueuePage, MembersPage) — follow same data table patterns

### Established Patterns
- Admin pages: dark theme (zinc-950), data tables with action buttons
- React Query for data fetching with `queryKey` pattern
- Supabase RPC/Edge Functions for privileged operations (service-role)
- Toast notifications via Sonner for success/error feedback

### Integration Points
- `AdminSidebar.tsx` — add "Vendor Management" nav item
- `App.tsx` — register `/admin/vendors` route (lazy-loaded)
- `vendor_logins` table — INSERT for new accounts (requires service-role or Edge Function)
- Supabase Auth Admin API — `supabase.auth.admin.createUser()` for provisioning (Edge Function needed)

</code_context>

<specifics>
## Specific Ideas

- Wizard should feel lightweight (dialog/sheet, not a heavy multi-page flow)
- Vendor profile search should be fast autocomplete (not a full page reload)
- Tier badges should be immediately recognizable at a glance in the table

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-admin-provisioning-tools*
*Context gathered: 2026-04-13*
