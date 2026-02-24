import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const MIN_MENTIONS = 5;

interface GenerateRequest {
  vendor_name?: string;
  all?: boolean;
  force?: boolean;
}

interface Mention {
  title: string;
  quote: string;
  type: string;
  dimension: string | null;
  sentiment: string | null;
  category: string | null;
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

function buildPrompt(
  vendorName: string,
  mentions: Mention[],
  categoryMentions: Mention[],
  primaryCategory: string | null
): string {
  const positive = mentions.filter((m) => m.type === "positive");
  const warning = mentions.filter((m) => m.type === "warning");

  // Collect dimension info
  const dimensions = mentions
    .filter((m) => m.dimension)
    .map((m) => m.dimension);
  const uniqueDimensions = [...new Set(dimensions)];

  let prompt = `You are an automotive industry analyst writing an intelligence briefing about "${vendorName}" for car dealers.

Below are ${mentions.length} dealer mentions about this vendor.

`;

  if (positive.length > 0) {
    prompt += `POSITIVE MENTIONS (${positive.length}):\n`;
    for (const m of positive) {
      const dimTag = m.dimension ? ` [${m.dimension}]` : "";
      prompt += `- "${m.title}" — "${m.quote}"${dimTag}\n`;
    }
    prompt += "\n";
  }

  if (warning.length > 0) {
    prompt += `WARNING MENTIONS (${warning.length}):\n`;
    for (const m of warning) {
      const dimTag = m.dimension ? ` [${m.dimension}]` : "";
      prompt += `- "${m.title}" — "${m.quote}"${dimTag}\n`;
    }
    prompt += "\n";
  }

  if (uniqueDimensions.length > 0) {
    prompt += `DIMENSIONS DISCUSSED: ${uniqueDimensions.join(", ")}\n\n`;
  }

  if (primaryCategory && categoryMentions.length > 0) {
    prompt += `CATEGORY CONTEXT — Other vendors in "${primaryCategory}" (${categoryMentions.length} mentions):\n`;
    for (const m of categoryMentions.slice(0, 50)) {
      prompt += `- "${m.title}" — "${m.quote}"\n`;
    }
    prompt += "\n";
  }

  prompt += `Return a JSON object with this exact structure:
{
  "summary_text": "2-4 sentence intelligence summary about ${vendorName}. Synthesize what dealers are saying — strengths, concerns, and overall sentiment. Be specific and reference patterns, not individual anecdotes. Write in a professional analyst tone.",
  "category_context": ${primaryCategory ? `"1-2 sentence observation about what dealers want in the ${primaryCategory} category and how ${vendorName} fits within that landscape. Compare to peer sentiment if context is available. Return null if insufficient category data."` : "null"}
}

Rules:
- summary_text must be 2-4 sentences, substantive and specific.
- category_context should provide competitive context or be null if insufficient data.
- Do not invent information not present in the mentions.
- Do not mention specific dealer names or quote verbatim.
- Return ONLY valid JSON, no markdown fences or extra text.`;

  return prompt;
}

async function generateForVendor(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  vendorName: string,
  force: boolean
): Promise<{ vendor_name: string; success: boolean; error?: string }> {
  try {
    // Check current mention count
    const { count: currentCount } = await supabase
      .from("vendor_mentions")
      .select("id", { count: "exact", head: true })
      .eq("vendor_name", vendorName);

    const mentionCount = currentCount || 0;

    if (mentionCount < MIN_MENTIONS) {
      return {
        vendor_name: vendorName,
        success: false,
        error: `Only ${mentionCount} mentions (need ${MIN_MENTIONS}+)`,
      };
    }

    // Check if regeneration needed
    if (!force) {
      const { data: existing } = await supabase
        .from("vendor_pulse_summaries")
        .select("mention_count_at_generation")
        .eq("vendor_name", vendorName)
        .maybeSingle();

      if (existing && existing.mention_count_at_generation === mentionCount) {
        return {
          vendor_name: vendorName,
          success: true,
          error: "Skipped (no new mentions)",
        };
      }
    }

    // Fetch all mentions WITH dimension and category data
    const { data: mentions, error: mentionsError } = await supabase
      .from("vendor_mentions")
      .select("title, quote, type, dimension, sentiment, category")
      .eq("vendor_name", vendorName);

    if (mentionsError) throw mentionsError;
    if (!mentions || mentions.length === 0) {
      return { vendor_name: vendorName, success: false, error: "No mentions found" };
    }

    // Determine primary category (most common)
    const categoryCounts: Record<string, number> = {};
    for (const m of mentions) {
      if (m.category) {
        categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
      }
    }
    const primaryCategory =
      Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null;

    // Fetch category context from other vendors
    let categoryMentions: Mention[] = [];
    if (primaryCategory) {
      const { data: catMentions } = await supabase
        .from("vendor_mentions")
        .select("title, quote, type, dimension, sentiment, category")
        .eq("category", primaryCategory)
        .neq("vendor_name", vendorName)
        .limit(50);

      categoryMentions = (catMentions || []) as Mention[];
    }

    // Call Gemini
    const prompt = buildPrompt(
      vendorName,
      mentions as Mention[],
      categoryMentions,
      primaryCategory
    );
    const raw = await callGemini(geminiKey, prompt);
    const parsed = JSON.parse(raw);

    // Validate structure
    if (!parsed.summary_text || typeof parsed.summary_text !== "string") {
      throw new Error("Invalid Gemini response: missing summary_text");
    }

    // Upsert
    const { error: upsertError } = await supabase
      .from("vendor_pulse_summaries")
      .upsert(
        {
          vendor_name: vendorName,
          summary_text: parsed.summary_text,
          category_context: parsed.category_context || null,
          mention_count_at_generation: mentionCount,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_name" }
      );

    if (upsertError) throw upsertError;

    console.log(`[${vendorName}] Generated pulse summary (${mentionCount} mentions)`);
    return { vendor_name: vendorName, success: true };
  } catch (e) {
    console.error(`[${vendorName}] Error:`, e);
    return {
      vendor_name: vendorName,
      success: false,
      error: (e as Error).message,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: GenerateRequest = await req.json();
    const force = body.force || false;
    const results: { vendor_name: string; success: boolean; error?: string }[] =
      [];

    if (body.vendor_name) {
      // Single vendor
      const result = await generateForVendor(
        supabase,
        GEMINI_API_KEY,
        body.vendor_name,
        force
      );
      results.push(result);
    } else if (body.all) {
      // All vendors with 5+ mentions
      const { data: vendorRows, error: vendorError } = await supabase.rpc(
        "get_vendor_pulse_vendors_list"
      );

      if (vendorError) throw vendorError;

      const eligible = ((vendorRows as any)?.vendors || [])
        .filter((v: { name: string; count: number }) => v.count >= MIN_MENTIONS)
        .map((v: { name: string }) => v.name);

      for (const name of eligible) {
        const result = await generateForVendor(
          supabase,
          GEMINI_API_KEY,
          name,
          force
        );
        results.push(result);
      }
    } else {
      throw new Error("Provide vendor_name or all:true");
    }

    return new Response(
      JSON.stringify({
        generated: results.filter(
          (r) => r.success && !r.error?.includes("Skipped")
        ).length,
        skipped: results.filter((r) => r.error?.includes("Skipped")).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-vendor-pulse-summary error:", error);
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
