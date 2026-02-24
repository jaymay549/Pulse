# Vendor Intelligence Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform CDG Pulse from a dealer quote feed into a vendor intelligence hub with synthesized profiles, dimensional insights, and category landscapes.

**Architecture:** Extend existing Supabase RPC functions and Gemini-powered edge functions to generate richer vendor intelligence. Add new React components for the redesigned vendor profile and category pages. The extraction pipeline already stores dimensional data (worth_it, reliable, integrates, support, adopted) — we surface it. New edge functions generate AI narrative summaries. Minimum 5-mention threshold enforced everywhere.

**Tech Stack:** React + TypeScript, Supabase (Postgres + Edge Functions), Gemini 2.0 Flash API, Tailwind CSS, TanStack Query

**Design Doc:** `docs/plans/2026-02-24-vendor-intelligence-hub-design.md`

---

## Phase 1: Vendor Pulse Summary Generation

The AI-synthesized narrative at the top of every vendor profile. This is the single highest-impact change — it transforms a data page into an intelligence page.

### Task 1: Create vendor_pulse_summaries table

**Files:**
- Create: `supabase/migrations/20260224000000_vendor_pulse_summaries.sql`

**Step 1: Write the migration**

```sql
-- Vendor Pulse Summaries: AI-generated narrative intelligence per vendor
CREATE TABLE IF NOT EXISTS public.vendor_pulse_summaries (
  vendor_name TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  category_context TEXT,
  mention_count_at_generation INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: public read, service-role write
ALTER TABLE public.vendor_pulse_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pulse summaries"
  ON public.vendor_pulse_summaries FOR SELECT
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_vendor_pulse_summaries_vendor
  ON public.vendor_pulse_summaries (vendor_name);
```

**Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

**Step 3: Commit**

```bash
git add supabase/migrations/20260224000000_vendor_pulse_summaries.sql
git commit -m "feat: add vendor_pulse_summaries table for AI narratives"
```

---

### Task 2: Create generate-vendor-pulse-summary edge function

**Files:**
- Create: `supabase/functions/generate-vendor-pulse-summary/index.ts`
- Reference: `supabase/functions/generate-vendor-themes/index.ts` (follow same pattern)

**Step 1: Create the edge function**

This follows the exact same pattern as `generate-vendor-themes` — Gemini call with structured JSON output, upsert into a summary table, minimum 5 mentions required.

```typescript
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
  dimension: string;
  sentiment: string;
  category: string;
}

interface CategoryMention {
  title: string;
  quote: string;
  type: string;
  vendor_name: string;
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
  categoryName: string,
  categoryMentions: CategoryMention[]
): string {
  const positive = mentions.filter((m) => m.type === "positive");
  const warning = mentions.filter((m) => m.type === "warning");

  // Count dimensions
  const dimensionCounts: Record<string, number> = {};
  for (const m of mentions) {
    if (m.dimension) {
      dimensionCounts[m.dimension] = (dimensionCounts[m.dimension] || 0) + 1;
    }
  }

  let prompt = `You are writing an intelligence summary about "${vendorName}", an automotive industry vendor in the "${categoryName}" category.

You have ${mentions.length} dealer mentions (${positive.length} positive, ${warning.length} warnings).

`;

  if (positive.length > 0) {
    prompt += `POSITIVE MENTIONS (${positive.length}):\n`;
    for (const m of positive) {
      prompt += `- [${m.dimension || "general"}] "${m.title}" — "${m.quote}"\n`;
    }
    prompt += "\n";
  }

  if (warning.length > 0) {
    prompt += `WARNING MENTIONS (${warning.length}):\n`;
    for (const m of warning) {
      prompt += `- [${m.dimension || "general"}] "${m.title}" — "${m.quote}"\n`;
    }
    prompt += "\n";
  }

  if (Object.keys(dimensionCounts).length > 0) {
    prompt += `DIMENSION BREAKDOWN:\n`;
    for (const [dim, count] of Object.entries(dimensionCounts)) {
      prompt += `- ${dim}: ${count} mentions\n`;
    }
    prompt += "\n";
  }

  // Add category context (what dealers want in this category)
  if (categoryMentions.length > 0) {
    const otherVendorMentions = categoryMentions.filter(
      (m) => m.vendor_name !== vendorName
    );
    if (otherVendorMentions.length > 0) {
      prompt += `OTHER VENDORS IN "${categoryName}" CATEGORY (${otherVendorMentions.length} mentions from other vendors — use to understand what dealers value in this category):\n`;
      for (const m of otherVendorMentions.slice(0, 30)) {
        prompt += `- [${m.vendor_name}] "${m.title}"\n`;
      }
      prompt += "\n";
    }
  }

  prompt += `Write a JSON object with this structure:
{
  "summary_text": "A 2-4 sentence intelligence summary about this vendor based on dealer feedback. Start with what the vendor is known for based on the mentions. Then note key strengths. Then note the most common concerns. Be specific — reference patterns, not generic statements. Do not use superlatives or marketing language.",
  "category_context": "A 1-2 sentence observation about what dealers in the ${categoryName} category are looking for overall, and how this vendor fits that picture. This should be based on the broader category mentions, not just this vendor."
}

