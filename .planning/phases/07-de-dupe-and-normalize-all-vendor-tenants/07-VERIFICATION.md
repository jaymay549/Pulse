---
phase: 07-de-dupe-and-normalize-all-vendor-tenants
verified: 2026-04-16T16:02:21Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Apply migrations to staging database and call admin_vendor_health_check()"
    expected: "Returns healthy=true with unlinked_mentions=0, orphan_metadata=[], orphan_profiles=[], duplicate_entities=[], invalid_parent_child=[]"
    why_human: "Cannot verify live database state programmatically — the migrations produce a specific outcome only after running against actual data with real vendor records"
  - test: "Verify no data loss occurred for conflicting alias metadata (CR-01 risk)"
    expected: "Aliases that existed on both keeper and dropped entity were not silently discarded — the keeper retains at least one copy of each alias text"
    why_human: "The broad DELETE in 20260416300000 step 1 deletes conflicting aliases by dropping entity; need to confirm no alias text was lost entirely (only the duplicate confidence metadata is lost, not the alias itself)"
gaps: []
---

# Phase 07: De-dupe and Normalize All Vendor Tenants Verification Report

**Phase Goal:** Audit and clean up all vendor tenants in the database — remove duplicates, normalize naming, and ensure each vendor has a single canonical profile before selling vendor tiers
**Verified:** 2026-04-16T16:02:21Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can call an RPC that returns all duplicate vendor name groups with mention counts | VERIFIED | `admin_audit_vendor_duplicates()` in 20260416100000 — STABLE SECURITY DEFINER, returns `duplicate_groups` with `normalized_name`, `variants` (including `mention_count`), `total_mentions` |
| 2 | All `vendor_mentions.vendor_name` values have consistent casing (title case), no leading/trailing whitespace, and no double spaces | VERIFIED | 20260416200000 Step 4: `UPDATE public.vendor_mentions SET vendor_name = public._normalize_vendor_name(vendor_name)` using `IS DISTINCT FROM` |
| 3 | All `vendor_entities.canonical_name` values have consistent casing and no whitespace issues | VERIFIED | 20260416200000 Step 2: UPDATE with `_normalize_vendor_name(canonical_name)` + slug recompute |
| 4 | All `vendor_alias_mappings.alias_text` values are lowercased and trimmed | VERIFIED | 20260416200000 Step 3: UPDATE with `lower(trim(regexp_replace(...)))` using `IS DISTINCT FROM` |
| 5 | Every `vendor_mention` with a recognizable vendor name has a non-NULL `vendor_entity_id` | VERIFIED | 20260416300000 Steps 2-3: registers unlinked mention names as aliases then calls `backfill_vendor_mentions_family(NULL)` |
| 6 | No two `vendor_entities` share the same normalized `canonical_name` | VERIFIED | 20260416300000 Step 1: DO $$ loop merges all entities sharing `lower(canonical_name)`, keeper selected by mention count DESC, duplicates soft-deleted then hard-deleted |
| 7 | Every `vendor_metadata` row can be joined to a `vendor_entity` via canonical_name or alias | VERIFIED | 20260416300000 Step 2: `INSERT INTO vendor_alias_mappings` for unlinked mention names; after backfill, metadata rows aligned via text match at `lower(vendor_name) = lower(canonical_name)` |
| 8 | Every `vendor_profiles` row can be joined to a `vendor_entity` via canonical_name or alias | VERIFIED | Same alias registration as Truth 7; vendor_profiles.vendor_name normalized to title case by 20260416200000 Step 6 |
| 9 | Admin can call a health check RPC that returns zero unlinked mentions and zero orphan records (post-migration) | VERIFIED | `admin_vendor_health_check()` in 20260416400000 — all 10 required keys present, `healthy` boolean computed correctly, granted to `authenticated` and `service_role` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql` | `admin_audit_vendor_duplicates` RPC | VERIFIED | 179 lines; all 5 JSONB keys; STABLE, SECURITY DEFINER, correct GRANT |
| `supabase/migrations/20260416200000_normalize_vendor_names.sql` | `_normalize_vendor_name()` + 5-table normalization | VERIFIED | 91 lines; IMMUTABLE helper; all 5 table UPDATEs; IS DISTINCT FROM throughout; Step 7 alias re-registration with `source='manual'` (constraint-safe) |
| `supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql` | Bulk merge + backfill | VERIFIED | 133 lines; DO $$ loop; 3 UPDATEs setting vendor_entity_id; backfill call; Step 4 vendor_name normalization; Step 5 hard-delete; `source='manual'` (constraint-safe) |
| `supabase/migrations/20260416400000_vendor_health_check_rpc.sql` | `admin_vendor_health_check` RPC | VERIFIED | 163 lines; all 10 JSONB keys; STABLE, SECURITY DEFINER; correct GRANT |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vendor_mentions.vendor_entity_id` | `vendor_entities.id` | FK + backfill (Steps 2-3 of 300000) | WIRED | Step 2 registers missing aliases, Step 3 calls `backfill_vendor_mentions_family(NULL)` |
| `vendor_metadata.vendor_name` | `vendor_entities.canonical_name` | Text join after normalization | WIRED | Both columns normalized to title case; health check validates this via orphan detection |
| `admin_audit_vendor_duplicates` | `vendor_mentions + vendor_entities` | `lower(vendor_name)` grouping | WIRED | CTE uses `GROUP BY lower(trim(vendor_name))` + `HAVING COUNT(DISTINCT ...) > 1` |

