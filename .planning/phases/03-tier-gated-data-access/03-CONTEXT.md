# Phase 3: Tier-Gated Data Access - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

RLS policies enforcing T1/T2 data boundaries at the database level. Frontend locked sections for out-of-tier features. Vendor isolation ensuring vendor A cannot see vendor B's data. `vendor_tier()` SECURITY DEFINER function for RLS policy lookups.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User deferred all implementation decisions to Claude. The following areas are open for the researcher and planner to determine the best approach:

- **D-01:** T1 vs T2 data split — which dashboard sections/data belong to each tier. T1 gets market intel and positivity leaderboard; T2 gets all T1 content plus granular mentions, insights, action plans.
- **D-02:** Locked section UX — how out-of-tier sections appear to T1 vendors (hidden vs locked with upgrade prompt)
- **D-03:** RLS strategy — `vendor_tier()` function, which tables get policies, handling SECURITY DEFINER audit
- **D-04:** Vendor isolation — vendor_name matching across tables, casing mismatch handling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 & 2 Dependencies
- `src/integrations/supabase/vendorClient.ts` — Isolated vendor Supabase client (RLS queries go through this)
- `src/hooks/useVendorSupabaseAuth.ts` — Vendor auth hook (provides session for RLS)
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — vendor_logins table (tier column is RLS source of truth)
- `supabase/functions/provision-vendor/index.ts` — Provisioning function (sets tier on vendor_logins)

### Vendor Dashboard
- `src/pages/VendorDashboardPage.tsx` — Main dashboard page with dual-auth
- `src/components/vendor-dashboard/VendorDashboardSidebar.tsx` — Sidebar nav with all sections
- `src/components/vendor-dashboard/VendorDashboardLayout.tsx` — Layout wrapper
- `src/hooks/useSupabaseVendorData.ts` — Vendor data fetching hooks (queries that need RLS)

### Data Tables (RLS targets)
- `vendor_profiles` — Vendor profile data
- `vendor_mentions` — Mention data (T2 only)
- `vendor_pulse_insights` — Pulse insights (T2 only)
- `vendor_reviews` — Review data
- `vendor_groups` — Group associations
- `vendor_metadata` — Metadata

### Requirements
- `.planning/REQUIREMENTS.md` — TIER-01 through TIER-07 define exact acceptance criteria

### Blockers from STATE.md
- SECURITY DEFINER RPC audit must enumerate all vendor dashboard RPCs before any RLS policy ships
- Validate vendor_name string matching across vendor_logins, vendor_profiles, and vendor_mentions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useVendorSupabaseAuth` hook — provides `session` and `user` for RLS context
- `vendorClient.ts` — isolated client that will carry the vendor's JWT for RLS
- `VendorDashboardSidebar.tsx` — sidebar nav sections that need tier-based visibility
- `VendorTierBadge.tsx` — tier badge component from Phase 2

### Established Patterns
- Supabase RLS via `auth.uid()` for row ownership
- SECURITY DEFINER functions for cross-schema joins (e.g., `admin_list_vendor_logins`)
- React Query for data fetching with conditional `enabled` flags
- Tier utilities in `src/utils/tierUtils.ts` (existing dealer tier system — pattern to follow)

### Integration Points
- `vendor_logins.tier` — source of truth for vendor tier
- `vendor_logins.vendor_name` — joins to all vendor data tables
- `VendorDashboardPage.tsx` — needs to pass tier to child components for frontend gating
- `VendorDashboardSidebar.tsx` — needs to hide/lock sections based on tier

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-tier-gated-data-access*
*Context gathered: 2026-04-13*