Rules:
- Be specific and cite patterns from the data ("multiple dealers mention...", "a common theme is...")
- Do not invent information not present in the mentions
- Do not use marketing language or superlatives
- Do not name specific dealers or identify sources
- Keep summary_text to 2-4 sentences
- Keep category_context to 1-2 sentences
- If there aren't enough category mentions from other vendors to draw conclusions, set category_context to null
- Return ONLY valid JSON, no markdown fences`;

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

    // Fetch all mentions for this vendor (with dimension data)
    const { data: mentions, error: mentionsError } = await supabase
      .from("vendor_mentions")
      .select("title, quote, type, dimension, sentiment, category")
      .eq("vendor_name", vendorName);

    if (mentionsError) throw mentionsError;
    if (!mentions || mentions.length === 0) {
      return { vendor_name: vendorName, success: false, error: "No mentions found" };
    }

    // Get the vendor's primary category
    const categoryCount: Record<string, number> = {};
    for (const m of mentions) {
      if (m.category) {
        categoryCount[m.category] = (categoryCount[m.category] || 0) + 1;
      }
    }
    const primaryCategory =
      Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "general";

    // Fetch category-level mentions for context (up to 50 from other vendors)
    const { data: categoryMentions } = await supabase
      .from("vendor_mentions")
      .select("title, quote, type, vendor_name")
      .eq("category", primaryCategory)
      .neq("vendor_name", vendorName)
      .limit(50);

    // Call Gemini
    const prompt = buildPrompt(
      vendorName,
      mentions as Mention[],
      primaryCategory,
      (categoryMentions || []) as CategoryMention[]
    );
    const raw = await callGemini(geminiKey, prompt);
    const result = JSON.parse(raw);

    if (!result.summary_text) {
      throw new Error("Invalid Gemini response — missing summary_text");
    }

    // Upsert
    const { error: upsertError } = await supabase
      .from("vendor_pulse_summaries")
      .upsert(
        {
          vendor_name: vendorName,
          summary_text: result.summary_text,
          category_context: result.category_context || null,
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
    const results: { vendor_name: string; success: boolean; error?: string }[] = [];

    if (body.vendor_name) {
      const result = await generateForVendor(supabase, GEMINI_API_KEY, body.vendor_name, force);
      results.push(result);
    } else if (body.all) {
      const { data: vendorRows, error: vendorError } = await supabase.rpc(
        "get_vendor_pulse_vendors_list"
      );
      if (vendorError) throw vendorError;

      const eligible = ((vendorRows as any)?.vendors || [])
        .filter((v: { name: string; count: number }) => v.count >= MIN_MENTIONS)
        .map((v: { name: string }) => v.name);

      for (const name of eligible) {
        const result = await generateForVendor(supabase, GEMINI_API_KEY, name, force);
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
```

**Step 2: Commit**

```bash
git add supabase/functions/generate-vendor-pulse-summary/index.ts
git commit -m "feat: add generate-vendor-pulse-summary edge function"
```

---

### Task 3: Add fetchVendorPulseSummary to data hooks

**Files:**
- Modify: `src/hooks/useSupabaseVendorData.ts`

**Step 1: Add the fetch function**

Add this export alongside the existing fetch functions:

```typescript
export async function fetchVendorPulseSummary(
  vendorName: string
): Promise<{ summary_text: string; category_context: string | null } | null> {
  const { data, error } = await supabase
    .from("vendor_pulse_summaries")
    .select("summary_text, category_context")
    .eq("vendor_name", vendorName)
    .maybeSingle();

  if (error) {
    console.error("fetchVendorPulseSummary error:", error);
    return null;
  }
  return data;
}
```

**Step 2: Commit**

```bash
git add src/hooks/useSupabaseVendorData.ts
git commit -m "feat: add fetchVendorPulseSummary data hook"
```

---

### Task 4: Create VendorPulseSummary component

