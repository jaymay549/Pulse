# Vendor Deduplication/Merging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make vendor deduplication actually work — resolve aliases on approval, rename existing mentions on merge, and backfill current data.

**Architecture:** A `resolve_vendor_name()` PL/pgSQL function handles all name resolution (exact alias lookup + pg_trgm fuzzy match). It's called by `admin_approve_mention` on every approval. A separate `merge_vendor_mentions` RPC renames existing data when admins merge vendors. One frontend change to VendorMergeDialog calls the new RPC.

**Tech Stack:** PostgreSQL (PL/pgSQL, pg_trgm), React/TypeScript (one component change)

**Important context:**
- The MCP Supabase tools are connected to the WRONG project (`rixrkhumtmhzfgavzjyn`). The correct project is `nsfrxtpxzdmqlezvvjgg`. All SQL must be deployed by the user via the Supabase SQL editor. Provide the SQL and curl verification commands.
- There is no test framework in this project. Verify DB functions via curl, frontend via `vite build`.
- All `.rpc()` calls in this codebase use `as any` casts because the Supabase types file doesn't define these functions. Follow the same pattern.
- The existing `admin_approve_mention` RPC signature is: `(p_vendor_name TEXT, p_category TEXT, p_headline TEXT, p_dimension mention_dimension, p_sentiment mention_sentiment, p_snippet_anon TEXT, p_message_ids INTEGER[]) RETURNS INTEGER`.
- `vendor_groups` and `vendor_aliases` tables already exist on production.

---

## Task 1: Enable pg_trgm and deploy `resolve_vendor_name`

**Files:**
- SQL to run in Supabase SQL editor (provide to user)

**Step 1: Present SQL to user for deployment**

The user must run this in the Supabase SQL editor for project `nsfrxtpxzdmqlezvvjgg`:

```sql
-- Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Resolve a vendor name to its canonical form
-- 1. Exact alias lookup
-- 2. Exact canonical name match
-- 3. Fuzzy match (similarity > 0.4)
-- 4. Return input if no match (new vendor)
CREATE OR REPLACE FUNCTION resolve_vendor_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_canonical TEXT;
  v_sim REAL;
BEGIN
  -- 1. Exact alias lookup (case-insensitive)
  SELECT vg.canonical_name INTO v_canonical
  FROM vendor_aliases va
  JOIN vendor_groups vg ON vg.id = va.group_id
  WHERE lower(va.alias) = lower(p_name)
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    RETURN v_canonical;
  END IF;

  -- 2. Exact canonical name match (input IS a canonical name)
  SELECT vg.canonical_name INTO v_canonical
  FROM vendor_groups vg
  WHERE lower(vg.canonical_name) = lower(p_name)
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    RETURN v_canonical;
  END IF;

  -- 3. Fuzzy match via pg_trgm
  SELECT vg.canonical_name,
         similarity(lower(vg.canonical_name), lower(p_name))
  INTO v_canonical, v_sim
  FROM vendor_groups vg
  WHERE similarity(lower(vg.canonical_name), lower(p_name)) > 0.4
  ORDER BY similarity(lower(vg.canonical_name), lower(p_name)) DESC
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    -- Auto-register as alias for future exact matches
    INSERT INTO vendor_aliases (group_id, alias)
    SELECT vg.id, p_name
    FROM vendor_groups vg
    WHERE vg.canonical_name = v_canonical
    ON CONFLICT DO NOTHING;

    RETURN v_canonical;
  END IF;

  -- 4. No match — new vendor
  RETURN p_name;
END;
$$;
```

**Step 2: Verify via curl**

Run:
```bash
# Test with a known canonical name — should return itself
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/resolve_vendor_name' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_name": "DriveCentric"}'

# Test with a known alias (if one exists) — should return canonical
# Test with a completely unknown name — should return itself
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/resolve_vendor_name' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_name": "SomeRandomNewVendor"}'
```

Expected: First returns `"DriveCentric"`, second returns `"SomeRandomNewVendor"`.

**Step 3: Commit** — No code changes for this task.

---

## Task 2: Modify `admin_approve_mention` to call `resolve_vendor_name`

**Files:**
- SQL to run in Supabase SQL editor (modify existing RPC)

**Step 1: Get current function definition**

Run in Supabase SQL editor to see the current function body:
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'admin_approve_mention';
```

**Step 2: Modify the function**

The change is minimal. In the existing function body, wherever `p_vendor_name` is used for the INSERT into `vendor_mentions`, wrap it with `resolve_vendor_name()`:

```sql
-- Find the line that looks like:
--   ... p_vendor_name ...
-- And change it to:
--   ... resolve_vendor_name(p_vendor_name) ...
```

Specifically, the INSERT statement should change from:
```sql
INSERT INTO vendor_mentions (vendor_name, ...)
VALUES (p_vendor_name, ...)
```
to:
```sql
INSERT INTO vendor_mentions (vendor_name, ...)
VALUES (resolve_vendor_name(p_vendor_name), ...)
```

Also apply the same change if `p_vendor_name` is used in the `vendor_metadata` INSERT/upsert within the same function.

**Step 3: Verify via curl**

First, check existing vendor_groups to find a vendor with aliases:
```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/vendor_groups?select=canonical_name,vendor_aliases(alias)' \
  -H 'apikey: <anon_key>' | head -c 500
