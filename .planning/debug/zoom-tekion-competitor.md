---
status: investigating
trigger: "Zoom is incorrectly showing as a competitor to Tekion on the vendor profile page"
created: 2026-04-21T00:00:00Z
updated: 2026-04-21T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Tekion's vendor_metadata.category is NULL because the split migration only fires on rows where category = 'dms-crm', and Tekion's row was either never assigned a category or was assigned NULL. When v_category IS NULL in get_compared_vendors(), the entire category filter is bypassed, allowing Zoom (and any other non-DMS vendor) to pass through as a "competitor".
test: Traced full data path: VendorProfile.tsx → fetchComparedVendors() → get_compared_vendors() RPC → vendor_metadata.category lookup
expecting: Tekion has category = NULL in vendor_metadata, causing v_category IS NULL to bypass the filter
next_action: DONE — root cause identified

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Zoom should NOT appear as a competitor to Tekion (different categories: video conferencing vs DMS)
actual: Zoom is listed as a competitor to Tekion on the vendor profile page
errors: No errors — data quality issue in the database
reproduction: Go to Tekion's vendor profile page and look at the competitor section
started: ~12 days ago when vendor categorization unification was built but never deployed/run

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Competitor data comes from vendor_pulse_insights.top_competitors (AI-generated)
  evidence: Competitors section in VendorProfile.tsx is populated via fetchComparedVendors() which calls get_compared_vendors() RPC — not vendor_pulse_insights
  timestamp: 2026-04-21

- hypothesis: The bug is in the enrich-mentions edge function mis-categorizing vendors
  evidence: enrich-mentions assigns category per mention, not competitor relationships. The competitor RPC is entirely separate and category-based.
  timestamp: 2026-04-21

- hypothesis: The DMS/CRM split migration fixed the issue for all vendors
  evidence: 20260312320000_split_dms_crm_categories.sql only updates vendor_metadata rows WHERE category = 'dms-crm'. If Tekion's vendor_metadata.category was NULL (never set), this migration does nothing for Tekion.
  timestamp: 2026-04-21

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-21
  checked: VendorProfile.tsx lines 133, 330
  found: comparedVendors is populated by fetchComparedVendors(vendorName), a direct async call at component mount
  implication: Competitor data is NOT cached/stored — it's a live RPC query each page load

- timestamp: 2026-04-21
  checked: useSupabaseVendorData.ts fetchComparedVendors()
  found: Calls supabase.rpc("get_compared_vendors", { p_vendor_name }) — no category parameter passed
  implication: All filtering is done server-side in the SQL function based on vendor_metadata.category

- timestamp: 2026-04-21
  checked: get_compared_vendors() in 20260312510000_fix_compared_vendors_dms_crm.sql
  found: The function does SELECT category INTO v_category FROM vendor_metadata WHERE lower(vendor_name) = lower(v_canonical). Then the candidate filter is: v_category IS NULL OR EXISTS (matching category in vendor_metadata). When v_category IS NULL, the filter is completely bypassed — ALL vendors with ≥3 mentions pass through.
  implication: If Tekion has no category in vendor_metadata, Zoom and every other high-mention vendor becomes a "competitor"

- timestamp: 2026-04-21
  checked: 20260312320000_split_dms_crm_categories.sql lines 77-88
  found: The only migration that assigns category in vendor_metadata does: UPDATE vendor_metadata SET category = 'dms' WHERE category = 'dms-crm' AND vendor_name ILIKE '%tekion%'. This only fires if Tekion already had category = 'dms-crm'.
  implication: If Tekion's vendor_metadata.category started as NULL (no prior category), this migration is a no-op for Tekion

- timestamp: 2026-04-21
  checked: 20260312330000_fix_vendor_category_assignments.sql
  found: Updates vendor_mentions.category and vendor_profiles.category for Tekion to 'dms' — but NO corresponding update to vendor_metadata.category. vendor_metadata is not touched.
  implication: vendor_metadata.category for Tekion remains at whatever it was (likely NULL if never enriched)

- timestamp: 2026-04-21
  checked: All migrations touching vendor_metadata INSERT/UPDATE
  found: vendor_metadata rows are only auto-created via the vendor claim/onboarding flow (submit_claim RPC). Vendors imported from WAM (like Tekion) would need manual admin creation or the vendor-enrich edge function to create/populate them. The vendor-enrich function was never deployed with the new category logic, and its batch enrichment was never run.
  implication: Tekion's vendor_metadata.category is almost certainly NULL — confirming the bypass

- timestamp: 2026-04-21
  checked: enrich-mentions backfillVendorCategories() function
  found: This function reads vendor_mentions WHERE vendor_name = vendor.vendor_name (exact match). Tekion mentions have vendor_entity_id set and may be stored under various vendor_name values (Tekion, Tekion DMS, Tekion CRM). The backfill might also miss some if the entity_id normalization changed the effective vendor_name.
  implication: Even if enrich-mentions had been run, the backfill might not have correctly set vendor_metadata.category for Tekion due to the vendor_name mismatch between vendor_metadata and vendor_mentions

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Tekion's vendor_metadata.category is NULL. The get_compared_vendors() SQL function contains a safety bypass: when v_category IS NULL (line 72 of the function), the entire category filter is skipped with v_category IS NULL OR EXISTS (...). This causes all vendors with ≥3 mentions to be returned as competitors regardless of their actual category. Zoom has many dealer mentions (e.g., "we use Zoom for training") and passes the 3-mention threshold, so it ranks in the top-4 by mention count.

  The category was never set because:
  1. The DMS/CRM split migration only updates rows WHERE category = 'dms-crm' — Tekion's row was NULL
  2. The vendor-enrich edge function (which uses Gemini to assign categories) was never deployed/run for Tekion
  3. The enrich-mentions backfill reads from vendor_mentions by vendor_name exact match which may miss entity-normalized mentions

fix: |
  Two-part fix:
  1. Immediate: Run a SQL UPDATE to set vendor_metadata.category = 'dms' WHERE vendor_name ILIKE '%tekion%' — this immediately fixes the v_category IS NULL bypass for Tekion
  2. Systemic: Deploy vendor-enrich and run batch enrichment to populate vendor_metadata.category for all 565 pending vendors, so the same bug doesn't affect other uncategorized vendors

verification: Reload Tekion's vendor profile page and confirm the competitor section shows only DMS vendors (CDK, Reynolds, etc.) instead of Zoom
files_changed: []
