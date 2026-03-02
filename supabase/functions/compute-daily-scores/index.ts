import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

// ── Types ────────────────────────────────────────────────────

interface RuleFired {
  rule_id: string;
  priority: "high" | "medium" | "low";
  category: string;
  metric_affected: string | null;
  supporting_data: Record<string, unknown>;
}

interface MetricData {
  score: number | null;
  mention_count: number;
  below_threshold: boolean;
  sentiment_ratio?: number;
  velocity_score?: number;
  positive_count?: number;
  recent_mentions?: number;
  prior_mentions?: number;
}

interface VendorMetrics {
  health_score: number | null;
  product_stability: MetricData;
  customer_experience: MetricData;
  value_perception: MetricData;
}

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

// ── Rule Engine ──────────────────────────────────────────────

interface PreviousScores {
  product_stability: number | null;
  customer_experience: number | null;
  value_perception: number | null;
  health_score: number | null;
}

interface Benchmarks {
  product_stability_median: number | null;
  customer_experience_median: number | null;
  value_perception_median: number | null;
}

function evaluateRules(
  vendorName: string,
  current: VendorMetrics,
  previous: PreviousScores | null,
  benchmarks: Benchmarks | null,
  featureGapCount: number,
  mentionVolumeCurrent: number,
  mentionVolumePrior: number
): RuleFired[] {
  const rules: RuleFired[] = [];

  const metrics: { key: string; score: number | null; prev: number | null; bench: number | null; data: MetricData }[] = [
    {
      key: "product_stability",
      score: current.product_stability?.score ?? null,
      prev: previous?.product_stability ?? null,
      bench: benchmarks?.product_stability_median ?? null,
      data: current.product_stability,
    },
    {
      key: "customer_experience",
      score: current.customer_experience?.score ?? null,
      prev: previous?.customer_experience ?? null,
      bench: benchmarks?.customer_experience_median ?? null,
      data: current.customer_experience,
    },
    {
      key: "value_perception",
      score: current.value_perception?.score ?? null,
      prev: previous?.value_perception ?? null,
      bench: benchmarks?.value_perception_median ?? null,
      data: current.value_perception,
    },
  ];

  for (const m of metrics) {
    if (m.score === null) continue;

    // Metric Drop Alert: >10 point drop
    if (m.prev !== null && m.prev - m.score > 10) {
      rules.push({
        rule_id: "metric_drop",
        priority: "high",
        category: "urgent",
        metric_affected: m.key,
        supporting_data: {
          current_score: m.score,
          previous_score: m.prev,
          delta: Math.round(m.prev - m.score),
          velocity_score: m.data.velocity_score,
        },
      });
    }

    // Dimension Weakness: any dimension <40% positive
    if (m.data.sentiment_ratio !== undefined && m.data.sentiment_ratio < 40) {
      rules.push({
        rule_id: "dimension_weakness",
        priority: "high",
        category: "improvement",
        metric_affected: m.key,
        supporting_data: {
          sentiment_ratio: m.data.sentiment_ratio,
          mention_count: m.data.mention_count,
        },
      });
    }

    // Momentum Win: >15 point increase
    if (m.prev !== null && m.score - m.prev > 15) {
      rules.push({
        rule_id: "momentum_win",
        priority: "medium",
        category: "celebrate",
        metric_affected: m.key,
        supporting_data: {
          current_score: m.score,
          previous_score: m.prev,
          delta: Math.round(m.score - m.prev),
        },
      });
    }

    // Below Category: >15 points below median
    if (m.bench !== null && m.bench - m.score > 15) {
      rules.push({
        rule_id: "below_category",
        priority: "medium",
        category: "competitive",
        metric_affected: m.key,
        supporting_data: {
          current_score: m.score,
          category_median: m.bench,
          gap: Math.round(m.bench - m.score),
        },
      });
    }
  }

  // Feature Gap Cluster: 3+ gaps detected
  if (featureGapCount >= 3) {
    rules.push({
      rule_id: "feature_gap_cluster",
      priority: "medium",
      category: "product",
      metric_affected: null,
      supporting_data: { gap_count: featureGapCount },
    });
  }

  // Volume Spike: >50% increase
  if (mentionVolumePrior > 0) {
    const volumeChange = ((mentionVolumeCurrent - mentionVolumePrior) / mentionVolumePrior) * 100;
    if (volumeChange > 50) {
      rules.push({
        rule_id: "volume_spike",
        priority: "low",
        category: "awareness",
        metric_affected: null,
        supporting_data: {
          current_volume: mentionVolumeCurrent,
          prior_volume: mentionVolumePrior,
          change_pct: Math.round(volumeChange),
        },
      });
    }
  }

  // Stale Data: no recent mentions (checked via current volume = 0)
  if (mentionVolumeCurrent === 0 && mentionVolumePrior > 0) {
    rules.push({
      rule_id: "stale_data",
      priority: "low",
      category: "engagement",
      metric_affected: null,
      supporting_data: { last_mention_volume: mentionVolumePrior },
    });
  }

  return rules;
}

