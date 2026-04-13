# Phase 3: Tier-Gated Data Access - Research

**Researched:** 2026-04-13
**Domain:** Supabase RLS, PostgreSQL SECURITY DEFINER, React vendor client architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — user deferred all implementation decisions to Claude.

### Claude's Discretion
- **D-01:** T1 vs T2 data split — which dashboard sections/data belong to each tier
- **D-02:** Locked section UX — how out-of-tier sections appear to T1 vendors
- **D-03:** RLS strategy — `vendor_tier()` function, which tables get policies, SECURITY DEFINER audit
- **D-04:** Vendor isolation — vendor_name matching across tables, casing mismatch handling

### Deferred Ideas (OUT OF SCOPE)
None from discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIER-01 | RLS base predicate: vendor sees only their own data (`vendor_logins.user_id = auth.uid()`) | vendor_tier() SECURITY DEFINER pattern; auth.uid() works for vendorSupabase sessions |
| TIER-02 | T1 vendors see market intel and positivity/ranking leaderboard within their segment | DashboardIntel (market intel), DashboardSegments (rankings) — public-read tables need tier-specific SELECT policies |
| TIER-03 | T1 vendors cannot access action plans, "what people are saying", or actionable data segments | DashboardMentions, ActionPlan, DashboardDimensions: must return no rows for T1 via RLS + frontend gate |
| TIER-04 | T2 vendors see all T1 content plus granular dimension insights, mentions, and action plans | RLS policies on vendor_mentions, vendor_recommendations, vendor_feature_gaps allow T2 via vendor_tier() = 'tier_2' |
| TIER-05 | Tier gating enforced at database level via RLS policies (not just frontend) | vendor_tier() SECURITY DEFINER → RLS; SECURITY DEFINER RPCs must call it internally |
| TIER-06 | Frontend renders locked/hidden sections for out-of-tier features (no data leaks via API) | VendorDashboardPage has tier from vendor_logins; needs to pass it to sidebar + section components |
| TIER-07 | `vendor_tier()` SECURITY DEFINER function provides tier lookup for RLS policies without circular dependency | Standard Supabase pattern for RLS helper; function reads vendor_logins by auth.uid() |
</phase_requirements>

---

## Summary

Phase 3 enforces the revenue boundary: T1 vendors ($12K) see market intel and segment rankings; T2 vendors ($25K) see all that plus granular mentions, dimensions, and action plans. No vendor can see another vendor's data.

The codebase has two independent auth systems running on the same Supabase instance. Vendor users authenticate via Supabase Auth (the `vendorSupabase` client, `storageKey: 'vendor-auth'`), not Clerk. When a vendor session is active, `auth.uid()` returns the vendor's Supabase UUID. This is the foundation for RLS.

**The most important pre-implementation discovery:** all vendor dashboard section components (`DashboardMentions`, `DashboardDimensions`, `DashboardIntel`, `DashboardOverview`, `DashboardSegments`, `PulseBriefing`, `DashboardScreenshots`, `DashboardCategories`) use `useClerkSupabase()`, not `vendorSupabase`. This means vendor users making data queries currently use the Clerk client, which has no Clerk session and falls back to anon-key behavior — bypassing RLS entirely. Phase 3 must fix this as a prerequisite to RLS enforcement.

The SECURITY DEFINER audit is the critical blocker noted in STATE.md. All vendor-facing data RPCs (`get_vendor_dashboard_intel`, `get_vendor_pulse_feed_v3`, `get_vendor_profile_v3`, `get_vendor_actionable_insights`, `get_vendor_dimensions`, `get_vendor_trend`, `get_compared_vendors`) are granted to `anon, authenticated, service_role` and have no auth checks. They accept any `p_vendor_name TEXT` and return data for it. Phase 3 must add internal `vendor_tier()` checks to the T2-gated RPCs.

