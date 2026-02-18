# AI-Synthesized Vendor Theme Summaries — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw mention title grouping with AI-synthesized theme summaries in the vendor profile "What Dealers Appreciate" / "Common Concerns" sections, and gate them behind pro membership.

**Architecture:** A new `vendor_theme_summaries` table stores cached AI-generated themes per vendor. A Supabase edge function (`generate-vendor-themes`) fetches mentions, calls Gemini Flash to synthesize themes, and upserts the result. The `get_vendor_themes` RPC is rewritten to read cached summaries with a fallback to `GROUP BY title` for vendors below the 5-mention threshold. VendorProfile.tsx adds pro-gating blur over the theme sections.

**Tech Stack:** PostgreSQL (Supabase), Deno edge functions, Gemini Flash API, React/TypeScript, Tailwind CSS

**Important context:**
- The MCP Supabase tools are connected to the WRONG project (`rixrkhumtmhzfgavzjyn`). The correct project is `nsfrxtpxzdmqlezvvjgg`. All SQL must be deployed by the user via the Supabase SQL editor. Provide the SQL and curl verification commands.
- There is no test framework in this project. Verify DB functions via curl, frontend via `vite build`.
- All `.rpc()` calls in this codebase use `as any` casts because the Supabase types file doesn't define these functions. Follow the same pattern.
- The existing edge function (`vendor-enrich`) uses `serve` from `https://deno.land/std@0.168.0/http/server.ts` and `createClient` from `https://esm.sh/@supabase/supabase-js@2.76.0`. Follow the same import patterns.
- Edge functions are called from the frontend via `fetch()` to `https://nsfrxtpxzdmqlezvvjgg.supabase.co/functions/v1/<function-name>`.
- The `GEMINI_API_KEY` env var must be set in the Supabase dashboard for the edge function to work. Remind the user to do this.

---

## Task 1: Create `vendor_theme_summaries` table

**Files:**
- SQL to run in Supabase SQL editor (provide to user)

**Step 1: Present SQL to user for deployment**

The user must run this in the Supabase SQL editor for project `nsfrxtpxzdmqlezvvjgg`:

```sql
CREATE TABLE IF NOT EXISTS vendor_theme_summaries (
  vendor_name                  text PRIMARY KEY,
  themes                       jsonb NOT NULL DEFAULT '{}'::jsonb,
  mention_count_at_generation  int,
  generated_at                 timestamptz DEFAULT now()
);

-- Allow edge functions (service role) full access
ALTER TABLE vendor_theme_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON vendor_theme_summaries
  FOR ALL
  USING (auth.role() = 'service_role');

-- Allow anon/authenticated to read (for the frontend RPC)
CREATE POLICY "Public read access"
  ON vendor_theme_summaries
  FOR SELECT
  USING (true);
```

**Step 2: Verify via curl**

```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/vendor_theme_summaries?limit=1' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json'
```

Expected: `[]` (empty array, no error).

**Step 3: Commit** — No code changes for this task.

---

## Task 2: Rewrite `get_vendor_themes` RPC to read cached summaries

**Files:**
- SQL to run in Supabase SQL editor

**Step 1: Present SQL to user for deployment**

This replaces the existing `get_vendor_themes` function. It reads from `vendor_theme_summaries` first, falling back to the old `GROUP BY title` approach for vendors without a cached summary.

