import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

// ── Unified vendor categories (keep in sync with src/constants/vendorCategories.ts) ──
const VALID_CATEGORIES = [
  "dms",               // Dealer Management Systems — back-office operations (CDK, Reynolds, Tekion)
  "crm",               // Customer Relationship Management — sales/lead management (DriveCentric, VinSolutions)
  "inventory",         // Inventory management, pricing, appraisal tools (vAuto, VinCue, Accu-Trade)
  "marketing",         // Digital advertising, SEO, SEM, social media marketing
  "website",           // Dealership website platforms (Dealer Inspire, DealerOn, Dealer.com)
  "digital-retailing", // Online buying/selling tools (Roadster, Darwin, Gubagoo)
  "fixed-ops",         // Service, parts, recalls, repair orders
  "ai-automation",     // AI chatbots, automation, virtual assistants (Impel, Numa, Matador)
  "f-and-i",           // Finance & Insurance products, menu selling
  "equity-mining",     // Data mining for trade equity opportunities
  "desking",           // Deal structuring, desking tools
  "call-management",   // Phone tracking, call analytics (CallRevu, Car Wars)
  "lead-providers",    // Third-party lead generation and aggregators
  "reputation",        // Reviews, reputation management (Podium, Birdeye)
  "training",          // Training, consulting, 20-groups (NCM, Chris Collins)
  "recon",             // Vehicle reconditioning workflow
  "accounting",        // Dealership accounting software
  "hr-payroll",        // Human resources and payroll
  "compliance",        // Regulatory compliance, OFAC, deal auditing
  "service-products",  // Aftermarket service contracts, warranties
  "security",          // Vehicle tracking, lot management, security
  "diagnostics",       // Vehicle diagnostics and inspection
  "it-support",        // IT infrastructure, managed services, cybersecurity
  "other",             // Doesn't fit above categories
];

interface EnrichRequest {
  vendor_names?: string[];
  batch_size?: number;
}

interface EnrichResult {
  vendor_name: string;
  success: boolean;
  error?: string;
}

// --- Firecrawl helpers ---

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
  console.log(`[firecrawlSearch] query="${query}" results=${JSON.stringify(data).slice(0, 500)}`);
  return data.data || [];
}

async function firecrawlScrapeJson(
  apiKey: string,
  url: string
): Promise<Record<string, string>> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["json"],
      jsonOptions: {
        prompt:
          "Extract company information: the company tagline or slogan, a 1-2 sentence summary of what the company does, the headquarters city and state, and the industry they operate in.",
        schema: {
          type: "object",
          properties: {
            tagline: { type: "string" },
            summary: { type: "string" },
            headquarters: { type: "string" },
            industry: { type: "string" },
          },
        },
      },
      waitFor: 3000,
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  const text = await res.text();
  console.log(`[firecrawlScrapeJson] url="${url}" status=${res.status} body=${text.slice(0, 500)}`);
  if (!res.ok) throw new Error(`Firecrawl scrape-json failed: ${res.status} — ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  return data.data?.json || {};
}

async function firecrawlScreenshot(
  apiKey: string,
  url: string
): Promise<string | null> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["screenshot"],
      waitFor: 3000,
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  const text = await res.text();
  console.log(`[firecrawlScreenshot] url="${url}" status=${res.status} body=${text.slice(0, 300)}`);
  if (!res.ok) throw new Error(`Firecrawl screenshot failed: ${res.status} — ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  return data.data?.screenshot || null;
}

// --- Main enrichment logic ---

