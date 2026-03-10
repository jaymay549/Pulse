# Airtable → Supabase Member Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admins click a button on `/admin/members` to pull all members from Airtable into Supabase, inserting new ones and updating existing ones while preserving Supabase-only fields.

**Architecture:** Supabase Edge Function calls Airtable REST API, normalizes data, upserts via a PostgreSQL function. Admin UI calls the edge function with Clerk auth.

**Tech Stack:** Deno (edge function), PostgreSQL (upsert function), React/TypeScript (button UI), Airtable REST API v0

---

### Task 1: SQL Migration — `upsert_member_from_airtable` Function

**Files:**
- Create: `supabase/migrations/20260309000000_upsert_member_from_airtable.sql`

**Step 1: Write the migration**

```sql
-- Upsert function for Airtable → Supabase member sync.
-- Matches on email (primary) or whatsapp_number (fallback).
-- Preserves Supabase-only fields (clerk_user_id, id, created_at, updated_at).
-- Uses COALESCE to skip null Airtable values on update.

CREATE OR REPLACE FUNCTION public.upsert_member_from_airtable(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_whatsapp_number TEXT,
  p_dealership_name TEXT,
  p_role TEXT,
  p_role_band TEXT,
  p_oems TEXT[],
  p_rooftops INTEGER,
  p_city TEXT,
  p_state TEXT,
  p_zip TEXT,
  p_region TEXT,
  p_tier TEXT,
  p_cohort_id TEXT,
  p_status TEXT,
  p_amount_paid NUMERIC,
  p_payment_status TEXT,
  p_stripe_customer_id TEXT,
  p_biggest_focus TEXT,
  p_area_of_interest TEXT,
  p_annual_revenue TEXT,
  p_volunteer_group_leader BOOLEAN,
  p_source_ref TEXT,
  p_additional_notes TEXT
)
RETURNS TEXT  -- 'inserted' | 'updated' | 'skipped'
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_result TEXT;
BEGIN
  -- Try to find existing member by email first, then whatsapp_number
  SELECT id INTO v_existing_id
    FROM public.members
   WHERE (p_email IS NOT NULL AND lower(email) = lower(p_email))
      OR (p_whatsapp_number IS NOT NULL AND whatsapp_number = p_whatsapp_number)
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing, preserving Supabase-only fields, skip nulls from Airtable
    UPDATE public.members SET
      name              = COALESCE(p_name, name),
      email             = COALESCE(p_email, email),
      phone             = COALESCE(p_phone, phone),
      whatsapp_number   = COALESCE(p_whatsapp_number, whatsapp_number),
      dealership_name   = COALESCE(p_dealership_name, dealership_name),
      role              = COALESCE(p_role, role),
      role_band         = COALESCE(p_role_band, role_band),
      oems              = CASE WHEN p_oems IS NOT NULL AND array_length(p_oems, 1) > 0 THEN p_oems ELSE oems END,
      rooftops          = COALESCE(p_rooftops, rooftops),
      city              = COALESCE(p_city, city),
      state             = COALESCE(p_state, state),
      zip               = COALESCE(p_zip, zip),
      region            = COALESCE(p_region, region),
      tier              = COALESCE(p_tier, tier),
      cohort_id         = COALESCE(p_cohort_id, cohort_id),
      status            = COALESCE(p_status, status),
      amount_paid       = COALESCE(p_amount_paid, amount_paid),
      payment_status    = COALESCE(p_payment_status, payment_status),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      biggest_focus     = COALESCE(p_biggest_focus, biggest_focus),
      area_of_interest  = COALESCE(p_area_of_interest, area_of_interest),
      annual_revenue    = COALESCE(p_annual_revenue, annual_revenue),
      volunteer_group_leader = COALESCE(p_volunteer_group_leader, volunteer_group_leader),
      source_ref        = COALESCE(p_source_ref, source_ref),
      additional_notes  = COALESCE(p_additional_notes, additional_notes)
    WHERE id = v_existing_id;
    v_result := 'updated';
  ELSE
    -- Insert new member
    INSERT INTO public.members (
      name, email, phone, whatsapp_number, dealership_name,
      role, role_band, oems, rooftops,
      city, state, zip, region,
      tier, cohort_id, status, amount_paid, payment_status, stripe_customer_id,
      biggest_focus, area_of_interest, annual_revenue,
      volunteer_group_leader, source_ref, additional_notes
    ) VALUES (
      COALESCE(p_name, 'Unknown'), p_email, p_phone, p_whatsapp_number, p_dealership_name,
      p_role, p_role_band, COALESCE(p_oems, '{}'), p_rooftops,
      p_city, p_state, p_zip, p_region,
      COALESCE(p_tier, 'free'), p_cohort_id, COALESCE(p_status, 'active'),
      p_amount_paid, p_payment_status, p_stripe_customer_id,
      p_biggest_focus, p_area_of_interest, p_annual_revenue,
      COALESCE(p_volunteer_group_leader, false), p_source_ref, p_additional_notes
    );
    v_result := 'inserted';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_member_from_airtable TO service_role;
```