// ── LLM Recommendation Text ─────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  product_stability: "Product Stability",
  customer_experience: "Customer Experience",
  value_perception: "Value Perception",
};

function buildRecommendationPrompt(rules: RuleFired[], vendorName: string): string {
  const ruleDescriptions = rules.map((r, i) => {
    const metricLabel = r.metric_affected ? METRIC_LABELS[r.metric_affected] || r.metric_affected : "overall";
    return `${i + 1}. Rule: ${r.rule_id} | Priority: ${r.priority} | Metric: ${metricLabel} | Data: ${JSON.stringify(r.supporting_data)}`;
  }).join("\n");

  return `You are a vendor intelligence advisor for ${vendorName}, an automotive dealership technology vendor.

Generate actionable recommendations based on these triggered rules:

${ruleDescriptions}

For each rule, write a 2-3 sentence insight. Be specific, cite the numbers, and end with a concrete suggestion.

Tone: professional strategist, not alarmist. Frame negatives as opportunities.

Return JSON array:
[
  {
    "rule_index": 0,
    "insight_text": "Your Product Stability score dropped 14 points this month..."
  },
  ...
]`;
}

// ── Process one vendor ───────────────────────────────────────

async function processVendor(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  vendorName: string
): Promise<{ vendor_name: string; success: boolean; error?: string }> {
  try {
    // 1. Get previous scores before recomputing
    const { data: prevScores } = await supabase
      .from("vendor_metric_scores")
      .select("product_stability, customer_experience, value_perception, health_score")
      .eq("vendor_name", vendorName)
      .maybeSingle();

    // 2. Compute metrics (calls the SQL RPC)
    const { data: metricsResult, error: metricsErr } = await supabase
      .rpc("compute_vendor_metrics", { p_vendor_name: vendorName });
    if (metricsErr) throw metricsErr;

    const metrics = metricsResult as VendorMetrics;

    // 3. Compute feature gaps
    const { data: gapsResult, error: gapsErr } = await supabase
      .rpc("compute_vendor_feature_gaps", { p_vendor_name: vendorName });
    if (gapsErr) throw gapsErr;

    const gaps = (gapsResult || []) as unknown[];

    // 4. Get vendor category & compute benchmarks
    const { data: meta } = await supabase
      .from("vendor_metadata")
      .select("category")
      .eq("vendor_name", vendorName)
      .maybeSingle();

    let benchmarks: Benchmarks | null = null;
    if (meta?.category) {
      const { data: benchResult } = await supabase
        .rpc("compute_category_benchmarks", { p_category: meta.category });
      if (benchResult) {
        benchmarks = benchResult as Benchmarks;
      }
    }

    // 5. Get mention volumes for rules
    const { count: currentVolume } = await supabase
      .from("vendor_mentions")
      .select("*", { count: "exact", head: true })
      .eq("vendor_name", vendorName)
      .eq("is_hidden", false)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

    const { count: priorVolume } = await supabase
      .from("vendor_mentions")
      .select("*", { count: "exact", head: true })
      .eq("vendor_name", vendorName)
      .eq("is_hidden", false)
      .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
      .lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

    // 6. Evaluate rules
    const firedRules = evaluateRules(
      vendorName,
      metrics,
      prevScores as PreviousScores | null,
      benchmarks,
      gaps.length,
      currentVolume || 0,
      priorVolume || 0
    );

    // 7. Deactivate old recommendations
    await supabase
      .from("vendor_recommendations")
      .update({ is_active: false })
      .eq("vendor_name", vendorName)
      .eq("is_active", true);

    // 8. Generate LLM insights for fired rules (if any)
    if (firedRules.length > 0) {
      const topRules = firedRules.slice(0, 5); // max 5

      let insightTexts: string[] = [];
      try {
        const prompt = buildRecommendationPrompt(topRules, vendorName);
        const raw = await callGemini(geminiKey, prompt);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          insightTexts = parsed.map((p: { insight_text: string }) => p.insight_text);
        }
      } catch (llmErr) {
        console.error(`[${vendorName}] LLM error, using fallback text:`, llmErr);
        // Fallback: use rule data directly
        insightTexts = topRules.map((r) => {
          const metric = r.metric_affected ? METRIC_LABELS[r.metric_affected] : "your metrics";
          return `A change was detected in ${metric}. Review your dashboard for details.`;
        });
      }

      // 9. Insert new recommendations
      const inserts = topRules.map((rule, i) => ({
        vendor_name: vendorName,
        rule_id: rule.rule_id,
        priority: rule.priority,
        category: rule.category,
        metric_affected: rule.metric_affected,
        insight_text: insightTexts[i] || `Review ${rule.metric_affected || "your metrics"} for recent changes.`,
        supporting_data: rule.supporting_data,
        is_active: true,
        triggered_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      }));

      const { error: insertErr } = await supabase
        .from("vendor_recommendations")
        .insert(inserts);
      if (insertErr) throw insertErr;
    }

    console.log(
      `[${vendorName}] Processed: health=${metrics.health_score}, rules=${firedRules.length}, gaps=${gaps.length}`
    );
    return { vendor_name: vendorName, success: true };
  } catch (e) {
    console.error(`[${vendorName}] Error:`, e);
    return { vendor_name: vendorName, success: false, error: (e as Error).message };
  }
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
    const singleVendor = body.vendor_name as string | undefined;

    // Get vendors to process
    let vendorNames: string[];
    if (singleVendor) {
      vendorNames = [singleVendor];
    } else {
      // All vendors with 5+ mentions
      const { data: vendors } = await supabase
        .from("vendor_mentions")
        .select("vendor_name")
        .eq("is_hidden", false);

      const counts: Record<string, number> = {};
      for (const v of vendors || []) {
        counts[v.vendor_name] = (counts[v.vendor_name] || 0) + 1;
      }
      vendorNames = Object.entries(counts)
        .filter(([, count]) => count >= 5)
        .map(([name]) => name);
    }

    console.log(`Processing ${vendorNames.length} vendors...`);

    const results = [];
    for (const name of vendorNames) {
      const result = await processVendor(supabase, GEMINI_API_KEY, name);
      results.push(result);
    }

    // Compute category benchmarks for all categories
    const { data: categories } = await supabase
      .from("vendor_metadata")
      .select("category")
      .not("category", "is", null);

    const uniqueCategories = [...new Set((categories || []).map((c) => c.category).filter(Boolean))];
    for (const cat of uniqueCategories) {
      await supabase.rpc("compute_category_benchmarks", { p_category: cat });
    }

    return new Response(
      JSON.stringify({
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        categories_updated: uniqueCategories.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("compute-daily-scores error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