**Primary recommendation:** (1) Fix the client dispatch issue in VendorDashboardPage by passing `vendorSupabase` to all section components for vendor sessions. (2) Add `vendor_tier()` SECURITY DEFINER function. (3) Add RLS on `vendor_mentions` (currently no RLS at all). (4) Update T2-only SECURITY DEFINER RPCs to return empty results for non-T2 callers.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase RLS | Built-in | Row-level security enforcement | Database-enforced; survives API layer bypass |
| PostgreSQL SECURITY DEFINER | Built-in | Tier lookup without circular dependency | Standard pattern for RLS helper functions |
| Supabase JS SDK | 2.76.1 [VERIFIED: codebase] | Vendor client for authenticated queries | Already isolated with `storageKey: 'vendor-auth'` |
| React Query | 5.83.0 [VERIFIED: codebase] | Conditional data fetching based on tier | `enabled` flag pattern already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Lock/Badge components | Existing in codebase | Locked section UX | T1 viewing T2 sections |
| Lucide React Lock icon | 0.462.0 [VERIFIED: codebase] | Visual lock indicator | Locked section header |

---

## Architecture Patterns

### Pattern 1: vendor_tier() SECURITY DEFINER Function
[VERIFIED: Supabase RLS documentation pattern, confirmed via codebase pattern in `admin_list_vendor_logins` and `has_role`]

The canonical approach for tier lookups in RLS policies: a SECURITY DEFINER function that queries `vendor_logins` by `auth.uid()`. This avoids the circular dependency that would occur if RLS on `vendor_logins` itself tried to call a function that reads `vendor_logins`.

```sql
-- New migration: vendor tier helper for RLS
CREATE OR REPLACE FUNCTION public.vendor_tier()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tier
  FROM public.vendor_logins
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.vendor_tier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_tier() TO authenticated;
```

`auth.uid()` returns the vendor's Supabase UUID when called via `vendorSupabase` (Supabase Auth session). It returns `NULL` for Clerk JWT sessions — so policies using `vendor_tier()` do not interfere with existing Clerk auth queries. [VERIFIED: codebase — `vendor_logins` migration comment explicitly states "For Clerk JWT sessions, auth.uid() returns NULL"]

### Pattern 2: RLS Base Predicate — Vendor Sees Only Own Data (TIER-01)

All vendor-facing table policies must check `vendor_logins.vendor_name = auth_vendor_name`. The cleanest approach: a second SECURITY DEFINER helper returns the authenticated vendor's name.

```sql
CREATE OR REPLACE FUNCTION public.auth_vendor_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendor_name
  FROM public.vendor_logins
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
```

This function returns `NULL` when called by a Clerk session (dealer/admin), so existing policies on `vendor_profiles`, `vendor_reviews`, etc. are not affected.

### Pattern 3: T2-Only RLS on vendor_mentions

`vendor_mentions` currently has no RLS enabled. [VERIFIED: searched all migrations for `ENABLE ROW LEVEL SECURITY` on `vendor_mentions` — none found. Table predates migrations, created by WAM backend.]

```sql
-- Enable RLS on vendor_mentions (currently off)
ALTER TABLE public.vendor_mentions ENABLE ROW LEVEL SECURITY;

-- Existing public behavior preserved: anon/dealer reads remain open
CREATE POLICY "Public read vendor_mentions"
  ON public.vendor_mentions FOR SELECT
  TO anon
  USING (true);

-- Authenticated (Clerk) users: open read (existing behavior for dealer search/feed)
CREATE POLICY "Authenticated read vendor_mentions"
  ON public.vendor_mentions FOR SELECT
  TO authenticated
  USING (
    -- Clerk sessions (auth.uid() is a UUID but vendor_tier() returns NULL) — public read
    public.vendor_tier() IS NULL
    OR
    -- Vendor sessions: T2 only, own vendor_name only
    (
      public.vendor_tier() = 'tier_2'
      AND lower(vendor_name) = lower(public.auth_vendor_name())
    )
  );
```

