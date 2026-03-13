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

interface FeatureGap {
  id: string;
  gap_label: string;
  mention_count: number;
}

// Maps the human-readable dimension label back to DB dimension keys
const LABEL_TO_DIMENSIONS: Record<string, string[]> = {
  "Product reliability":  ["reliable"],
  "Integration quality":  ["integrates"],
  "Support & training":   ["support"],
  "Adoption & onboarding": ["adopted"],
  "Pricing & value":      ["worth_it"],
};

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

// ── Prompt builders ────────────────────────────────────────

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

function buildGapInsightPrompt(
  vendorName: string,
  dimensionLabel: string,
  quotes: string[]
): string {
  const count = quotes.length;
  return `You are an automotive technology consultant reviewing dealer concerns about ${vendorName}.

AREA OF CONCERN: ${dimensionLabel} (${count} dealer concern${count !== 1 ? "s" : ""})

WHAT DEALERS SAID:
${quotes.slice(0, 12).map((q) => `- "${q}"`).join("\n")}

Write ONE actionable recommendation for ${vendorName}'s leadership team (1-2 sentences).
Rules:
- Identify the specific problem pattern or root cause you see in the feedback
- Suggest a concrete, practical next step they should take
- Professional, direct tone — like a consultant briefing a VP
- Do NOT quote dealers verbatim or start with the vendor name
- Do NOT mention "CDGPulse", "survey", "poll", or "dealers say"

Return JSON: {"insight": "your 1-2 sentence recommendation"}`;
}

// ── Generate gap insights for one vendor ───────────────────

async function generateGapInsights(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  canonicalName: string,
  vendorEntityId: string | null,
  originalVendorName: string
): Promise<number> {
  // Fetch existing feature gaps
  const { data: gapsData } = await supabase
    .from("vendor_feature_gaps")
    .select("id, gap_label, mention_count")
    .eq("vendor_name", canonicalName);

  const gaps = (gapsData || []) as FeatureGap[];
  if (gaps.length === 0) return 0;

  let updated = 0;

  for (const gap of gaps) {
    // gap_label is a dimension label like "Product reliability"
    // Map it back to DB dimension keys to find matching mentions
    const dimensions = LABEL_TO_DIMENSIONS[gap.gap_label];
    if (!dimensions || dimensions.length === 0) {
      console.warn(`[${canonicalName}] No dimension mapping for gap "${gap.gap_label}"`);
      continue;
    }

    let quotesQuery = supabase
      .from("vendor_mentions")
      .select("quote, headline")
      .eq("type", "warning")
      .eq("is_hidden", false)
      .in("dimension", dimensions)
      .not("quote", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);

    if (vendorEntityId) {
      quotesQuery = quotesQuery.eq("vendor_entity_id", vendorEntityId);
    } else {
      quotesQuery = quotesQuery.eq("vendor_name", originalVendorName);
    }

    const { data: mentionData } = await quotesQuery;
    const quotes = (mentionData || [])
      .map((m: { quote: string | null; headline: string | null }) =>
        m.quote || m.headline
      )
      .filter(Boolean) as string[];

    if (quotes.length === 0) continue;

    const prompt = buildGapInsightPrompt(canonicalName, gap.gap_label, quotes);

    try {
      const raw = await callGemini(geminiKey, prompt);
      const parsed = JSON.parse(raw);
      const insight = parsed.insight as string | undefined;

      if (insight && insight.length > 10) {
        await supabase
          .from("vendor_feature_gaps")
          .update({ ai_insight: insight })
          .eq("id", gap.id);
        updated++;
      }
    } catch (e) {
      console.warn(`[${canonicalName}] Gap insight error for "${gap.gap_label}":`, e);
    }
  }

  return updated;
}

// ── Generate for one vendor ────────────────────────────────

async function generateForVendor(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  vendorName: string,
  force: boolean
): Promise<{ vendor_name: string; success: boolean; state?: string; gaps_generated?: number; error?: string }> {
  try {
    // Resolve vendor entity ID and canonical name for entity-aware fetching
    const { data: entityRows } = await supabase.rpc(
      "resolve_vendor_family_name_only",
      { p_vendor_name: vendorName }
    );
    const entityRow = (entityRows as any[])?.[0] ?? null;
    const vendorEntityId: string | null = entityRow?.vendor_entity_id ?? null;
    const canonicalName: string = entityRow?.canonical_name ?? vendorName;

    // Fetch ALL mentions including hidden (prevents gaming)
    let mentionsQuery = supabase
      .from("vendor_mentions")
      .select("headline, quote, type, dimension, sentiment, category, source, is_hidden");

    if (vendorEntityId) {
      mentionsQuery = mentionsQuery.eq("vendor_entity_id", vendorEntityId);
    } else {
      mentionsQuery = mentionsQuery.eq("vendor_name", vendorName);
    }

    const { data: allMentions, error: mentionsError } = await mentionsQuery;

    if (mentionsError) throw mentionsError;

    const mentions = (allMentions || []) as Mention[];
    const mentionCount = mentions.length;

    // Determine state
    let state: "rich" | "thin" | "empty";
    if (mentionCount >= 5) state = "rich";
    else if (mentionCount > 0) state = "thin";
    else state = "empty";

    // Check if summary needs regeneration
    let summaryChanged = true;
    if (!force) {
      const { data: existing } = await supabase
        .from("vendor_intelligence_cache")
        .select("mention_count_at_generation")
        .eq("vendor_name", canonicalName)
        .maybeSingle();

      if (existing && existing.mention_count_at_generation === mentionCount) {
        summaryChanged = false;
      }
    }

    if (summaryChanged) {
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

      // Generate overall vendor summary via Gemini
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

      const { error: upsertError } = await supabase
        .from("vendor_intelligence_cache")
        .upsert(
          {
            vendor_name: canonicalName,
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
    }

    // Always generate/refresh gap insights (gaps recomputed separately by cron)
    const gapsGenerated = await generateGapInsights(
      supabase,
      geminiKey,
      canonicalName,
      vendorEntityId,
      vendorName
    );

    const logLabel = summaryChanged ? "Generated" : "Refreshed gaps only";
    console.log(
      `[${canonicalName}] ${logLabel} (state=${state}, mentions=${mentionCount}, gap_insights=${gapsGenerated})`
    );

    if (!summaryChanged && gapsGenerated === 0) {
      return { vendor_name: canonicalName, success: true, state, gaps_generated: 0, error: "Skipped (unchanged)" };
    }

    return { vendor_name: canonicalName, success: true, state, gaps_generated: gapsGenerated };
  } catch (e) {
    console.error(`[${vendorName}] Error:`, e);
    return {
      vendor_name: vendorName,
      success: false,
      error: String(e instanceof Error ? e.message : e),
    };
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
    const results: Array<{
      vendor_name: string;
      success: boolean;
      state?: string;
      gaps_generated?: number;
      error?: string;
    }> = [];

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