**Files:**
- Create: `src/components/vendors/VendorPulseSummary.tsx`

**Step 1: Build the component**

```typescript
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { fetchVendorPulseSummary } from "@/hooks/useSupabaseVendorData";

interface VendorPulseSummaryProps {
  vendorName: string;
  mentionCount: number;
}

const MIN_MENTIONS = 5;

export function VendorPulseSummary({ vendorName, mentionCount }: VendorPulseSummaryProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["vendor-pulse-summary", vendorName],
    queryFn: () => fetchVendorPulseSummary(vendorName),
    enabled: mentionCount >= MIN_MENTIONS,
  });

  if (mentionCount < MIN_MENTIONS) return null;
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/3 mb-3" />
        <div className="h-3 bg-zinc-800 rounded w-full mb-2" />
        <div className="h-3 bg-zinc-800 rounded w-5/6" />
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Vendor Pulse Summary</h3>
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed">
        {summary.summary_text}
      </p>

      {summary.category_context && (
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
          {summary.category_context}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vendors/VendorPulseSummary.tsx
git commit -m "feat: add VendorPulseSummary component"
```

---

## Phase 2: Dimensional Insights

Surface the dimension/sentiment data that's already being stored in `vendor_mentions`.

### Task 5: Create get_vendor_dimensions RPC function

**Files:**
- Create: `supabase/migrations/20260224000001_vendor_dimensions_rpc.sql`

**Step 1: Write the migration**

```sql
-- RPC function to aggregate dimension/sentiment data for a vendor
CREATE OR REPLACE FUNCTION public.get_vendor_dimensions(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
  FROM (
    SELECT
      dimension,
      COUNT(*) AS mention_count,
      COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive_count,
      COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative_count,
      COUNT(*) FILTER (WHERE sentiment = 'mixed') AS mixed_count,
      COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE sentiment = 'positive') / NULLIF(COUNT(*), 0)
      ) AS positive_percent
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name
      AND dimension IS NOT NULL
      AND dimension != 'other'
    GROUP BY dimension
    ORDER BY COUNT(*) DESC
  ) d;
$$;
```

**Step 2: Apply the migration**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/20260224000001_vendor_dimensions_rpc.sql
git commit -m "feat: add get_vendor_dimensions RPC function"
```

---

### Task 6: Add fetchVendorDimensions to data hooks

**Files:**
- Modify: `src/hooks/useSupabaseVendorData.ts`

**Step 1: Add the type and fetch function**

```typescript
export interface VendorDimension {
  dimension: string;
  mention_count: number;
  positive_count: number;
  negative_count: number;
  mixed_count: number;
  neutral_count: number;
  positive_percent: number;
}

export async function fetchVendorDimensions(
  vendorName: string
): Promise<VendorDimension[]> {
  const { data, error } = await supabase.rpc("get_vendor_dimensions", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("fetchVendorDimensions error:", error);
    return [];
  }
  return (data || []) as VendorDimension[];
}
```

**Step 2: Commit**

```bash
git add src/hooks/useSupabaseVendorData.ts
git commit -m "feat: add fetchVendorDimensions data hook"
```

---

### Task 7: Create DimensionalInsights component

**Files:**
- Create: `src/components/vendors/DimensionalInsights.tsx`

**Step 1: Build the component**

This shows dimension-level sentiment as horizontal bars — not scores or rankings, but "what dealers are saying about [dimension]."

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchVendorDimensions, type VendorDimension } from "@/hooks/useSupabaseVendorData";
import { VENDOR_DIMENSIONS } from "@/types/admin";

interface DimensionalInsightsProps {
  vendorName: string;
  mentionCount: number;
}

const MIN_MENTIONS = 5;

function sentimentLabel(positivePct: number): { text: string; color: string } {
  if (positivePct >= 75) return { text: "Mostly positive", color: "text-emerald-400" };
  if (positivePct >= 50) return { text: "Mixed-positive", color: "text-emerald-300" };
  if (positivePct >= 25) return { text: "Mixed", color: "text-amber-400" };
  return { text: "Needs attention", color: "text-red-400" };
}

function DimensionBar({ dim }: { dim: VendorDimension }) {
  const info = VENDOR_DIMENSIONS[dim.dimension] || { label: dim.dimension, icon: "MoreHorizontal" };
  const sentiment = sentimentLabel(dim.positive_percent);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-28 flex-shrink-0">
        <span className="text-xs font-medium text-zinc-300">{info.label}</span>
      </div>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${dim.positive_percent}%` }}
        />
      </div>
      <div className="w-32 flex-shrink-0 text-right">
        <span className={`text-xs font-medium ${sentiment.color}`}>
          {sentiment.text}
        </span>
      </div>
      <span className="text-xs text-zinc-600 w-20 text-right flex-shrink-0">
        {dim.mention_count} mentions
      </span>
    </div>
  );
}

