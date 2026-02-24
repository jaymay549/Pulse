import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface GenerateRequest {
  vendor_name?: string;
  all?: boolean;
  force?: boolean;
}

interface Mention {
  headline: string | null;
  quote: string | null;
  type: string;
  dimension: string | null;
  sentiment: string | null;
  category: string | null;
  source: string;
  is_hidden: boolean;
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
          temperature: 0.3,
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

// ── Prompt builders per state ──────────────────────────────

function buildPrompt(
  vendorName: string,
  mentions: Mention[],
  state: "rich" | "thin" | "empty",
  autoSummary?: string | null
): string {
  if (state === "empty") {
    return `You are writing a neutral profile overview for ${vendorName}, an automotive dealership technology vendor with no dealer feedback yet.

${autoSummary ? `PUBLIC INFO:\n${autoSummary}` : "No public information available."}

Return JSON:
{
  "summary_text": "Neutral 1-2 sentence description of what ${vendorName} does in the dealership technology space. If no info, say they are a vendor in the auto dealer tech space.",
  "sentiment": "neutral"
}`;
  }

  // Include ALL mentions (hidden + visible) so vendors can't game sentiment
  const positive = mentions.filter((m) => m.type === "positive");
  const warning = mentions.filter((m) => m.type === "warning");
  const dimensions = [
    ...new Set(mentions.filter((m) => m.dimension).map((m) => m.dimension)),
  ];

  if (state === "thin") {
    let prompt = `You are analyzing limited dealer feedback about ${vendorName} in the auto dealership tech space.

MENTIONS (${mentions.length}):\n`;
    for (const m of mentions) {
      const dim = m.dimension ? ` [${m.dimension}]` : "";
      prompt += `- [${m.type}] "${m.headline || ""}" — "${m.quote || ""}"${dim}\n`;
    }
    prompt += `\nReturn JSON:
{
  "summary_text": "2-3 sentence summary of early dealer feedback. Acknowledge limited data.",
  "sentiment": "positive, negative, or mixed",
  "top_dimension": "${dimensions[0] || ""}"
}`;
    return prompt;
  }

  // Rich state (5+)
  let prompt = `You are an automotive industry analyst summarizing dealer feedback about ${vendorName}.

${mentions.length} dealer mentions (${positive.length} positive, ${warning.length} warnings).\n\n`;

  if (positive.length > 0) {
    prompt += "POSITIVE:\n";
    for (const m of positive.slice(0, 15)) {
      const dim = m.dimension ? ` [${m.dimension}]` : "";
      prompt += `- "${m.headline || ""}" — "${m.quote || ""}"${dim}\n`;
    }
    prompt += "\n";
  }

  if (warning.length > 0) {
    prompt += "WARNINGS:\n";
    for (const m of warning.slice(0, 15)) {
      const dim = m.dimension ? ` [${m.dimension}]` : "";
      prompt += `- "${m.headline || ""}" — "${m.quote || ""}"${dim}\n`;
    }
    prompt += "\n";
  }

  if (dimensions.length > 0) {
    prompt += `DIMENSIONS: ${dimensions.join(", ")}\n\n`;
  }

  prompt += `Return JSON:
{
  "summary_text": "3-4 sentence intelligence summary. Synthesize patterns — strengths, concerns, trends. Professional analyst tone. Don't quote individuals.",
  "sentiment": "positive, negative, or mixed",
  "trend_direction": "up, down, or stable",
  "top_dimension": "${dimensions[0] || ""}"
}`;

  return prompt;
}

// ── Generate for one vendor ────────────────────────────────

async function generateForVendor(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  vendorName: string,
  force: boolean
): Promise<{ vendor_name: string; success: boolean; state?: string; error?: string }> {
  try {
    // Fetch ALL mentions including hidden (prevents gaming)
    const { data: allMentions, error: mentionsError } = await supabase
      .from("vendor_mentions")
      .select("headline, quote, type, dimension, sentiment, category, source, is_hidden")
      .eq("vendor_name", vendorName);

    if (mentionsError) throw mentionsError;

    const mentions = (allMentions || []) as Mention[];
    const mentionCount = mentions.length;

    // Determine state
    let state: "rich" | "thin" | "empty";
    if (mentionCount >= 5) state = "rich";
    else if (mentionCount > 0) state = "thin";
    else state = "empty";

    // Skip if no change since last generation
    if (!force) {
      const { data: existing } = await supabase
        .from("vendor_intelligence_cache")
        .select("mention_count_at_generation")
        .eq("vendor_name", vendorName)
        .maybeSingle();

      if (existing && existing.mention_count_at_generation === mentionCount) {
        return { vendor_name: vendorName, success: true, state, error: "Skipped (unchanged)" };
      }
    }

    // For empty state, fetch auto-summary from bootstrapping
    let autoSummary: string | null = null;
    if (state === "empty") {
      const { data: metadata } = await supabase
        .from("vendor_metadata")
        .select("auto_summary")
        .eq("vendor_name", vendorName)
        .maybeSingle();
      autoSummary = metadata?.auto_summary || null;
    }

    // Generate via Gemini
    const prompt = buildPrompt(vendorName, mentions, state, autoSummary);
    const raw = await callGemini(geminiKey, prompt);
    const parsed = JSON.parse(raw);

    if (!parsed.summary_text) {
      throw new Error("Invalid Gemini response: missing summary_text");
    }

    // Stats: only count visible mentions for display
    const visible = mentions.filter((m) => !m.is_hidden);
    const positiveCount = visible.filter((m) => m.type === "positive").length;
    const warningCount = visible.filter((m) => m.type === "warning").length;
    const externalCount = visible.filter((m) => m.source === "external").length;

    // Upsert cache
    const { error: upsertError } = await supabase
      .from("vendor_intelligence_cache")
      .upsert(
        {
          vendor_name: vendorName,
          state,
          summary_text: parsed.summary_text,
          sentiment: parsed.sentiment || "neutral",
          trend_direction: parsed.trend_direction || null,
          top_dimension: parsed.top_dimension || null,
          stats: {
            total: visible.length,
            positive: positiveCount,
            warnings: warningCount,
            external_count: externalCount,
          },
          mention_count_at_generation: mentionCount,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_name" }
      );

    if (upsertError) throw upsertError;

    console.log(`[${vendorName}] Generated intelligence (state=${state}, mentions=${mentionCount})`);
    return { vendor_name: vendorName, success: true, state };
  } catch (e) {
    console.error(`[${vendorName}] Error:`, e);
    return { vendor_name: vendorName, success: false, error: (e as Error).message };
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

    const body: GenerateRequest = await req.json();
    const force = body.force || false;
    const results: Array<{ vendor_name: string; success: boolean; state?: string; error?: string }> = [];

    if (body.vendor_name) {
      const result = await generateForVendor(supabase, GEMINI_API_KEY, body.vendor_name, force);
      results.push(result);
    } else if (body.all) {
      const { data: vendorRows } = await supabase
        .from("vendor_metadata")
        .select("vendor_name");

      for (const row of vendorRows || []) {
        const result = await generateForVendor(supabase, GEMINI_API_KEY, row.vendor_name, force);
        results.push(result);
      }
    } else {
      throw new Error("Provide vendor_name or all:true");
    }

    return new Response(
      JSON.stringify({
        generated: results.filter((r) => r.success && !r.error?.includes("Skipped")).length,
        skipped: results.filter((r) => r.error?.includes("Skipped")).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-vendor-intelligence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
