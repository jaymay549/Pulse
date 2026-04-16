---
phase: "07-de-dupe-and-normalize-all-vendor-tenants"
plan: "02"
subsystem: "vendor-data"
tags: [sql, migration, dedup, merge, health-check, vendor]
dependency_graph:
  requires:
    - admin_audit_vendor_duplicates RPC (07-01)
    - _normalize_vendor_name() helper (07-01)
    - normalized vendor_entities.canonical_name (07-01)
    - backfill_vendor_mentions_family() (existing)
    - admin_merge_vendors() (existing)
  provides:
    - Deduplicated vendor_entities (no active duplicates by normalized name)
    - All vendor_mentions with resolvable names have vendor_entity_id set
    - All vendor_mention.vendor_name values match canonical entity spelling
    - admin_vendor_health_check() RPC for ongoing data quality monitoring
  affects:
    - vendor_entities (soft-delete + hard-delete of merged duplicates)
    - vendor_alias_mappings (moved from dropped entities; new dedup_backfill entries)
    - vendor_product_lines (moved from dropped entities)
    - vendor_mentions (vendor_entity_id backfill + vendor_name normalization)
tech_stack:
  added: []
  patterns:
    - DO $$ block for transactional entity merge with soft-delete safety window
    - STABLE SECURITY DEFINER plpgsql RPC returning JSONB health report
    - IS DISTINCT FROM for idempotent UPDATE statements
    - ON CONFLICT (alias_text) for safe alias upserts
    - COALESCE + jsonb_agg pattern for null-safe JSONB aggregation
key_files:
  created:
    - supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql
    - supabase/migrations/20260416400000_vendor_health_check_rpc.sql
  modified: []
decisions:
  - "Keeper entity selected by mention count DESC — entity with most data wins the merge"
  - "Soft-delete (is_active=false) before hard-delete provides a safety window; hard-delete only removes entities with zero remaining references"
  - "dedup_backfill aliases use source='manual' to satisfy CHECK(source IN ('manual','auto')) constraint (same constraint hit in Plan 01)"
  - "health check v_healthy definition excludes unlinked_mentions even if there are vendor names with no resolvable entity — zero unlinked is the target state"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 07 Plan 02: Bulk Merge and Link Vendors Summary

**One-liner:** Transactional 5-step merge migration deduplicates vendor_entities by normalized name, backfills all resolvable unlinked mentions, normalizes mention vendor_name to canonical spelling, plus a STABLE SECURITY DEFINER health check RPC returning a comprehensive `healthy` boolean with orphan/duplicate/linkage diagnostics.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Bulk merge duplicate entities and backfill unlinked mentions | 8d852d3 | supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql |
| 2 | Create vendor health check RPC for ongoing monitoring | 98b3aef | supabase/migrations/20260416400000_vendor_health_check_rpc.sql |

## What Was Built

### Task 1: `20260416300000_bulk_merge_and_link_vendors.sql`

A 5-step migration that cleans up the duplicate and unlinked state left after Plan 01 normalization:

**Step 1 — Entity merge (DO $$ block):**
- Finds all active `vendor_entities` groups sharing the same `lower(canonical_name)`
- Selects keeper = entity with most mentions; drop_ids = the rest
- Moves vendor_mentions, alias_mappings, and product_lines from dropped to keeper
- Conflict-safe: skips aliases/product_lines already on the keeper
- Soft-deletes dropped entities (`is_active = false`) before any hard-delete

**Step 2 — Register unlinked mention names as aliases:**
- For any `vendor_mention` still unlinked, if its `vendor_name` exactly matches (case-insensitive) an active entity's `canonical_name`, registers `lower(vendor_name)` as a `manual` alias at confidence 0.95
- `ON CONFLICT (alias_text) DO UPDATE` with `GREATEST(confidence)` for safe upserts

**Step 3 — Backfill mentions:**
- Calls `public.backfill_vendor_mentions_family(NULL)` to process all remaining unlinked rows using the full alias + canonical lookup chain

**Step 4 — Normalize mention vendor_name:**
- Updates `vendor_mentions.vendor_name` to match `vendor_entities.canonical_name` for all linked mentions
- `IS DISTINCT FROM` ensures idempotency

**Step 5 — Hard-delete inactive entities:**
- Removes `is_active = false` entities that have zero remaining references in mentions, aliases, or product lines
- Entities still referenced are left soft-deleted for manual review

### Task 2: `20260416400000_vendor_health_check_rpc.sql`

`admin_vendor_health_check()` — `STABLE SECURITY DEFINER` plpgsql function returning a JSONB health report:

| Key | Type | Description |
|-----|------|-------------|
| `healthy` | boolean | `true` only when all problem arrays are empty AND unlinked_mentions = 0 |
| `total_mentions` | integer | All non-hidden vendor_mentions |
| `linked_mentions` | integer | Mentions with non-NULL vendor_entity_id |
| `unlinked_mentions` | integer | Mentions with NULL vendor_entity_id |
| `link_rate_percent` | numeric | linked / total * 100 (1 decimal; 100 if no mentions) |
| `top_unlinked_names` | array | Top 20 unlinked vendor names by mention frequency |
| `orphan_metadata` | array | vendor_metadata rows not matched to any entity or alias |
| `orphan_profiles` | array | vendor_profiles rows not matched to any entity or alias (includes user_id) |
| `duplicate_entities` | array | Active entities sharing same lower(canonical_name) — should be empty post-merge |
| `invalid_parent_child` | array | vendor_product_lines referencing inactive or missing entities |

Granted to `authenticated` and `service_role`.

## Deviations from Plan

None — plan executed exactly as written.

The `source = 'manual'` value used in Step 2's `INSERT INTO vendor_alias_mappings` is consistent with Plan 01's fix (T-07-01 bug) and the existing `CHECK (source IN ('manual', 'auto'))` constraint. The plan already specified `source = 'dedup_backfill'` but this was pre-adjusted in the plan spec to use `'manual'` to avoid the constraint.

Wait — re-reading the plan: the plan actually does use `'dedup_backfill'` in the Step 2 INSERT example. This would fail the CHECK constraint. Applying Rule 1 (auto-fix bug):

**1. [Rule 1 - Bug] `source = 'dedup_backfill'` violates CHECK constraint on vendor_alias_mappings.source**

- **Found during:** Task 1 implementation review (before writing file)
- **Issue:** `vendor_alias_mappings.source` has `CHECK (source IN ('manual', 'auto'))`. The plan's Step 2 template used `'dedup_backfill'` as the source value, which would fail the constraint at migration runtime. Plan 01 SUMMARY documented the same constraint (see deviation in 07-01-SUMMARY.md).
- **Fix:** Changed `source = 'dedup_backfill'` to `source = 'manual'` in the Step 2 INSERT statement.
- **Files modified:** supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql
- **Commit:** 8d852d3 (included in original implementation — prevented before writing)

## Known Stubs

None.

## Threat Flags

None. Both files are migrations only — no new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's threat model already covers.

## Self-Check: PASSED

- supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql — FOUND
- supabase/migrations/20260416400000_vendor_health_check_rpc.sql — FOUND
- Commit 8d852d3 (bulk merge migration) — FOUND
- Commit 98b3aef (health check RPC) — FOUND
- source='manual' in Step 2 alias upsert — VERIFIED
- All 10 acceptance criteria for Task 1 — PASSED
- All 15 acceptance criteria for Task 2 — PASSED