export function DimensionalInsights({ vendorName, mentionCount }: DimensionalInsightsProps) {
  const { data: dimensions = [], isLoading } = useQuery({
    queryKey: ["vendor-dimensions", vendorName],
    queryFn: () => fetchVendorDimensions(vendorName),
    enabled: mentionCount >= MIN_MENTIONS,
  });

  if (mentionCount < MIN_MENTIONS) return null;
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-zinc-800 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (dimensions.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">
        What Dealers Say By Dimension
      </h3>
      <div className="divide-y divide-zinc-800/50">
        {dimensions.map((dim) => (
          <DimensionBar key={dim.dimension} dim={dim} />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vendors/DimensionalInsights.tsx
git commit -m "feat: add DimensionalInsights component"
```

---

## Phase 3: Vendor Profile Page Redesign

Integrate the new components into the vendor profile and restructure the page.

### Task 8: Restructure VendorProfile page layout

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Add imports for new components**

At the top of the file, add:
```typescript
import { VendorPulseSummary } from "@/components/vendors/VendorPulseSummary";
import { DimensionalInsights } from "@/components/vendors/DimensionalInsights";
```

**Step 2: Restructure the page content order**

Find the section after the Hero/Stats area and restructure the component order to:

1. **VendorPulseSummary** — New, right after stats (gated by 5+ mentions)
2. **DimensionalInsights** — New, right after summary (gated by 5+ mentions)
3. **What Dealers Appreciate** (existing themes.positiveThemes — keep)
4. **Common Concerns** (existing themes.warningThemes — keep)
5. **Alternatives & Competitors** (existing compareVendors — keep)
6. **Community Mentions** (existing quote feed — keep but lower on page)

Insert the new components after the Stats Row and AIInsightBanner:

```tsx
{/* Vendor Pulse Summary — new */}
<VendorPulseSummary
  vendorName={profileData.vendorName}
  mentionCount={profileData.stats.totalMentions}
/>

{/* Dimensional Insights — new */}
<DimensionalInsights
  vendorName={profileData.vendorName}
  mentionCount={profileData.stats.totalMentions}
/>
```

**Step 3: Add "not enough data" message for low-mention vendors**

Below the hero, if `profileData.stats.totalMentions < 5`, show:
```tsx
{profileData.stats.totalMentions < 5 && (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center">
    <p className="text-sm text-zinc-400">
      More insights will appear as dealer feedback grows.
    </p>
    <p className="text-xs text-zinc-600 mt-1">
      {profileData.stats.totalMentions} of 5 mentions needed for full analysis.
    </p>
  </div>
)}
```

**Step 4: Verify the page renders correctly**

Run: `npm run dev` and navigate to a vendor profile with 5+ mentions. Verify:
- Pulse Summary appears after stats
- Dimensional Insights appears after summary
- Themes still render
- Quotes are below everything
- A vendor with <5 mentions shows the "not enough data" message instead of insights

**Step 5: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: integrate pulse summary and dimensional insights into vendor profile"
```

---

## Phase 4: Category Landscape Pages

Transform category pages from filtered quote feeds to landscape overviews.

### Task 9: Create CategoryLandscape component

**Files:**
- Create: `src/components/vendors/CategoryLandscape.tsx`

**Step 1: Build the component**

This replaces the current category view in VendorsV2. It shows:
1. A category-level AI summary
2. A vendor directory grid (no rankings)
3. Category-level themes

```typescript
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

interface VendorInCategory {
  name: string;
  count: number;
  logoUrl?: string;
}

interface CategoryLandscapeProps {
  categoryId: string;
  categoryLabel: string;
  vendors: VendorInCategory[];
  getLogoUrl: (vendorName: string) => string;
}

export function CategoryLandscape({
  categoryId,
  categoryLabel,
  vendors,
  getLogoUrl,
}: CategoryLandscapeProps) {
  const navigate = useNavigate();

  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => a.name.localeCompare(b.name)),
    [vendors]
  );

  return (
    <div className="space-y-6">
      {/* Category Header */}
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">{categoryLabel}</h2>
        <p className="text-sm text-zinc-400 mt-1">
          {vendors.length} vendors &middot; {vendors.reduce((sum, v) => sum + v.count, 0)} dealer mentions
        </p>
      </div>

      {/* Vendor Directory Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedVendors.map((vendor) => (
          <button
            key={vendor.name}
            onClick={() => navigate(`/vendors/${encodeURIComponent(vendor.name)}`)}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left hover:border-zinc-600 transition-colors"
          >
            <img
              src={getLogoUrl(vendor.name)}
              alt=""
              className="h-8 w-8 rounded-md object-contain bg-white p-0.5 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {vendor.name}
              </p>
              <p className="text-xs text-zinc-500">
                {vendor.count} mentions
              </p>
            </div>
          </button>
        ))}
      </div>

      {sortedVendors.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <Building2 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No vendors found in this category yet.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vendors/CategoryLandscape.tsx
git commit -m "feat: add CategoryLandscape component for category overview pages"
```

---

### Task 10: Integrate CategoryLandscape into VendorsV2

**Files:**
- Modify: `src/pages/VendorsV2.tsx`

**Step 1: Import CategoryLandscape**

```typescript
import { CategoryLandscape } from "@/components/vendors/CategoryLandscape";
```

**Step 2: Replace the category+no-vendor view**

When a category is selected but no specific vendor, render `CategoryLandscape` instead of the current filtered quote grid. Find the conditional rendering section and add a branch:

When `selectedCategory !== "all" && !selectedVendor && !aiQuery`, render:
```tsx
<CategoryLandscape
  categoryId={selectedCategory}
  categoryLabel={categories.find(c => c.id === selectedCategory)?.label || selectedCategory}
  vendors={vendorsInCategory}
  getLogoUrl={getLogoUrl}
/>
```

Keep the existing quote grid for when a specific vendor is selected within a category.

**Step 3: Verify**

Run: `npm run dev` and:
- Click a category → should see the landscape overview with vendor cards
- Click a vendor card → should navigate to the vendor profile
- Search still works
- Landing page unchanged

**Step 4: Commit**

```bash
git add src/pages/VendorsV2.tsx
git commit -m "feat: integrate CategoryLandscape into VendorsV2 category view"
```

---

## Phase 5: Enhanced Extraction — Pricing & Switching Signals

Extend the AI extraction to capture pricing data and switching narratives from dealer conversations. This requires changes to the extraction prompt used in the WAM backend (Railway).

### Task 11: Add pricing and switching columns to vendor_mentions

**Files:**
- Create: `supabase/migrations/20260224000002_vendor_mentions_enrichment.sql`

**Step 1: Write the migration**

```sql
-- Add structured extraction columns for pricing and switching intelligence
ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS pricing_signal JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS switching_signal JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dealership_context JSONB DEFAULT NULL;

-- pricing_signal schema: { "amount": "$2000/mo", "terms": "3-year", "unit_type": "per-store" }
-- switching_signal schema: { "direction": "to" | "from", "other_vendor": "Vendor X", "outcome": "positive" | "negative" | "neutral" }
-- dealership_context schema: { "size": "mid-size", "rooftop_count": 6, "region": "Southeast" }

COMMENT ON COLUMN public.vendor_mentions.pricing_signal IS 'Extracted pricing data: amount, terms, unit_type';
COMMENT ON COLUMN public.vendor_mentions.switching_signal IS 'Extracted switching data: direction, other_vendor, outcome';
COMMENT ON COLUMN public.vendor_mentions.dealership_context IS 'Extracted dealer context: size, rooftop_count, region';
```

**Step 2: Apply and commit**

```bash
git add supabase/migrations/20260224000002_vendor_mentions_enrichment.sql
git commit -m "feat: add pricing, switching, and dealer context columns to vendor_mentions"
```

---

### Task 12: Create get_vendor_pricing_intel and get_vendor_switching_intel RPC functions

**Files:**
- Create: `supabase/migrations/20260224000003_vendor_intel_rpcs.sql`

**Step 1: Write the RPCs**

```sql
-- Pricing intelligence aggregation
CREATE OR REPLACE FUNCTION public.get_vendor_pricing_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'data_points', COUNT(*),
    'mentions', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'amount', pricing_signal->>'amount',
          'terms', pricing_signal->>'terms',
          'unit_type', pricing_signal->>'unit_type'
        )
      ) FILTER (WHERE pricing_signal IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND pricing_signal IS NOT NULL;
$$;

-- Switching intelligence aggregation
CREATE OR REPLACE FUNCTION public.get_vendor_switching_intel(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'switched_to', (
      SELECT COUNT(*) FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'to'
    ),
    'switched_from', (
      SELECT COUNT(*) FROM public.vendor_mentions
      WHERE vendor_name = p_vendor_name
        AND switching_signal->>'direction' = 'from'
    ),
    'to_sources', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'vendor', switching_signal->>'other_vendor',
        'count', cnt
      )), '[]'::jsonb)
      FROM (
        SELECT switching_signal->>'other_vendor' AS other, COUNT(*) AS cnt
        FROM public.vendor_mentions
        WHERE vendor_name = p_vendor_name
          AND switching_signal->>'direction' = 'to'
          AND switching_signal->>'other_vendor' IS NOT NULL
        GROUP BY switching_signal->>'other_vendor'
        ORDER BY cnt DESC
      ) sub
    ),
    'from_destinations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'vendor', switching_signal->>'other_vendor',
        'count', cnt
      )), '[]'::jsonb)
      FROM (
        SELECT switching_signal->>'other_vendor' AS other, COUNT(*) AS cnt
        FROM public.vendor_mentions
        WHERE vendor_name = p_vendor_name
          AND switching_signal->>'direction' = 'from'
          AND switching_signal->>'other_vendor' IS NOT NULL
        GROUP BY switching_signal->>'other_vendor'
        ORDER BY cnt DESC
      ) sub
    )
  );
$$;
```

**Step 2: Apply and commit**

```bash
git add supabase/migrations/20260224000003_vendor_intel_rpcs.sql
git commit -m "feat: add pricing and switching intelligence RPC functions"
```

---

### Task 13: Create PricingIntelligence component

**Files:**
- Create: `src/components/vendors/PricingIntelligence.tsx`

**Step 1: Build the component**

```typescript
import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PricingIntelligenceProps {
  vendorName: string;
  mentionCount: number;
}

interface PricingData {
  data_points: number;
  mentions: Array<{
    amount: string | null;
    terms: string | null;
    unit_type: string | null;
  }>;
}

const MIN_MENTIONS = 5;
const MIN_PRICING_POINTS = 3;

export function PricingIntelligence({ vendorName, mentionCount }: PricingIntelligenceProps) {
  const { data: pricing, isLoading } = useQuery({
    queryKey: ["vendor-pricing-intel", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_pricing_intel" as never, {
        p_vendor_name: vendorName,
      } as never);
      if (error) throw error;
      return data as unknown as PricingData;
    },
    enabled: mentionCount >= MIN_MENTIONS,
  });

  if (mentionCount < MIN_MENTIONS) return null;
  if (isLoading) return null;
  if (!pricing || pricing.data_points < MIN_PRICING_POINTS) return null;

  const amounts = pricing.mentions
    .map((m) => m.amount)
    .filter(Boolean) as string[];

  const terms = pricing.mentions
    .map((m) => m.terms)
    .filter(Boolean) as string[];

  // Find most common term
  const termCounts: Record<string, number> = {};
  for (const t of terms) {
    termCounts[t] = (termCounts[t] || 0) + 1;
  }
  const commonTerm = Object.entries(termCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Pricing Intelligence</h3>
      </div>

      {amounts.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {amounts.map((amount, i) => (
              <span
                key={i}
                className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
              >
                {amount}
              </span>
            ))}
          </div>
        </div>
      )}

      {commonTerm && (
        <p className="mt-3 text-xs text-zinc-500">
          Most commonly reported: {commonTerm} contracts
        </p>
      )}

      <p className="mt-2 text-xs text-zinc-600">
        Based on {pricing.data_points} dealer-reported data points
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vendors/PricingIntelligence.tsx
git commit -m "feat: add PricingIntelligence component"
```

---

### Task 14: Create SwitchingIntel component

**Files:**
- Create: `src/components/vendors/SwitchingIntel.tsx`

**Step 1: Build the component**

```typescript
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SwitchingIntelProps {
  vendorName: string;
  mentionCount: number;
}

interface SwitchingData {
  switched_to: number;
  switched_from: number;
  to_sources: Array<{ vendor: string; count: number }>;
  from_destinations: Array<{ vendor: string; count: number }>;
}

const MIN_MENTIONS = 5;

export function SwitchingIntel({ vendorName, mentionCount }: SwitchingIntelProps) {
  const { data: switching, isLoading } = useQuery({
    queryKey: ["vendor-switching-intel", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_switching_intel" as never, {
        p_vendor_name: vendorName,
      } as never);
      if (error) throw error;
      return data as unknown as SwitchingData;
    },
    enabled: mentionCount >= MIN_MENTIONS,
  });

  if (mentionCount < MIN_MENTIONS) return null;
  if (isLoading) return null;
  if (!switching) return null;

  const totalSwitching = switching.switched_to + switching.switched_from;
  if (totalSwitching === 0) return null;

  const netPositive = switching.switched_to > switching.switched_from;
  const netNeutral = switching.switched_to === switching.switched_from;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Switching Intel</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <span className="text-lg font-bold text-emerald-400">
            {switching.switched_to}
          </span>
          <p className="text-xs text-zinc-400 mt-0.5">dealers switched to</p>
          {switching.to_sources.length > 0 && (
            <p className="text-xs text-zinc-600 mt-1">
              from: {switching.to_sources.map((s) => s.vendor).join(", ")}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-zinc-800/50 p-3">
          <span className="text-lg font-bold text-red-400">
            {switching.switched_from}
          </span>
          <p className="text-xs text-zinc-400 mt-0.5">dealers switched from</p>
          {switching.from_destinations.length > 0 && (
            <p className="text-xs text-zinc-600 mt-1">
              to: {switching.from_destinations.map((s) => s.vendor).join(", ")}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Net trend:{" "}
        <span className={netNeutral ? "text-zinc-400" : netPositive ? "text-emerald-400" : "text-red-400"}>
          {netNeutral ? "Neutral" : netPositive ? "Positive" : "Negative"}
        </span>
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vendors/SwitchingIntel.tsx
git commit -m "feat: add SwitchingIntel component"
```

---

### Task 15: Add PricingIntelligence and SwitchingIntel to VendorProfile

**Files:**
- Modify: `src/pages/VendorProfile.tsx`

**Step 1: Import and add components**

```typescript
import { PricingIntelligence } from "@/components/vendors/PricingIntelligence";
import { SwitchingIntel } from "@/components/vendors/SwitchingIntel";
```

Add them after DimensionalInsights, before themes:

```tsx
{/* Pricing Intelligence — new */}
<PricingIntelligence
  vendorName={profileData.vendorName}
  mentionCount={profileData.stats.totalMentions}
/>

{/* Switching Intel — new */}
<SwitchingIntel
  vendorName={profileData.vendorName}
  mentionCount={profileData.stats.totalMentions}
/>
```

**Step 2: Verify the full page order is now:**
1. Hero (header, banner, logo, metadata)
2. Stats row
3. Vendor Pulse Summary (5+ mentions)
4. Dimensional Insights (5+ mentions)
5. Pricing Intelligence (5+ mentions, 3+ pricing data points)
6. Switching Intel (5+ mentions, any switching data)
7. What Dealers Appreciate (themes)
8. Common Concerns (themes)
9. Alternatives & Competitors
10. Community Mentions (quotes — demoted)

**Step 3: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: add pricing and switching intelligence to vendor profile"
```

---

## Phase 6: Dealer Onboarding & "Dealers Like You"

### Task 16: Create dealer_profiles table

**Files:**
- Create: `supabase/migrations/20260224000004_dealer_profiles.sql`

**Step 1: Write the migration**

```sql
-- Dealer profiles for "Dealers Like You" personalization
CREATE TABLE IF NOT EXISTS public.dealer_profiles (
  user_id TEXT PRIMARY KEY,
  rooftop_size TEXT CHECK (rooftop_size IN ('small', 'mid-size', 'large')),
  region TEXT,
  shopping_for TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.dealer_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own profile
CREATE POLICY "Users manage own dealer profile"
  ON public.dealer_profiles
  FOR ALL
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

COMMENT ON TABLE public.dealer_profiles IS 'Stores dealer characteristics for "Dealers Like You" personalization';
```

**Step 2: Apply and commit**

```bash
git add supabase/migrations/20260224000004_dealer_profiles.sql
git commit -m "feat: add dealer_profiles table for personalization"
```

---

### Task 17: Create DealerOnboardingModal component

**Files:**
- Create: `src/components/vendors/DealerOnboardingModal.tsx`

**Step 1: Build a minimal 3-question onboarding modal**

The modal asks:
1. How many rooftops? (Small 1-3 / Mid-size 4-15 / Large 15+)
2. What region? (Northeast / Southeast / Midwest / Southwest / West / Canada)
3. What are you shopping for? (multi-select categories — optional)

Save to `dealer_profiles` table. Show on first authenticated visit to the vendor section if no profile exists. Include a "Skip" button.

This is a standard form component — implementation details should follow existing modal patterns in the codebase (e.g., `ClaimProfileModal.tsx`).

**Step 2: Commit**

```bash
git add src/components/vendors/DealerOnboardingModal.tsx
git commit -m "feat: add DealerOnboardingModal for personalization"
```

---

### Task 18: Add segment filtering to dimension and summary queries

**Files:**
- Modify: `supabase/migrations/20260224000005_segment_filtering.sql` (new)

**Step 1: Create segment-aware RPC functions**

Add optional `p_dealership_size` parameter to `get_vendor_dimensions` and other RPCs. The filter joins `vendor_mentions` with `dealership_context->>'size'` when the parameter is provided. Only return segment-filtered data when there are 5+ mentions in that segment; otherwise fall back to "All Dealers."

This is the most complex RPC change — it needs to gracefully degrade when segment data is sparse.

**Step 2: Commit**

```bash
git add supabase/migrations/20260224000005_segment_filtering.sql
git commit -m "feat: add segment-aware filtering to vendor intelligence RPCs"
```

---

## Phase 7: Vendor Dashboard Upgrades

Enhance the existing vendor dashboard (`src/components/vendor-dashboard/`) with the new intelligence data.

### Task 19: Add DimensionalFeedback tab to vendor dashboard

**Files:**
- Create: `src/components/vendor-dashboard/DashboardDimensions.tsx`
- Modify: `src/components/vendor-dashboard/VendorDashboardLayout.tsx` (add new section)
- Modify: `src/components/vendor-dashboard/VendorDashboardSidebar.tsx` (add nav item)

Shows the vendor their own dimensional feedback with the mentions driving each dimension. Uses existing `get_vendor_dimensions` RPC plus a new query that fetches mentions filtered by dimension.

**Step 1: Build component, wire into layout and sidebar**

**Step 2: Commit**

```bash
git add src/components/vendor-dashboard/DashboardDimensions.tsx src/components/vendor-dashboard/VendorDashboardLayout.tsx src/components/vendor-dashboard/VendorDashboardSidebar.tsx
git commit -m "feat: add dimensional feedback tab to vendor dashboard"
```

---

### Task 20: Add sentiment-over-time chart to vendor dashboard overview

**Files:**
- Modify: `src/components/vendor-dashboard/DashboardOverview.tsx`

Add a simple line chart showing monthly positive sentiment % over the last 6 months. This requires a new RPC that buckets mentions by month and calculates positive_percent per bucket. Use a lightweight chart library already in the project, or simple CSS bars if no chart library exists.

**Step 1: Create RPC, build chart, integrate into overview**

**Step 2: Commit**

```bash
git add src/components/vendor-dashboard/DashboardOverview.tsx
git commit -m "feat: add sentiment-over-time chart to vendor dashboard"
```

---

## Phase 8: Generate & Backfill

### Task 21: Run pulse summary generation for all eligible vendors

**Step 1: Deploy the edge function**

```bash
npx supabase functions deploy generate-vendor-pulse-summary
```

**Step 2: Invoke for all vendors**

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/generate-vendor-pulse-summary" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"all": true}'
```

**Step 3: Verify results in Supabase dashboard**

Check `vendor_pulse_summaries` table — should have entries for all vendors with 5+ mentions.

---

### Task 22: Update extraction prompt for pricing and switching signals

This task is in the WAM backend (Railway), not in this repo. The Gemini extraction prompt that processes WhatsApp conversations needs to be updated to also extract:

- `pricing_signal`: Any dollar amounts, contract terms, per-unit costs mentioned
- `switching_signal`: "We switched from X" / "we're leaving Y" / "we moved to Z"
- `dealership_context`: Dealership size, rooftop count, region if mentioned

The `admin_approve_mention` RPC also needs updating to accept and store these new fields.

This is a backend change that should be coordinated separately.

---

## Implementation Order & Dependencies

```
Phase 1 (Pulse Summary)         → Can ship independently
Phase 2 (Dimensional Insights)  → Can ship independently (data already exists)
Phase 3 (Profile Redesign)      → Depends on Phase 1 + 2
Phase 4 (Category Landscapes)   → Can ship independently
Phase 5 (Enhanced Extraction)   → Can ship independently (new data starts flowing)
Phase 6 (Dealers Like You)      → Depends on Phase 5 (needs dealership_context data)
Phase 7 (Vendor Dashboard)      → Depends on Phase 2
Phase 8 (Backfill)              → Depends on Phase 1 + 5
```

**Recommended execution order:** Phase 2 → Phase 1 → Phase 3 → Phase 4 → Phase 7 → Phase 5 → Phase 8 → Phase 6

Start with Phase 2 because the dimension data already exists and just needs surfacing — quickest win.
