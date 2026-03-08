/**
 * One-time import: Airtable CSV -> Supabase members table
 *
 * Usage:
 *   npx tsx scripts/import-airtable-members.ts path/to/airtable-export.csv
 *
 * Expects SUPABASE_SERVICE_ROLE_KEY env var.
 * Uses VITE_SUPABASE_URL from .env for the project URL.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Assume US if 10 digits
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
    console.error(
      "Usage: npx tsx scripts/import-airtable-members.ts <csv-path>"
    );
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf-8");
  const rows: AirtableRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV`);

  const members = rows.map((r) => {
    const whatsapp = normalizePhone(r.clean_phone || r.whatsapp_number);
    const phone = normalizePhone(r.phone);

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
      volunteer_group_leader:
        r.volunteer_group_leader === "true" ||
        r.volunteer_group_leader === "Yes",
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
  const { data: backfilled, error: bfErr } = await supabase.rpc(
    "backfill_mention_member_attribution",
    { p_limit: 50000 }
  );
  if (bfErr) {
    console.error("Backfill error:", bfErr.message);
  } else {
    console.log(`Backfilled member_id on ${backfilled} mentions`);
  }
}

main().catch(console.error);
