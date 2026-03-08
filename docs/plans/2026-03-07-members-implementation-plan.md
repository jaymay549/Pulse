# Members Table & Mention Attribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `members` table from Airtable data, link mentions to members via phone number, and wire Clerk auth to member profiles.

**Architecture:** Single `members` table in public schema holds all member data imported from Airtable. `vendor_mentions` gets a `member_id` FK. The existing WAM sync trigger is extended to look up `sender_number` → `members.whatsapp_number` and stamp `member_id`. A Clerk-linking RPC auto-connects auth users to their member row on first login.

**Tech Stack:** Supabase (Postgres), Clerk (auth), React hooks

---

### Task 1: Create `members` table migration

**Files:**
- Create: `supabase/migrations/20260307000000_members_table.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- Members table: CDG Circles member profiles
-- Source: one-time Airtable import, Supabase is source of truth going forward
-- ============================================================

CREATE TABLE public.members (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id          TEXT UNIQUE,

  -- Identity
  name                   TEXT NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  whatsapp_number        TEXT UNIQUE,

  -- Dealership & Role
  dealership_name        TEXT,
  role                   TEXT,
  role_band              TEXT,
  oems                   TEXT[] DEFAULT '{}',
  rooftops               INTEGER,

  -- Location
  city                   TEXT,
  state                  TEXT,
  zip                    TEXT,
  region                 TEXT,

  -- CDG Membership
  tier                   TEXT DEFAULT 'free',
  cohort_id              TEXT,
  status                 TEXT DEFAULT 'active',
  amount_paid            NUMERIC,
  payment_status         TEXT,
  stripe_customer_id     TEXT,

  -- Interests & Context
  biggest_focus          TEXT,
  area_of_interest       TEXT,
  annual_revenue         TEXT,
  volunteer_group_leader BOOLEAN DEFAULT false,
  source_ref             TEXT,
  additional_notes       TEXT,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_members_email ON public.members (email);
CREATE INDEX idx_members_state ON public.members (state);
CREATE INDEX idx_members_role ON public.members (role);

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Members can read their own row
CREATE POLICY "Members can view own profile"
  ON public.members FOR SELECT
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- Members can update their own row (limited fields via app logic)
CREATE POLICY "Members can update own profile"
  ON public.members FOR UPDATE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- Admins can do everything
CREATE POLICY "Admins full access to members"
  ON public.members FOR ALL
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- Service role (for import, backfill, triggers)
GRANT ALL ON public.members TO service_role;
```

**Step 2: Apply migration**

Run via Supabase dashboard SQL editor or `supabase db push` (since MCP apply_migration isn't connected to this project).

**Step 3: Verify**

Query `SELECT count(*) FROM public.members;` — should return 0.

**Step 4: Commit**

```bash
git add supabase/migrations/20260307000000_members_table.sql
git commit -m "feat: add members table for CDG Circles member profiles"
```

---

### Task 2: Add `member_id` to `vendor_mentions`

**Files:**
- Create: `supabase/migrations/20260307000001_vendor_mentions_member_id.sql`

**Step 1: Write the migration**

```sql
-- Add member attribution to vendor mentions
ALTER TABLE public.vendor_mentions
  ADD COLUMN member_id UUID REFERENCES public.members(id);

CREATE INDEX idx_vendor_mentions_member_id
  ON public.vendor_mentions (member_id)
  WHERE member_id IS NOT NULL;
```

**Step 2: Apply migration**

**Step 3: Verify**

Query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'vendor_mentions' AND column_name = 'member_id';` — should return 1 row.

**Step 4: Commit**

```bash
git add supabase/migrations/20260307000001_vendor_mentions_member_id.sql
git commit -m "feat: add member_id FK to vendor_mentions for attribution"
```

---

### Task 3: Modify WAM sync trigger to stamp `member_id`

**Files:**
- Create: `supabase/migrations/20260307000002_sync_trigger_member_attribution.sql`

**Context:** The existing `sync_single_wam_processed_mention` function inserts into `public.vendor_mentions` but doesn't pass `message_ids`. The trigger wrapper (`sync_wam_processed_mention_trigger`) has access to `NEW.message_ids` (a TEXT field like `"[332,472,...]"`). We need to:
1. Parse `message_ids` text into integer array
2. Look up the first message's `sender_number` in `wam.messages`
3. Match to `members.whatsapp_number`
4. Pass `member_id` through to the upsert

**Step 1: Write the migration**

```sql
-- ============================================================
-- Extend WAM sync to attribute mentions to members
-- ============================================================

-- 1) Replace sync function to accept + use member_id
CREATE OR REPLACE FUNCTION public.sync_single_wam_processed_mention(
  p_id TEXT,
  p_vendor_name TEXT,
  p_category TEXT,
  p_sentiment TEXT,
  p_snippet_anon TEXT,
  p_headline TEXT,
  p_dimension TEXT,
  p_conversation_time TEXT,
  p_member_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type public.review_type;
  v_created_at TIMESTAMPTZ;
BEGIN
  v_type := CASE
    WHEN lower(coalesce(p_sentiment, '')) = 'positive' THEN 'positive'::public.review_type
    ELSE 'warning'::public.review_type
  END;

  v_created_at := COALESCE(NULLIF(p_conversation_time, '')::timestamptz, now());

  INSERT INTO public.vendor_mentions (
    id,
    vendor_name,
    category,
    type,
    title,
    quote,
    explanation,
    dimension,
    conversation_time,
    created_at,
    source,
    is_hidden,
    member_id
  )
  VALUES (
    p_id,
    p_vendor_name,
    COALESCE(NULLIF(p_category, ''), 'other'),
    v_type,
    COALESCE(NULLIF(p_headline, ''), 'Vendor mention'),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_dimension, ''), 'other'),
    v_created_at,
    v_created_at,
    'community',
    false,
    p_member_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    vendor_name = EXCLUDED.vendor_name,
    category = EXCLUDED.category,
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    quote = EXCLUDED.quote,
    explanation = EXCLUDED.explanation,
    dimension = EXCLUDED.dimension,
    conversation_time = EXCLUDED.conversation_time,
    created_at = LEAST(public.vendor_mentions.created_at, EXCLUDED.created_at),
    source = EXCLUDED.source,
    is_hidden = false,
    member_id = COALESCE(EXCLUDED.member_id, public.vendor_mentions.member_id);