**Important:** Enabling RLS on `vendor_mentions` will break the existing dealer-facing feed (`VendorsV2`, `VendorProfile`) unless the anon/Clerk authenticated policy allows public reads. The policies above preserve existing behavior while adding vendor-session gating. [ASSUMED — needs confirmation that the anon read policy doesn't break any admin or service-role write paths; service_role bypasses RLS by default in Supabase so writes are safe]

### Pattern 4: T2-Only SECURITY DEFINER RPCs

The SECURITY DEFINER RPCs bypass RLS entirely. For T2-gated RPCs, the function body must perform its own auth check:

```sql
-- Example: adding T2 guard to get_vendor_actionable_insights
CREATE OR REPLACE FUNCTION get_vendor_actionable_insights(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vendor isolation + T2 tier check
  IF auth.uid() IS NOT NULL THEN
    IF public.vendor_tier() IS NULL OR public.vendor_tier() <> 'tier_2' THEN
      RETURN '{}'::jsonb;
    END IF;
    IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
      RETURN '{}'::jsonb;
    END IF;
  END IF;
  -- ... existing function body ...
END;
$$;
```

The guard `IF auth.uid() IS NOT NULL` ensures the check only fires for vendor sessions. Clerk sessions and anon calls (dealer feed, admin) pass through unchanged. [VERIFIED: codebase — `vendor_logins` migration comment confirms `auth.uid()` is NULL for Clerk JWT sessions]

### Pattern 5: Frontend Tier-Gating Architecture

**Current state (pre-Phase 3):**
- `VendorDashboardPage` fetches `{ vendor_name, tier }` from `vendor_logins` via `vendorSupabase`
- The `tier` is extracted but never passed to child components
- All section components use `useClerkSupabase()` — returns anon-key behavior for vendor users

**Required changes:**
1. Pass `tier` as a prop from `VendorDashboardPage` to sections (or via context)
2. Pass `vendorSupabase` as the Supabase client to section components for vendor sessions, so `auth.uid()` works for RLS
3. `VendorDashboardSidebar` receives `tier` to conditionally render locked sections
4. Section components check `tier` before rendering T2-only content

**Client dispatch pattern for vendor sessions:**

```typescript
// In VendorDashboardPage: determine the right client to use
const activeClient = (isVendorAuth && !isAuthenticated) ? vendorSupabase : supabase;
// Pass activeClient to section components
```

Or alternatively, create a `useVendorDataClient` hook that returns `vendorSupabase` when vendor session is active, `useClerkSupabase()` otherwise. This minimizes component interface changes.

### Pattern 6: Locked Section UX (TIER-06)

For T1 vendors viewing T2 sections: hide the section entirely from sidebar nav (do not show a locked state — T1 vendors should not see that T2 sections exist unless there is an upsell intent). The v2 requirements note blurred/locked upgrade surfaces as a deferred feature (`VEXP-01`). For v1: hide.

```typescript
// VendorDashboardSidebar: filter nav items by tier
const visibleItems = items.filter(item => {
  if (T2_ONLY_SECTIONS.includes(item.id) && tier !== 'tier_2') return false;
  return true;
});
```

### Recommended Project Structure for Phase 3

```
supabase/migrations/
  20260413200000_vendor_tier_function.sql    -- vendor_tier() + auth_vendor_name() helpers
  20260413300000_vendor_mentions_rls.sql     -- Enable RLS on vendor_mentions
  20260413400000_vendor_rls_policies.sql     -- Policies on vendor_recommendations, vendor_feature_gaps, etc.
  20260413500000_t2_rpc_guards.sql           -- Add auth guards to T2-only SECURITY DEFINER RPCs

src/
  integrations/supabase/vendorClient.ts      -- Existing (already correct)
  hooks/useVendorDataClient.ts               -- NEW: returns vendorSupabase or Clerk client based on session
  components/vendor-dashboard/
    VendorDashboardSidebar.tsx               -- EDIT: accept tier prop, hide T2 sections for T1
    VendorDashboardLayout.tsx                -- EDIT: accept + forward tier
    DashboardMentions.tsx                    -- EDIT: use vendorDataClient
    DashboardDimensions.tsx                  -- EDIT: use vendorDataClient
    DashboardIntel.tsx                       -- EDIT: use vendorDataClient
    DashboardOverview.tsx                    -- EDIT: use vendorDataClient
    DashboardSegments.tsx                    -- EDIT: use vendorDataClient
  pages/VendorDashboardPage.tsx              -- EDIT: extract tier, pass to layout + sections
```

### Anti-Patterns to Avoid

- **Frontend-only gating without DB enforcement:** Setting `enabled: tier === 'tier_2'` on React Query alone does not satisfy TIER-05. API calls must return empty rows, not just be suppressed client-side.
- **Modifying Clerk JWT for vendor data:** Do not attempt to embed tier in Clerk JWT claims for vendor users. Vendor auth is entirely Supabase-native.
- **Using `auth.uid()` directly in RLS without vendor_tier():** `auth.uid()` returns values for both Clerk sessions and Supabase Auth sessions. Direct `auth.uid() = user_id` in policies on shared tables (like `vendor_mentions`) would fail for Clerk users who have no `vendor_logins` row.
- **Enabling RLS on vendor_mentions without an anon/Clerk read policy:** Would break existing dealer-facing feed. Must add "public read" policy for non-vendor sessions simultaneously.
- **Calling vendor_tier() on tables without RLS:** Enabling RLS must accompany any policy that calls `vendor_tier()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier lookup in RLS | Custom JWT claim parsing | `vendor_tier()` SECURITY DEFINER | JWT parsing in RLS is fragile; function is testable, atomic |
| Vendor name isolation | Frontend filtering | RLS `auth_vendor_name()` policy predicate | Frontend can be bypassed via direct API/RPC calls |
| Client selection per session | Conditional client re-creation | `useVendorDataClient` hook + useMemo | Avoids React client re-renders; consistent with existing patterns |
| T2 check in every RPC | Duplicate guard logic | Shared `vendor_tier()` call | Single point to update when tier logic changes |

---

## Runtime State Inventory

Not applicable — this is a new feature phase (greenfield RLS addition to existing tables), not a rename/refactor.

---

## Common Pitfalls

### Pitfall 1: vendor_mentions Has No RLS — Enabling It Will Break the Public Feed
**What goes wrong:** After `ALTER TABLE public.vendor_mentions ENABLE ROW LEVEL SECURITY`, all existing queries from the dealer-facing pages (`/vendors`, `/vendors/:slug`) return zero rows because there is no policy allowing anon/authenticated reads.
**Why it happens:** Supabase blocks all access when RLS is enabled but no matching policy exists.
**How to avoid:** Always add the permissive `anon` and `authenticated` (Clerk) read policies in the same migration that enables RLS.
**Warning signs:** Vendor profile pages go blank immediately after migration is applied.

### Pitfall 2: Clerk Sessions Hit vendor_tier() and Get NULL — Silently Blocking Dealer Reads
**What goes wrong:** A policy written as `USING (public.vendor_tier() = 'tier_2' OR ...)` blocks Clerk-authenticated dealers from reading mentions because `vendor_tier()` returns `NULL` for Clerk sessions and `NULL = 'tier_2'` is `NULL` (not `FALSE`), which evaluates to denied.
**Why it happens:** In SQL, `NULL = 'tier_2'` is `NULL`, not `FALSE`. RLS `USING` clauses treat `NULL` as denied.
**How to avoid:** Always include a `vendor_tier() IS NULL` branch in policies to pass Clerk sessions through: `USING (public.vendor_tier() IS NULL OR (public.vendor_tier() = 'tier_2' AND ...))`.
**Warning signs:** Dealer users get empty vendor feeds after migration; admin pages show no mentions.

### Pitfall 3: vendorSupabase Client Not Used for Vendor Data Queries — RLS Never Fires
**What goes wrong:** All vendor dashboard section components use `useClerkSupabase()`. When a vendor user is authenticated (Supabase Auth, not Clerk), `getToken()` returns `null`, the Supabase client uses the anon key, and `auth.uid()` is `NULL` inside RLS policies.
**Why it happens:** The Clerk session doesn't exist for vendor users. `useClerkSupabase()` builds a client with `accessToken: () => session?.getToken()` — returns `null` when no Clerk session.
**How to avoid:** For vendor sessions, pass `vendorSupabase` (which holds the vendor's Supabase Auth JWT in `vendor-auth` localStorage) as the query client for all section components.
**Warning signs:** RLS policies are added but vendor users still see other vendors' data OR see empty results for their own data.

### Pitfall 4: vendor_name Casing Mismatch Between vendor_logins and vendor_mentions
**What goes wrong:** `vendor_logins.vendor_name` is set from `vendor_profiles.vendor_name` (exact match), while `vendor_mentions.vendor_name` is normalized via `canonical_vendor_name_case()`. If the canonical form has different casing (e.g., `Tekion` vs `TEKION`), the RLS predicate `vendor_name = auth_vendor_name()` returns no rows.
**Why it happens:** The admin wizard uses an exact-match from `vendor_profiles` dropdown. `vendor_mentions` casing is determined by frequency analysis in `canonical_vendor_name_case()`. These can diverge.
**How to avoid:** Use `lower(vendor_name) = lower(public.auth_vendor_name())` in all RLS policies. The `auth_vendor_name()` function can optionally run `canonical_vendor_name_case()` on its return value to be safe.
**Warning signs:** T2 vendor gets zero mentions despite having data; test with PSQL `SELECT * FROM vendor_mentions WHERE lower(vendor_name) = lower('VendorName')` vs exact match.

### Pitfall 5: SECURITY DEFINER RPCs Accept Any p_vendor_name — Cross-Vendor Leak
**What goes wrong:** A vendor calls `get_vendor_dashboard_intel('OtherVendorName')` directly via curl or browser DevTools. Because the RPC is SECURITY DEFINER and accepts any vendor name, it returns that vendor's data.
**Why it happens:** These RPCs were designed for public-access dealer browsing. They have no `auth.uid()` checks.
**How to avoid:** Add a guard at the top of each T2 RPC: if `auth.uid() IS NOT NULL` (vendor session) and `lower(p_vendor_name) <> lower(public.auth_vendor_name())`, return empty JSON.
**Warning signs:** TIER-03 acceptance criterion "direct API call for T2 data returns no rows" fails during testing.

### Pitfall 6: Demo Requests Table Uses Old auth.jwt() ->> 'sub' Pattern
**What goes wrong:** `vendor_demo_requests` has a policy using `auth.jwt() ->> 'sub'` to match `vendor_profiles.user_id`. This works for Clerk sessions (Clerk puts `sub` = UUID), but for vendor Supabase Auth sessions, `sub` is also the UUID — however the vendor user has no `vendor_profiles` row (only a `vendor_logins` row). The demo requests policy would silently return no rows.
**Why it happens:** The policy was written before the vendor login system existed.
**How to avoid:** Add a secondary policy path for vendor sessions: `OR vendor_name = public.auth_vendor_name()`.
**Warning signs:** `DashboardDemoRequests` shows empty for vendor users even when demo requests exist.

---

## T1 vs T2 Data Split (D-01)

Based on REQUIREMENTS.md acceptance criteria and dashboard section analysis:

### T1 Sections (available to tier_1 and tier_2)
| Section ID | Component | Data Source | Notes |
|------------|-----------|-------------|-------|
| `intelligence` | `VendorCommandCenter` | `get_vendor_dashboard_intel` | Health score, metrics, benchmarks — market positioning. T1 gets this. |
| `overview` | `DashboardOverview` | `get_vendor_sentiment_history` + `fetchVendorPulseFeed` | Summary stats + trend chart. T1 gets this. |
| `intel` | `DashboardIntel` | `get_vendor_profile_v3`, `get_vendor_trend`, `get_compared_vendors` | **Market Intel** (sidebar label). Positivity ranking vs peers — T1 core value. |
| `segments` | `DashboardSegments` | `get_vendor_segment_intel` | Positivity leaderboard by segment — T1 core value. |

### T2 Sections (tier_2 only)
| Section ID | Component | Data Source | Reason for T2 |
|------------|-----------|-------------|---------------|
| `mentions` | `DashboardMentions` | `fetchVendorPulseFeed` (vendor-filtered) | "What people are saying" — explicitly T2 per TIER-03 |
| `dimensions` | `DashboardDimensions` | `get_vendor_dimensions`, `vendor_mentions` direct | Granular dimension insights — T2 per TIER-04 |
| `dealer-signals` | `DashboardDealerSignals` | WAM API | Actionable sales signals — T2 (actionable data) |
| `demo-requests` | `DashboardDemoRequests` | `vendor_demo_requests` | Contact/lead data — T2 (actionable data) |

### Shared Sections (both tiers, but read-only for vendors)
| Section ID | Component | Notes |
|------------|-----------|-------|
| `categories` | `DashboardCategories` | Profile metadata — both tiers can view |
| `screenshots` | `DashboardScreenshots` | Profile media — both tiers can view |
| `profile` | `DashboardEditProfile` | Profile editing — both tiers can edit own profile |

### Action Plans (TIER-03 gating)
`ActionPlan` component renders `recommendations` from `get_vendor_dashboard_intel`. Since `VendorCommandCenter` fetches the full `intel` object for all sections, the action plan data is embedded in the intelligence section response. Options:
1. Gate the ActionPlan sub-component render in `VendorCommandCenter` based on tier prop
2. Add tier check inside `get_vendor_dashboard_intel` to omit `recommendations` for T1

Option 2 (DB-level) is more secure. Implement both (defense in depth).

---

## SECURITY DEFINER RPC Audit

The full audit scope from STATE.md blocker: "142 SECURITY DEFINER functions in codebase, many accept `vendor_name TEXT` with no tier check."

**Phase 3 scope (vendor dashboard RPCs only):**

| RPC | Used In | T2-Only? | Requires Guard? |
|-----|---------|----------|-----------------|
| `get_vendor_dashboard_intel` | `VendorCommandCenter` | Partial (recommendations) | Add T2 guard for `recommendations` key, or filter in component |
| `get_vendor_pulse_feed_v3` | `DashboardMentions`, `DashboardOverview` | T2 for vendor-filtered feed | Add guard when vendor session + !T2 |
| `get_vendor_profile_v3` | `DashboardIntel` | T1 safe (market positioning) | No guard needed for T1 |
| `get_vendor_actionable_insights` | Not currently called in dashboard | T2 | Add guard if called in future |
| `get_vendor_dimensions` | `DashboardDimensions` | T2 | Add guard |
| `get_vendor_trend` | `DashboardIntel` | T1 safe | No guard needed |
| `get_compared_vendors` | `DashboardIntel` | T1 safe (public market intel) | No guard needed |
| `get_vendor_themes` | `PulseBriefing` | T1 safe | No guard needed |
| `get_vendor_segment_intel` | `DashboardSegments` | T1 safe | No guard needed |
| `admin_list_vendor_logins` | Admin panel only | Admin-gated via Edge Function | Existing: no change |

**RPCs not used in vendor dashboard (do not require Phase 3 changes):**
All other SECURITY DEFINER functions in the codebase (admin RPCs, WAM sync functions, compute/backfill functions) are admin-only or service-role-only. The full 142-function audit is deferred to SEC-01 (v2 requirement).

---

## Code Examples

### Example: Creating vendor_tier() migration pattern
```sql
-- Source: codebase pattern from admin_list_vendor_logins_rpc.sql and has_role function
CREATE OR REPLACE FUNCTION public.vendor_tier()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tier
  FROM public.vendor_logins
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.vendor_tier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_tier() TO authenticated;
-- anon users (unauthenticated) cannot call this; returns NULL for Clerk sessions
```

### Example: RLS policy using vendor_tier()
```sql
-- Source: codebase — vendor_demo_requests pattern adapted for tier-gating
CREATE POLICY "Vendor reads own mentions (T2 only)"
  ON public.vendor_mentions FOR SELECT
  TO authenticated
  USING (
    -- Clerk sessions pass through (vendor_tier() is NULL for Clerk JWTs)
    public.vendor_tier() IS NULL
    OR (
      public.vendor_tier() = 'tier_2'
      AND lower(vendor_name) = lower(public.auth_vendor_name())
    )
  );
```

### Example: useVendorDataClient hook
```typescript
// Source: follows useClerkSupabase pattern from existing codebase
import { vendorSupabase } from "@/integrations/supabase/vendorClient";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useVendorSupabaseAuth } from "@/hooks/useVendorSupabaseAuth";
import { useClerkAuth } from "@/hooks/useClerkAuth";

