import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";
const BATCH_SIZE = 15; // vendors per invocation
const SKIP_PATTERNS =
  /linkedin\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|glassdoor|crunchbase|wikipedia|yelp\.com|bbb\.org|indeed\.com/i;

// ── Firecrawl search ─────────────────────────────────────────

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit = 5
): Promise<{ url: string; title: string; description: string }[]> {
  const res = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  const text = await res.text();
  if (!res.ok) throw new Error(`Firecrawl search failed: ${res.status} — ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  console.log(`[firecrawlSearch] query="${query}" status=${res.status} results=${(data.data || []).length}`);
  return data.data || [];
}

// ── Extract best website URL from search results ─────────────

function pickBestUrl(results: { url: string; title: string; description: string }[]): string | null {
  // Filter out social media, review sites, etc.
  const candidates = results.filter((r) => !SKIP_PATTERNS.test(r.url));
  if (candidates.length === 0) return null;

  // Extract just the origin from the top result
  try {
    const parsed = new URL(candidates[0].url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return candidates[0].url;
  }
}

// ── Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || BATCH_SIZE;
    const vendorNames: string[] | undefined = body.vendor_names;

    // Query vendors — specific names or batch of missing
    let vendors: { vendor_name: string }[] = [];
    if (vendorNames?.length) {
      vendors = vendorNames.map((n) => ({ vendor_name: n }));
    } else {
      const { data, error: fetchError } = await supabase
        .from("vendor_metadata")
        .select("vendor_name")
        .is("website_url", null)
        .limit(batchSize);
      if (fetchError) throw fetchError;
      vendors = data || [];
    }

    if (!vendors || vendors.length === 0) {
      return new Response(
        JSON.stringify({ resolved: 0, not_found: [], remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resolved = 0;
    const notFound: string[] = [];
    let rateLimited = false;
    const debug: Record<string, unknown>[] = []; // TODO: remove after testing

    for (const vendor of vendors) {
      try {
        const results = await firecrawlSearch(
          FIRECRAWL_API_KEY,
          `${vendor.vendor_name} official website`,
          5
        );

        const url = pickBestUrl(results);

        debug.push({ vendor: vendor.vendor_name, results_count: results.length, urls: results.map(r => r.url), picked: url });

        if (url) {
          const { error } = await supabase
            .from("vendor_metadata")
            .update({ website_url: url })
            .eq("vendor_name", vendor.vendor_name);

          if (!error) {
            resolved++;
            console.log(`[${vendor.vendor_name}] -> ${url}`);
          }
        } else {
          notFound.push(vendor.vendor_name);
          console.log(`[${vendor.vendor_name}] no website found`);
        }
      } catch (e) {
        if ((e as Error).message === "RATE_LIMITED") {
          rateLimited = true;
          console.log("Rate limited, stopping batch");
          break;
        }
        notFound.push(vendor.vendor_name);
        debug.push({ vendor: vendor.vendor_name, error: (e as Error).message });
      }
    }

    // Count remaining
    const { data: remainingRows } = await supabase
      .from("vendor_metadata")
      .select("vendor_name")
      .is("website_url", null);
    const remaining = remainingRows?.length ?? 0;

    return new Response(
      JSON.stringify({
        resolved,
        not_found: notFound,
        rate_limited: rateLimited,
        remaining,
        debug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("resolve-vendor-websites error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