async function enrichVendor(
  supabase: ReturnType<typeof createClient>,
  firecrawlKey: string,
  vendor: { vendor_name: string; website_url: string | null }
): Promise<EnrichResult> {
  const { vendor_name } = vendor;
  let website_url = vendor.website_url;
  const slug = vendor_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    // Mark as enriching
    await supabase
      .from("vendor_metadata")
      .update({ enrichment_status: "enriching" })
      .eq("vendor_name", vendor_name);

    const updates: Record<string, unknown> = {};

    // Step 0: Find website URL if missing
    if (!website_url) {
      try {
        const results = await firecrawlSearch(
          firecrawlKey,
          `${vendor_name} official website`,
          5
        );
        // Pick the first non-linkedin, non-social-media result
        const skipPatterns = /linkedin\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|glassdoor|crunchbase|wikipedia/i;
        const siteResult = results.find((r) => !skipPatterns.test(r.url));
        if (siteResult) {
          // Extract just the origin (e.g. https://lotlinx.com)
          try {
            const parsed = new URL(siteResult.url);
            website_url = `${parsed.protocol}//${parsed.hostname}`;
          } catch {
            website_url = siteResult.url;
          }
          updates.website_url = website_url;
          console.log(`[${vendor_name}] Found website: ${website_url}`);
        }
      } catch (e) {
        if ((e as Error).message === "RATE_LIMITED") throw e;
        console.error(`[${vendor_name}] Website search failed:`, e);
      }
    }

    // Step 1: Find LinkedIn URL
    try {
      const results = await firecrawlSearch(
        firecrawlKey,
        `"${vendor_name}" site:linkedin.com/company`,
        3
      );
      const linkedinResult = results.find((r) =>
        /linkedin\.com\/company\//.test(r.url)
      );
      if (linkedinResult) {
        updates.linkedin_url = linkedinResult.url;
      }
    } catch (e) {
      if ((e as Error).message === "RATE_LIMITED") throw e;
      console.error(`[${vendor_name}] LinkedIn search failed:`, e);
    }

    // Step 2: Extract structured data from website (using scrape+JSON, which is synchronous)
    if (website_url) {
      try {
        const extracted = await firecrawlScrapeJson(firecrawlKey, website_url);
        if (extracted.tagline) updates.tagline = extracted.tagline;
        if (extracted.headquarters)
          updates.headquarters = extracted.headquarters;
        // Only update description if currently empty
        if (extracted.summary) {
          const { data: current } = await supabase
            .from("vendor_metadata")
            .select("description")
            .eq("vendor_name", vendor_name)
            .single();
          if (!current?.description) {
            updates.description = extracted.summary;
          }
        }
      } catch (e) {
        if ((e as Error).message === "RATE_LIMITED") throw e;
        console.error(`[${vendor_name}] Website extract failed:`, e);
      }
    }

    // Step 3: Screenshot banner from website
    if (website_url) {
      try {
        const screenshotUrl = await firecrawlScreenshot(
          firecrawlKey,
          website_url
        );
        if (screenshotUrl) {
          // Download the temporary screenshot
          const imgRes = await fetch(screenshotUrl);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const filePath = `${slug}.png`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
              .from("vendor-banners")
              .upload(filePath, arrayBuffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (uploadError) {
              console.error(
                `[${vendor_name}] Banner upload failed:`,
                uploadError
              );
            } else {
              const {
                data: { publicUrl },
              } = supabase.storage
                .from("vendor-banners")
                .getPublicUrl(filePath);
              updates.banner_url = publicUrl;
            }
          }
        }
      } catch (e) {
        if ((e as Error).message === "RATE_LIMITED") throw e;
        console.error(`[${vendor_name}] Screenshot failed:`, e);
      }
    }

    // Step 4: Generate AI overview from scraped data
    if (website_url) {
      try {
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
          console.warn(`[${vendor_name}] GEMINI_API_KEY not set, skipping auto-summary`);
        } else {
          const contextParts: string[] = [];
          if (updates.tagline) contextParts.push(`Tagline: ${updates.tagline}`);
          if (updates.description) contextParts.push(`Description: ${updates.description}`);
          if (updates.headquarters) contextParts.push(`HQ: ${updates.headquarters}`);

          const categoryList = VALID_CATEGORIES
            .filter((c) => c !== "other")
            .map((c) => `"${c}"`)
            .join(", ");

          const prompt = `You are analyzing a vendor in the automotive dealership technology space.

VENDOR: ${vendor_name}
WEBSITE: ${website_url}
${contextParts.length > 0 ? `CONTEXT:\n${contextParts.join("\n")}` : ""}

Generate a structured profile. Return JSON:
{
  "category": "Pick the single BEST category from: ${categoryList}. Only use \"other\" if the vendor truly does not fit ANY of the above.",
  "auto_summary": "2-3 sentence neutral, factual overview of what this company does for auto dealerships. No marketing fluff.",
  "auto_products": ["Key", "product", "areas"],
  "auto_segments": ["Target", "customer", "segments"],
  "auto_integrations": ["Known", "integration", "partners"]
}

CATEGORY GUIDELINES:
- "dms" = back-office dealer management (CDK, Reynolds, Tekion). NOT the same as CRM.
- "crm" = sales/lead management (VinSolutions, DriveCentric, Elead). NOT the same as DMS.
- "website" = dealership website providers (Dealer Inspire, DealerOn). NOT "marketing".
- "marketing" = advertising, SEO, SEM, social. NOT website providers.
- "reputation" = review management, customer feedback (Podium, Birdeye).
- "f-and-i" = finance & insurance products/tools.
- "lead-providers" = third-party lead sources. NOT CRM.
- Prefer a specific category over "other". Only use "other" as a last resort.

If insufficient data for a field, use an empty array. Return only valid JSON.`;

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.2,
                },
              }),
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const rawJson = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
              const parsed = JSON.parse(rawJson);
              if (parsed.category && VALID_CATEGORIES.includes(parsed.category)) {
                updates.category = parsed.category;
                console.log(`[${vendor_name}] Assigned category: ${parsed.category}`);
              }
              if (parsed.auto_summary) updates.auto_summary = parsed.auto_summary;
              if (parsed.auto_products?.length) updates.auto_products = parsed.auto_products;
              if (parsed.auto_segments?.length) updates.auto_segments = parsed.auto_segments;
              if (parsed.auto_integrations?.length) updates.auto_integrations = parsed.auto_integrations;
              updates.auto_summary_generated_at = new Date().toISOString();
              console.log(`[${vendor_name}] Generated auto-summary`);
            }
          } else {
            console.warn(`[${vendor_name}] Gemini returned ${geminiRes.status}, skipping auto-summary`);
          }
        }
      } catch (e) {
        // Don't block enrichment if auto-summary fails
        console.error(`[${vendor_name}] Auto-summary generation failed:`, e);
      }
    }

    // Step 5: Update vendor_metadata
    const updateKeys = Object.keys(updates);
    console.log(`[${vendor_name}] Saving fields: ${updateKeys.join(", ") || "(none)"}`);

    await supabase
      .from("vendor_metadata")
      .update({
        ...updates,
        enrichment_status: "enriched",
        enrichment_error: updateKeys.length > 0 ? null : "No data found",
        enriched_at: new Date().toISOString(),
      })
      .eq("vendor_name", vendor_name);

    return { vendor_name, success: true };
  } catch (e) {
    const errorMsg = (e as Error).message || "Unknown error";
    if (errorMsg === "RATE_LIMITED") throw e;

    await supabase
      .from("vendor_metadata")
      .update({
        enrichment_status: "failed",
        enrichment_error: errorMsg,
      })
      .eq("vendor_name", vendor_name);

    return { vendor_name, success: false, error: errorMsg };
  }
}

