---
phase: 07-de-dupe-and-normalize-all-vendor-tenants
reviewed: 2026-04-16T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql
  - supabase/migrations/20260416200000_normalize_vendor_names.sql
  - supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql
  - supabase/migrations/20260416400000_vendor_health_check_rpc.sql
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-16T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four SQL migration files implement a full vendor deduplication and normalization pipeline: an audit RPC (100000), a name normalization pass (200000), a bulk merge + backfill migration (300000), and a health-check RPC (400000). The overall design is solid — idempotent UPDATE patterns, soft-delete safety windows before hard deletes, and well-structured CTEs. However, one critical ordering bug in the merge loop will silently discard valid aliases before they can be moved to the keeper entity, two grant permissions expose admin-only functions to all authenticated users, and several smaller correctness issues exist.

## Critical Issues

### CR-01: Alias deletion deletes already-moved rows, silently losing data

**File:** `supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql:60-69`

**Issue:** Inside the dedup loop, two statements operate on `v_drop_ids` aliases in sequence:

1. `UPDATE … SET vendor_entity_id = v_keep_id WHERE vendor_entity_id = ANY(v_drop_ids) AND alias_text NOT IN (…keeper aliases…)` — moves non-conflicting aliases to keeper.
2. `DELETE FROM vendor_alias_mappings WHERE vendor_entity_id = ANY(v_drop_ids)` — intended to remove only the conflicting leftovers.

After step 1, the successfully moved aliases now have `vendor_entity_id = v_keep_id`, so the DELETE in step 2 will NOT touch them. That part is safe. However, if a subsequent loop iteration processes another duplicate group that overlaps `v_drop_ids` (unlikely but possible when >2 entities share the same normalized name across groups), OR if the UPDATE and DELETE run within the same snapshot, the logic is correct only because Postgres UPDATE visibility is within-statement. The real bug is different: aliases that ARE conflicting are left behind with `vendor_entity_id = ANY(v_drop_ids)` (the UPDATE skips them), and the DELETE removes them — so conflicting aliases are **hard-deleted without any audit trail**, meaning the alias is permanently gone rather than being retained on the keeper. This means a mention text like "CDK Global" that existed as an alias on both entities will be deleted from the dropped entity instead of kept (it already exists on the keeper, which is fine), but the metadata (confidence, source) of the higher-confidence duplicate alias is lost.

The more impactful correctness issue: the `DELETE` at line 68-69 uses `vendor_entity_id = ANY(v_drop_ids)` which, after the UPDATE above, **only** catches aliases that were left behind because they conflicted. But this is a broad DELETE — if a future code change reorders these statements, all moved aliases would also be deleted. This is a fragile dependency between two sequential DML statements with no comment explaining the invariant.

**Fix:** Replace the two-step UPDATE+DELETE with a single DELETE that explicitly targets only the conflicting rows, making the invariant explicit and safe:

```sql
-- Move non-conflicting alias mappings from dropped entities to keeper
UPDATE public.vendor_alias_mappings
SET vendor_entity_id = v_keep_id
WHERE vendor_entity_id = ANY(v_drop_ids)
  AND alias_text NOT IN (
    SELECT alias_text FROM public.vendor_alias_mappings WHERE vendor_entity_id = v_keep_id
  );

-- Delete ONLY the remaining aliases on dropped entities (those that conflicted
-- and could not be moved). The UPDATE above already moved the rest.
DELETE FROM public.vendor_alias_mappings
WHERE vendor_entity_id = ANY(v_drop_ids)
  AND alias_text IN (
    SELECT alias_text FROM public.vendor_alias_mappings WHERE vendor_entity_id = v_keep_id
  );
```

Alternatively, use `ON CONFLICT (alias_text) DO UPDATE SET confidence = GREATEST(...)` with an `INSERT … SELECT` to upsert all aliases, then delete all remaining dropped-entity rows.

---

## Warnings

### WR-01: Admin RPCs granted to all `authenticated` users, not just admins

**File:** `supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql:178`
**File:** `supabase/migrations/20260416400000_vendor_health_check_rpc.sql:162`

**Issue:** Both `admin_audit_vendor_duplicates()` and `admin_vendor_health_check()` are `SECURITY DEFINER` and expose internal data structures (orphan profiles with `user_id`, all vendor entity names, mention counts). They are granted to `authenticated` — any logged-in user can call them. The `admin_` prefix signals intent, but the grant does not enforce it. By contrast, the `_normalize_vendor_name` helper is granted to `authenticated, anon, service_role`, but that is a pure transformation function with no data access, so that grant is fine.

**Fix:** Restrict to `service_role` only (callable from Edge Functions and backend), or add an explicit admin role check at the start of each function:

```sql
-- Option A: restrict grant
GRANT EXECUTE ON FUNCTION public.admin_audit_vendor_duplicates() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_vendor_health_check() TO service_role;

-- Option B: add role guard inside function body (before any SELECT)
IF NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
) THEN
  RAISE EXCEPTION 'admin access required';
END IF;
```

---

### WR-02: `initcap()` called without NULL guard for `vendor_mentions.vendor_name`

**File:** `supabase/migrations/20260416200000_normalize_vendor_names.sql:37`

**Issue:** `_normalize_vendor_name` uses `coalesce(p_name, '')` before `initcap()`, returning an empty string `''` when the input is NULL. The UPDATE at line 62 (`vendor_mentions.vendor_name`) would then set a NULL `vendor_name` to `''`. That empty-string result passes the `IS DISTINCT FROM` check (NULL IS DISTINCT FROM ''), updating rows that may have legitimately NULL vendor names and replacing them with empty strings, which is a different and potentially worse state.

