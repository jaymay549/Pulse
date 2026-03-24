import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface TransformRequest {
  batch_size?: number;
}

interface TransformResult {
  review_id: string;
  success: boolean;
  error?: string;
}

// ── Gemini helper ──────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

// ── Transform prompt ───────────────────────────────────────

function buildTransformPrompt(review: {
  vendor_name: string;
  raw_text: string;
}): string {
  return `You are transforming an external review into CDG Pulse voice — a platform where car dealers discuss vendor technology.

VENDOR: ${review.vendor_name}

ORIGINAL REVIEW:
${review.raw_text}

Transform this into a dealer-style mention. Return JSON:
{
  "headline": "Short punchy headline (5-10 words) capturing the key point",
  "quote": "1-2 sentence anonymized dealer-style quote. Conversational tone, like something said in a group chat.",
  "dimension": "one of: worth_it, reliable, integrates, support, adopted, other",
  "sentiment": "one of: positive, negative, neutral, mixed",
  "sentiment_score": 1-5 integer (1=very negative/weak, 3=moderate, 5=very positive/strong),
  "category": "one of: crm, dms, marketing, data-analytics, inventory, website, service-bdc, desking-fi, compliance, phone, other"
}

Sentiment guide:
- positive: clearly favorable, recommending, praising
- negative: clearly unfavorable, complaining, warning others away
- neutral: factual observation without strong opinion, just reporting usage
- mixed: contains both significant praise and significant criticism

Sentiment score guide:
- 1: very mild / barely an opinion
- 2: mild but noticeable
- 3: moderate opinion but not a strong endorsement or complaint
- 4: strong feeling — clear recommendation, clear complaint, specific praise or specific problem
- 5: extreme / emphatic — "best thing ever" or "worst experience"
If someone likes, recommends, or expresses excitement about a product → at least 4.
If someone describes a specific problem or warns others → at least 4.
Reserve 3 for genuinely tepid opinions like "it works fine" or "it's okay".

Rules:
- Sound like organic dealer conversation, not a formal review
- Remove all identifying information (reviewer name, company, location)
- Keep the core insight but rewrite in casual tone
- Be honest — preserve both positives and negatives
- If the review has a star rating, use it to inform sentiment_score (1 star=1, 5 stars=5)
- Return only valid JSON, no markdown fences`;
}

// ── Transform a single review ──────────────────────────────

async function transformReview(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  review: { id: string; vendor_name: string; raw_text: string }
): Promise<TransformResult> {
  try {
    const prompt = buildTransformPrompt(review);
    const raw = await callGemini(geminiKey, prompt);
    const parsed = JSON.parse(raw);

    if (!parsed.headline || !parsed.quote || !parsed.sentiment) {
      throw new Error("Invalid AI response: missing required fields");
    }

    // Dedup: check if a similar headline already exists for this vendor
    const { data: existing } = await supabase
      .from("vendor_mentions")
      .select("id")
      .eq("vendor_name", review.vendor_name)
      .ilike("headline", `%${parsed.headline.slice(0, 25)}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("external_review_queue")
        .update({ status: "duplicate" })
        .eq("id", review.id);

      return { review_id: review.id, success: false, error: "Duplicate" };
    }

    // Compute NPS tier
    const score = Math.max(1, Math.min(5, parsed.sentiment_score || 3));
    let npsTier: string;
    if (parsed.sentiment === "positive" && score >= 4) {
      npsTier = "promoter";
    } else if ((parsed.sentiment === "negative" || parsed.sentiment === "warning") && score >= 4) {
      npsTier = "detractor";
    } else {
      npsTier = "passive";
    }

    const typeMap: Record<string, string> = {
      positive: "positive",
      negative: "negative",
      neutral: "neutral",
      mixed: "mixed",
    };

    // Insert into vendor_mentions
    const { error: insertError } = await supabase
      .from("vendor_mentions")
      .insert({
        vendor_name: review.vendor_name,
        category: parsed.category || null,
        headline: parsed.headline,
        quote: parsed.quote,
        dimension: parsed.dimension || "other",
        sentiment: parsed.sentiment,
        type: typeMap[parsed.sentiment] || "negative",
        sentiment_score: score,
        nps_tier: npsTier,
        source: "external",
        source_review_id: review.id,
        approved_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    // Mark as transformed
    await supabase
      .from("external_review_queue")
      .update({ status: "transformed", transformed_at: new Date().toISOString() })
      .eq("id", review.id);

    console.log(`[${review.vendor_name}] Transformed review ${review.id}: "${parsed.headline}"`);
    return { review_id: review.id, success: true };
  } catch (e) {
    const errorMsg = (e as Error).message;

    await supabase
      .from("external_review_queue")
      .update({ status: "rejected", error_message: errorMsg })
      .eq("id", review.id);

    return { review_id: review.id, success: false, error: errorMsg };
  }
}

// ── Handler ────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: TransformRequest = await req.json();
    const batchSize = body.batch_size || 10;

    // Get pending reviews
    const { data: reviews, error: fetchError } = await supabase
      .from("external_review_queue")
      .select("id, vendor_name, raw_text")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!reviews || reviews.length === 0) {
      return new Response(
        JSON.stringify({ transformed: 0, remaining: 0, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: TransformResult[] = [];
    for (const review of reviews) {
      const result = await transformReview(supabase, GEMINI_API_KEY, review);
      results.push(result);
    }

    // Count remaining
    const { count } = await supabase
      .from("external_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return new Response(
      JSON.stringify({
        transformed: results.filter((r) => r.success).length,
        duplicates: results.filter((r) => r.error === "Duplicate").length,
        failed: results.filter((r) => !r.success && r.error !== "Duplicate").length,
        remaining: count || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("transform-external-review error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
