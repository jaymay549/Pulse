---
phase: "07-de-dupe-and-normalize-all-vendor-tenants"
plan: "01"
subsystem: "vendor-data"
tags: [sql, migration, dedup, normalization, vendor]
dependency_graph:
  requires: []
  provides:
    - admin_audit_vendor_duplicates RPC
    - _normalize_vendor_name() helper function
    - normalized vendor_entities.canonical_name
    - normalized vendor_alias_mappings.alias_text
    - normalized vendor_mentions.vendor_name
    - normalized vendor_metadata.vendor_name
    - normalized vendor_profiles.vendor_name
  affects:
    - vendor_entities
    - vendor_alias_mappings
    - vendor_mentions
    - vendor_metadata
    - vendor_profiles
tech_stack:
  added: []
  patterns:
    - STABLE SECURITY DEFINER plpgsql RPC returning JSONB
    - IMMUTABLE sql helper function for name normalization
    - IS DISTINCT FROM for idempotent UPDATE statements
    - ON CONFLICT for safe alias upserts
key_files:
  created:
    - supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql
    - supabase/migrations/20260416200000_normalize_vendor_names.sql
  modified: []
decisions:
  - "alias_text normalization uses lowercase (not title case) to match the existing admin_merge_vendors convention which stores all aliases as lower()"
  - "IS DISTINCT FROM on all UPDATE statements ensures idempotency — safe to re-run without side effects"
  - "Canonical name re-registration as aliases (Step 7) ensures resolve_vendor_family() exact-match lookup works after normalization changes canonical_name casing"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 07 Plan 01: Vendor Dedup Audit and Name Normalization Summary

**One-liner:** Read-only audit RPC exposing duplicate vendor groups, unlinked mentions, and orphan rows, plus idempotent name normalization across all five vendor name columns using initcap + trim + collapse.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create vendor duplicate audit RPC | a22f00c | supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql |
| 2 | Normalize vendor names across all tables | 50bb95e | supabase/migrations/20260416200000_normalize_vendor_names.sql |

## What Was Built

### Task 1: `admin_audit_vendor_duplicates()` RPC

A `STABLE SECURITY DEFINER` plpgsql function returning a JSONB object with five keys:

- **`duplicate_groups`** — vendor name groups where the same `lower(trim(vendor_name))` has multiple distinct `vendor_entity_id` values or multiple distinct raw spellings. Each group includes normalized_name, variants (with canonical_name and mention_count), and total_mentions.
- **`unlinked_vendors`** — distinct vendor_name values from vendor_mentions where `vendor_entity_id IS NULL`, ordered by mention_count DESC.
- **`orphan_metadata`** — vendor_metadata rows with no matching canonical_name or alias_text. Includes has_logo and has_description flags.
- **`orphan_profiles`** — vendor_profiles rows with no matching canonical_name or alias_text. Includes user_id and is_approved.
- **`stats`** — summary: total_mentions, linked_mentions, unlinked_mentions, total_entities, total_aliases, duplicate_group_count.

Granted to `authenticated` and `service_role`.

### Task 2: `_normalize_vendor_name()` + 6-table normalization

An `IMMUTABLE` SQL helper that trims, collapses multiple spaces to one, and applies `initcap()` (title case).

Applied across:

| Table | Column | Normalization |
|-------|--------|---------------|
| `vendor_entities` | `canonical_name` | title case; `slug` also recomputed |
| `vendor_alias_mappings` | `alias_text` | lowercase trimmed (matches existing convention) |
| `vendor_mentions` | `vendor_name` | title case |
| `vendor_metadata` | `vendor_name` | title case |
| `vendor_profiles` | `vendor_name` | title case + `updated_at = now()` |

After normalization, canonical names are re-registered as lowercase aliases via `ON CONFLICT ... DO UPDATE` to preserve the `resolve_vendor_family()` exact-match path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `source = 'normalization'` violates CHECK constraint on vendor_alias_mappings.source**

- **Found during:** Task 2 post-write review
- **Issue:** `vendor_alias_mappings.source` has `CHECK (source IN ('manual', 'auto'))`. The plan's Step 7 template used `'normalization'` as the source value, which would fail the constraint at migration runtime.
- **Fix:** Changed source value from `'normalization'` to `'manual'` in the Step 7 INSERT statement.
- **Files modified:** supabase/migrations/20260416200000_normalize_vendor_names.sql
- **Commit:** 960619c

## Known Stubs

None.

## Threat Flags

None. Both files are migrations only — no new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's threat model already covers.

## Self-Check: PASSED

- supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql — FOUND
- supabase/migrations/20260416200000_normalize_vendor_names.sql — FOUND
- Commit a22f00c (audit RPC) — FOUND
- Commit 50bb95e (normalization) — FOUND
- Commit 960619c (bug fix: source value) — FOUND
- source='manual' in alias re-registration — VERIFIED