```sql
CREATE OR REPLACE FUNCTION get_vendor_themes(p_vendor_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cached_result jsonb;
  fallback_result jsonb;
  mention_total int;
BEGIN
  -- Try cached AI summary first
  SELECT themes INTO cached_result
  FROM vendor_theme_summaries
  WHERE vendor_name = p_vendor_name;

  IF cached_result IS NOT NULL THEN
    RETURN cached_result;
  END IF;

  -- Fallback: GROUP BY title (original approach)
  SELECT jsonb_build_object(
    'positiveThemes', COALESCE((
      SELECT jsonb_agg(t ORDER BY (t->>'mention_count')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'label', title,
          'summary', (array_agg(quote ORDER BY conversation_time DESC))[1],
          'mention_count', COUNT(*)::int
        ) AS t
        FROM vendor_mentions
        WHERE vendor_name = p_vendor_name AND type = 'positive'
        GROUP BY title
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb),
    'warningThemes', COALESCE((
      SELECT jsonb_agg(t ORDER BY (t->>'mention_count')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'label', title,
          'summary', (array_agg(quote ORDER BY conversation_time DESC))[1],
          'mention_count', COUNT(*)::int
        ) AS t
        FROM vendor_mentions
        WHERE vendor_name = p_vendor_name AND type = 'warning'
        GROUP BY title
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb)
  ) INTO fallback_result;

  RETURN fallback_result;
END;
$$;
```

Note: The fallback now uses `label` and `summary` keys (instead of the old `theme` and `sample_quote`) so the frontend can use one consistent interface.

**Step 2: Verify via curl**

```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/get_vendor_themes' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_vendor_name": "DriveCentric"}'
```

Expected: JSON with `positiveThemes` and `warningThemes` arrays, each item having `label`, `summary`, `mention_count`.

**Step 3: Commit** — No code changes for this task.

---

## Task 3: Update frontend types and data hook for new theme shape

**Files:**
- Modify: `src/hooks/useSupabaseVendorData.ts:26-32`

**Step 1: Update the VendorTheme interface**

In `src/hooks/useSupabaseVendorData.ts`, replace the `VendorTheme` interface to match the new RPC output:

Replace:
```typescript
export interface VendorTheme {
  theme: string;
  mention_count: number;
  percentage: number;
  sample_quote: string;
}
```

With:
```typescript
export interface VendorTheme {
  label: string;
  summary: string;
  mention_count: number;
}
```

**Step 2: Update the `fetchVendorThemes` return mapping**

In the same file, the `fetchVendorThemes` function currently returns `result?.positiveThemes` and `result?.warningThemes` directly — this still works since the RPC returns those same keys. No change needed here.

**Step 3: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`

Expected: Build will fail because VendorProfile.tsx references `t.theme` and `t.sample_quote` which no longer exist. That's expected — we fix it in the next task.

**Step 4: Commit**

```bash
git add src/hooks/useSupabaseVendorData.ts
git commit -m "refactor: update VendorTheme interface for AI summaries"
```

---

## Task 4: Update VendorProfile.tsx theme sections for new data shape

**Files:**
- Modify: `src/pages/VendorProfile.tsx:957-967` (positive themes)
- Modify: `src/pages/VendorProfile.tsx:988-998` (warning themes)

**Step 1: Update positive theme rendering**

In `src/pages/VendorProfile.tsx`, find the positive themes `<li>` block (inside "What Dealers Appreciate") and replace `t.theme` with `t.label` and `t.sample_quote` with `t.summary`:

Replace:
```typescript
                              <span className="text-[13px] font-semibold text-slate-700 leading-snug">{t.theme}</span>
```
With:
```typescript
                              <span className="text-[13px] font-semibold text-slate-700 leading-snug">{t.label}</span>
```

Replace:
```typescript
                            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{t.sample_quote}</p>
```
With:
```typescript
                            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{t.summary}</p>
```

(Also changed `line-clamp-2` to `line-clamp-3` since summaries are longer than raw quotes.)

**Step 2: Update warning theme rendering**

Same changes in the "Common Concerns" section:

Replace `t.theme` → `t.label`
Replace `t.sample_quote` → `t.summary`
Replace `line-clamp-2` → `line-clamp-3`

**Step 3: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "refactor: update theme sections for label/summary data shape"
```

---

## Task 5: Add pro-gating blur to theme sections

**Files:**
- Modify: `src/pages/VendorProfile.tsx:945-1009`

**Step 1: Verify `isProUserValue` is available**

Check that `isProUserValue` already exists in VendorProfile.tsx. It should — it's used for mentions locking. If not, it's derived from:

```typescript
const { tier } = useClerkAuth();
const isProUserValue = isProUser(tier);
```

