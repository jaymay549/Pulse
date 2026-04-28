# Phase 8: Parent/Child Company Filtering — Research

**Researched:** 2026-04-23
**Domain:** Supabase schema extension, RLS SECURITY DEFINER functions, React state management (product line context), admin wizard extension, vendor dashboard multi-product switching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create a new `vendor_product_subscriptions` junction table linking `vendor_logins.id` to `vendor_product_lines.id` with its own `tier` column (unverified/tier_1/tier_2).
- **D-02:** Keep both account-level tier (`vendor_logins.tier`) and product-specific tier (`vendor_product_subscriptions.tier`). Dashboard reads product-specific tier when a product line is selected; falls back to account tier otherwise.
- **D-03:** Require at least one product subscription per vendor. Admin must create at least one product line subscription during provisioning.
- **D-04:** Extend the existing `VendorWizardDialog` with a new step after tier selection: auto-populate product lines from the selected vendor entity's `vendor_product_lines`, show checkboxes with per-product-line tier selectors.
- **D-05:** Auto-populate product lines from the selected vendor entity.
- **D-06:** Post-provisioning editing via vendor detail view — clicking a vendor in the management list opens a detail panel/page for CRUD on product line subscriptions.
- **D-07:** Vendor management list table shows a badge count (e.g., "3 products") next to each vendor row, clickable to expand/navigate to detail.
- **D-08:** Header dropdown selector showing the active product line name. Switching reloads dashboard data for that product line.
- **D-09:** Default to the first subscribed product line (alphabetically or by creation date) on initial login.
- **D-10:** Individual product lines only in the dropdown — no "All products" aggregate option.
- **D-11:** Frontend passes the selected `product_line_slug` to each RPC call. Stop passing `null` from vendor dashboard components.
- **D-12:** Tier used for component gating is the product-specific tier from `vendor_product_subscriptions`.
- **D-13:** Update ALL vendor dashboard components that call RPCs to pass the active product line slug.
- **D-14:** RLS enforcement — create an RLS-compatible SECURITY DEFINER function (similar to `vendor_tier()`) that checks `vendor_product_subscriptions`.

### Claude's Discretion

- Table schema details for `vendor_product_subscriptions` (columns, constraints, indexes)
- RPC function signature changes and new helper functions
- React state management for active product line (context provider vs hook)
- Wizard step UI layout and validation
- Vendor detail panel/page design
- Migration ordering and data backfill strategy

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 8 builds a per-product-line subscription system on top of the already-solid vendor auth and product line infrastructure from Phases 1–3. The `vendor_product_lines` and `vendor_entities` tables already exist and are populated. The RPCs already accept `p_product_line_slug` and the vendor session auth guard pattern (`vendor_tier()` / `auth_vendor_name()`) is well-established. The gap is (1) the junction table connecting vendor logins to specific product lines with per-product tier, (2) the admin wizard step and detail view for managing those subscriptions, (3) product line state in the vendor dashboard frontend, and (4) threading the active slug through every RPC call.

The key design risk is the React state management choice: the active product line slug must be visible to every dashboard section component without prop-drilling through `VendorDashboardPage` → `VendorDashboardLayout` → each section. A React Context provider co-located with `VendorDashboardPage` is the right pattern given the existing architecture — it mirrors how `VendorTierProvider` already wraps the dashboard.

The RLS guard for product subscriptions follows the exact same `SECURITY DEFINER` pattern as `vendor_tier()`. The critical nuance is that this guard must check both vendor isolation AND product line subscription before allowing RPCs to return data for a requested slug.

**Primary recommendation:** Mirror the `vendor_tier()` / `auth_vendor_name()` pattern precisely for the new subscription guard, use a React Context for active product line state, and thread the slug from that context in all dashboard components without changing their external prop signatures.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.76.1 | Supabase client for RPC calls, table reads | Existing project standard [VERIFIED: codebase] |
| React Context + `useState` | React 18.3.1 | Active product line state shared across dashboard | Mirrors existing `VendorTierProvider` pattern [VERIFIED: codebase] |
| `@tanstack/react-query` | 5.83.0 | Fetching subscriptions, invalidating on mutation | Existing project standard [VERIFIED: codebase] |
| shadcn/ui `Select` | current | Product line dropdown in header | Used in `VendorManagementPage` TierSelect [VERIFIED: codebase] |
| Lucide React | 0.462.0 | Icons for badge, detail view | Existing project standard [VERIFIED: codebase] |
| Framer Motion | 12.26.1 | Animate detail panel opening | Used in `VendorManagementPage` [VERIFIED: codebase] |