/**
 * Returns the appropriate Supabase client for the current session.
 * Vendor sessions (Supabase Auth): returns vendorSupabase so auth.uid() works for RLS.
 * Dealer/admin sessions (Clerk): returns Clerk-scoped client.
 */
export function useVendorDataClient() {
  const { isAuthenticated: isClerkAuth } = useClerkAuth();
  const { isAuthenticated: isVendorAuth } = useVendorSupabaseAuth();
  const clerkClient = useClerkSupabase();

  if (isVendorAuth && !isClerkAuth) {
    return vendorSupabase;
  }
  return clerkClient;
}
```

### Example: Frontend tier gate in VendorDashboardSidebar
```typescript
// T2-only section IDs — hidden from T1 vendors
const T2_ONLY_SECTIONS: DashboardSection[] = [
  "mentions",
  "dimensions",
  "dealer-signals",
  "demo-requests",
];

// In nav render: filter items based on tier
const visibleItems = items.filter(item =>
  !T2_ONLY_SECTIONS.includes(item.id) || tier === "tier_2"
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vendor data gated at WAM API layer only | RLS enforcement at Postgres level | Phase 3 (this phase) | Survives API bypass; enforced for direct DB access |
| vendor_mentions: no RLS (public table) | vendor_mentions: RLS with tier-gated policy | Phase 3 (this phase) | T2-only data cannot be accessed by T1 or unauth vendor sessions |
| All vendor dashboard RPCs: public access | T2 RPCs: internal auth guard | Phase 3 (this phase) | Direct RPC calls return empty for non-T2 vendor sessions |

**Currently public (no RLS on vendor_mentions):** `vendor_mentions` was created by the WAM backend before the migration-managed schema. It has never had RLS enabled. All existing `ALTER TABLE` migrations on it only add columns. [VERIFIED: searched all 120+ migrations for `ENABLE ROW LEVEL SECURITY` on `vendor_mentions` — none found]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Enabling RLS on `vendor_mentions` won't break WAM backend writes (service_role bypasses RLS) | Common Pitfalls | If WAM uses a non-service-role key for writes, inserts would fail after RLS enabled |
| A2 | `DashboardDealerSignals` (WAM API calls) can be frontend-gated without DB-level RLS since it goes through WAM API, not Supabase | T1/T2 split | If WAM API doesn't check vendor tier, T1 vendors could call WAM directly |
| A3 | Admin mode (`?vendor=VendorName`) bypasses RLS appropriately via the `admin-ensure-vendor-profile` Edge Function (service role) | Architecture | If admin mode accidentally uses vendorSupabase, admin would see vendor-scoped data only |

---

## Open Questions

1. **DashboardDealerSignals — WAM API tier enforcement**
   - What we know: `DashboardDealerSignals` calls WAM API (not Supabase). The WAM API uses `X-Password` auth, not vendor JWT.
   - What's unclear: Does WAM API enforce vendor tier? If not, T1 vendors could call the WAM API for dealer signals directly.
   - Recommendation: For Phase 3 v1, gate this section frontend-only. Add to SEC-01 backlog for WAM-side enforcement.

2. **Unverified tier vendors — dashboard access**
   - What we know: `vendor_logins.tier` can be `'unverified'`. VEXP-02 (graceful holding page for unverified) is deferred to v2.
   - What's unclear: Should `unverified` vendors see the dashboard at all, or a blank state?
   - Recommendation: Treat `unverified` as a subset of `tier_1` absence — show no sections, display a "Contact your sales representative" message. Keep simple for v1.

3. **admin mode + RLS interaction**
   - What we know: Admin mode in `VendorDashboardPage` uses `useClerkSupabase()` with the `admin-ensure-vendor-profile` Edge Function (service role). The Edge Function uses service role key which bypasses RLS.
   - What's unclear: When admin views vendor dashboard sections, do those section components use `useClerkSupabase()` correctly (they do currently, but after the `useVendorDataClient` refactor, care must be taken not to return `vendorSupabase` for admin sessions).
   - Recommendation: `useVendorDataClient` must check `isAdminMode` or `isAuthenticated` first before returning `vendorSupabase`. The existing `isVendorAuth && !isAuthenticated` guard in `VendorDashboardPage` is the right condition.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond existing Supabase + React stack, both confirmed operational from Phases 1 and 2).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.57.0 (E2E only; no unit test framework) [VERIFIED: CLAUDE.md] |
