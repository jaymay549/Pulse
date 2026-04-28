---
phase: quick
plan: 260428-paj
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260428100000_dashboard_intel_product_line_filter.sql
  - src/hooks/useVendorIntelligenceDashboard.ts
autonomous: true
requirements: [CAR-20]
must_haves:
  truths:
    - "RPC returns parent-level data when called without product line slug (backward compatible)"
    - "RPC returns product-line-specific metrics, gaps, and mentions when called with a valid slug"
    - "Frontend hook passes productLineSlug to the RPC when available"
  artifacts:
    - path: "supabase/migrations/20260428100000_dashboard_intel_product_line_filter.sql"
      provides: "Updated get_vendor_dashboard_intel with optional p_product_line_slug parameter"
      contains: "p_product_line_slug"
    - path: "src/hooks/useVendorIntelligenceDashboard.ts"
      provides: "Hook passes p_product_line_slug to RPC call"
      contains: "p_product_line_slug"
  key_links:
    - from: "src/hooks/useVendorIntelligenceDashboard.ts"
      to: "get_vendor_dashboard_intel RPC"
      via: "supabase.rpc with p_product_line_slug param"
      pattern: "p_product_line_slug.*productLineSlug"
---

<objective>
Extend the `get_vendor_dashboard_intel` RPC to accept an optional `p_product_line_slug` parameter for product-line-level filtering, and re-enable the frontend hook to pass this parameter. This completes CAR-20 (Parent/Child Company Filtering).

Purpose: Vendors with multi-product subscriptions (e.g., Cox Automotive with VinSolutions, Dealertrack) can view intelligence scoped to a specific product line via the dashboard dropdown.
Output: New SQL migration + updated frontend hook.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@supabase/migrations/20260324920000_restore_full_dashboard_intel.sql
@src/hooks/useVendorIntelligenceDashboard.ts
@supabase/migrations/20260304120000_vendor_family_foundation.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration to add p_product_line_slug parameter to get_vendor_dashboard_intel</name>
  <files>supabase/migrations/20260428100000_dashboard_intel_product_line_filter.sql</files>
  <action>
Create a new migration that replaces `get_vendor_dashboard_intel` with a two-parameter overload: `get_vendor_dashboard_intel(p_vendor_name TEXT, p_product_line_slug TEXT DEFAULT NULL)`.

The function must first DROP the old single-param version (since adding a DEFAULT param to an existing function creates an overload, not a replacement, which causes ambiguity). Then CREATE OR REPLACE the new version.

Logic changes when `p_product_line_slug IS NOT NULL`:

1. **Resolve product line:** After the existing entity resolution block, add:
   ```
   v_product_line_id UUID;
   v_product_line_name TEXT;
   v_effective_name TEXT;  -- replaces v_canonical_name in lookups
   ```
   Look up `vendor_product_lines` by slug AND vendor_entity_id:
   ```sql
   IF p_product_line_slug IS NOT NULL AND v_entity_id IS NOT NULL THEN
     SELECT id, name INTO v_product_line_id, v_product_line_name
     FROM public.vendor_product_lines
     WHERE slug = p_product_line_slug AND vendor_entity_id = v_entity_id;
   END IF;
   ```
   Set `v_effective_name := COALESCE(v_product_line_name, v_canonical_name);`

2. **Metrics lookup:** Change `WHERE vendor_name = v_canonical_name` to `WHERE vendor_name = v_effective_name` (product lines like "VinSolutions" have their own rows in `vendor_metric_scores`).

3. **Category/metadata lookup:** Keep using `v_canonical_name` for category (categories are parent-level).

4. **Benchmarks + percentiles:** No change needed (category-level, always parent).

5. **Recommendations:** Pass `v_effective_name` instead of `p_vendor_name` to `get_vendor_actionable_insights(v_effective_name)`.

6. **Feature gaps:** Change `WHERE fg.vendor_name = v_canonical_name` to `WHERE fg.vendor_name = v_effective_name`.