### New Surface
| Item | What It Is | Where |
|------|-----------|-------|
| `vendor_product_subscriptions` table | Junction: vendor_logins.id → vendor_product_lines.id + tier | New migration |
| `vendor_product_tier()` SECURITY DEFINER | Returns tier for current vendor + product line slug | New migration |
| `vendor_subscribed_products()` SECURITY DEFINER | Returns product line slugs subscribed by current vendor | New migration |
| `useActiveProductLine` context + hook | Provides/consumes active product line slug + tier | New `src/hooks/` |
| `VendorProductLineSwitcher` component | Header dropdown for switching product lines | New `src/components/vendor-dashboard/` |
| Admin "Product Lines" wizard step | Step 3 in VendorWizardDialog (after tier) | Extend existing file |
| Admin vendor detail panel | Panel/sheet for CRUD on product subscriptions | New admin component |

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
supabase/
└── migrations/
    ├── YYYYMMDDXXXXXX_vendor_product_subscriptions.sql   — table + RLS policies
    └── YYYYMMDDXXXXXX_vendor_product_tier_functions.sql  — SECURITY DEFINER helpers + RPC guard update

src/
├── hooks/
│   └── useActiveProductLine.ts   — context provider + consumer hook
├── components/
│   └── vendor-dashboard/
│       └── VendorProductLineSwitcher.tsx   — header dropdown
│   └── admin/
│       └── vendor-management/
│           └── VendorProductSubscriptionsPanel.tsx   — detail CRUD panel
```

### Pattern 1: SECURITY DEFINER Subscription Guard (replicate vendor_tier())

**What:** A stable, SECURITY DEFINER function that reads `vendor_product_subscriptions` without triggering RLS on that table, returning data scoped to `auth.uid()`.

**When to use:** Inside RPC guards, in RLS policies on tables that need product-line-level scoping.

**The `vendor_tier()` template to replicate:**
```sql
-- Source: supabase/migrations/20260413200000_vendor_tier_function.sql (VERIFIED: codebase)