| Config file | `playwright.config.ts` (uses Lovable preset; `e2e/` directory) |
| Quick run command | `npx playwright test --grep "vendor-tier"` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIER-01 | T1 vendor cannot read other vendor's data via direct Supabase query | E2E smoke | `npx playwright test e2e/vendor-tier.spec.ts` | No — Wave 0 |
| TIER-02 | T1 vendor sees market intel and segment leaderboard sections | E2E smoke | `npx playwright test e2e/vendor-tier.spec.ts` | No — Wave 0 |
| TIER-03 | T1 vendor does NOT see mentions/dimensions sections; direct RPC returns empty | E2E smoke | `npx playwright test e2e/vendor-tier.spec.ts` | No — Wave 0 |
| TIER-04 | T2 vendor sees mentions, dimensions, action plans | E2E smoke | `npx playwright test e2e/vendor-tier.spec.ts` | No — Wave 0 |
| TIER-05 | Direct Supabase RPC with T1 credentials returns no rows for T2 data | E2E smoke (API) | `npx playwright test e2e/vendor-tier.spec.ts` | No — Wave 0 |
| TIER-06 | Sidebar shows only T1 sections for T1 vendor | E2E smoke | `npx playwright test e2e/vendor-tier.spec.ts` | No — Wave 0 |
| TIER-07 | `vendor_tier()` function exists and returns correct value for test vendor | Manual SQL verification | `SELECT vendor_tier()` as vendor user | Manual |

