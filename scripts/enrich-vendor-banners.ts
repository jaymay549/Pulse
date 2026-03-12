/**
 * Enrich top vendors with website screenshot banner images.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/enrich-vendor-banners.ts [--top=N] [--dry-run] [--force]
 *
 * Options:
 *   --top=N     Number of top vendors by mention count to process (default: 30)
 *   --dry-run   Preview which vendors would be enriched, no changes made
 *   --force     Overwrite existing banner_url values
 *
 * Requires:
 *   SUPABASE_SERVICE_ROLE_KEY env var
 *   VITE_SUPABASE_URL (or SUPABASE_URL) env var
 *   firecrawl CLI authenticated (run `firecrawl --status` to verify)
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { mkdirSync, existsSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const TOP_N = parseInt(
  args.find((a) => a.startsWith("--top="))?.split("=")[1] ?? "30",
  10
);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BUCKET = "vendor-screenshots";
const TMP_DIR = "/tmp/vendor-banners";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return `https://${url}`;
  return url;
}

function vendorSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function getTopVendors(): Promise<{ name: string; count: number }[]> {
  const { data, error } = await supabase.rpc(
    "get_vendor_pulse_vendors_list_v2"
  );
  if (error) throw new Error(`RPC error: ${error.message}`);
  const vendors: { name: string; count: number }[] = data?.vendors ?? [];
  return vendors.slice(0, TOP_N);
}

async function getVendorProfile(
  vendorName: string
): Promise<{ company_website: string | null; banner_url: string | null } | null> {
  const { data, error } = await supabase
    .from("vendor_profiles")
    .select("company_website, banner_url")
    .ilike("vendor_name", vendorName)
    .maybeSingle();
  if (error) {
    console.error(`  DB error for ${vendorName}: ${error.message}`);
    return null;
  }
  return data;
}

async function screenshotWebsite(url: string): Promise<Buffer | null> {
  const outFile = join(TMP_DIR, `screenshot-${Date.now()}.json`);
  try {
    execSync(
      `firecrawl scrape "${url}" --format screenshot --json -o "${outFile}"`,
      { stdio: "pipe", timeout: 60_000 }
    );
    const result = JSON.parse(readFileSync(outFile, "utf-8"));
    const screenshotUrl: string | undefined = result.screenshot;
    if (!screenshotUrl) {
      console.error("  No screenshot field in firecrawl output");
      return null;
    }
    // Download the signed URL before it expires
    const res = await fetch(screenshotUrl);
    if (!res.ok) {
      console.error(`  Failed to download screenshot: ${res.status}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err: any) {
    console.error(`  Screenshot error: ${err.message ?? err}`);
    return null;
  } finally {
    if (existsSync(outFile)) unlinkSync(outFile);
  }
}

async function uploadBanner(
  vendorName: string,
  imageBuffer: Buffer
): Promise<string | null> {
  const slug = vendorSlug(vendorName);
  const storagePath = `banners/${slug}/banner.png`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error(`  Upload error: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function updateBannerUrl(
  vendorName: string,
  bannerUrl: string
): Promise<void> {
  const { error } = await supabase
    .from("vendor_profiles")
    .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
    .ilike("vendor_name", vendorName);
  if (error) throw new Error(`Update error: ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n🔥 Vendor banner enrichment — top ${TOP_N} vendors${DRY_RUN ? " (DRY RUN)" : ""}${FORCE ? " (--force: overwriting existing)" : ""}\n`
  );

  ensureTmpDir();

  const vendors = await getTopVendors();
  console.log(`Fetched ${vendors.length} top vendors from mentions.\n`);

  let updated = 0,
    skipped = 0,
    failed = 0;

  for (const vendor of vendors) {
    console.log(`\n📍 ${vendor.name} (${vendor.count} mentions)`);

    const profile = await getVendorProfile(vendor.name);

    if (!profile) {
      console.log("  ⏭  No vendor_profiles row — skipping");
      skipped++;
      continue;
    }

    if (!profile.company_website) {
      console.log("  ⏭  No company_website set — skipping");
      skipped++;
      continue;
    }

    if (profile.banner_url && !FORCE) {
      console.log(`  ⏭  Already has banner: ${profile.banner_url}`);
      skipped++;
      continue;
    }

    const url = normalizeUrl(profile.company_website);
    console.log(`  🌐 ${url}`);

    if (DRY_RUN) {
      console.log("  ✓ Would screenshot and upload (dry run)");
      skipped++;
      continue;
    }

    const imageBuffer = await screenshotWebsite(url);
    if (!imageBuffer) {
      failed++;
      continue;
    }
    console.log(`  📸 Screenshot captured (${Math.round(imageBuffer.length / 1024)} KB)`);

    const publicUrl = await uploadBanner(vendor.name, imageBuffer);
    if (!publicUrl) {
      failed++;
      continue;
    }

    await updateBannerUrl(vendor.name, publicUrl);
    console.log(`  ✅ Banner saved: ${publicUrl}`);
    updated++;

    // Brief pause between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `\n─────────────────────────────────────\n` +
      `✅ Updated:  ${updated}\n` +
      `⏭  Skipped:  ${skipped}\n` +
      `❌ Failed:   ${failed}\n` +
      `Credits used: ~${updated} (1 per screenshot)\n`
  );
}

main().catch((err) => {
  console.error("\nFatal:", err.message ?? err);
  process.exit(1);
});
