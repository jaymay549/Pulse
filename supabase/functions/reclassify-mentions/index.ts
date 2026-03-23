import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface ReclassifyRequest {
  batch_size?: number;
  dry_run?: boolean;
}

interface ReclassifyResult {
  mention_id: string;
  old_type: string;
  new_type: string;
  sentiment_score: number;
  nps_tier: string;
  success: boolean;
  error?: string;
}

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
          temperature: 0.2,
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

function buildReclassifyPrompt(mention: {
  vendor_name: string;
  quote: string;
  headline: string | null;
  type: string;
  dimension: string;
}): string {
  return `Reclassify this vendor mention with enriched sentiment.

VENDOR: ${mention.vendor_name}
CURRENT TYPE: ${mention.type}
DIMENSION: ${mention.dimension}
HEADLINE: ${mention.headline || "N/A"}
QUOTE: ${mention.quote}

Return JSON:
{
  "sentiment": "one of: positive, negative, neutral, mixed",
  "sentiment_score": 1-5 integer
}

Sentiment guide:
- positive: clearly favorable, recommending, praising
- negative: clearly unfavorable, complaining, warning others away
- neutral: factual observation without strong opinion
- mixed: contains both significant praise and significant criticism

Score guide:
- 1: extremely negative or barely any positive
- 2: mostly negative or weak positive
- 3: moderate / balanced
- 4: mostly positive or mild negative
- 5: extremely positive / enthusiastic, or very harsh criticism

Rules:
- Be consistent — similar quotes should get similar scores
- The current type is a hint but you can change it
- Return only valid JSON, no markdown fences`;
}

function deriveNpsTier(sentiment: string, score: number): string {
  if (sentiment === "positive" && score >= 5) return "promoter";
  if (sentiment === "positive" && score <= 2) return "detractor";
  if (sentiment === "negative" || sentiment === "warning") return "detractor";
  return "passive";
}

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

    const body: ReclassifyRequest = await req.json();
    const batchSize = body.batch_size || 20;
    const dryRun = body.dry_run || false;

    const { data: mentions, error: fetchError } = await supabase
      .from("vendor_mentions")
      .select("id, vendor_name, quote, headline, type, dimension")
      .is("sentiment_score", null)
      .eq("is_hidden", false)
      .not("quote", "eq", "")
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ reclassified: 0, remaining: 0, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ReclassifyResult[] = [];

    for (const mention of mentions) {
      try {
        const prompt = buildReclassifyPrompt(mention);
        const raw = await callGemini(GEMINI_API_KEY, prompt);
        const parsed = JSON.parse(raw);

        const sentiment = parsed.sentiment || "negative";
        const score = Math.max(1, Math.min(5, parsed.sentiment_score || 3));
        const npsTier = deriveNpsTier(sentiment, score);

        const typeMap: Record<string, string> = {
          positive: "positive",
          negative: "negative",
          neutral: "neutral",
          mixed: "mixed",
        };
        const newType = typeMap[sentiment] || "negative";

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("vendor_mentions")
            .update({
              type: newType,
              sentiment_score: score,
              nps_tier: npsTier,
            })
            .eq("id", mention.id);

          if (updateError) throw updateError;
        }

        results.push({
          mention_id: mention.id,
          old_type: mention.type,
          new_type: newType,
          sentiment_score: score,
          nps_tier: npsTier,
          success: true,
        });

        console.log(
          `[${mention.vendor_name}] ${mention.id}: ${mention.type} → ${newType} (score=${score}, tier=${npsTier})`
        );
      } catch (e) {
        results.push({
          mention_id: mention.id,
          old_type: mention.type,
          new_type: mention.type,
          sentiment_score: 0,
          nps_tier: "",
          success: false,
          error: (e as Error).message,
        });
      }
    }

    const { count } = await supabase
      .from("vendor_mentions")
      .select("id", { count: "exact", head: true })
      .is("sentiment_score", null)
      .eq("is_hidden", false)
      .not("quote", "eq", "");

    return new Response(
      JSON.stringify({
        reclassified: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        remaining: count || 0,
        dry_run: dryRun,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("reclassify-mentions error:", error);
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
