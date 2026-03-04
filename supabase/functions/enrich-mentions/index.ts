import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const BATCH_SIZE = 15; // mentions per Gemini call

// ── Valid values ──────────────────────────────────────────────

const VALID_SENTIMENTS = ["positive", "negative", "mixed", "neutral"];

const VALID_DIMENSIONS = [
  "worth_it",    // pricing, ROI, value for money
  "reliable",    // uptime, bugs, stability, data accuracy
  "integrates",  // DMS/CRM/tool integrations, data sync, API
  "support",     // customer support, response time, account reps
  "adopted",     // ease of use, onboarding, training, team adoption
  "other",       // doesn't clearly fit the above
];

const VALID_CATEGORIES = [
  "dms",               // Dealer Management Systems (CDK, Reynolds, Tekion, PBS, Frazer)
  "crm",               // Customer Relationship Management (DriveCentric, VinSolutions, Elead)
  "inventory",         // Inventory management, pricing, appraisal (vAuto, VinCue, Accu-Trade)
  "digital-retailing", // Online buying/selling tools (Roadster, Darwin, Gubagoo)
  "fixed-ops",         // Service, parts, recalls, repair orders
  "marketing",         // Digital advertising, SEO, SEM, social media
  "ai-automation",     // AI chatbots, automation tools (Impel, Numa, Matador)
  "call-management",   // Phone tracking, call analytics (CallRevu, Car Wars)
  "equity-mining",     // Data mining for trade equity opportunities
  "f-and-i",           // Finance & Insurance products and tools
  "accounting",        // Dealership accounting software
  "training",          // Training, consulting, 20-groups (NCM, Chris Collins)
  "website",           // Website providers (Dealer Inspire, DealerOn, Dealer.com)
  "reputation",        // Reviews, reputation management (Podium, Birdeye)
  "desking",           // Deal structuring, desking tools
  "compliance",        // Compliance, regulatory tools
  "other",             // Doesn't fit above categories
];

// ── Gemini helper ────────────────────────────────────────────

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
          temperature: 0.1,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

// ── Enrichment prompt ────────────────────────────────────────

interface MentionRow {
  id: string;
  vendor_name: string;
  title: string | null;
  quote: string;
  explanation: string | null;
  type: string;
  category: string;
}

interface PreviewChange {
  mention_id: string;
  vendor_name: string;
  display_mode: "raw" | "rewritten_negative";
  quality_score: number | null;
  evidence_level: string | null;
  original_quote: string;
  display_text: string;
}

async function resolveVendorEntityId(
  supabase: ReturnType<typeof createClient>,
  vendorName: string
): Promise<string | null> {
  try {
    const { data } = await supabase.rpc("resolve_vendor_family", {
      p_vendor_name: vendorName,
      p_title: null,
      p_quote: null,
      p_explanation: null,
    });
    const first = Array.isArray(data) ? data[0] : null;
    return (first?.vendor_entity_id as string | undefined) || null;
  } catch {
    return null;
  }
}