END;
$$;

-- 2) Helper: resolve member_id from message_ids text
CREATE OR REPLACE FUNCTION public.resolve_member_from_message_ids(
  p_message_ids TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_ids INT[];
  v_sender_number TEXT;
  v_member_id UUID;
BEGIN
  -- Parse "[332,472,473]" text into int array
  IF p_message_ids IS NULL OR p_message_ids = '' THEN
    RETURN NULL;
  END IF;

  v_ids := string_to_array(
    trim(both '[]' from replace(p_message_ids, ' ', '')),
    ','
  )::INT[];

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get sender_number from the first message
  SELECT m.sender_number INTO v_sender_number
  FROM wam.messages m
  WHERE m.id = v_ids[1]
  LIMIT 1;

  IF v_sender_number IS NULL THEN
    RETURN NULL;
  END IF;

  -- Match to member by whatsapp_number
  SELECT mb.id INTO v_member_id
  FROM public.members mb
  WHERE mb.whatsapp_number = v_sender_number
  LIMIT 1;

  RETURN v_member_id;
END;
$$;

-- 3) Replace trigger wrapper to resolve member before sync
CREATE OR REPLACE FUNCTION public.sync_wam_processed_mention_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  v_member_id := public.resolve_member_from_message_ids(NEW.message_ids);

  PERFORM public.sync_single_wam_processed_mention(
    NEW.id,
    NEW.vendor_name,
    NEW.category,
    NEW.sentiment,
    NEW.snippet_anon,
    NEW.headline,
    NEW.dimension,
    NEW.conversation_time,
    v_member_id
  );
  RETURN NEW;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.sync_single_wam_processed_mention(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_member_from_message_ids(TEXT) TO service_role;
```

**Step 2: Apply migration**

**Step 3: Verify**

Test the resolve function once members are imported (Task 5). For now, verify the function exists:
```sql
SELECT proname FROM pg_proc WHERE proname = 'resolve_member_from_message_ids';
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260307000002_sync_trigger_member_attribution.sql
git commit -m "feat: extend WAM sync trigger with member attribution"
```

---

### Task 4: Backfill RPC for existing mentions

**Files:**
- Create: `supabase/migrations/20260307000003_backfill_member_attribution.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- Backfill member_id on existing vendor_mentions
-- Joins: vendor_mentions -> wam.vendor_mentions_processed (by id)
--        -> wam.messages (first message_id) -> members (by whatsapp_number)
-- ============================================================

CREATE OR REPLACE FUNCTION public.backfill_mention_member_attribution(
  p_limit INTEGER DEFAULT 10000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  WITH resolved AS (
    SELECT
      vm.id AS mention_id,
      public.resolve_member_from_message_ids(wmp.message_ids) AS member_id
    FROM public.vendor_mentions vm
    JOIN wam.vendor_mentions_processed wmp ON wmp.id = vm.id
    WHERE vm.member_id IS NULL
      AND wmp.message_ids IS NOT NULL
      AND wmp.message_ids != ''
    LIMIT p_limit
  )
  UPDATE public.vendor_mentions vm
  SET member_id = r.member_id
  FROM resolved r
  WHERE vm.id = r.mention_id
    AND r.member_id IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_mention_member_attribution(INTEGER) TO service_role;
```

**Step 2: Apply migration**

**Step 3: Commit**

```bash
git add supabase/migrations/20260307000003_backfill_member_attribution.sql
git commit -m "feat: add backfill RPC for mention member attribution"
```

---

### Task 5: Clerk linking RPC

**Files:**
- Create: `supabase/migrations/20260307000004_clerk_member_link.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- Link Clerk user to members row on first login
-- Called from the frontend after Clerk auth succeeds
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_clerk_to_member(
  p_clerk_user_id TEXT,
  p_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- First check if already linked
  SELECT id INTO v_member_id
  FROM public.members
  WHERE clerk_user_id = p_clerk_user_id;

  IF v_member_id IS NOT NULL THEN
    RETURN v_member_id;
  END IF;

  -- Try to link by email
  UPDATE public.members
  SET clerk_user_id = p_clerk_user_id,
      updated_at = now()
  WHERE lower(email) = lower(p_email)
    AND clerk_user_id IS NULL
  RETURNING id INTO v_member_id;

  RETURN v_member_id;  -- NULL if no match found
END;
$$;

-- Callable by authenticated users (they link themselves)
GRANT EXECUTE ON FUNCTION public.link_clerk_to_member(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_clerk_to_member(TEXT, TEXT) TO service_role;
```

**Step 2: Apply migration**

**Step 3: Commit**

```bash
git add supabase/migrations/20260307000004_clerk_member_link.sql
git commit -m "feat: add Clerk-to-member linking RPC"
```

---

### Task 6: Frontend hook — `useMemberProfile`

**Files:**
- Create: `src/hooks/useMemberProfile.ts`

**Step 1: Write the hook**

```typescript
import { useEffect, useState } from "react";
import { useClerkAuth } from "./useClerkAuth";
import { useClerkSupabase } from "./useClerkSupabase";

export interface MemberProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  dealership_name: string | null;
  role: string | null;
  role_band: string | null;
  oems: string[];
  rooftops: number | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  region: string | null;
  tier: string;
  cohort_id: string | null;
  status: string;
  biggest_focus: string | null;
  area_of_interest: string | null;
  annual_revenue: string | null;
  volunteer_group_leader: boolean;
}

export function useMemberProfile() {
  const { user, isAuthenticated } = useClerkAuth();
  const supabase = useClerkSupabase();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || !supabase) {
      setLoading(false);
      return;
    }

    async function loadOrLink() {
      setLoading(true);
      try {
        // Try to load member by clerk_user_id
        const { data, error } = await supabase!
          .from("members" as never)
          .select("*")
          .eq("clerk_user_id", user!.id)
          .maybeSingle();

        if (data) {
          setMember(data as unknown as MemberProfile);
          setLinked(true);
          setLoading(false);
          return;
        }

        // Not linked yet — try to link by email
        if (user!.email) {
          const { data: linkResult } = await supabase!
            .rpc("link_clerk_to_member", {
              p_clerk_user_id: user!.id,
              p_email: user!.email,
            });

          if (linkResult) {
            // Successfully linked — reload profile
            const { data: profile } = await supabase!
              .from("members" as never)
              .select("*")
              .eq("clerk_user_id", user!.id)
              .maybeSingle();

            if (profile) {
              setMember(profile as unknown as MemberProfile);
              setLinked(true);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }

    loadOrLink();
  }, [isAuthenticated, user?.id, supabase]);

  return { member, loading, linked };
}
```

**Step 2: Verify** `useClerkSupabase` hook exists and returns a Supabase client.

Check: `src/hooks/useClerkSupabase.ts` — already confirmed it exists.

**Step 3: Commit**

```bash
git add src/hooks/useMemberProfile.ts
git commit -m "feat: add useMemberProfile hook for Clerk-linked member data"
```

---

### Task 7: Airtable CSV import script

**Files:**
- Create: `scripts/import-airtable-members.ts`

**Step 1: Write the import script**

```typescript
/**
 * One-time import: Airtable CSV -> Supabase members table
 *
 * Usage:
 *   npx tsx scripts/import-airtable-members.ts path/to/airtable-export.csv
 *
 * Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (or uses values from .env).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  // Strip everything except digits
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Ensure country code (assume US if 10 digits)
  if (digits.length === 10) return "1" + digits;
  return digits;
}

function parseOems(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface AirtableRow {
  email?: string;
  name?: string;
  phone?: string;
  dealership_name?: string;
  city_state?: string;
  state?: string;
  zip?: string;
  role?: string;
  role_band?: string;
  OEMs?: string;
  biggest_focus?: string;
  area_of_interest?: string;
  rooftops?: string;
  region?: string;
  tier?: string;
  amount_paid?: string;
  payment_status?: string;
  status?: string;
  whatsapp_number?: string;
  volunteer_group_leader?: string;
  additional_notes?: string;
  stripe_customer_id?: string;
  cohort_id?: string;
  source_ref?: string;
  annual_revenue?: string;
  clean_phone?: string;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-airtable-members.ts <csv-path>");
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf-8");
  const rows: AirtableRow[] = parse(raw, { columns: true, skip_empty_lines: true });

  console.log(`Parsed ${rows.length} rows from CSV`);

  const members = rows.map((r) => {
    // Use clean_phone or whatsapp_number, normalize both
    const whatsapp = normalizePhone(r.clean_phone || r.whatsapp_number);
    const phone = normalizePhone(r.phone);

    // Parse city from city_state if city not separate
    let city: string | null = null;
    if (r.city_state) {
      const parts = r.city_state.split(",");
      city = parts[0]?.trim() || null;
    }

    return {
      name: r.name || "Unknown",
      email: r.email || null,
      phone,
      whatsapp_number: whatsapp,
      dealership_name: r.dealership_name || null,
      role: r.role || null,
      role_band: r.role_band || null,
      oems: parseOems(r.OEMs),
      rooftops: r.rooftops ? parseInt(r.rooftops, 10) || null : null,
      city,
      state: r.state || null,
      zip: r.zip || null,
      region: r.region || null,
      tier: r.tier || "free",
      cohort_id: r.cohort_id || null,
      status: r.status || "active",
      amount_paid: r.amount_paid ? parseFloat(r.amount_paid) || null : null,
      payment_status: r.payment_status || null,
      stripe_customer_id: r.stripe_customer_id || null,
      biggest_focus: r.biggest_focus || null,
      area_of_interest: r.area_of_interest || null,
      annual_revenue: r.annual_revenue || null,
      volunteer_group_leader: r.volunteer_group_leader === "true" || r.volunteer_group_leader === "Yes",
      source_ref: r.source_ref || null,
      additional_notes: r.additional_notes || null,
    };
  });

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < members.length; i += BATCH) {
    const batch = members.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("members")
      .upsert(batch, { onConflict: "whatsapp_number", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
      skipped += batch.length;
    } else {
      inserted += data?.length || 0;
    }
  }

  console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);

  // Run backfill
  console.log("Running mention backfill...");
  const { data: backfilled } = await supabase.rpc(
    "backfill_mention_member_attribution",
    { p_limit: 50000 }
  );
  console.log(`Backfilled member_id on ${backfilled} mentions`);
}

main().catch(console.error);
```

**Step 2: Install csv-parse if not present**

```bash
npm install --save-dev csv-parse
```

**Step 3: Commit**

```bash
git add scripts/import-airtable-members.ts
git commit -m "feat: add Airtable CSV import script for members"
```

---

### Task 8: Run the import

**This task is manual — run after exporting Airtable to CSV.**

**Step 1: Export Airtable to CSV**

Export the members view from Airtable as CSV.

**Step 2: Run import**

```bash
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" npx tsx scripts/import-airtable-members.ts path/to/export.csv
```

**Step 3: Verify**

```sql
-- Check member count
SELECT count(*) FROM public.members;

-- Check attribution backfill
SELECT count(*) FROM public.vendor_mentions WHERE member_id IS NOT NULL;

-- Spot check: see which members are most mentioned
SELECT m.name, m.role, m.dealership_name, count(vm.id) AS mention_count
FROM public.members m
JOIN public.vendor_mentions vm ON vm.member_id = m.id
GROUP BY m.id
ORDER BY mention_count DESC
LIMIT 10;
```

**Step 4: Commit any adjustments**

---

### Execution Order Summary

| Task | What | Depends On |
|------|------|------------|
| 1 | `members` table migration | — |
| 2 | `member_id` on `vendor_mentions` | Task 1 |
| 3 | WAM sync trigger with attribution | Tasks 1, 2 |
| 4 | Backfill RPC | Tasks 1, 2, 3 |
| 5 | Clerk linking RPC | Task 1 |
| 6 | `useMemberProfile` hook | Task 5 |
| 7 | CSV import script | Task 1 |
| 8 | Run the import + backfill | Tasks 1-4, 7 |

Tasks 5-6 (Clerk linking) and Tasks 3-4 (mention attribution) are independent tracks after Tasks 1-2.