**Note:** TIER-05 requires a real vendor session in a test environment. Testing DB-level RLS enforcement from Playwright requires using the Supabase JS SDK inside the test with a real vendor JWT. This is complex — consider a simpler manual verification for v1: run `SELECT` on `vendor_mentions` via `psql` as an authenticated vendor user to confirm RLS blocks T2 data for T1 credentials.

### Wave 0 Gaps
- [ ] `e2e/vendor-tier.spec.ts` — covers TIER-01 through TIER-06 with two test vendor accounts (T1 and T2)
- [ ] Two test vendor accounts pre-provisioned in staging Supabase

---

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (handled in Phase 1) | Supabase Auth |
| V3 Session Management | No (handled in Phase 1) | `storageKey: 'vendor-auth'` isolation |
| V4 Access Control | **YES — core of this phase** | RLS policies + `vendor_tier()` SECURITY DEFINER |
| V5 Input Validation | Limited | `p_vendor_name TEXT` inputs to RPCs validated by exact-match from wizard (Phase 2); RLS normalizes with `lower()` |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vendor A calls `get_vendor_dashboard_intel('Vendor B')` | Information Disclosure | SECURITY DEFINER auth guard: if vendor session + name mismatch → return `{}` |
| T1 vendor calls `get_vendor_dimensions('own_name')` directly | Elevation of Privilege | SECURITY DEFINER guard: if vendor session + tier != tier_2 → return `{}` |
| Enabling RLS breaks existing public feed | Denial of Service (unintentional) | Always add anon + Clerk read policy in same migration as ENABLE RLS |
| Clerk client used for vendor data queries (no vendor JWT) | Bypass | `useVendorDataClient` hook returns correct client; vendor JWT required for RLS to fire |
| `vendor_logins` RLS allows vendor to read own row, but `vendor_tier()` calls `vendor_logins` — circular? | Escalation | No circular dependency: `vendor_logins` SELECT policy is `auth.uid() = user_id` (direct UUID check, no function call); `vendor_tier()` reads `vendor_logins` in SECURITY DEFINER context (bypasses RLS on `vendor_logins`) |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `supabase/migrations/20260413000000_create_vendor_logins.sql` — tier values, auth.uid() behavior
- Codebase: `supabase/migrations/20260413100000_admin_list_vendor_logins_rpc.sql` — SECURITY DEFINER pattern for vendor data
- Codebase: `supabase/migrations/20251027135752_cd922597-5dbb-4ef2-815b-71b5c357043d.sql` — `has_role` SECURITY DEFINER pattern
- Codebase: `src/integrations/supabase/vendorClient.ts` — isolated vendor client with `storageKey: 'vendor-auth'`
- Codebase: `src/hooks/useVendorSupabaseAuth.ts` — vendor session lifecycle
- Codebase: `src/pages/VendorDashboardPage.tsx` — current tier fetch and client dispatch logic
- Codebase: All 120+ `supabase/migrations/*.sql` files — confirmed no RLS on `vendor_mentions`

### Secondary (MEDIUM confidence)
- Codebase: `supabase/migrations/20260226100000_vendor_intelligence_platform.sql` — "Public read" policies on `vendor_recommendations`, `vendor_metric_scores` confirm current public-access model
- Codebase: `supabase/migrations/20260312110000_vendor_demo_requests.sql` — existing vendor access pattern using `auth.jwt() ->> 'sub'`

### Tertiary (LOW confidence)
- [ASSUMED] Service role bypass behavior when WAM backend writes to `vendor_mentions` — standard Supabase behavior but not verified in migration scripts for this table specifically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing libraries confirmed from codebase
- Architecture: HIGH — all patterns derived from verified codebase analysis
- Pitfalls: HIGH — all confirmed from direct code inspection (no RLS on vendor_mentions, Clerk client used for vendor queries, casing issues in canonical_vendor_name_case)
- T1/T2 split: MEDIUM — derived from requirements + sidebar section mapping; final UI decisions are Claude's discretion (D-01)
- SECURITY DEFINER audit scope: HIGH for vendor dashboard RPCs; MEDIUM for completeness (full 142-function audit is v2)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable codebase; vendor dashboard architecture unlikely to change)
