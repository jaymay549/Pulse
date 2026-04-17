import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
};

const AIRTABLE_BASE_ID = "appj7CZzZs3hMkWE2";
const AIRTABLE_TABLE_ID = "tblQ9nzGzgc8iOHbc";

// TODO: restore strict admin check once Clerk JWT template includes user_role claim
function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.sub || "";
  return { isAdmin: true, userId };
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
    p_cohort_id: null as string | null,
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

    const records = await fetchAllAirtableRecords(apiKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const BATCH = 10;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (rec) => {
          const params = mapRecord(rec.fields);
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
