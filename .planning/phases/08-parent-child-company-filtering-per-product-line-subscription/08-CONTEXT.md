# Phase 8: Parent/Child Company Filtering — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Vendors subscribe per product line with tier-per-product. Admin provisions product line subscriptions through the existing wizard. Vendor dashboard shows a product line switcher. RPCs scope data to the selected product line. RLS enforces subscription boundaries. Implements CAR-20.

</domain>

<decisions>
## Implementation Decisions

### Subscription Data Model
- **D-01:** Create a new `vendor_product_subscriptions` junction table linking `vendor_logins.id` to `vendor_product_lines.id` with its own `tier` column (unverified/tier_1/tier_2). One auth user, multiple subscriptions.
- **D-02:** Keep both account-level tier (`vendor_logins.tier`) and product-specific tier (`vendor_product_subscriptions.tier`). Dashboard reads product-specific tier when a product line is selected; falls back to account tier otherwise.
- **D-03:** Require at least one product subscription per vendor. Admin must create at least one product line subscription during provisioning. No subscription = admin must add one.

### Admin Provisioning Flow
- **D-04:** Extend the existing `VendorWizardDialog` with a new step after tier selection: auto-populate product lines from the selected vendor entity's `vendor_product_lines`, show checkboxes with per-product-line tier selectors.
- **D-05:** Auto-populate product lines from the selected vendor entity (e.g., selecting Cox Automotive loads VinSolutions, DealerTrack, etc.). Admin checks which ones to subscribe and sets tier per product line.
- **D-06:** Post-provisioning editing via vendor detail view — clicking a vendor in the management list opens a detail panel/page for CRUD on product line subscriptions (add/remove/change tier).
- **D-07:** Vendor management list table shows a badge count (e.g., "3 products") next to each vendor row, clickable to expand/navigate to detail.

### Vendor Dashboard Product Switcher
- **D-08:** Header dropdown selector showing the active product line name. Switching reloads dashboard data for that product line. Compact and always accessible.
- **D-09:** Default to the first subscribed product line (alphabetically or by creation date) on initial login. No "last viewed" persistence.
- **D-10:** Individual product lines only in the dropdown — no "All products" aggregate option. Each view maps 1:1 to a product line slug.

### RPC and Data Scoping
- **D-11:** Frontend passes the selected `product_line_slug` to each RPC call. RPCs already accept `p_product_line_slug` — stop passing `null` from vendor dashboard components.
- **D-12:** Tier used for component gating (`tier_component_config`) is the product-specific tier from `vendor_product_subscriptions`, not the account tier. When viewing VinSolutions (T2), vendor sees T2 components; when viewing DealerTrack (T1), vendor sees T1 components.
- **D-13:** Update ALL vendor dashboard components that call RPCs to pass the active product line slug. Consistent behavior — all data scoped to selected product.
- **D-14:** RLS enforcement — create an RLS-compatible SECURITY DEFINER function (similar to `vendor_tier()`) that checks `vendor_product_subscriptions`. If a vendor passes a product_line_slug they're not subscribed to, RPCs return no rows. Defense in depth.

### Claude's Discretion
- Table schema details for `vendor_product_subscriptions` (columns, constraints, indexes)
- RPC function signature changes and new helper functions
- React state management for active product line (context provider vs hook)
- Wizard step UI layout and validation
- Vendor detail panel/page design
- Migration ordering and data backfill strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/20260304120000_vendor_family_foundation.sql` — Defines vendor_entities, vendor_product_lines, vendor_alias_mappings, resolve_vendor_family()
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — Defines vendor_logins table (user_id, vendor_name, tier)
- `supabase/migrations/20260413200000_vendor_tier_function.sql` — vendor_tier() and auth_vendor_name() SECURITY DEFINER functions

### Frontend (Vendor Dashboard)
- `src/pages/VendorDashboardPage.tsx` — Main vendor dashboard page
- `src/components/vendor-dashboard/` — All vendor dashboard section components
- `src/hooks/useSupabaseVendorData.ts` — RPC calls with p_product_line_slug parameter

### Frontend (Admin)
- `src/pages/admin/VendorManagementPage.tsx` — Vendor management list page
- `src/components/admin/vendor-management/VendorWizardDialog.tsx` — Provisioning wizard to extend

### Tier Gating
- `src/types/tier-config.ts` — DASHBOARD_COMPONENTS and tier config types
- `src/hooks/useVendorSupabaseAuth.ts` — Vendor auth hook (if exists)

### Existing Product Line Handling
- `src/pages/VendorProfile.tsx` — Product line filter tabs (public-facing, lines 1387-1391)
- `supabase/migrations/20260313300000_vendor_list_product_lines.sql` — Product line display in vendor list RPC

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vendor_product_lines` table already exists with entity_id, name, slug, is_active
- `resolve_vendor_family()` function resolves vendor names to entity + product line IDs
- RPCs (`get_vendor_profile_v3`, `get_vendor_pulse_feed_v2`) already accept `p_product_line_slug` parameter
- `vendor_tier()` SECURITY DEFINER pattern can be replicated for product subscription checks
- VendorProfile.tsx has product line filter tab UI that could inform dashboard switcher design
- `VendorWizardDialog.tsx` is the existing 4-step wizard to extend

### Established Patterns
- Supabase RLS with SECURITY DEFINER helper functions (vendor_tier, auth_vendor_name)
- React Query for data fetching with `queryKey` arrays including filter params
- shadcn/ui Select component for dropdowns
- Admin list tables with badges (existing tier badge pattern in vendor management)

### Integration Points
- `VendorDashboardPage.tsx` — needs product line context/state
- All vendor dashboard section components — need to receive and pass product_line_slug
- `useVendorDataClient` hook — may need product line awareness
- `VendorWizardDialog.tsx` — new wizard step for product line selection
- `VendorManagementPage.tsx` — new badge column and detail view navigation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-parent-child-company-filtering-per-product-line-subscription*
*Context gathered: 2026-04-23*