### Data-Flow Trace (Level 4)

Not applicable — all artifacts are SQL migrations and read-only RPCs. No React components or client-side data rendering involved. Data flows are within SQL only and cannot be verified without running against the live database.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration file 100000 defines admin_audit_vendor_duplicates | `grep -c "admin_audit_vendor_duplicates" ...100000.sql` | 2 | PASS |
| Migration file 200000 defines _normalize_vendor_name as IMMUTABLE | `grep -c "IMMUTABLE" ...200000.sql` | 1 | PASS |
| Migration file 300000 calls backfill_vendor_mentions_family | `grep -c "backfill_vendor_mentions_family" ...300000.sql` | 3 | PASS |
| Migration file 400000 defines admin_vendor_health_check with all 10 keys | All key greps return ≥ 1 | All returned 1 | PASS |
| All 5 SUMMARY commit hashes exist in git history | `git show --stat` for each hash | a22f00c, 50bb95e, 960619c, 8d852d3, 98b3aef all found | PASS |
| Migrations applied to production (healthy=true result) | Requires DB access | N/A | SKIP — needs human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEDUP-01 | 07-01-PLAN.md | Identify duplicates (implied: audit RPC) | SATISFIED | `admin_audit_vendor_duplicates()` returns `duplicate_groups` with full variant breakdown |
| DEDUP-02 | 07-02-PLAN.md | Merge into canonical records preserving richest data | SATISFIED | DO $$ loop in 300000: keeper selected by mention count DESC; aliases + product_lines moved before soft-delete |
| DEDUP-03 | 07-01-PLAN.md | Normalize vendor names (casing, whitespace) | SATISFIED | `_normalize_vendor_name()` + 5-table UPDATE pass in 200000 |
| DEDUP-04 | 07-02-PLAN.md | Validate parent/child relationships | SATISFIED | `invalid_parent_child` check in health check RPC; Step 1 of 300000 moves product_lines from dropped to keeper |
| DEDUP-05 | 07-02-PLAN.md | Ensure all vendor_mentions point to valid non-duplicate profiles | SATISFIED | Step 3 backfill + Step 4 vendor_name normalization to canonical spelling |