CREATE OR REPLACE FUNCTION public.vendor_product_tier(p_product_line_slug TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vps.tier
  FROM public.vendor_product_subscriptions vps
  JOIN public.vendor_product_lines vpl ON vpl.id = vps.vendor_product_line_id
  JOIN public.vendor_logins vl ON vl.id = vps.vendor_login_id
  WHERE vl.user_id = auth.uid()
    AND vpl.slug = p_product_line_slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.vendor_product_tier(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_product_tier(TEXT) TO authenticated;
```

And a companion to return all subscribed slugs for the current session:
```sql
CREATE OR REPLACE FUNCTION public.vendor_subscribed_slugs()
RETURNS TABLE(slug TEXT, tier TEXT, product_line_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vpl.slug, vps.tier, vpl.name
  FROM public.vendor_product_subscriptions vps
  JOIN public.vendor_product_lines vpl ON vpl.id = vps.vendor_product_line_id
  JOIN public.vendor_logins vl ON vl.id = vps.vendor_login_id
  WHERE vl.user_id = auth.uid()
  ORDER BY vpl.name ASC;
$$;

REVOKE ALL ON FUNCTION public.vendor_subscribed_slugs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_subscribed_slugs() TO authenticated;
```

### Pattern 2: RPC Guard Update (replicate existing guard pattern)

**What:** Update product-line-aware RPCs so vendor sessions are checked against subscriptions, not just identity.

**Existing guard template (from 20260413400000_t2_rpc_guards.sql):**
```sql
-- Source: supabase/migrations/20260413400000_t2_rpc_guards.sql (VERIFIED: codebase)

IF public.vendor_tier() IS NOT NULL THEN
  IF lower(p_vendor_name) <> lower(public.auth_vendor_name()) THEN
    RETURN empty;
  END IF;
  -- Additional subscription check for product line:
  IF p_product_line_slug IS NOT NULL THEN
    IF public.vendor_product_tier(p_product_line_slug) IS NULL THEN
      RETURN empty;  -- Vendor not subscribed to this product line
    END IF;
  END IF;
END IF;
```

**RPCs needing this guard added/extended:** `get_vendor_pulse_feed_v3`, `get_vendor_profile_v3` (both already accept `p_product_line_slug`; currently no subscription check). Others (`get_vendor_dimensions`, `get_vendor_dashboard_intel`, etc.) do not accept a product line slug yet — they use vendor name isolation only. Phase 8 does not add product line scoping to those RPCs (not in scope per D-11/D-13).

### Pattern 3: React Context for Active Product Line

**What:** A React Context co-located with `VendorDashboardPage` that holds `{ activeSlug, setActiveSlug, activeTier }`. Components consume via a hook. Mirrors existing `VendorTierProvider` in `GatedCard.tsx`.

**Why Context over prop-drilling:** `VendorDashboardPage` currently passes `vendorName` as a prop to 11 section components. Adding `productLineSlug` as a prop to each would also require updating `VendorDashboardLayout` → section children chain. Context avoids this.

**Existing VendorTierProvider pattern to mirror:**
```typescript
// Source: src/components/vendor-dashboard/GatedCard.tsx (VERIFIED: codebase)
// VendorTierProvider wraps the entire dashboard and provides tier via context.
// The new useActiveProductLine context should follow the same co-location pattern.
```

**Proposed hook signature:**
```typescript
// src/hooks/useActiveProductLine.ts
export interface ActiveProductLine {
  slug: string;
  name: string;
  tier: string;  // product-specific tier from vendor_product_subscriptions
}

export interface ActiveProductLineContextValue {
  activeProductLine: ActiveProductLine | null;
  setActiveProductLine: (pl: ActiveProductLine) => void;
  subscriptions: ActiveProductLine[];  // all subscribed product lines
  isLoading: boolean;
}

// Provider wraps VendorDashboardPage content
export function ActiveProductLineProvider({ vendorLoginId, children }: ...)

// Consumer hook
export function useActiveProductLine(): ActiveProductLineContextValue
```

**Query key pattern:** `["vendor-product-subscriptions", vendorLoginId]` — follows existing `["vendor-login-profile", vendorUser?.id]` pattern in `VendorDashboardPage`.

### Pattern 4: Wizard Step Extension

**What:** Add a step 3 ("Products") after the existing tier step (step 2) in `VendorWizardDialog`. Steps become: Email → Profile → Tier → Products → Confirm.

**How wizard currently works:**
- 4 steps (0-indexed: 0=Email, 1=Profile, 2=Tier, 3=Confirm)
- Progress bar: `((step + 1) / 4) * 100`
- `canAdvance` gates each step
- `steps` array labels
- Single `provisionMutation` at step 3

**Extension approach:**
1. Add step 3 = "Products" between current Tier (2) and Confirm (now step 4)
2. Update `steps` array to 5 entries
3. Update progress bar divisor to 5
4. Add `selectedProductLines: Record<productLineId, tier>` state
5. Query `vendor_product_lines` by `vendor_entity_id` when step 2 is completed (vendor entity is known from step 1 search — need to resolve entity from vendor_name)
6. `canAdvance` at step 3: at least one product line checked
7. Pass `product_subscriptions` in `provisionMutation` body

**Entity resolution:** The existing wizard fetches `vendor_profiles` (vendor_name, company_logo_url, category). `vendor_entities` has a `canonical_name` that may match or diverge from `vendor_profiles.vendor_name`. The query for product lines must join via `vendor_entities` → `vendor_product_lines` using `vendor_entity_id`. The existing `resolve_vendor_family()` RPC resolves a vendor name to an entity ID — use this, or query `vendor_entities` directly by canonical_name match against the selected vendor profile name.

**Simpler approach:** After selecting the vendor name in step 1, call `resolve_vendor_family(vendorName)` RPC to get `vendor_entity_id`, then query `vendor_product_lines WHERE vendor_entity_id = ?`. If the entity is not found, show a message "No product lines configured for this vendor."

### Pattern 5: Admin vendor detail panel

**What:** Clicking a vendor row (or the "N products" badge) opens a side panel (Sheet from shadcn/ui) showing current product subscriptions with the ability to add/remove/change tier. This panel is separate from the provisioning wizard — it handles post-provisioning edits.

**Pattern:** Uses `Sheet` component (already used in `VendorDashboardLayout` for mobile sidebar). Query `vendor_product_subscriptions JOIN vendor_product_lines WHERE vendor_logins.vendor_name = ?`. Each row shows product line name, current tier (editable select), and a delete button.

### Anti-Patterns to Avoid

- **Do NOT prop-drill `productLineSlug` through VendorDashboardLayout:** The layout component has no need to know about product line — keep that concern in VendorDashboardPage and the Context.
- **Do NOT query vendor_product_subscriptions directly from vendor session components:** All reads must go through the SECURITY DEFINER function or via the `useActiveProductLine` hook (which uses the vendorClient). Direct table reads will fail because RLS on `vendor_product_subscriptions` depends on `vendor_logins.user_id = auth.uid()` and the join.
- **Do NOT skip the subscription guard in product-line-scoped RPCs:** A vendor session passing a product_line_slug they don't own would return data from another vendor's product line if only the vendor name isolation guard is applied. The subscription check is additive to the name isolation check.
- **Do NOT change the query key shape for existing queries without including productLineSlug:** Queries like `["vendor-recent-mentions", vendorName]` in `DashboardOverview` must become `["vendor-recent-mentions", vendorName, productLineSlug]` when productLineSlug is wired in, or stale data from a different product line will be served.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase row-level auth helper | Custom auth check in RPC | SECURITY DEFINER function (vendor_tier() pattern) | Avoids circular dependency on vendor_logins RLS; established pattern in this codebase |
| Product line state propagation | Props through layout → sections | React Context (ActiveProductLineProvider) | 11 section components would all need new props; context is the established pattern (VendorTierProvider) |
| Product line switcher dropdown | Custom select element | shadcn/ui `Select` | Already used in TierSelect in VendorManagementPage; consistent styling |
| Post-provisioning edit modal | Custom dialog | shadcn/ui `Sheet` | Already used in VendorDashboardLayout for mobile sidebar; correct pattern for side panels |
| Subscription CRUD | Direct table mutations from frontend | Supabase client calls from admin (Clerk client, not vendorClient) | Admin uses clerk-scoped client; vendor_product_subscriptions needs service-role for admin writes |

**Key insight:** The `vendor_tier()` SECURITY DEFINER pattern is the critical architectural building block for this phase. Every product-level auth check should route through the same pattern — creating a new function rather than embedding raw SQL in RPCs keeps the auth logic composable and auditable.

---

## Runtime State Inventory

This is not a rename/refactor phase. Omitted.

---

## Common Pitfalls

### Pitfall 1: vendor_logins.id vs vendor_logins.user_id in the junction table

**What goes wrong:** Using `user_id` (Supabase Auth UUID) as the FK in `vendor_product_subscriptions` instead of `vendor_logins.id` (the table's own PK). D-01 specifies `vendor_logins.id`.

**Why it happens:** The confusion between the auth UUID (`user_id`) and the table's PK (`id`) is easy to make. `vendor_tier()` uses `WHERE user_id = auth.uid()` because it looks up by session. The subscription table should FK to `vendor_logins.id` (the row PK) so subscriptions survive user re-provisioning if the auth UUID changes.

**How to avoid:** In `vendor_product_subscriptions`, the FK is `vendor_login_id UUID REFERENCES public.vendor_logins(id) ON DELETE CASCADE`. In SECURITY DEFINER functions, bridge via `JOIN vendor_logins vl ON vl.id = vps.vendor_login_id WHERE vl.user_id = auth.uid()`.

**Warning signs:** Query returns no rows even though subscriptions exist — check whether you're joining on `user_id` vs `id`.

### Pitfall 2: React Query cache staleness when switching product lines

**What goes wrong:** Vendor switches from VinSolutions (T2) to DealerTrack (T1). The DashboardDimensions component renders but shows VinSolutions data because the query key `["vendor-dimensions", vendorName]` didn't include `productLineSlug`.

**Why it happens:** All dashboard queries currently use `vendorName` as the cache discriminator. When `productLineSlug` is introduced, every query that calls a product-line-aware RPC must include the slug in its `queryKey`.

**How to avoid:** Update `queryKey` arrays in all affected dashboard component hooks: `["vendor-recent-mentions", vendorName, productLineSlug]`, `["vendor-sentiment-history", vendorName, productLineSlug]`, etc. The slug comes from `useActiveProductLine()`.

**Warning signs:** Switching product lines doesn't update data; data appears correct on first load but stale after switching.

### Pitfall 3: Wizard step count and progress bar off-by-one

**What goes wrong:** Wizard has 5 steps after the extension but progress bar still divides by 4. The "Products" step shows 120% width. Or the `canAdvance` logic at step 3 is incorrect because it still checks for `step < 3` instead of `step < 4`.

**Why it happens:** The wizard has multiple places that encode the step count: `steps` array, progress bar divisor, `canAdvance` condition, `step < 3` gates for the Continue button. All must be updated together.

**How to avoid:** Derive step count from `steps.length` everywhere instead of hardcoding 4. Specifically: `width: ${((step + 1) / steps.length) * 100}%` and `step < steps.length - 1`.

**Warning signs:** Progress bar overflows; Continue button visible at final confirmation step.

### Pitfall 4: vendor_product_lines not populated for vendor entity

**What goes wrong:** Admin selects Cox Automotive as the vendor profile in step 1, but the product lines step shows empty — no checkboxes appear.

**Why it happens:** `vendor_product_lines` rows may not exist for the selected vendor entity if that entity has not been seeded with product line records. The wizard queries by `vendor_entity_id` resolved from the vendor profile name, but no product lines exist.

**How to avoid:** Show a clear message ("No product lines configured for this vendor — contact engineering to add them.") rather than silently showing an empty step. The "at least one product" validation (D-03) should only apply if product lines exist; if none exist, surface the gap explicitly.

**Warning signs:** Empty product lines step with no error message; admin proceeds through wizard creating a subscription-less vendor.

### Pitfall 5: product-specific tier vs account tier confusion in VendorDashboardPage

**What goes wrong:** After implementing `useActiveProductLine`, the `vendorTier` variable in `VendorDashboardPage` still reads from `vendorLoginProfile.tier` (account-level tier) instead of the product-specific tier. Dashboard components use account tier instead of product tier for component gating.

**Why it happens:** `VendorDashboardPage` has a multi-source tier resolution block (lines 159-161 in current code). Adding product-specific tier requires overriding this resolution when a product line is active.

**How to avoid:** Per D-02, when a product line is active, use `activeProductLine.tier` from `useActiveProductLine()`. The existing fallback chain (lines 159-161) should become: product-specific tier (if product line active) → `vendorLoginProfile.tier` → `resolvedTier` → `undefined`.

**Warning signs:** T1 vendor with T2 product line sees T1 gating; T2 vendor with T1 product line sees full T2 access.

### Pitfall 6: Admin writes to vendor_product_subscriptions must use Clerk client (not vendorClient)

**What goes wrong:** The admin provisioning wizard or the detail panel uses `vendorSupabase` (the magic-link client) to insert into `vendor_product_subscriptions`, which fails because the vendor session is not active during admin provisioning.

**Why it happens:** The codebase has two clients: `vendorSupabase` for vendor sessions and `clerkSupabase` / the edge function for admin operations. Admin writes should go through the `provision-vendor` Edge Function (service role) or through `useClerkSupabase()`.

**How to avoid:** The provisioning wizard's `provisionMutation` already calls the `provision-vendor` Edge Function. Extend that Edge Function's `provision` action to accept and insert `product_subscriptions`. The detail panel CRUD should use `useClerkSupabase()` with admin RPC calls (same pattern as `admin_update_vendor_tier` RPC).

---

## Code Examples

### vendor_product_subscriptions table migration
```sql
-- Source: Architecture based on vendor_logins migration pattern (VERIFIED: codebase)
CREATE TABLE public.vendor_product_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_login_id UUID NOT NULL REFERENCES public.vendor_logins(id) ON DELETE CASCADE,
  vendor_product_line_id UUID NOT NULL REFERENCES public.vendor_product_lines(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'unverified'
    CHECK (tier IN ('unverified', 'tier_1', 'tier_2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_login_id, vendor_product_line_id)  -- no duplicate subscriptions
);

CREATE INDEX idx_vendor_product_subscriptions_login
  ON public.vendor_product_subscriptions(vendor_login_id);

CREATE INDEX idx_vendor_product_subscriptions_product_line
  ON public.vendor_product_subscriptions(vendor_product_line_id);

ALTER TABLE public.vendor_product_subscriptions ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own subscriptions (for the product line switcher query)
CREATE POLICY "Vendor can read own subscriptions"
  ON public.vendor_product_subscriptions FOR SELECT TO authenticated
  USING (
    vendor_login_id IN (
      SELECT id FROM public.vendor_logins WHERE user_id = auth.uid()
    )
  );

-- Admin writes go through service-role Edge Function; no authenticated INSERT policy needed.
```

### Fetching product lines for wizard step (from Supabase)
```typescript
// Source: Pattern derived from existing wizard vendor_profiles query (VERIFIED: codebase)
// In VendorWizardDialog, after vendor entity is resolved:
const { data: productLines } = useQuery({
  queryKey: ["vendor-product-lines-for-entity", entityId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("vendor_product_lines")
      .select("id, name, slug")
      .eq("vendor_entity_id", entityId)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
  enabled: !!entityId,
});
```

### Reading active product line subscriptions in vendor dashboard
```typescript
// Source: Pattern follows vendor-login-profile query in VendorDashboardPage (VERIFIED: codebase)
const { data: subscriptions } = useQuery({
  queryKey: ["vendor-product-subscriptions", vendorUser?.id],
  queryFn: async () => {
    const { data, error } = await vendorSupabase
      .rpc("vendor_subscribed_slugs" as never);
    if (error) throw error;
    return (data ?? []) as Array<{ slug: string; tier: string; product_line_name: string }>;
  },
  enabled: isVendorAuth && !!vendorUser?.id,
});
```

### VendorProductLineSwitcher header dropdown
```typescript
// Source: Pattern from TierSelect in VendorManagementPage.tsx (VERIFIED: codebase)
// Uses shadcn/ui Select; compact; calls setActiveProductLine from context
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProductLine } from "@/hooks/useActiveProductLine";

export function VendorProductLineSwitcher() {
  const { activeProductLine, setActiveProductLine, subscriptions } = useActiveProductLine();
  if (subscriptions.length <= 1) return null;  // hide if only one product line

  return (
    <Select
      value={activeProductLine?.slug ?? ""}
      onValueChange={(slug) => {
        const found = subscriptions.find((s) => s.slug === slug);
        if (found) setActiveProductLine(found);
      }}
    >
      <SelectTrigger className="h-8 text-xs ...">
        <SelectValue placeholder="Select product line" />
      </SelectTrigger>
      <SelectContent>
        {subscriptions.map((s) => (
          <SelectItem key={s.slug} value={s.slug}>
            {s.product_line_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Tier resolution in VendorDashboardPage with product-specific tier
```typescript
// Source: Extends existing tier resolution block (lines 159-161 in VendorDashboardPage.tsx) (VERIFIED: codebase)
// After useActiveProductLine is called:
const { activeProductLine } = useActiveProductLine();

const vendorTier = (isAdminMode && !adminVendorView)
  ? undefined
  : activeProductLine?.tier         // product-specific tier (D-12)
    || vendorLoginProfile?.tier      // account-level fallback (D-02)
    || resolvedTier
    || undefined;
```

### Admin RPC for product subscription CRUD
```sql
-- Source: Pattern from admin_update_vendor_tier.sql (VERIFIED: codebase via migration listing)
CREATE OR REPLACE FUNCTION public.admin_upsert_product_subscription(
  p_vendor_name TEXT,
  p_product_line_slug TEXT,
  p_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login_id UUID;
  v_product_line_id UUID;
BEGIN
  -- Resolve vendor_login_id from vendor_name (take first matching row)
  SELECT id INTO v_login_id
  FROM public.vendor_logins
  WHERE vendor_name = p_vendor_name
  LIMIT 1;
  IF v_login_id IS NULL THEN
    RAISE EXCEPTION 'No vendor login found for vendor_name: %', p_vendor_name;
  END IF;

  -- Resolve product line id from slug
  SELECT id INTO v_product_line_id
  FROM public.vendor_product_lines
  WHERE slug = p_product_line_slug;
  IF v_product_line_id IS NULL THEN
    RAISE EXCEPTION 'No product line found for slug: %', p_product_line_slug;
  END IF;

  INSERT INTO public.vendor_product_subscriptions
    (vendor_login_id, vendor_product_line_id, tier, updated_at)
  VALUES
    (v_login_id, v_product_line_id, p_tier, now())
  ON CONFLICT (vendor_login_id, vendor_product_line_id)
  DO UPDATE SET tier = EXCLUDED.tier, updated_at = now();
END;
$$;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded tier from `vendor_logins.tier` | Product-specific tier from `vendor_product_subscriptions.tier` | Phase 8 | Enables per-product access control |
| All RPCs pass `p_product_line_slug: null` from dashboard | Pass actual active slug from context | Phase 8 | Data filtered to subscribed product |
| No product subscription gate on RPCs | Subscription check in SECURITY DEFINER guard | Phase 8 | Defense in depth: vendor can't read unsubscribed product data |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vendor_product_lines` rows are already seeded for at least some vendor entities in the live DB | Code Examples (wizard step query) | Wizard product lines step will show empty for all vendors; need a data seeding task |
| A2 | The `vendor_entities` canonical_name matches closely enough to `vendor_profiles.vendor_name` for `resolve_vendor_family()` to succeed for wizard vendors | Architecture Patterns (Pattern 4) | Entity lookup returns NULL; product lines step has no data to display |
| A3 | All vendor logins have exactly one `vendor_logins` row per vendor (the existing code groups by `vendor_name` but takes `primary = logins[0]`) | Code Examples (admin RPC) | `admin_upsert_product_subscription` needs to handle multi-login vendors — the subscription should be per-login-id, not per-vendor-name |

**Note on A3:** `vendor_product_subscriptions` FK is to `vendor_logins.id` (per D-01). A vendor with 2 emails = 2 vendor_login rows. The admin detail panel must show and manage subscriptions per login row, or copy subscriptions across all logins for the same vendor name. The wizard creates one login per provisioning — so provisioned subscriptions apply to that login's row. Post-provisioning via the detail panel should also be per-login-id. This needs a clarifying decision from the planner.

---

## Open Questions

1. **Multi-login subscription sharing**
   - What we know: Multiple `vendor_logins` rows can share the same `vendor_name` (e.g., different email contacts at the same company). `vendor_product_subscriptions` FKs to `vendor_logins.id`.
   - What's unclear: Should product subscriptions apply to all logins for a vendor name, or each login independently? The admin detail panel shows vendor groups — if both employees of VinSolutions share a subscription, the data model requires duplicate rows or a different FK design (FK to vendor entity instead of login).
   - Recommendation: Phase 8 per D-01 is clear that FK is `vendor_logins.id`. This is "per-login" subscriptions. The admin detail panel should manage subscriptions per individual login row. If admin wants all logins to have the same subscriptions, they do it row by row. Flag this to user if it causes friction.

2. **Product line switcher visibility when only 1 product**
   - What we know: D-10 says individual product lines only, D-08 says header dropdown. D-09 says default to first.
   - What's unclear: If a vendor has only 1 subscription, should the switcher be hidden (no choice to make) or shown anyway (for consistency)?
   - Recommendation: Hide the switcher when `subscriptions.length <= 1` to avoid visual noise. Show a simple label ("VinSolutions") in the header instead if needed.

3. **Entity ID resolution in wizard**
   - What we know: The wizard currently searches `vendor_profiles` (not `vendor_entities`). `vendor_entities.canonical_name` may differ from `vendor_profiles.vendor_name`.
   - What's unclear: Is there a reliable join between `vendor_profiles` and `vendor_entities`?
   - Recommendation: Call `resolve_vendor_family(vendorName)` RPC (already exists) to get entity_id from the selected vendor name. This is the same resolution path used by the mention pipeline. If it returns NULL, show "Product lines not available for this vendor."

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code and migration changes only. No new external tools, services, or runtimes required. Supabase and the existing project stack are already confirmed available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.57.0 (E2E only; no unit test framework) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --headed` (manual, targeted) |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | `vendor_product_subscriptions` table exists with correct schema and FK constraints | manual-only (DB inspection) | `psql -c "\d vendor_product_subscriptions"` | N/A |
| D-04/D-05 | Wizard shows product line step with checkboxes after tier selection | E2E (manual) | `npx playwright test --grep "wizard product"` | ❌ Wave 0 |
| D-07 | Vendor row shows product count badge | E2E (manual) | `npx playwright test --grep "vendor badge"` | ❌ Wave 0 |
| D-08/D-09 | Header dropdown shows first product line on login | E2E (manual) | `npx playwright test --grep "product switcher"` | ❌ Wave 0 |
| D-11/D-13 | Dashboard components pass slug to RPCs (not null) | Manual (network inspector) | — | N/A |
| D-14 | Vendor cannot access unsubscribed product line data | Manual (vendor session + curl) | — | N/A |

No unit test framework is configured. Primary validation for this phase is: (1) migration applies cleanly, (2) wizard provisions vendor with product subscriptions, (3) vendor dashboard loads correct product line on login, (4) switching product lines reloads data with correct slug.

### Sampling Rate
- **Per task commit:** Manual browser smoke test (login as vendor, confirm product switcher appears with correct product lines)
- **Per wave merge:** Full E2E suite if Playwright tests created in Wave 0
- **Phase gate:** All D-decisions manually verified before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/vendor-product-switcher.spec.ts` — covers D-08, D-09, D-13
- [ ] `tests/admin-wizard-product-step.spec.ts` — covers D-04, D-05
- [ ] No test infrastructure gaps for Playwright (already configured)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing Supabase magic-link auth unchanged |
| V3 Session Management | no | Existing vendor session unchanged |
| V4 Access Control | **YES** | SECURITY DEFINER subscription guard (`vendor_product_tier()`); RLS on `vendor_product_subscriptions` |
| V5 Input Validation | **YES** | `p_product_line_slug` input to RPCs — validated by slug lookup returning NULL (not found = blocked) |
| V6 Cryptography | no | No new crypto surfaces |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vendor passes product_line_slug they don't own to RPC | Elevation of Privilege | `vendor_product_tier(slug)` returns NULL → RPC returns empty rows (D-14) |
| Vendor guesses another vendor's product line slug | Information Disclosure | Vendor isolation guard (existing) + subscription check (new) blocks cross-vendor + cross-product reads |
| Admin writes product subscription with invalid tier | Tampering | CHECK constraint on `vendor_product_subscriptions.tier` column |

**Defense in depth layers:**
1. Frontend: product line switcher only shows subscribed product lines (can't select unsubscribed)
2. SECURITY DEFINER function: `vendor_product_tier(slug)` returns NULL for unsubscribed
3. RPC guard: returns empty rows if subscription check fails
4. RLS on `vendor_product_subscriptions`: vendor can only read own rows

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260413200000_vendor_tier_function.sql` — vendor_tier() and auth_vendor_name() SECURITY DEFINER pattern [VERIFIED: codebase read]
- `supabase/migrations/20260413400000_t2_rpc_guards.sql` — RPC guard pattern for vendor session isolation [VERIFIED: codebase read]
- `supabase/migrations/20260304120000_vendor_family_foundation.sql` — vendor_entities, vendor_product_lines schema and RPCs [VERIFIED: codebase read]
- `supabase/migrations/20260413000000_create_vendor_logins.sql` — vendor_logins table schema and RLS [VERIFIED: codebase read]
- `src/components/vendor-dashboard/GatedCard.tsx` — VendorTierProvider context pattern [VERIFIED: codebase (import in VendorDashboardPage)]
- `src/pages/VendorDashboardPage.tsx` — multi-source tier resolution, query keys, section rendering [VERIFIED: codebase read]
- `src/pages/admin/VendorManagementPage.tsx` — admin table pattern, TierSelect, Sheet usage [VERIFIED: codebase read]
- `src/components/admin/vendor-management/VendorWizardDialog.tsx` — current 4-step wizard [VERIFIED: codebase read]
- `src/hooks/useSupabaseVendorData.ts` — productLineSlug passing pattern, RPC fallback chain [VERIFIED: codebase read]
- `src/hooks/useVendorDataClient.ts` — vendorSupabase vs clerkSupabase dispatch [VERIFIED: codebase read]
- `supabase/functions/provision-vendor/index.ts` — Edge Function pattern for admin writes [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- None required — all critical patterns verified directly in codebase.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified in codebase
- Architecture: HIGH — all patterns derived from existing working code in codebase
- Pitfalls: HIGH — derived from reading actual implementation details (step count encoding, query key patterns, client dispatch logic)

**Research date:** 2026-04-23
**Valid until:** 2026-06-01 (stable codebase; patterns won't change unless migrations modify the functions listed above)