function buildEnrichmentPrompt(mentions: MentionRow[]): string {
  const mentionList = mentions.map((m, i) =>
    `${i}. [${m.type}] Vendor: ${m.vendor_name} | Current category: ${m.category}\n   Title: "${m.title ?? ""}"\n   Quote: "${m.quote}"\n   Explanation: "${m.explanation ?? ""}"`
  ).join("\n\n");

  return `You are an automotive dealership technology analyst. For each dealer mention below, extract structured intelligence.

MENTIONS:
${mentionList}

For EACH mention, return:
1. "sentiment": The actual sentiment of the quote. One of: ${VALID_SENTIMENTS.join(", ")}
   - "positive" = clearly favorable
   - "negative" = clearly unfavorable or complaint
   - "mixed" = contains both praise and criticism
   - "neutral" = factual statement, neither positive nor negative

2. "dimension": What aspect of the vendor is being discussed. One of: ${VALID_DIMENSIONS.join(", ")}
   - "worth_it" = pricing, cost, ROI, value for money
   - "reliable" = product stability, bugs, uptime, data accuracy
   - "integrates" = integration with other tools, DMS connectivity, data sync, API
   - "support" = customer support, account managers, response time, training support
   - "adopted" = ease of use, onboarding, user adoption, learning curve
   - "other" = doesn't clearly fit above

3. "headline": A 4-8 word actionable summary. Write it as a theme, not a sentence.
   Good: "Slow DMS integration sync issues"
   Good: "Excellent onboarding and training support"
   Bad: "The vendor has problems" (too vague)

4. "category": The correct product category. One of: ${VALID_CATEGORIES.join(", ")}
   IMPORTANT: "dms" and "crm" are DIFFERENT categories.
   - DMS = Dealer Management System (back-office: accounting, deal logging, parts, service scheduling). Examples: CDK, Reynolds, Tekion, PBS, Frazer, DealerTrack
   - CRM = Customer Relationship Management (sales: lead management, follow-up, communication). Examples: DriveCentric, VinSolutions, Elead, DealerSocket
   - If a vendor does BOTH, classify based on what THIS specific quote is discussing

5. "pricing_signal": If the quote mentions specific pricing, cost, fees, or ROI, extract it as an object:
   {"amount": "dollar amount or range if mentioned", "context": "what the price is for"}
   Return null if no pricing is mentioned.

6. "switching_signal": If the quote mentions switching from/to another vendor, extract it:
   {"direction": "to" or "from", "other_vendor": "name of the other vendor", "reason": "why they switched"}
   Return null if no switching is mentioned.

7. "quality_score": Integer 0-100 indicating information quality/actionability.
   - 0-30: mostly opinion/rant, low signal
   - 31-59: mixed quality, partial signal
   - 60-79: useful and fairly specific
   - 80-100: specific, actionable, evidence-backed

8. "evidence_level": one of "none", "weak", "moderate", "strong"

9. "is_opinion_heavy": true if mostly subjective language with limited concrete details.

10. "rewritten_negative_text": only for warning mentions that are low/medium quality or opinion-heavy.
    - Write concise normalized output:
      Concern: ...
      Dealer impact: ...
      Action signal: ...
    - Keep neutral tone.
    - No invented facts.
    - Do NOT use loaded or defamatory wording (e.g., "vaporware", "scam", "fraud", "garbage", "trash").
    - Do NOT include imperative recommendations like "avoid adopting" or "do not use".
    - If evidence_level is "none" or "weak", DO NOT include "Action signal". Use this 2-line format instead:
      Concern: General negative sentiment noted.
      Dealer impact: Limited concrete detail provided.
    - Null when mention should remain raw.

11. "rewrite_confidence": number between 0 and 1 (null when rewritten_negative_text is null).

Return a JSON array with one object per mention, in the same order. Each object:
{
  "index": 0,
  "sentiment": "positive",
  "dimension": "support",
  "headline": "Outstanding account manager responsiveness",
  "category": "crm",
  "pricing_signal": null,
  "switching_signal": null,
  "quality_score": 72,
  "evidence_level": "moderate",
  "is_opinion_heavy": false,
  "rewritten_negative_text": null,
  "rewrite_confidence": null
}`;
}

// ── Validation ───────────────────────────────────────────────

interface EnrichmentResult {
  index: number;
  sentiment: string;
  dimension: string;
  headline: string;
  category: string;
  pricing_signal: { amount: string; context: string } | null;
  switching_signal: { direction: string; other_vendor: string; reason: string } | null;
  quality_score?: number;
  evidence_level?: "none" | "weak" | "moderate" | "strong";
  is_opinion_heavy?: boolean;
  rewritten_negative_text?: string | null;
  rewrite_confidence?: number | null;
}

function validateResult(r: EnrichmentResult): EnrichmentResult {
  const evidenceLevel = ["none", "weak", "moderate", "strong"].includes(r.evidence_level || "")
    ? r.evidence_level
    : "weak";

  const qualityScore = Number.isFinite(r.quality_score as number)
    ? Math.max(0, Math.min(100, Math.round(r.quality_score as number)))
    : 55;

  const rewriteConfidence = Number.isFinite(r.rewrite_confidence as number)
    ? Math.max(0, Math.min(1, Number(r.rewrite_confidence)))
    : null;

  return {
    index: r.index,
    sentiment: VALID_SENTIMENTS.includes(r.sentiment) ? r.sentiment : "neutral",
    dimension: VALID_DIMENSIONS.includes(r.dimension) ? r.dimension : "other",
    headline: (r.headline || "").slice(0, 100) || "General mention",
    category: VALID_CATEGORIES.includes(r.category) ? r.category : "other",
    pricing_signal: r.pricing_signal && r.pricing_signal.amount ? r.pricing_signal : null,
    switching_signal: r.switching_signal && r.switching_signal.other_vendor ? r.switching_signal : null,
    quality_score: qualityScore,
    evidence_level: evidenceLevel,
    is_opinion_heavy: !!r.is_opinion_heavy,
    rewritten_negative_text: r.rewritten_negative_text ? r.rewritten_negative_text.slice(0, 500) : null,
    rewrite_confidence: rewriteConfidence,
  };
}