**Step 2: Apply the migration**

Run: `supabase db push` or apply via Supabase MCP `apply_migration` tool.

**Step 3: Commit**

```bash
git add supabase/migrations/20260309000000_upsert_member_from_airtable.sql
git commit -m "feat: add upsert_member_from_airtable SQL function for Airtable sync"
```

---

### Task 2: Edge Function — `sync-airtable-members`

**Files:**
- Create: `supabase/functions/sync-airtable-members/index.ts`

**Step 1: Create the edge function**

Follow the same patterns as `supabase/functions/admin-ensure-vendor-profile/index.ts`:
- Deno `serve()` handler
- CORS headers matching existing pattern
- `verifyAdmin()` using the same JWT + `ADMIN_CLERK_IDS` pattern
- Service role Supabase client for upserts

**Airtable API details:**
- Base ID: `appj7CZzZs3hMkWE2`
- Table ID: `tblQ9nzGzgc8iOHbc`
- Endpoint: `https://api.airtable.com/v0/{baseId}/{tableId}`
- Auth: `Authorization: Bearer {AIRTABLE_API_KEY}`
- Pagination: response includes `offset` field; pass as query param for next page
- Rate limit: 5 requests/second (add small delay between pages)

**Field mapping** (Airtable field names → Supabase columns):
- `email` → `email` (string)
- `name` → `name` (string)
- `phone` → `phone` (normalize: digits only, prepend "1" for 10-digit)
- `clean_phone` / `whatsapp_number` → `whatsapp_number` (normalize same way)
- `dealership_name` → `dealership_name` (string)
- `city_state` → `city` (split on comma, take first part)
- `state` → `state` (string)
- `zip` → `zip` (number → string)
- `role` → `role` (singleSelect → extract `.name` string)
- `role_band` → `role_band` (formula → string)
- `OEMs` → `oems` (comma/semicolon split → string array)
- `biggest_focus` → `biggest_focus` (string)
- `area_of_interest` → `area_of_interest` (string)
- `rooftops` → `rooftops` (number)
- `region` → `region` (singleSelect → extract `.name`)
- `tier` → `tier` (singleSelect → extract `.name`)
- `amount_paid` → `amount_paid` (currency number)
- `payment_status` → `payment_status` (singleSelect → extract `.name`)
- `status` → `status` (singleSelect → extract `.name`)
- `whatsapp_number` → see `clean_phone` above
- `volunteer_group_leader` → `volunteer_group_leader` (singleSelect "Yes"/"true" → boolean)
- `additional_notes` → `additional_notes` (string)
- `stripe_customer_id` → `stripe_customer_id` (string)
- `source_ref` → `source_ref` (string)
- `annual_revenue` → `annual_revenue` (currency → string)
- `cohort_id` → `cohort_id` (multipleRecordLinks — skip, keep existing Supabase value)

