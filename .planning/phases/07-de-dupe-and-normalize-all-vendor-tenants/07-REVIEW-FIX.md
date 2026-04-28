---
phase: 07-de-dupe-and-normalize-all-vendor-tenants
fixed_at: 2026-04-16T12:30:00Z
review_path: .planning/phases/07-de-dupe-and-normalize-all-vendor-tenants/07-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-04-16T12:30:00Z
**Source review:** .planning/phases/07-de-dupe-and-normalize-all-vendor-tenants/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

**Important context:** All source migrations (20260416100000–400000) have already been applied to production. Fixes are delivered as new migration files that apply corrective ALTER/CREATE OR REPLACE/REVOKE/GRANT statements and re-run affected data operations with the corrected logic.

## Fixed Issues

### CR-01: Alias deletion deletes already-moved rows, silently losing data

**Files modified:** `supabase/migrations/20260416500000_fix_cr01_alias_delete_scope.sql`
**Commit:** be6b18e
**Applied fix:** Created a new migration that re-runs the dedup merge loop with the corrected DELETE statement. The original broad `DELETE FROM vendor_alias_mappings WHERE vendor_entity_id = ANY(v_drop_ids)` is replaced with an explicit `DELETE … AND alias_text IN (SELECT alias_text FROM … WHERE vendor_entity_id = v_keep_id)`. This makes the intent self-documenting: only conflicting (non-moveable) aliases are deleted; successfully moved aliases cannot be accidentally targeted even if statement order were to change in the future. The DO block is idempotent — it only processes any active entities that still share a normalized canonical_name after the original pass (catching any edge cases missed by the first run).

---

### WR-01: Admin RPCs granted to all `authenticated` users, not just admins

**Files modified:** `supabase/migrations/20260416500001_fix_wr01_restrict_admin_rpc_grants.sql`
**Commit:** fb0b17b
**Applied fix:** Issued `REVOKE EXECUTE … FROM authenticated` for both `admin_audit_vendor_duplicates()` and `admin_vendor_health_check()`, then `GRANT EXECUTE … TO service_role` only. Any logged-in user can no longer call these SECURITY DEFINER functions; access is restricted to Edge Functions and backend services authenticated as service_role.

---

### WR-02: `initcap()` called without NULL guard for `vendor_mentions.vendor_name`

**Files modified:** `supabase/migrations/20260416500002_fix_wr02_normalize_null_guard.sql`
**Commit:** 3700cd7
**Applied fix:** `CREATE OR REPLACE FUNCTION public._normalize_vendor_name` with a `CASE WHEN p_name IS NULL THEN NULL` short-circuit, replacing the `coalesce(p_name, '')` pattern. Also revoked the `anon` grant (addressing IN-02 scope as it was part of the same function). Added remediation UPDATEs that restore empty-string `''` vendor_name values (set by the original NULL→'' conversion) back to NULL across `vendor_mentions`, `vendor_metadata`, and `vendor_profiles`.

---

### WR-03: `ON CONFLICT (alias_text) DO UPDATE` may silently reroute aliases to wrong entities

**Files modified:** `supabase/migrations/20260416500003_fix_wr03_alias_conflict_guard.sql`
**Commit:** 3ca8df7
**Applied fix:** Two-step migration: (1) A remediation UPDATE that restores any alias rows whose `vendor_entity_id` was potentially overwritten by the original migration — it corrects aliases where `alias_text = lower(canonical_name)` of a different active entity, limited to unambiguous cases (exactly one active entity owns that canonical name). (2) Re-runs the canonical-alias registration with the corrected conflict clause: `ON CONFLICT (alias_text) DO UPDATE SET confidence = GREATEST(…) WHERE vendor_alias_mappings.vendor_entity_id = EXCLUDED.vendor_entity_id` — so only the confidence is refreshed when the alias already belongs to the same entity, and unrelated aliases are left untouched.

---

### WR-04: `backfill_vendor_mentions_family(NULL)` processes all mentions with no transaction size guard

**Files modified:** `supabase/migrations/20260416500004_fix_wr04_backfill_timeout.sql`
**Commit:** 43744af
**Applied fix:** Wrapped the `backfill_vendor_mentions_family(NULL)` call with `SET LOCAL statement_timeout = '600s'` and `RESET statement_timeout` to bound the lock duration. This re-runs the backfill for any still-unlinked mentions (e.g., after alias repairs in WR-03) and documents the timeout expectation. The migration comment also notes the batched alternative (`backfill_vendor_mentions_family(10000)`) for very large tables.

---

_Fixed: 2026-04-16T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