// --- Edge function handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: EnrichRequest = await req.json();
    let vendors: { vendor_name: string; website_url: string | null }[] = [];

    if (body.vendor_names?.length) {
      const { data } = await supabase
        .from("vendor_metadata")
        .select("vendor_name, website_url")
        .in("vendor_name", body.vendor_names);
      vendors = data || [];
    } else if (body.batch_size) {
      const { data } = await supabase
        .from("vendor_metadata")
        .select("vendor_name, website_url")
        .eq("enrichment_status", "pending")
        .limit(body.batch_size);
      vendors = data || [];
    }

    if (vendors.length === 0) {
      // Count remaining
      const { count } = await supabase
        .from("vendor_metadata")
        .select("id", { count: "exact", head: true })
        .eq("enrichment_status", "pending");

      return new Response(
        JSON.stringify({
          enriched: 0,
          remaining: count || 0,
          rate_limited: false,
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: EnrichResult[] = [];
    let rateLimited = false;

    for (const vendor of vendors) {
      try {
        const result = await enrichVendor(supabase, FIRECRAWL_API_KEY, vendor);
        results.push(result);
      } catch (e) {
        if ((e as Error).message === "RATE_LIMITED") {
          rateLimited = true;
          // Reset this vendor back to pending
          await supabase
            .from("vendor_metadata")
            .update({ enrichment_status: "pending" })
            .eq("vendor_name", vendor.vendor_name);
          break;
        }
        results.push({
          vendor_name: vendor.vendor_name,
          success: false,
          error: (e as Error).message,
        });
      }
    }

    // Count remaining
    const { count } = await supabase
      .from("vendor_metadata")
      .select("id", { count: "exact", head: true })
      .eq("enrichment_status", "pending");

    return new Response(
      JSON.stringify({
        enriched: results.filter((r) => r.success).length,
        remaining: count || 0,
        rate_limited: rateLimited,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vendor enrich error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
