/**
 * Enrich top vendors with website screenshot banner images.
 * Automatically finds vendor websites via Firecrawl search if not set.
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

// Domains to skip when searching for vendor websites
const SKIP_DOMAINS = [
  "g2.com", "capterra.com", "getapp.com", "trustpilot.com", "softwareadvice.com",
  "gartner.com", "glassdoor.com", "indeed.com", "crunchbase.com", "bloomberg.com",
  "businesswire.com", "prnewswire.com", "linkedin.com", "youtube.com", "facebook.com",
  "twitter.com", "x.com", "instagram.com", "tiktok.com", "reddit.com", "medium.com",
  "cars.com", "autotrader.com", "cargurus.com", "edmunds.com", "dealerrater.com",
  "yelp.com", "bbb.org", "wikipedia.org", "news", "techcrunch.com", "forbes.com",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return `https://${url}`;
  return url;
}

function rootUrl(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return normalizeUrl(url);
  }
}

function vendorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function getTopVendors(): Promise<{ name: string; count: number }[]> {
  const { data, error } = await supabase.rpc(
    "get_vendor_pulse_vendors_list_v2"
  );
  if (error) throw new Error(`RPC error: ${error.message}`);
  return ((data?.vendors ?? []) as { name: string; count: number }[]).slice(
    0,
    TOP_N
  );
}

async function getKnownWebsite(
  vendorName: string
): Promise<{ website: string | null; hasBanner: boolean }> {
  // Check vendor_profiles first
  const { data: profile } = await supabase
    .from("vendor_profiles")
    .select("company_website, banner_url")
    .ilike("vendor_name", vendorName)
    .maybeSingle();

  if (profile?.banner_url && !FORCE) {
    return { website: null, hasBanner: true };
  }
  if (profile?.company_website) {
    return { website: profile.company_website, hasBanner: false };
  }

  // Fall back to vendor_metadata
  const { data: meta } = await supabase
    .from("vendor_metadata")
    .select("website_url")
    .ilike("vendor_name", vendorName)
    .maybeSingle();

  return { website: meta?.website_url ?? null, hasBanner: false };
}

async function upsertVendorProfile(
  vendorName: string,
  updates: { company_website?: string; banner_url: string }
): Promise<void> {
  const { data: existing } = await supabase
    .from("vendor_profiles")
    .select("id")
    .ilike("vendor_name", vendorName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("vendor_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .ilike("vendor_name", vendorName);
    if (error) throw new Error(`Update error: ${error.message}`);
  } else {
    const { error } = await supabase.from("vendor_profiles").insert({
      vendor_name: vendorName,
      is_approved: false,
      ...updates,
    });
    if (error) throw new Error(`Insert error: ${error.message}`);
  }
}

// ── Firecrawl helpers ────────────────────────────────────────────────────────

async function searchVendorWebsite(vendorName: string): Promise<string | null> {
  const tmpFile = join(TMP_DIR, `search-${Date.now()}.json`);
  try {
    const query = `${vendorName} automotive dealer software official site`;
    execSync(`firecrawl search "${query}" --limit 5 --json -o "${tmpFile}"`, {
      stdio: "pipe",
      timeout: 30_000,
    });
    const result = JSON.parse(readFileSync(tmpFile, "utf-8"));
    const hits: Array<{ url: string }> = result?.data?.web ?? [];

    const filtered = hits.filter((r) => {
      try {
        const hostname = new URL(r.url).hostname;
        return !SKIP_DOMAINS.some((skip) => hostname.includes(skip));
      } catch {
        return false;
      }
    });

    if (filtered.length === 0) return null;
    return rootUrl(filtered[0].url);
  } catch (err: any) {
    console.error(`  Search error: ${err.message ?? err}`);
    return null;
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
}

async function screenshotWebsite(url: string): Promise<Buffer | null> {
  const tmpFile = join(TMP_DIR, `screenshot-${Date.now()}.json`);
  try {
    execSync(
      `firecrawl scrape "${url}" --format screenshot --json -o "${tmpFile}"`,
      { stdio: "pipe", timeout: 60_000 }
    );
    const result = JSON.parse(readFileSync(tmpFile, "utf-8"));
    const screenshotUrl: string | undefined = result.screenshot;
    if (!screenshotUrl) {
      console.error("  No screenshot in firecrawl response");
      return null;
    }
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
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n🔥 Vendor banner enrichment — top ${TOP_N} vendors` +
      `${DRY_RUN ? " (DRY RUN)" : ""}` +
      `${FORCE ? " (--force)" : ""}\n`
  );

  ensureTmpDir();

  const vendors = await getTopVendors();
  console.log(`Fetched ${vendors.length} top vendors.\n`);

  let updated = 0,
    skipped = 0,
    failed = 0;

  for (const vendor of vendors) {
    console.log(`\n📍 ${vendor.name} (${vendor.count} mentions)`);

    // 1. Check DB for existing website / banner
    const { website: knownWebsite, hasBanner } = await getKnownWebsite(
      vendor.name
    );

    if (hasBanner) {
      console.log("  ⏭  Already has banner — skipping (use --force to redo)");
      skipped++;
      continue;
    }

    let website = knownWebsite;
    let websiteSource = "db";

    // 2. If no website, search for it
    if (!website) {
      console.log("  🔍 No website found — searching via Firecrawl...");
      if (!DRY_RUN) {
        website = await searchVendorWebsite(vendor.name);
        websiteSource = "search";
      }
    }

    if (!website) {
      console.log("  ✗ Could not find website");
      failed++;
      continue;
    }

    const url = rootUrl(website);
    console.log(
      `  🌐 ${url}${websiteSource === "search" ? " (found via search)" : ""}`
    );

    if (DRY_RUN) {
      console.log("  ✓ Would screenshot and upload (dry run)");
      skipped++;
      continue;
    }

    // 3. Screenshot
    const imageBuffer = await screenshotWebsite(url);
    if (!imageBuffer) {
      failed++;
      continue;
    }
    console.log(
      `  📸 Screenshot captured (${Math.round(imageBuffer.length / 1024)} KB)`
    );

    // 4. Upload to storage
    const publicUrl = await uploadBanner(vendor.name, imageBuffer);
    if (!publicUrl) {
      failed++;
      continue;
    }

    // 5. Upsert vendor_profiles
    const upsertData: { company_website?: string; banner_url: string } = {
      banner_url: publicUrl,
    };
    if (websiteSource === "search") {
      upsertData.company_website = url;
    }

    await upsertVendorProfile(vendor.name, upsertData);
    console.log(`  ✅ Banner saved: ${publicUrl}`);
    updated++;

    // Brief pause between vendors
    await new Promise((r) => setTimeout(r, 750));
  }

  console.log(
    `\n─────────────────────────────────────\n` +
      `✅ Updated:       ${updated}\n` +
      `⏭  Skipped:       ${skipped}\n` +
      `❌ Failed:        ${failed}\n` +
      `Credits used:    ~${updated * 2} (search + screenshot per vendor)\n`
  );
}

main().catch((err) => {
  console.error("\nFatal:", err.message ?? err);
  process.exit(1);
});