**Key implementation notes:**
- Airtable `singleSelect` fields return objects like `{ id: "sel...", name: "Pro", color: "blue" }`. Extract `.name`.
- Airtable paginates with `offset` in response body. Keep fetching until no `offset` returned.
- Call `upsert_member_from_airtable` RPC for each member via `supabase.rpc()`.
- Batch RPC calls (don't await each individually — use Promise.all in groups of 10).
- Return JSON: `{ inserted: N, updated: N, skipped: N, errors: [...] }`.

**Step 2: Write the code**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
};

const AIRTABLE_BASE_ID = "appj7CZzZs3hMkWE2";
const AIRTABLE_TABLE_ID = "tblQ9nzGzgc8iOHbc";

function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.sub || "";
  const adminIds = (Deno.env.get("ADMIN_CLERK_IDS") || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (adminIds.length > 0 && adminIds.includes(userId)) {
    return { isAdmin: true, userId };
  }
  if (payload.user_role === "admin") {
    return { isAdmin: true, userId };
  }
  return { isAdmin: false, userId };
}

function normalizePhone(raw: string | number | undefined | null): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length === 10) return "1" + digits;
  return digits;
}

function parseOems(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function selectName(field: unknown): string | null {
  if (field == null) return null;
  if (typeof field === "string") return field;
  if (typeof field === "object" && "name" in (field as Record<string, unknown>)) {
    return (field as Record<string, string>).name;
  }
  return null;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllAirtableRecords(apiKey: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;

    // Respect Airtable rate limit (5 req/s)
    if (offset) await new Promise((r) => setTimeout(r, 220));
  } while (offset);

  return allRecords;
}

function mapRecord(fields: Record<string, unknown>) {
  const cleanPhone = normalizePhone(fields.clean_phone as string);
  const whatsapp = normalizePhone(fields.whatsapp_number as string);

  let city: string | null = null;
  if (fields.city_state && typeof fields.city_state === "string") {
    const parts = fields.city_state.split(",");
    city = parts[0]?.trim() || null;
  }

  const volLeader = selectName(fields.volunteer_group_leader);

  return {
    p_name: (fields.name as string) || null,
    p_email: (fields.email as string) || null,
    p_phone: normalizePhone(fields.phone as string),
    p_whatsapp_number: cleanPhone || whatsapp,
    p_dealership_name: (fields.dealership_name as string) || null,
    p_role: selectName(fields.role),
    p_role_band: (fields.role_band as string) || null,
    p_oems: parseOems(fields.OEMs as string),
    p_rooftops: typeof fields.rooftops === "number" ? fields.rooftops : null,
    p_city: city,
    p_state: (fields.state as string) || null,
    p_zip: fields.zip != null ? String(fields.zip) : null,
    p_region: selectName(fields.region),
    p_tier: selectName(fields.tier),
    p_cohort_id: null as string | null, // Skip — multipleRecordLinks, not a text ID
    p_status: selectName(fields.status),
    p_amount_paid: typeof fields.amount_paid === "number" ? fields.amount_paid : null,
    p_payment_status: selectName(fields.payment_status),
    p_stripe_customer_id: (fields.stripe_customer_id as string) || null,
    p_biggest_focus: (fields.biggest_focus as string) || null,
    p_area_of_interest: (fields.area_of_interest as string) || null,
    p_annual_revenue:
      fields.annual_revenue != null ? String(fields.annual_revenue) : null,
    p_volunteer_group_leader:
      volLeader === "Yes" || volLeader === "true" ? true : volLeader === "No" || volLeader === "false" ? false : null,
    p_source_ref: (fields.source_ref as string) || null,
    p_additional_notes: (fields.additional_notes as string) || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authToken =
      req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    if (!authToken) throw new Error("Missing auth token");

    const { isAdmin, userId } = verifyAdmin(authToken);
    if (!isAdmin) {
      throw new Error(
        `Permission denied: admin role required (user: ${userId})`
      );
    }

    const apiKey = Deno.env.get("AIRTABLE_API_KEY");
    if (!apiKey) throw new Error("AIRTABLE_API_KEY secret not set");

    // Fetch all Airtable records
    const records = await fetchAllAirtableRecords(apiKey);

    // Supabase service client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in batches of 10
    const BATCH = 10;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (rec) => {
          const params = mapRecord(rec.fields);
          // Skip records with no email AND no whatsapp — can't match
          if (!params.p_email && !params.p_whatsapp_number) {
            return "skipped";
          }
          const { data, error } = await supabase.rpc(
            "upsert_member_from_airtable",
            params
          );
          if (error) throw new Error(`${params.p_email}: ${error.message}`);
          return data as string;
        })
      );

      for (const r of results) {
        if (r.status === "rejected") {
          errors.push(r.reason?.message || "Unknown error");
        } else if (r.value === "inserted") {
          inserted++;
        } else if (r.value === "updated") {
          updated++;
        } else {
          skipped++;
        }
      }
    }

    // Run mention backfill if we inserted new members
    if (inserted > 0) {
      await supabase.rpc("backfill_mention_member_attribution", {
        p_limit: 50000,
      });
    }

    return new Response(
      JSON.stringify({ inserted, updated, skipped, errors, total: records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

**Step 3: Set the Airtable API key secret**

Run: `supabase secrets set AIRTABLE_API_KEY=pat...` (the user's Airtable personal access token)

**Step 4: Deploy the edge function**

Run: `supabase functions deploy sync-airtable-members`

**Step 5: Commit**

```bash
git add supabase/functions/sync-airtable-members/index.ts
git commit -m "feat: add sync-airtable-members edge function"
```

---

### Task 3: Admin UI — Sync Button on MembersPage

**Files:**
- Modify: `src/pages/admin/MembersPage.tsx`

**Step 1: Add the sync button**

Add a "Sync from Airtable" button next to the page title. Uses `fetchWithAuth` from `useClerkAuth` to call the edge function. Shows loading state and a toast with results.

Import additions at top:
- `import { RefreshCw } from "lucide-react";`
- `import { toast } from "sonner";`
- `import { useClerkAuth } from "@/hooks/useClerkAuth";`

Add state and handler inside `MembersPage` component:
```typescript
const { fetchWithAuth, isAdmin } = useClerkAuth();
const [syncing, setSyncing] = useState(false);

const handleSync = async () => {
  setSyncing(true);
  try {
    const res = await fetchWithAuth(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-airtable-members`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sync failed");
    toast.success(
      `Sync complete: ${data.inserted} new, ${data.updated} updated, ${data.skipped} skipped` +
        (data.errors?.length ? `. ${data.errors.length} errors.` : "")
    );
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Sync failed");
  } finally {
    setSyncing(false);
  }
};
```

Update the header JSX — replace `<h1>` line with:
```tsx
<div className="flex items-center justify-between">
  <h1 className="text-xl font-bold text-zinc-100">Members</h1>
  {isAdmin && (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
    >
      <RefreshCw className={`h-3.5 w-3.5 mr-2 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing..." : "Sync from Airtable"}
    </Button>
  )}
</div>
```

**Step 2: Commit**

```bash
git add src/pages/admin/MembersPage.tsx
git commit -m "feat: add Sync from Airtable button to admin members page"
```

---

### Task 4: Verify End-to-End

**Step 1: Test the sync**

1. Navigate to `/admin/members`
2. Click "Sync from Airtable"
3. Verify toast shows correct counts
4. Confirm new members appear in the table
5. Confirm existing members' `clerk_user_id` was preserved

**Step 2: Test Clerk login matching**

1. Log in as a user whose email exists in Airtable
2. Verify `useMemberProfile` links them to their member row
3. Confirm the member profile loads correctly

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Airtable → Supabase member sync with admin UI"
```
