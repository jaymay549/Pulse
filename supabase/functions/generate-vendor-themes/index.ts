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

function buildPrompt(vendorName: string, mentions: Mention[]): string {
  const positive = mentions.filter((m) => m.type === "positive");
  const warning = mentions.filter((m) => m.type === "warning");

  let prompt = `You are analyzing dealer feedback about "${vendorName}", an automotive industry vendor.

Below are ${mentions.length} dealer mentions, grouped by sentiment.

`;

  if (positive.length > 0) {
    prompt += `POSITIVE MENTIONS (${positive.length}):\n`;
    for (const m of positive) {
      prompt += `- "${m.title}" — "${m.quote}"\n`;
    }
    prompt += "\n";
  }

  if (warning.length > 0) {
    prompt += `WARNING MENTIONS (${warning.length}):\n`;
    for (const m of warning) {
      prompt += `- "${m.title}" — "${m.quote}"\n`;
    }
    prompt += "\n";
  }

  prompt += `Synthesize the mentions into themes. Return a JSON object with this exact structure:
{
  "positiveThemes": [
    {
      "label": "2-5 word theme name",
      "summary": "1-2 sentence synthesis of what dealers are saying about this theme. Reference patterns across multiple mentions, not single anecdotes.",
      "mention_count": <number of mentions that relate to this theme>
    }
  ],
  "warningThemes": [
    {
      "label": "2-5 word theme name",
      "summary": "1-2 sentence synthesis",
      "mention_count": <number>
    }
  ]
}

Rules:
- Return 3-4 themes per sentiment type (fewer if insufficient data for that sentiment).
- If there are 0 mentions for a sentiment, return an empty array for that key.
- Theme labels should be concise and specific (e.g., "Responsive support team", "Complex pricing structure").
- Summaries should synthesize patterns across mentions, not quote individual dealers.
- mention_count per theme should sum to roughly the total mentions for that sentiment.
- Do not invent information not present in the mentions.
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
        .from("vendor_theme_summaries")
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

    // Fetch all mentions
    const { data: mentions, error: mentionsError } = await supabase
      .from("vendor_mentions")
      .select("title, quote, type")
      .eq("vendor_name", vendorName);

    if (mentionsError) throw mentionsError;
    if (!mentions || mentions.length === 0) {
      return { vendor_name: vendorName, success: false, error: "No mentions found" };
    }

    // Call Gemini
    const prompt = buildPrompt(vendorName, mentions as Mention[]);
    const raw = await callGemini(geminiKey, prompt);
    const themes = JSON.parse(raw);

    // Validate structure
    if (!themes.positiveThemes || !themes.warningThemes) {
      throw new Error("Invalid Gemini response structure");
    }

    // Upsert
    const { error: upsertError } = await supabase
      .from("vendor_theme_summaries")
      .upsert(
        {
          vendor_name: vendorName,
          themes,
          mention_count_at_generation: mentionCount,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_name" }
      );

    if (upsertError) throw upsertError;

    console.log(`[${vendorName}] Generated themes (${mentionCount} mentions)`);
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
      // All vendors with 5+ mentions — use raw SQL to avoid Supabase JS 1,000-row default limit
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
    console.error("generate-vendor-themes error:", error);
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
