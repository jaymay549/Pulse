import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface VendorMention {
  title: string;
  type: "positive" | "warning";
  quote: string;
}

interface DashboardIntel {
  health_score: number | null;
  metrics: Record<string, {
    score: number | null;
    mention_count?: number;
    sentiment_ratio?: number;
    velocity_score?: number;
  }>;
  benchmarks: {
    product_stability_median: number;
    customer_experience_median: number;
    value_perception_median: number;
    qualifying_vendor_count: number;
  } | null;
  percentiles: Record<string, number | null> | null;
  recommendations: {
    priority: string;
    category: string;
    metric_affected: string;
    insight_text: string;
  }[];
  feature_gaps: {
    gap_label: string;
    mention_count: number;
    trend_direction: string;
  }[];
  sentiment_history: {
    month: string;
    total_mentions: number;
    positive_count: number;
    health_estimate: number | null;
  }[];
}

interface VendorData {
  name: string;
  category: string;
  positiveCount: number;
  warningCount: number;
  mentions: VendorMention[];
  dashboardIntel?: DashboardIntel;
}

function buildDashboardSystemPrompt(vendor: VendorData): string {
  const intel = vendor.dashboardIntel!;

  const metricsSection = Object.entries(intel.metrics || {})
    .map(([key, m]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (m.score === null) return `- ${label}: Not enough data yet`;
      return `- ${label}: ${m.score}/100 (sentiment: ${m.sentiment_ratio?.toFixed(0) ?? "?"}%, velocity: ${m.velocity_score?.toFixed(1) ?? "?"}, ${m.mention_count ?? 0} mentions)`;
    })
    .join("\n");

  let benchmarkSection = "Not enough vendors in your category for benchmarks yet.";
  if (intel.benchmarks && intel.benchmarks.qualifying_vendor_count >= 4) {
    benchmarkSection = `Category: ${vendor.category} (${intel.benchmarks.qualifying_vendor_count} vendors)
- Product Stability median: ${intel.benchmarks.product_stability_median ?? "N/A"}
- Customer Experience median: ${intel.benchmarks.customer_experience_median ?? "N/A"}
- Value Perception median: ${intel.benchmarks.value_perception_median ?? "N/A"}`;
  }

  let percentileSection = "";
  if (intel.percentiles) {
    percentileSection = Object.entries(intel.percentiles)
      .filter(([, v]) => v !== null)
      .map(([key, v]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return `- ${label}: ${v}th percentile`;
      })
      .join("\n");
  }

  const recsSection =
    intel.recommendations.length > 0
      ? intel.recommendations
          .map(
            (r) =>
              `- [${r.priority.toUpperCase()}] ${r.insight_text} (affects: ${r.metric_affected}, category: ${r.category})`
          )
          .join("\n")
      : "No active recommendations.";

  const gapsSection =
    intel.feature_gaps.length > 0
      ? intel.feature_gaps
          .map(
            (g) =>
              `- "${g.gap_label}" (${g.mention_count} mentions, trending ${g.trend_direction})`
          )
          .join("\n")
      : "No significant feature gaps detected.";

  const historySection = intel.sentiment_history
    .map(
      (h) =>
        `- ${h.month}: ${h.total_mentions} mentions, ${h.positive_count} positive${h.health_estimate !== null ? `, health ~${h.health_estimate}` : ""}`
    )
    .join("\n");

  return `You are CDG Pulse AI, a vendor performance advisor for automotive dealership technology vendors. You are speaking directly to the team at ${vendor.name}.

You have access to their complete CDG Pulse performance dashboard:

HEALTH SCORE: ${intel.health_score !== null ? `${intel.health_score}/100` : "Not yet calculated (need more data)"}

PERFORMANCE METRICS:
${metricsSection}

CATEGORY BENCHMARKS:
${benchmarkSection}

${percentileSection ? `PERCENTILE RANKINGS:\n${percentileSection}\n` : ""}
ACTIVE RECOMMENDATIONS:
${recsSection}

FEATURE GAPS (recurring dealer concerns):
${gapsSection}

SENTIMENT HISTORY (last 6 months):
${historySection}

Guidelines:
- You are advising the vendor about THEIR OWN performance based on dealer feedback
- Be specific — reference exact scores, percentiles, and trends
- When they ask about improving, prioritize recommendations and feature gaps
- When they ask about comparisons, use benchmarks and percentiles (never reveal competitor names)
- Be encouraging but honest about areas needing work
- If a metric is null, explain that more dealer feedback is needed
- Keep answers concise and actionable
- Use bullet points and bold text for key insights
- Reference specific months from sentiment history when discussing trends`;
}