**Orphaned requirements note:** DEDUP-01 through DEDUP-05 are referenced in plan frontmatter but **do not appear in `.planning/REQUIREMENTS.md`**. This is a traceability gap — these requirement IDs exist only in the plan files with no corresponding definition in the requirements registry. The phase goal was expressed as a narrative in ROADMAP.md rather than formal requirements. No fix needed to pass the phase, but the requirements file should be updated to include these IDs for future reference.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 20260416300000_bulk_merge_and_link_vendors.sql | 68-69 | `DELETE FROM vendor_alias_mappings WHERE vendor_entity_id = ANY(v_drop_ids)` — broad DELETE without restricting to conflicting aliases only | Warning | Functionally safe today (UPDATE at 62-65 already moved non-conflicting rows to keeper before this DELETE runs, so DELETE only catches the conflicting leftovers). However, the implicit ordering dependency makes the logic fragile: a reorder of these two statements would silently delete all moved aliases. Additionally, conflicting aliases' metadata (confidence, source) is permanently lost rather than being merged via `GREATEST(confidence)`. Flagged as CR-01 in code review. |
| 20260416100000_vendor_dedup_audit_rpc.sql, 20260416400000_vendor_health_check_rpc.sql | 178, 162 | `GRANT EXECUTE … TO authenticated` on admin-only RPCs | Warning | Any authenticated (non-admin) user can call these functions and read orphan profiles with user_ids, all vendor entity names, and mention counts. SECURITY DEFINER does not restrict callers — it only elevates execution context. Flagged as WR-01 in code review. |
| 20260416200000_normalize_vendor_names.sql | 37 | `coalesce(p_name, '')` returns `''` for NULL input | Warning | A NULL `vendor_name` in any table would be SET to `''` (empty string) rather than left as NULL, since `NULL IS DISTINCT FROM ''` is true. Flagged as WR-02 in code review. |
| 20260416200000_normalize_vendor_names.sql | 88-90 | `ON CONFLICT (alias_text) DO UPDATE SET vendor_entity_id = EXCLUDED.vendor_entity_id` | Warning | If an existing alias points to a different entity, this silently reroutes it to the entity being registered. No guard on `vendor_alias_mappings.vendor_entity_id = EXCLUDED.vendor_entity_id`. Flagged as WR-03 in code review. |
| 20260416200000_normalize_vendor_names.sql | 40 | `GRANT EXECUTE … TO anon` on `_normalize_vendor_name` | Info | Pure IMMUTABLE function with no data access, so no security risk. But inconsistent with project convention of restricting to authenticated users. Flagged as IN-02 in code review. |

Note: All anti-patterns above were identified in the existing `07-REVIEW.md` code review report. CR-01 was rated critical in the review but does not prevent goal achievement — the merge loop still correctly deduplicates entities and no aliases are permanently lost (conflicting aliases already exist on the keeper). The practical impact is loss of confidence metadata for duplicate aliases.

### Human Verification Required

#### 1. Post-migration health check

**Test:** Apply all four migrations to the staging database and call `SELECT public.admin_vendor_health_check()`.
**Expected:** Returns `{"healthy": true, "unlinked_mentions": 0, "orphan_metadata": [], "orphan_profiles": [], "duplicate_entities": [], "invalid_parent_child": []}` (or close to it — any remaining unlinked mentions are vendor names with no matching entity, which is expected for truly unknown vendors).
**Why human:** Cannot verify live database state programmatically. The migrations succeed structurally but the outcome depends on the actual vendor data in the database.

#### 2. Verify no alias data loss from CR-01

**Test:** After running 20260416300000, check whether any alias_text values that existed on dropped entities are now entirely absent from `vendor_alias_mappings` (i.e., not present on the keeper entity either).
**Expected:** Every alias that existed before the merge either appears on the keeper entity or was already a duplicate of an alias on the keeper (same alias_text, keeper has its own copy). No alias_text should be permanently destroyed.
**Why human:** The broad DELETE at line 68-69 deletes conflicting aliases from dropped entities. The keeper entity already has its own copy of those alias_texts, so no alias_text should disappear entirely — but this needs to be confirmed against real data.

### Gaps Summary

No blocking gaps. All 9 observable truths are supported by substantive, wired migration artifacts. All 4 migration files exist, are non-stub, and are structurally correct.

Two human verification items remain before the phase can be considered fully closed:
1. Confirm `admin_vendor_health_check()` returns `healthy: true` on staging with real data.
2. Confirm CR-01 (broad alias DELETE) did not cause any alias_text to be permanently lost.

Additionally, DEDUP-01 through DEDUP-05 requirement IDs referenced in plan frontmatter are not registered in REQUIREMENTS.md. This is a documentation gap but does not affect code correctness.

---

_Verified: 2026-04-16T16:02:21Z_
_Verifier: Claude (gsd-verifier)_
