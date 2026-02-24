import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

interface IngestionRequest {
  vendor_names?: string[];
  batch_size?: number;
  sources?: string[];
}

interface IngestionResult {
  vendor_name: string;
  source: string;
  reviews_found: number;
  error?: string;
}

// ── Firecrawl helpers ──────────────────────────────────────

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit = 3
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
  if (!res.ok) throw new Error(`Firecrawl search failed: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

async function firecrawlScrapeMarkdown(
  apiKey: string,
  url: string
): Promise<string> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      waitFor: 5000,
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`Firecrawl scrape failed: ${res.status}`);
  const data = await res.json();
  return data.data?.markdown || "";
}

// ── Review extraction ──────────────────────────────────────

/**
 * Extracts individual review blocks from scraped markdown.
 * Looks for substantial text blocks that are likely user reviews.
 */
function extractReviews(
  markdown: string,
  _source: string
): Array<{ raw_text: string; raw_rating: number | null }> {
  const reviews: Array<{ raw_text: string; raw_rating: number | null }> = [];

  // Split on common review separators (headings, horizontal rules, numbered items)
  const blocks = markdown.split(/\n(?:#{1,3}\s|---|\*\*\*|___|\d+\.\s)/);

  for (const block of blocks) {
    const text = block.trim();
    // Only keep blocks that look like actual reviews (50-2000 chars)
    if (text.length < 50 || text.length > 2000) continue;
    // Skip nav/footer content
    if (/sign\s*in|log\s*in|cookie|privacy\s*policy|terms\s*of\s*service/i.test(text)) continue;

    // Try to extract star rating (e.g. "4/5", "4 out of 5", "4.5 stars")
    let rating: number | null = null;
    const ratingMatch = text.match(/(\d+\.?\d*)\s*(?:\/\s*5|out\s+of\s+5|stars?)/i);
    if (ratingMatch) {
      const val = parseFloat(ratingMatch[1]);
      if (val >= 0 && val <= 5) rating = val;
    }

    reviews.push({ raw_text: text.slice(0, 2000), raw_rating: rating });
  }

  return reviews.slice(0, 15); // Cap per page
}

// ── Source-specific search queries ─────────────────────────

function getSearchQuery(vendorName: string, source: string): string {
  switch (source) {
    case "g2":
      return `${vendorName} reviews site:g2.com`;
    case "capterra":
      return `${vendorName} reviews site:capterra.com`;
    case "trustradius":
      return `${vendorName} reviews site:trustradius.com`;
    case "reddit":
      return `${vendorName} dealer review site:reddit.com`;
    case "google":
      return `${vendorName} reviews`;
    default:
      throw new Error(`Unsupported source: ${source}`);
  }
}

// ── Ingest one vendor × source ─────────────────────────────

async function ingestVendorSource(
  supabase: ReturnType<typeof createClient>,
  firecrawlKey: string,
  vendorName: string,
  source: string
): Promise<IngestionResult> {
  try {
    const query = getSearchQuery(vendorName, source);
    const searchResults = await firecrawlSearch(firecrawlKey, query, 3);

    if (searchResults.length === 0) {
      return { vendor_name: vendorName, source, reviews_found: 0 };
    }

    let totalIngested = 0;

    for (const result of searchResults) {
      try {
        const markdown = await firecrawlScrapeMarkdown(firecrawlKey, result.url);
        const reviews = extractReviews(markdown, source);

        for (const review of reviews) {
          // Basic dedup: skip if exact text already in queue
          const { data: existing } = await supabase
            .from("external_review_queue")
            .select("id")
            .eq("vendor_name", vendorName)
            .eq("raw_text", review.raw_text)
            .limit(1);

          if (existing && existing.length > 0) continue;

          const { error } = await supabase
            .from("external_review_queue")
            .insert({
              vendor_name: vendorName,
              source,
              raw_text: review.raw_text,
              raw_rating: review.raw_rating,
              status: "pending",
            });

          if (!error) totalIngested++;
        }
      } catch (e) {
        if ((e as Error).message === "RATE_LIMITED") throw e;
        console.error(`[${vendorName}/${source}] Scrape failed for ${result.url}:`, e);
      }
    }

    return { vendor_name: vendorName, source, reviews_found: totalIngested };
  } catch (e) {
    if ((e as Error).message === "RATE_LIMITED") throw e;
    return {
      vendor_name: vendorName,
      source,
      reviews_found: 0,
      error: (e as Error).message,
    };
  }
}

// ── Handler ────────────────────────────────────────────────

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

    const body: IngestionRequest = await req.json();
    const sources = body.sources || ["g2", "capterra", "reddit"];

    // Resolve vendor list
    let vendorNames: string[] = [];
    if (body.vendor_names?.length) {
      vendorNames = body.vendor_names;
    } else if (body.batch_size) {
      const { data } = await supabase
        .from("vendor_metadata")
        .select("vendor_name")
        .limit(body.batch_size);
      vendorNames = (data || []).map((v) => v.vendor_name);
    }

    const results: IngestionResult[] = [];
    let rateLimited = false;

    for (const vendorName of vendorNames) {
      if (rateLimited) break;
      for (const source of sources) {
        try {
          const result = await ingestVendorSource(supabase, FIRECRAWL_API_KEY, vendorName, source);
          results.push(result);
        } catch (e) {
          if ((e as Error).message === "RATE_LIMITED") {
            rateLimited = true;
            break;
          }
        }
      }
    }

    const totalIngested = results.reduce((sum, r) => sum + r.reviews_found, 0);

    return new Response(
      JSON.stringify({
        ingested: totalIngested,
        vendors_processed: new Set(results.map((r) => r.vendor_name)).size,
        rate_limited: rateLimited,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ingest-external-reviews error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