7. **Feature gap supporting quotes:** Add an additional filter when v_product_line_id is not null:
   ```sql
   AND (v_product_line_id IS NULL OR vm.vendor_product_line_id = v_product_line_id)
   ```

8. **Sentiment history:** Add the same product line filter to the vendor_mentions subquery:
   ```sql
   AND (v_product_line_id IS NULL OR vendor_product_line_id = v_product_line_id)
   ```

9. **Return object:** Add `'product_line'` key to the returned jsonb:
   ```sql
   'product_line', CASE WHEN v_product_line_id IS NOT NULL THEN
     jsonb_build_object('id', v_product_line_id, 'name', v_product_line_name, 'slug', p_product_line_slug)
   ELSE NULL END
   ```

10. **GRANT:** `GRANT EXECUTE ON FUNCTION get_vendor_dashboard_intel(TEXT, TEXT) TO authenticated, anon, service_role;`

When `p_product_line_slug IS NULL`, `v_product_line_id` and `v_product_line_name` stay NULL, `v_effective_name` falls back to `v_canonical_name`, and all filters pass through -- identical behavior to before.

Important: The DROP + CREATE must be in the same migration to avoid a window where the function doesn't exist. Use:
```sql
DROP FUNCTION IF EXISTS get_vendor_dashboard_intel(TEXT);
```
before the CREATE OR REPLACE.
  </action>
  <verify>
    <automated>cd /Users/miguel/Pulse/Pulse && grep -c "p_product_line_slug" supabase/migrations/20260428100000_dashboard_intel_product_line_filter.sql</automated>
  </verify>
  <done>Migration file exists with DROP of old single-param function, CREATE of new two-param function with DEFAULT NULL, product line resolution logic, filtered queries for metrics/gaps/mentions, and GRANT statement</done>
</task>

<task type="auto">
  <name>Task 2: Re-enable product line slug parameter in frontend hook</name>
  <files>src/hooks/useVendorIntelligenceDashboard.ts</files>
  <action>
In `src/hooks/useVendorIntelligenceDashboard.ts`, line 114, change the RPC params from:
```ts
{ p_vendor_name: vendorName } as never
```
to:
```ts
{ p_vendor_name: vendorName, p_product_line_slug: productLineSlug ?? null } as never
```

Also add `product_line` to the `VendorDashboardIntel` interface (after `sentiment_history`):
```ts
product_line?: { id: string; name: string; slug: string } | null;
```

And include it in the return mapping inside queryFn (after `sentiment_history`):
```ts
product_line: result.product_line ?? null,
```
  </action>
  <verify>
    <automated>cd /Users/miguel/Pulse/Pulse && grep "p_product_line_slug" src/hooks/useVendorIntelligenceDashboard.ts && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Hook passes productLineSlug to RPC, VendorDashboardIntel type includes product_line field, build succeeds</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Frontend to RPC | productLineSlug comes from user-controlled dropdown |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | p_product_line_slug param | mitigate | RPC looks up slug against vendor_product_lines with vendor_entity_id match -- attacker cannot access unrelated vendor's product line data by injecting arbitrary slugs |
| T-quick-02 | Info Disclosure | sentiment/quotes filtering | mitigate | Product line filter is additive (AND clause) so it can only narrow results, never widen beyond what entity-level access already permits |
</threat_model>

<verification>
1. Deploy migration to Supabase
2. Call RPC without product line slug -- verify identical results to current behavior
3. Call RPC with a known product line slug (e.g., "vinsolutions") -- verify metrics/gaps/mentions are scoped to that product line
4. Frontend: select a product line in the dropdown and confirm dashboard updates with product-line-specific data
</verification>

<success_criteria>
- `get_vendor_dashboard_intel('Cox Automotive')` returns parent-level data (unchanged)
- `get_vendor_dashboard_intel('Cox Automotive', 'vinsolutions')` returns VinSolutions-specific metrics, gaps, and filtered mentions
- Frontend hook includes `p_product_line_slug` in RPC call
- Build passes without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260428-paj-extend-get-vendor-dashboard-intel-rpc-wi/260428-paj-SUMMARY.md`
</output>
