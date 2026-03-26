// supabase/functions/generate-sales-synopsis/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface SignalData {
  vendor_name: string;
  total_mentions: number;
  mentions_30d: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  mixed_count: number;
  promoter_count: number;
  detractor_count: number;
  passive_count: number;
  health_score: number | null;
  trend_direction: string | null;
  top_dimension: string | null;
  feature_gap_count: number;
  category: string | null;
  has_profile: boolean;
  confirmed_dealer_count: number;
  likely_dealer_count: number;
}

interface MentionSnippet {
  type: string;
  headline: string;
  quote: string;
  dimension: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signal, mentions } = (await req.json()) as {
      signal: SignalData;
      mentions: MentionSnippet[];
    };

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const totalNps =
      signal.promoter_count + signal.detractor_count + signal.passive_count;
    const npsScore =
      totalNps > 0
        ? Math.round(
            ((signal.promoter_count - signal.detractor_count) / totalNps) * 100
          )
        : "N/A";
    const negPct =
      signal.total_mentions > 0
        ? Math.round((signal.negative_count / signal.total_mentions) * 100)
        : 0;

    const positiveMentions = mentions
      .filter((m) => m.type === "positive")
      .slice(0, 5)
      .map((m) => `- "${m.headline}": ${m.quote}`)
      .join("\n");

    const negativeMentions = mentions
      .filter((m) => m.type !== "positive")
      .slice(0, 5)
      .map((m) => `- "${m.headline}": ${m.quote}`)
      .join("\n");

    const prompt = `You are a sales intelligence assistant for CDG Pulse, an automotive dealership vendor analytics platform. Generate a brief sales targeting synopsis for a vendor.

VENDOR: ${signal.vendor_name}
CATEGORY: ${signal.category || "Unknown"}
TOTAL MENTIONS: ${signal.total_mentions} (${signal.mentions_30d} in last 30 days)
SENTIMENT: ${negPct}% negative, trending ${signal.trend_direction || "stable"}
NPS SCORE: ${npsScore}
HEALTH SCORE: ${signal.health_score ?? "N/A"}/100
FEATURE GAPS: ${signal.feature_gap_count}
KNOWN DEALERS: ${signal.confirmed_dealer_count} confirmed + ${signal.likely_dealer_count} likely users
HAS PROFILE: ${signal.has_profile ? "Yes (existing customer)" : "No (not a customer yet)"}

POSITIVE DEALER FEEDBACK:
${positiveMentions || "None available"}

NEGATIVE DEALER FEEDBACK:
${negativeMentions || "None available"}

Respond with EXACTLY this JSON format (no markdown, no code fences):
{"data_summary": "2-3 sentences summarizing what the data says about this vendor's current standing among dealers", "pitch_angle": "1-2 sentences suggesting how a sales rep should approach this vendor, starting with 'Lead with:'"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
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
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the JSON response from Gemini
    let synopsis: { data_summary: string; pitch_angle: string };
    try {
      // Strip markdown code fences if Gemini wraps them
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      synopsis = JSON.parse(cleaned);
    } catch {
      // Fallback: use raw text as data_summary
      synopsis = {
        data_summary: text.trim(),
        pitch_angle: "Lead with: the data CDG Pulse has collected on dealer sentiment about their product.",
      };
    }

    return new Response(JSON.stringify(synopsis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-sales-synopsis error:", error);
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