Both `useClerkAuth` and `isProUser` are already imported in this file.

**Step 2: Wrap theme content with pro-gate**

Replace the entire themes section (lines 945-1009) with a version that wraps the content in a blur overlay for non-pro users. The section headers and icons remain visible; the theme list content gets blurred.

Replace the entire `<section className="mb-6">` block containing "What Dealers Appreciate" and "Common Concerns" with:

```tsx
          <section className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* What dealers appreciate */}
              <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">What Dealers Appreciate</h3>
                </div>
                <div className="relative">
                  {!isProUserValue && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
                      <Lock className="h-5 w-5 text-slate-400 mb-2" />
                      <p className="text-xs font-semibold text-slate-600 mb-1">Member-only insights</p>
                      <button
                        onClick={() => {
                          if (isAuthenticated) {
                            setShowUpgradeModal(true);
                          } else {
                            setShowSignIn(true);
                          }
                        }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {isAuthenticated ? "Upgrade to unlock" : "Sign in to unlock"}
                      </button>
                    </div>
                  )}
                  <div className={!isProUserValue ? "blur-[6px] select-none pointer-events-none" : ""}>
                    {themes?.positiveThemes && themes.positiveThemes.length > 0 ? (
                      <ul className="space-y-3">
                        {themes.positiveThemes.map((t, i) => (
                          <li key={i}>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[13px] font-semibold text-slate-700 leading-snug">{t.label}</span>
                                  <span className="flex-shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    {t.mention_count}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{t.summary}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">No positive themes recorded yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Common concerns */}
              <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Common Concerns</h3>
                </div>
                <div className="relative">
                  {!isProUserValue && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
                      <Lock className="h-5 w-5 text-slate-400 mb-2" />
                      <p className="text-xs font-semibold text-slate-600 mb-1">Member-only insights</p>
                      <button
                        onClick={() => {
                          if (isAuthenticated) {
                            setShowUpgradeModal(true);
                          } else {
                            setShowSignIn(true);
                          }
                        }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {isAuthenticated ? "Upgrade to unlock" : "Sign in to unlock"}
                      </button>
                    </div>
                  )}
                  <div className={!isProUserValue ? "blur-[6px] select-none pointer-events-none" : ""}>
                    {themes?.warningThemes && themes.warningThemes.length > 0 ? (
                      <ul className="space-y-3">
                        {themes.warningThemes.map((t, i) => (
                          <li key={i}>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[13px] font-semibold text-slate-700 leading-snug">{t.label}</span>
                                  <span className="flex-shrink-0 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                    {t.mention_count}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{t.summary}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">No concerns recorded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
```

**Step 3: Verify `Lock` is imported**

Check that `Lock` from `lucide-react` is already imported in VendorProfile.tsx. If not, add it to the import.

**Step 4: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/pages/VendorProfile.tsx
git commit -m "feat: add pro-gating blur to theme sections"
```

---

## Task 6: Create `generate-vendor-themes` edge function

**Files:**
- Create: `supabase/functions/generate-vendor-themes/index.ts`

**Step 1: Create the edge function**

Create `supabase/functions/generate-vendor-themes/index.ts`:

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
  vendor_name?: string;  // single vendor
  all?: boolean;         // regenerate all eligible vendors
  force?: boolean;       // regenerate even if mention count hasn't changed
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
      return { vendor_name: vendorName, success: false, error: `Only ${mentionCount} mentions (need ${MIN_MENTIONS}+)` };
    }

    // Check if regeneration needed
    if (!force) {
      const { data: existing } = await supabase
        .from("vendor_theme_summaries")
        .select("mention_count_at_generation")
        .eq("vendor_name", vendorName)
        .maybeSingle();

      if (existing && existing.mention_count_at_generation === mentionCount) {
        return { vendor_name: vendorName, success: true, error: "Skipped (no new mentions)" };
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
      .upsert({
        vendor_name: vendorName,
        themes,
        mention_count_at_generation: mentionCount,
        generated_at: new Date().toISOString(),
      }, { onConflict: "vendor_name" });

    if (upsertError) throw upsertError;

    console.log(`[${vendorName}] Generated themes (${mentionCount} mentions)`);
    return { vendor_name: vendorName, success: true };
  } catch (e) {
    console.error(`[${vendorName}] Error:`, e);
    return { vendor_name: vendorName, success: false, error: (e as Error).message };
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
      // Single vendor
      const result = await generateForVendor(supabase, GEMINI_API_KEY, body.vendor_name, force);
      results.push(result);
    } else if (body.all) {
      // All vendors with 5+ mentions
      const { data: vendors } = await supabase
        .rpc("get_vendor_pulse_vendors_list") as any;

      const vendorList: { name: string; count: number }[] = (vendors as any)?.vendors || [];
      const eligible = vendorList.filter((v) => v.count >= MIN_MENTIONS);

      for (const v of eligible) {
        const result = await generateForVendor(supabase, GEMINI_API_KEY, v.name, force);
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
```

