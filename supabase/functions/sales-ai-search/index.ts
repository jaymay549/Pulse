// supabase/functions/sales-ai-search/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface VendorSignal {
  vendor_name: string;
  category: string | null;
  total_mentions: number;
  mentions_30d: number;
  mentions_90d: number;
  positive_count: number;
  negative_count: number;
  health_score: number | null;
  trend_direction: string | null;
  feature_gap_count: number;
  pain_score: number;
  buzz_score: number;
  gap_score: number;
  known_dealers: number;
  has_profile: boolean;
  nps_score: number | null;
  negative_pct: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, vendors } = (await req.json()) as {
      question: string;
      vendors: VendorSignal[];
    };

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Build a compact data summary for context
    const vendorSummary = vendors
      .map(
        (v) =>
          `${v.vendor_name} | cat=${v.category || "?"} | 30d=${v.mentions_30d} 90d=${v.mentions_90d} total=${v.total_mentions} | neg=${v.negative_pct}% nps=${v.nps_score ?? "?"} health=${v.health_score ?? "?"} | trend=${v.trend_direction || "?"} | gaps=${v.feature_gap_count} dealers=${v.known_dealers} | pain=${v.pain_score} buzz=${v.buzz_score} gap=${v.gap_score} | profile=${v.has_profile}`
      )
      .join("\n");

    const prompt = `You are a sales intelligence analyst for CDG Pulse, an automotive dealership vendor analytics platform. You have access to the following vendor opportunity data from our sales targets dashboard.

DATA FIELDS:
- cat: product category
- 30d/90d/total: mention counts (30 day, 90 day, all time)
- neg: percentage of negative mentions
- nps: Net Promoter Score (-100 to 100)
- health: overall health score (0-100)
- trend: sentiment direction (improving/declining/stable)
- gaps: number of unmet feature requests
- dealers: known dealer users
- pain/buzz/gap: opportunity scores (0-100, higher = bigger opportunity)
- profile: whether they've claimed their CDG Pulse profile (true = existing customer)

VENDOR DATA (${vendors.length} vendors):
${vendorSummary}

USER QUESTION: ${question}

Answer concisely and specifically using the data above. Reference specific vendors and numbers. If the question is about strategy or targeting, give actionable advice. Format with markdown for readability.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    return new Response(JSON.stringify({ answer: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sales-ai-search error:", error);
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