```

Then verify that approving a mention with an aliased name stores the canonical form. (This will be fully testable once there are known aliases in the system.)

**Step 4: Commit** — No code changes for this task.

---

## Task 3: Deploy `merge_vendor_mentions` RPC

**Files:**
- SQL to run in Supabase SQL editor

**Step 1: Present SQL to user for deployment**

```sql
CREATE OR REPLACE FUNCTION merge_vendor_mentions(
  p_canonical_name TEXT,
  p_old_names TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Rename all mentions from old names to canonical
  UPDATE vendor_mentions
  SET vendor_name = p_canonical_name
  WHERE vendor_name = ANY(p_old_names);

  -- Move metadata if canonical doesn't have it yet
  UPDATE vendor_metadata
  SET vendor_name = p_canonical_name
  WHERE vendor_name = ANY(p_old_names)
    AND NOT EXISTS (
      SELECT 1 FROM vendor_metadata WHERE vendor_name = p_canonical_name
    );

  -- Delete leftover metadata for old names
  DELETE FROM vendor_metadata
  WHERE vendor_name = ANY(p_old_names);
END;
$$;
```

**Step 2: Verify via curl**

```bash
# Dry-run test: call with names that don't exist to confirm no error
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/merge_vendor_mentions' \
  -H 'apikey: <anon_key>' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_canonical_name": "TestVendor", "p_old_names": ["TestVendorAlt"]}'
```

Expected: No error (empty response, 200 OK). No rows affected since those vendors don't exist.

**Step 3: Commit** — No code changes for this task.

---

## Task 4: Update VendorMergeDialog to call `merge_vendor_mentions`

**Files:**
- Modify: `src/components/admin/queue/VendorMergeDialog.tsx:38-71`

**Step 1: Add merge_vendor_mentions call after creating group/aliases**

In `VendorMergeDialog.tsx`, after the aliases are inserted (line 61) and before the toast, add:

```typescript
      // Rename existing mentions + metadata to canonical name
      if (aliases.length > 0) {
        const { error: renameError } = await (supabase.rpc as any)(
          "merge_vendor_mentions",
          {
            p_canonical_name: canonicalName.trim(),
            p_old_names: aliases,
          }
        );
        if (renameError) {
          console.error("merge_vendor_mentions error:", renameError);
          // Non-fatal: group/aliases were created, mentions just weren't renamed
        }
      }
```

This goes inside the `try` block, between the alias insert and the `toast.success`.

**Step 2: Verify build**

Run:
```bash
cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build
```

Expected: Build succeeds with no TypeScript errors.

**Step 3: Commit**

```bash
git add src/components/admin/queue/VendorMergeDialog.tsx
git commit -m "feat: rename existing mentions when merging vendors"
```

---

## Task 5: Run backfill on existing data

**Files:**
- SQL to run in Supabase SQL editor (one-time)

**Step 1: Preview what would change**

Run a DRY RUN first to see which vendor names would be rewritten:

```sql
SELECT DISTINCT vendor_name, resolve_vendor_name(vendor_name) AS resolved
FROM vendor_mentions
WHERE vendor_name != resolve_vendor_name(vendor_name)
ORDER BY vendor_name;
```

Review the output — each row shows an old name and what it would become. Verify the mappings make sense.

**Step 2: Run the backfill**

```sql
-- Backfill vendor_mentions
UPDATE vendor_mentions
SET vendor_name = resolve_vendor_name(vendor_name)
WHERE vendor_name != resolve_vendor_name(vendor_name);

-- Backfill vendor_metadata (move metadata, don't create duplicates)
UPDATE vendor_metadata
SET vendor_name = resolve_vendor_name(vendor_name)
WHERE vendor_name != resolve_vendor_name(vendor_name)
  AND NOT EXISTS (
    SELECT 1 FROM vendor_metadata vm2
    WHERE vm2.vendor_name = resolve_vendor_name(vendor_metadata.vendor_name)
  );

-- Clean up orphaned metadata
DELETE FROM vendor_metadata
WHERE vendor_name != resolve_vendor_name(vendor_name);
```

**Step 3: Verify counts**

```sql
-- How many distinct vendor names remain?
SELECT count(DISTINCT vendor_name) FROM vendor_mentions;

-- Compare to the old count (was 545). Should be lower.
```

**Step 4: Commit** — No code changes for this task.

---

## Task 6: Final verification

**Step 1: Test the full flow end-to-end**

1. In the admin vendor queue, approve a mention where the vendor name is a known alias
2. Check `vendor_mentions` — the `vendor_name` should be the canonical form
3. Visit the vendor profile page — the mention should appear under the canonical vendor

**Step 2: Test the merge dialog**

1. Find two vendor names that should be merged but aren't yet
2. Select them in the merge dialog, pick a canonical name, merge
3. Verify `vendor_groups` has the new group
4. Verify `vendor_aliases` has the aliases
5. Verify `vendor_mentions` was renamed (check via SQL or the vendor profile page)

**Step 3: Test fuzzy matching**

1. Create a vendor group for a known vendor (e.g., "DriveCentric")
2. Approve a mention with a similar-but-different name (e.g., "Drive Centric")
3. Verify it was auto-resolved to "DriveCentric"
4. Check `vendor_aliases` — the new spelling should have been auto-registered

**Step 4: Commit any remaining changes**

```bash
git add -A && git status
# Only commit if there are changes
```