function sanitizeRewrittenText(
  rewritten: string | null | undefined,
  evidenceLevel: "none" | "weak" | "moderate" | "strong"
): string | null {
  if (!rewritten) return null;

  let text = rewritten;

  // Remove loaded wording and strong imperatives.
  const replacements: Array<[RegExp, string]> = [
    [/\bvaporware\b/gi, "immature offering"],
    [/\bscam\b/gi, "questionable fit"],
    [/\bfraud\b/gi, "trust concern"],
    [/\bgarbage\b/gi, "low satisfaction"],
    [/\btrash\b/gi, "low satisfaction"],
    [/\bavoid adopting\b/gi, "evaluate carefully"],
    [/\bdo not use\b/gi, "consider alternatives carefully"],
    [/\bstay away\b/gi, "proceed with caution"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  // For weak/none evidence, enforce non-prescriptive two-line format.
  if (evidenceLevel === "none" || evidenceLevel === "weak") {
    return "Concern: General negative sentiment noted.\nDealer impact: Limited concrete detail provided.";
  }

  return text.slice(0, 500);
}

// ── Process a batch ──────────────────────────────────────────

async function processBatch(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  mentions: MentionRow[]
): Promise<{ updated: number; errors: number; preview_changes: PreviewChange[] }> {
  let updated = 0;
  let errors = 0;
  const previewChanges: PreviewChange[] = [];

  try {
    const prompt = buildEnrichmentPrompt(mentions);
    const raw = await callGemini(geminiKey, prompt);
    const results: EnrichmentResult[] = JSON.parse(raw);

    if (!Array.isArray(results)) {
      throw new Error("Gemini returned non-array response");
    }

    for (const rawResult of results) {
      const result = validateResult(rawResult);
      const mention = mentions[result.index];
      if (!mention) continue;

      const updateData: Record<string, unknown> = {
        sentiment: result.sentiment,
        dimension: result.dimension,
        headline: result.headline,
        quality_score: result.quality_score ?? 55,
        evidence_level: result.evidence_level ?? "weak",
        is_opinion_heavy: result.is_opinion_heavy ?? false,
        rewrite_model_version: "gemini-2.0-flash:negative-policy-v1",
        rewrite_updated_at: new Date().toISOString(),
      };

      // Update category on the mention if it changed
      if (result.category !== mention.category) {
        updateData.category = result.category;
      }

      if (result.pricing_signal) {
        updateData.pricing_signal = result.pricing_signal;
      }

      if (result.switching_signal) {
        updateData.switching_signal = result.switching_signal;
      }

      // Display policy:
      // - non-warning mentions always raw
      // - warning mentions are raw if strong evidence OR quality>=60 and not opinion-heavy
      // - otherwise show rewritten_negative when rewrite text exists
      const isWarning = mention.type === "warning";
      const evidenceStrong = result.evidence_level === "strong";
      const qualityHighEnough = (result.quality_score ?? 0) >= 60;
      const opinionHeavy = !!result.is_opinion_heavy;
      const keepRawWarning = evidenceStrong || (qualityHighEnough && !opinionHeavy);
      const sanitizedRewrite = sanitizeRewrittenText(
        result.rewritten_negative_text,
        result.evidence_level ?? "weak"
      );

      if (!isWarning || keepRawWarning || !sanitizedRewrite) {
        updateData.display_mode = "raw";
        updateData.display_text = null;
      } else {
        updateData.display_mode = "rewritten_negative";
        updateData.display_text = sanitizedRewrite;
      }
      updateData.rewrite_confidence = result.rewrite_confidence;
      updateData.rewrite_status = "done";

      const { error } = await supabase
        .from("vendor_mentions")
        .update(updateData)
        .eq("id", mention.id);

      if (error) {
        console.error(`Failed to update mention ${mention.id}:`, error);
        errors++;
      } else {
        updated++;
        if (
          updateData.display_mode === "rewritten_negative" &&
          typeof updateData.display_text === "string" &&
          previewChanges.length < 4
        ) {
          previewChanges.push({
            mention_id: mention.id,
            vendor_name: mention.vendor_name,
            display_mode: "rewritten_negative",
            quality_score: (result.quality_score ?? null),
            evidence_level: (result.evidence_level ?? null),
            original_quote: mention.quote,
            display_text: updateData.display_text,
          });
        }
      }
    }
  } catch (e) {
    console.error("Batch processing error:", e);
    errors += mentions.length;
  }

  return { updated, errors, preview_changes: previewChanges };
}

// ── Backfill vendor_metadata.category ────────────────────────

async function backfillVendorCategories(
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  // For each vendor, find the most common category across their mentions
  const { data: vendors, error } = await supabase
    .from("vendor_metadata")
    .select("vendor_name");

  if (error || !vendors) return 0;

  let updated = 0;

  for (const vendor of vendors) {
    const { data: mentions } = await supabase
      .from("vendor_mentions")
      .select("category")
      .eq("vendor_name", vendor.vendor_name)
      .eq("is_hidden", false);

    if (!mentions || mentions.length === 0) continue;

    // Find most common category
    const counts: Record<string, number> = {};
    for (const m of mentions) {
      if (m.category) {
        counts[m.category] = (counts[m.category] || 0) + 1;
      }
    }

    const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!topCategory) continue;

    const { error: updateErr } = await supabase
      .from("vendor_metadata")
      .update({ category: topCategory[0] })
      .eq("vendor_name", vendor.vendor_name);

    if (!updateErr) updated++;
  }

  return updated;
}

// ── Handler ──────────────────────────────────────────────────

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

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "unenriched"; // "unenriched" | "all" | "vendor" | "display_policy"
    const vendorName = body.vendor_name as string | undefined;
    const vendorNameTrimmed = vendorName?.trim() || "";
    const limit = body.limit || 2000;
    const force = !!body.force;

    // Build query for mentions to enrich
    let query = supabase
      .from("vendor_mentions")
      .select("id, vendor_name, title, quote, explanation, type, category")
      .eq("is_hidden", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (mode === "unenriched") {
      // Only mentions that haven't been enriched yet
      query = query.is("dimension", null);
    } else if (mode === "vendor" && vendorNameTrimmed) {
      query = query.eq("vendor_name", vendorNameTrimmed);
    } else if (mode === "display_policy") {
      query = query.eq("type", "warning");
      if (!force) {
        query = query.neq("rewrite_status", "done");
      }
      if (vendorNameTrimmed) {
        const entityId = await resolveVendorEntityId(supabase, vendorNameTrimmed);
        if (entityId) {
          // Family-aware filter (CDK parent + mapped product lines).
          query = query.eq("vendor_entity_id", entityId);
        } else {
          // Fallback fuzzy name match for unmapped data.
          query = query.ilike("vendor_name", `%${vendorNameTrimmed}%`);
        }
      }
    }
    // mode === "all" uses no additional filters

    const { data: mentions, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No mentions to enrich", updated: 0, errors: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enriching ${mentions.length} mentions in batches of ${BATCH_SIZE}...`);

    let totalUpdated = 0;
    let totalErrors = 0;
    const previewChanges: PreviewChange[] = [];

    // Process in batches
    for (let i = 0; i < mentions.length; i += BATCH_SIZE) {
      const batch = mentions.slice(i, i + BATCH_SIZE) as MentionRow[];
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(mentions.length / BATCH_SIZE);

      console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} mentions)...`);

      const result = await processBatch(supabase, GEMINI_API_KEY, batch);
      totalUpdated += result.updated;
      totalErrors += result.errors;
      for (const sample of result.preview_changes) {
        if (previewChanges.length >= 4) break;
        previewChanges.push(sample);
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < mentions.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Backfill vendor_metadata.category from enriched mentions
    console.log("Backfilling vendor categories...");
    const categoriesUpdated = await backfillVendorCategories(supabase);

    return new Response(
      JSON.stringify({
        total_mentions: mentions.length,
        updated: totalUpdated,
        errors: totalErrors,
        batches: Math.ceil(mentions.length / BATCH_SIZE),
        vendor_categories_updated: categoriesUpdated,
        preview_changes: previewChanges,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("enrich-mentions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