function buildPublicChatSystemPrompt(vendorData: VendorData[]): string {
  const vendorSummary = vendorData
    .map(
      (v) =>
        `- ${v.name} (${v.category}): ${v.positiveCount} positive, ${v.warningCount} warnings`
    )
    .join("\n");

  const detailedMentions = vendorData
    .flatMap((v) =>
      v.mentions.slice(0, 3).map(
        (m) =>
          `[${v.name}] ${m.type.toUpperCase()}: "${m.title}" - ${m.quote.slice(0, 200)}...`
      )
    )
    .slice(0, 50)
    .join("\n");

  return `You are CDG Pulse AI, an expert automotive dealership vendor advisor. You help dealers make informed decisions about which vendors to use based on real dealer feedback data.

You have access to the following vendor data from real dealer reviews:

VENDOR SUMMARY (${vendorData.length} vendors):
${vendorSummary}

SAMPLE REVIEWS:
${detailedMentions}

Your capabilities:
1. **Recommend vendors** for specific needs (DMS, CRM, F&I, marketing, etc.)
2. **Compare vendors** side-by-side based on dealer feedback
3. **Identify problems** a vendor can solve based on their positive reviews
4. **Warn about issues** based on warning reviews
5. **Category expertise** - explain which vendors excel in each category

Guidelines:
- Be concise and actionable
- Always cite specific dealer feedback when making recommendations
- Be balanced - mention both pros and cons when comparing
- If asked about a vendor you don't have data on, say so
- Focus on helping dealers make better purchasing decisions
- Use specific numbers (positive/warning counts) to support recommendations`;
}

const GEMINI_MODEL = "gemini-2.0-flash";

/**
 * Convert OpenAI-style messages to Gemini contents format.
 * System message goes into systemInstruction; "assistant" role maps to "model".
 */
function toGeminiPayload(
  systemPrompt: string,
  messages: Message[]
): { systemInstruction: { parts: { text: string }[] }; contents: { role: string; parts: { text: string }[] }[] } {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as {
      messages?: Message[];
      vendorData?: VendorData[];
    };

    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    const vendorData = Array.isArray(payload?.vendorData) ? payload.vendorData : [];

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Detect dashboard context vs public profile context
    const hasDashboardContext = vendorData[0]?.dashboardIntel;
    const systemPrompt = hasDashboardContext
      ? buildDashboardSystemPrompt(vendorData[0])
      : buildPublicChatSystemPrompt(vendorData);

    const geminiPayload = toGeminiPayload(systemPrompt, messages);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
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

    // Transform Gemini SSE stream → OpenAI-compatible SSE stream
    const geminiBody = response.body!;
    const transform = new TransformStream<Uint8Array, Uint8Array>({
      buffer: "",
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        this.buffer += text;

        let nl: number;
        while ((nl = this.buffer.indexOf("\n")) !== -1) {
          let line = this.buffer.slice(0, nl);
          this.buffer = this.buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);

          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          try {
            const parsed = JSON.parse(json);
            // Extract text from Gemini format:
            // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
            const textPart =
              parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textPart !== undefined && textPart !== null) {
              // Emit in OpenAI-compatible format
              const openaiChunk = JSON.stringify({
                choices: [{ delta: { content: textPart } }],
              });
              controller.enqueue(
                new TextEncoder().encode(`data: ${openaiChunk}\n\n`)
              );
            }
          } catch {
            // skip malformed chunks
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      },
    } as Transformer<Uint8Array, Uint8Array> & { buffer: string });

    const readableStream = geminiBody.pipeThrough(transform);

    return new Response(readableStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Vendor AI chat error:", error);
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