**Fix:** Short-circuit on NULL inputs in the normalization helper:

```sql
CREATE OR REPLACE FUNCTION public._normalize_vendor_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN NULL
    ELSE initcap(trim(regexp_replace(p_name, '\s+', ' ', 'g')))
  END;
$$;
```

---

### WR-03: `ON CONFLICT (alias_text) DO UPDATE` in migration 200000 may silently reroute aliases to wrong entities

**File:** `supabase/migrations/20260416200000_normalize_vendor_names.sql:80-90`

**Issue:** Step 7 inserts canonical names as lowercase aliases. The conflict clause is:

```sql
ON CONFLICT (alias_text) DO UPDATE
  SET vendor_entity_id = EXCLUDED.vendor_entity_id,
      confidence       = GREATEST(vendor_alias_mappings.confidence, EXCLUDED.confidence);
```

If an existing alias row for the same `alias_text` already points to a *different* `vendor_entity_id` (a legitimate, previously established alias for another vendor), this UPDATE will silently overwrite it and reroute all future mention lookups for that alias to the new entity. There is no guard requiring the existing row's `vendor_entity_id` matches `EXCLUDED.vendor_entity_id`.

**Fix:** Add an explicit conflict guard, or use `DO NOTHING` and only update if the entity IDs match:

```sql
ON CONFLICT (alias_text) DO UPDATE
  SET confidence = GREATEST(vendor_alias_mappings.confidence, EXCLUDED.confidence)
  WHERE vendor_alias_mappings.vendor_entity_id = EXCLUDED.vendor_entity_id;
```

This ensures the upsert only updates confidence when the alias already belongs to the same entity, and leaves unrelated aliases untouched.

---

### WR-04: `backfill_vendor_mentions_family(NULL)` in migration 300000 processes all mentions with no transaction size guard

**File:** `supabase/migrations/20260416300000_bulk_merge_and_link_vendors.sql:111`

**Issue:** `SELECT public.backfill_vendor_mentions_family(NULL)` passes `NULL` as the limit, which the function translates to `LIMIT 2147483647` (effectively unlimited). On a large dataset this runs as a single UPDATE inside a migration transaction, holding a full table lock on `vendor_mentions` for the entire duration. If the table has millions of rows, this can exceed statement timeout limits or block all application reads/writes for an extended period. In a production deployment this is a hard blocker.

**Fix:** Either pass a batch size explicitly and run in multiple passes (not feasible in a single migration transaction), or set a generous `statement_timeout` before this step and document the expected duration:

```sql
-- Set a generous timeout for the full-table backfill (adjust to expected row count)
SET LOCAL statement_timeout = '600s';
SELECT public.backfill_vendor_mentions_family(NULL);
RESET statement_timeout;
```

Alternatively, if the table is large, this step should be extracted to a separate background job rather than run inside a migration.

---

## Info

### IN-01: Orphan metadata/profiles checks do not filter to `is_active = true` entities

**File:** `supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql:116-123`
**File:** `supabase/migrations/20260416400000_vendor_health_check_rpc.sql:75-83`

**Issue:** The orphan detection queries check whether a `vendor_metadata.vendor_name` matches `lower(ve.canonical_name)` in `vendor_entities`, but they do not filter `ve.is_active = true`. A vendor_metadata row that matches an inactive (soft-deleted) entity will be considered "not orphaned" even though the entity it matches is being removed. This makes the orphan report less accurate post-merge.

**Fix:** Add `AND ve.is_active = true` to the NOT EXISTS subqueries in both functions:

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM public.vendor_entities ve
  WHERE lower(ve.canonical_name) = lower(vm.vendor_name)
    AND ve.is_active = true  -- add this
)
```

---

### IN-02: `_normalize_vendor_name` granted to `anon` role unnecessarily

**File:** `supabase/migrations/20260416200000_normalize_vendor_names.sql:40`

**Issue:** `GRANT EXECUTE … TO authenticated, anon, service_role` grants this helper to the anonymous (unauthenticated) role. It is a pure `IMMUTABLE` SQL function with no data access so there is no security risk, but granting it to `anon` is inconsistent with the project's principle of restricting access to authenticated users. It also signals incorrect intent in code review.

**Fix:**

```sql
GRANT EXECUTE ON FUNCTION public._normalize_vendor_name(TEXT) TO authenticated, service_role;
```

---

### IN-03: Audit RPC `admin_audit_vendor_duplicates` filters `is_hidden = false` but health-check RPC does not consistently filter active entities

**File:** `supabase/migrations/20260416100000_vendor_dedup_audit_rpc.sql:33`
**File:** `supabase/migrations/20260416400000_vendor_health_check_rpc.sql:103-117`

**Issue:** The audit function's duplicate-group detection filters `WHERE is_hidden = false` on vendor_mentions, which is correct. The health-check's duplicate entity detection (lines 103-117) checks `WHERE is_active = true` on entities, also correct. However, the two RPCs have slightly different scopes for orphan detection (one in 100000 checks only entities, not active status; one in 400000 is consistent). This inconsistency means the two tools can return different orphan counts for the same database state, causing confusion when comparing audit vs. health-check results.

**Fix:** Standardize both RPCs to use `AND ve.is_active = true` in all entity subquery filters (see IN-01 fix above), so audit and health-check results are always comparable.

---

_Reviewed: 2026-04-16T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