**Step 2: Deploy the edge function**

The user needs to:
1. Set `GEMINI_API_KEY` in the Supabase dashboard (Settings → Edge Functions → Secrets) if not already set.
2. Deploy via Supabase CLI or the MCP deploy tool.

**Step 3: Verify via curl**

Test single vendor:
```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/functions/v1/generate-vendor-themes' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"vendor_name": "DriveCentric"}'
```

Expected: JSON with `generated: 1` and result showing success.

Verify it was cached:
```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/vendor_theme_summaries?vendor_name=eq.DriveCentric' \
  -H 'apikey: <anon_key>'
```

Expected: One row with `themes` containing `positiveThemes` and `warningThemes` arrays with AI-synthesized content.

**Step 4: Commit**

```bash
git add supabase/functions/generate-vendor-themes/index.ts
git commit -m "feat: add generate-vendor-themes edge function"
```

---

## Task 7: Verify full flow end-to-end

**Step 1: Generate themes for a test vendor**

Call the edge function for a vendor with many mentions (e.g., DriveCentric):

```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/functions/v1/generate-vendor-themes' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"vendor_name": "DriveCentric", "force": true}'
```

**Step 2: Verify the RPC returns cached data**

```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/get_vendor_themes' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_vendor_name": "DriveCentric"}'
```

Expected: Returns the AI-synthesized themes (not the old GROUP BY title output).

**Step 3: Verify fallback for a vendor without cached summary**

```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/rest/v1/rpc/get_vendor_themes' \
  -H 'apikey: <anon_key>' \
  -H 'Content-Type: application/json' \
  -d '{"p_vendor_name": "SomeSmallVendor"}'
```

Expected: Returns the GROUP BY title fallback output (with `label` and `summary` keys).

**Step 4: Verify build**

Run: `cd /Users/jasonmayhew/Pulselovable/cdgpulsecom && npx vite build`
Expected: Build succeeds.

**Step 5: Manual browser test**

Run `npm run dev` and navigate to `/vendors/DriveCentric`. Verify:
- "What Dealers Appreciate" shows AI-synthesized theme labels and summaries (not raw mention titles)
- "Common Concerns" shows AI-synthesized content
- As a non-pro user: both sections show blurred content with "Member-only insights" overlay and upgrade CTA
- As a pro user: full unblurred content visible

---

## Task 8: Batch-generate themes for all eligible vendors

**Step 1: Run batch generation**

```bash
curl -s 'https://nsfrxtpxzdmqlezvvjgg.supabase.co/functions/v1/generate-vendor-themes' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{"all": true}' \
  --max-time 300
```

Note: This may take a few minutes for all eligible vendors. The edge function processes them sequentially.

**Step 2: Verify coverage**

```sql
SELECT count(*) FROM vendor_theme_summaries;
```

Compare to:

```sql
SELECT count(DISTINCT vendor_name)
FROM vendor_mentions
GROUP BY vendor_name
HAVING count(*) >= 5;
```

Both counts should be similar.

**Step 3: Commit** — No code changes for this task.
