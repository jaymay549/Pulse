# Vendor Deduplication/Merging Design

## Problem

545 unique vendor names across 1,711 mentions — many are duplicates with different
spellings (e.g., "DriveCentric" / "Drive Centric" / "Drive-Centric"). The
`vendor_groups` and `vendor_aliases` tables exist but nothing uses them:

- `admin_approve_mention` stores the raw AI-extracted vendor name as-is
- All read-side RPCs query `vendor_mentions.vendor_name` directly
- The VendorMergeDialog creates groups/aliases but doesn't rename existing mentions

## Solution: 3 Minimal Changes

### Change 1: `resolve_vendor_name` SQL function + modify `admin_approve_mention`

Create a PL/pgSQL function that resolves any vendor name to its canonical form:

```sql
CREATE OR REPLACE FUNCTION resolve_vendor_name(p_name TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
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

  -- 2. Exact canonical name match
  SELECT vg.canonical_name INTO v_canonical
  FROM vendor_groups vg
  WHERE lower(vg.canonical_name) = lower(p_name)
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    RETURN v_canonical;
  END IF;

  -- 3. Fuzzy match via pg_trgm (similarity > 0.4)
  SELECT vg.canonical_name, similarity(lower(vg.canonical_name), lower(p_name))
  INTO v_canonical, v_sim
  FROM vendor_groups vg
  WHERE similarity(lower(vg.canonical_name), lower(p_name)) > 0.4
  ORDER BY similarity(lower(vg.canonical_name), lower(p_name)) DESC
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    -- Auto-insert as alias for future exact matches
    INSERT INTO vendor_aliases (group_id, alias)
    SELECT vg.id, p_name
    FROM vendor_groups vg
    WHERE vg.canonical_name = v_canonical
    ON CONFLICT DO NOTHING;

    RETURN v_canonical;
  END IF;

  -- 4. No match — genuinely new vendor
  RETURN p_name;
END;
$$;
```

Then modify `admin_approve_mention` to call `resolve_vendor_name(p_vendor_name)`
before inserting into `vendor_mentions`.

**Requires**: `pg_trgm` extension enabled (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).

### Change 2: VendorMergeDialog — rename existing mentions on merge

After creating the vendor group and aliases, also UPDATE existing mentions:

```typescript
// After creating group + aliases, rename existing mentions
const { error: renameError } = await supabase.rpc("merge_vendor_mentions", {
  p_canonical_name: canonicalName.trim(),
  p_old_names: aliases, // the non-canonical names
});
```

Backed by a simple RPC:

```sql
CREATE OR REPLACE FUNCTION merge_vendor_mentions(
  p_canonical_name TEXT,
  p_old_names TEXT[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Rename mentions
  UPDATE vendor_mentions
  SET vendor_name = p_canonical_name
  WHERE vendor_name = ANY(p_old_names);

  -- Rename metadata (merge if canonical already has metadata)
  UPDATE vendor_metadata
  SET vendor_name = p_canonical_name
  WHERE vendor_name = ANY(p_old_names)
    AND NOT EXISTS (
      SELECT 1 FROM vendor_metadata WHERE vendor_name = p_canonical_name
    );

  -- Delete orphaned metadata rows for old names
  DELETE FROM vendor_metadata
  WHERE vendor_name = ANY(p_old_names);
END;
$$;
```

### Change 3: One-time backfill

Run once after deploying changes 1 and 2:

```sql
UPDATE vendor_mentions
SET vendor_name = resolve_vendor_name(vendor_name)
WHERE vendor_name != resolve_vendor_name(vendor_name);
```

Also backfill vendor_metadata:

```sql
-- For each alias that has metadata but canonical doesn't, move it
-- For duplicates, keep the canonical's metadata
UPDATE vendor_metadata
SET vendor_name = resolve_vendor_name(vendor_name)
WHERE vendor_name != resolve_vendor_name(vendor_name)
  AND NOT EXISTS (
    SELECT 1 FROM vendor_metadata vm2
    WHERE vm2.vendor_name = resolve_vendor_name(vendor_metadata.vendor_name)
  );

DELETE FROM vendor_metadata
WHERE vendor_name != resolve_vendor_name(vendor_name);
```

## What Changes

| Component | Change |
|-----------|--------|
| `pg_trgm` extension | Enable |
| `resolve_vendor_name()` | New function |
| `admin_approve_mention` RPC | Call resolve before INSERT |
| `merge_vendor_mentions()` | New RPC for merge dialog |
| `VendorMergeDialog.tsx` | Call merge_vendor_mentions after creating group |
| One-time backfill | UPDATE existing data |

## What Doesn't Change

- All read-side RPCs (get_vendor_pulse_feed, get_vendor_profile, etc.)
- Frontend pages (VendorsV2, VendorProfile)
- VendorCard, ChatMarkdown, TrendingVendorChips
- Vendor enrichment edge function
- AI extraction pipeline (Gemini prompt unchanged)

## Data Flow After Changes

```
AI extracts "Drive-Centric" from conversation
  ↓
Admin approves mention
  ↓
admin_approve_mention calls resolve_vendor_name("Drive-Centric")
  ↓
Exact alias match → returns "DriveCentric"
  ↓
INSERT INTO vendor_mentions (vendor_name = 'DriveCentric', ...)
  ↓
All RPCs naturally aggregate under "DriveCentric"
```

## Future Enhancements (not in scope)

- AI prompt normalization (include known vendors list in Gemini prompt)
- Admin audit log of auto-merges
- Fuzzy match suggestion UI in approval flow
