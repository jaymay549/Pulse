# Sales Targets Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sales Targets" tab to the admin dashboard that surfaces vendor targeting opportunities with sortable signals, dealer drill-downs, and AI-generated pitch angles.

**Architecture:** Hybrid — a lightweight Supabase RPC aggregates raw signal data per vendor; the React frontend computes opportunity scores (Pain, Buzz, Gap) and handles sorting/filtering. Dealer details and AI synopses load on-demand when a row is expanded. AI calls go through a new Supabase Edge Function using Gemini.

**Tech Stack:** PostgreSQL (Supabase RPC), React + TypeScript, TanStack React Query, Tailwind CSS, Radix UI, Recharts (mini charts), Supabase Edge Functions (Deno + Gemini API)

**Spec:** `docs/superpowers/specs/2026-03-26-sales-targets-tool-design.md`

---

## File Structure

### New files:
- `supabase/migrations/YYYYMMDDHHMMSS_sales_opportunity_signals.sql` — RPC function
- `supabase/functions/generate-sales-synopsis/index.ts` — Edge function for AI synopsis
- `src/types/sales-targets.ts` — TypeScript types for this feature
- `src/hooks/useSalesOpportunities.ts` — React Query hook for RPC data
- `src/hooks/useSalesVendorDealers.ts` — React Query hook for dealer drill-down
- `src/hooks/useSalesSynopsis.ts` — Hook for on-demand AI synopsis generation
- `src/components/admin/sales-targets/SalesTargetsTab.tsx` — Main tab container with filters
- `src/components/admin/sales-targets/SalesTargetsTable.tsx` — Sortable table
- `src/components/admin/sales-targets/SalesTargetsRow.tsx` — Expandable vendor row
- `src/components/admin/sales-targets/DealerSubTable.tsx` — Dealer drill-down sub-table
- `src/components/admin/sales-targets/AISynopsis.tsx` — AI synopsis display component
- `src/components/admin/sales-targets/scoring.ts` — Pain/Buzz/Gap score computation

### Modified files:
- `src/pages/admin/AdminDashboard.tsx` — Add tab switcher between "System Stats" and "Sales Targets"

---

## Task 1: TypeScript Types

**Files:**
- Create: `src/types/sales-targets.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/types/sales-targets.ts

export interface SalesOpportunitySignal {
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
  trend_direction: "improving" | "declining" | "stable" | null;
  top_dimension: string | null;
  feature_gap_count: number;
  category: string | null;
  has_profile: boolean;
  confirmed_dealer_count: number;
  likely_dealer_count: number;
  mentioned_only_count: number;
}

export interface SalesOpportunityRow extends SalesOpportunitySignal {
  negative_pct: number;
  nps_score: number | null;
  known_dealers: number;
  pain_score: number;
  buzz_score: number;
  gap_score: number;
}

export interface VendorDealer {
  member_id: string;
  name: string;
  dealership_name: string | null;
  status: "Confirmed User" | "Likely User" | "Mentioned Only";
  sentiment: number | null;
  rooftops: number | null;
  region: string | null;
  switching: boolean;
  mention_count: number;
}

export interface SalesSynopsis {
  data_summary: string;
  pitch_angle: string;
}

export type SortField =
  | "vendor_name"
  | "category"
  | "mentions_30d"
  | "total_mentions"
  | "negative_pct"
  | "nps_score"
  | "health_score"
  | "trend_direction"
  | "feature_gap_count"
  | "known_dealers"
  | "has_profile"
  | "pain_score"
  | "buzz_score"
  | "gap_score";

export type SortDirection = "asc" | "desc";
```

- [ ] **Step 2: Commit**

```bash
git add src/types/sales-targets.ts
git commit -m "feat(sales-targets): add TypeScript types"
```

---

## Task 2: Scoring Utilities

**Files:**
- Create: `src/components/admin/sales-targets/scoring.ts`

- [ ] **Step 1: Create the scoring module**

```ts
// src/components/admin/sales-targets/scoring.ts

import type { SalesOpportunitySignal, SalesOpportunityRow } from "@/types/sales-targets";

/**
 * Compute Pain Score (0-100).
 * - 40% negative percentage
 * - 30% detractor ratio
 * - 30% declining trend bonus
 */
function painScore(signal: SalesOpportunitySignal): number {
  const negPct =
    signal.total_mentions > 0
      ? (signal.negative_count / signal.total_mentions) * 100
      : 0;

  const totalNps =
    signal.promoter_count + signal.detractor_count + signal.passive_count;
  const detractorRatio =
    totalNps > 0 ? (signal.detractor_count / totalNps) * 100 : 0;

  const trendBonus = signal.trend_direction === "declining" ? 100 : 0;

  return Math.min(
    100,
    Math.round(negPct * 0.4 + detractorRatio * 0.3 + trendBonus * 0.3)
  );
}

/**
 * Compute Buzz Score (0-100).
 * - 60% mentions_30d (normalized to max in dataset)
 * - 40% total_mentions (normalized to max in dataset)
 */
function buzzScore(
  signal: SalesOpportunitySignal,
  max30d: number,
  maxTotal: number
): number {
  const norm30d = max30d > 0 ? (signal.mentions_30d / max30d) * 100 : 0;
  const normTotal =
    maxTotal > 0 ? (signal.total_mentions / maxTotal) * 100 : 0;
  return Math.round(norm30d * 0.6 + normTotal * 0.4);
}

/**
 * Compute Gap Score (0-100).
 * Feature gap count normalized to max in dataset.
 */
function gapScore(signal: SalesOpportunitySignal, maxGaps: number): number {
  return maxGaps > 0
    ? Math.round((signal.feature_gap_count / maxGaps) * 100)
    : 0;
}

/**
 * Enrich raw signals with computed scores.
 */
export function computeOpportunityRows(
  signals: SalesOpportunitySignal[]
): SalesOpportunityRow[] {
  const max30d = Math.max(1, ...signals.map((s) => s.mentions_30d));
  const maxTotal = Math.max(1, ...signals.map((s) => s.total_mentions));
  const maxGaps = Math.max(1, ...signals.map((s) => s.feature_gap_count));

  return signals.map((s) => {
    const totalNps =
      s.promoter_count + s.detractor_count + s.passive_count;

    return {
      ...s,
      negative_pct:
        s.total_mentions > 0
          ? Math.round((s.negative_count / s.total_mentions) * 100)
          : 0,
      nps_score:
        totalNps > 0
          ? Math.round(
              ((s.promoter_count - s.detractor_count) / totalNps) * 100
            )
          : null,
      known_dealers: s.confirmed_dealer_count + s.likely_dealer_count,
      pain_score: painScore(s),
      buzz_score: buzzScore(s, max30d, maxTotal),
      gap_score: gapScore(s, maxGaps),
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sales-targets/scoring.ts
git commit -m "feat(sales-targets): add opportunity scoring utilities"
```

---

## Task 3: Supabase RPC Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_sales_opportunity_signals.sql`

**Important:** Generate the timestamp at migration creation time using `date +%Y%m%d%H%M%S`.

- [ ] **Step 1: Create the migration file**

```sql
-- Sales Opportunity Signals RPC
-- Returns one row per vendor with aggregated raw signals for the sales targets tool.
-- Scoring and ranking are handled in the frontend.

CREATE OR REPLACE FUNCTION get_sales_opportunity_signals(
  p_min_mentions INTEGER DEFAULT 3
)
RETURNS TABLE (
  vendor_name         TEXT,
  total_mentions      BIGINT,
  mentions_30d        BIGINT,
  positive_count      BIGINT,
  negative_count      BIGINT,
  neutral_count       BIGINT,
  mixed_count         BIGINT,
  promoter_count      BIGINT,
  detractor_count     BIGINT,
  passive_count       BIGINT,
  health_score        NUMERIC,
  trend_direction     TEXT,
  top_dimension       TEXT,
  feature_gap_count   BIGINT,
  category            TEXT,
  has_profile         BOOLEAN,
  confirmed_dealer_count BIGINT,
  likely_dealer_count    BIGINT,
  mentioned_only_count   BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH mention_agg AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS v_name,
      COUNT(*)                                     AS total_mentions,
      COUNT(*) FILTER (WHERE vm.created_at >= NOW() - INTERVAL '30 days') AS mentions_30d,
      COUNT(*) FILTER (WHERE vm.type = 'positive')  AS positive_count,
      COUNT(*) FILTER (WHERE vm.type IN ('negative', 'warning')) AS negative_count,
      COUNT(*) FILTER (WHERE vm.type = 'neutral')    AS neutral_count,
      COUNT(*) FILTER (WHERE vm.type = 'mixed')      AS mixed_count,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'promoter')  AS promoter_count,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'detractor') AS detractor_count,
      COUNT(*) FILTER (WHERE vm.nps_tier = 'passive')   AS passive_count
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
    HAVING COUNT(*) >= p_min_mentions
  ),
  confirmed AS (
    SELECT
      COALESCE(ve.canonical_name, uts.vendor_name) AS v_name,
      COUNT(DISTINCT uts.user_id) AS cnt
    FROM public.user_tech_stack uts
    LEFT JOIN public.vendor_entities ve
      ON lower(ve.canonical_name) = lower(uts.vendor_name)
    WHERE uts.is_current = true
    GROUP BY COALESCE(ve.canonical_name, uts.vendor_name)
  ),
  likely AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS v_name,
      COUNT(DISTINCT vm.member_id) AS cnt
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.member_id IS NOT NULL
      AND vm.dimension IN ('adopted', 'support', 'reliable', 'integrates', 'worth_it')
      -- Exclude members already counted as confirmed users
      AND NOT EXISTS (
        SELECT 1 FROM public.user_tech_stack uts
        JOIN public.members m ON m.clerk_user_id = uts.user_id
        WHERE m.id = vm.member_id
          AND lower(uts.vendor_name) = lower(COALESCE(ve.canonical_name, vm.vendor_name))
          AND uts.is_current = true
      )
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  ),
  mentioned_only AS (
    SELECT
      COALESCE(ve.canonical_name, vm.vendor_name) AS v_name,
      COUNT(DISTINCT vm.member_id) AS cnt
    FROM public.vendor_mentions vm
    LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
    WHERE vm.member_id IS NOT NULL
      -- Only members whose ALL mentions for this vendor are 'other' dimension or 'neutral' type
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_mentions vm2
        LEFT JOIN public.vendor_entities ve2 ON ve2.id = vm2.vendor_entity_id
        WHERE vm2.member_id = vm.member_id
          AND COALESCE(ve2.canonical_name, vm2.vendor_name) = COALESCE(ve.canonical_name, vm.vendor_name)
          AND vm2.dimension IN ('adopted', 'support', 'reliable', 'integrates', 'worth_it')
      )
      -- Also exclude confirmed users
      AND NOT EXISTS (
        SELECT 1 FROM public.user_tech_stack uts
        JOIN public.members m ON m.clerk_user_id = uts.user_id
        WHERE m.id = vm.member_id
          AND lower(uts.vendor_name) = lower(COALESCE(ve.canonical_name, vm.vendor_name))
          AND uts.is_current = true
      )
    GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
  )
  SELECT
    ma.v_name                                    AS vendor_name,
    ma.total_mentions,
    ma.mentions_30d,
    ma.positive_count,
    ma.negative_count,
    ma.neutral_count,
    ma.mixed_count,
    ma.promoter_count,
    ma.detractor_count,
    ma.passive_count,
    vms.health_score                             AS health_score,
    vic.trend_direction                          AS trend_direction,
    vic.top_dimension                            AS top_dimension,
    COALESCE(fg.gap_count, 0)                    AS feature_gap_count,
    vmd.category                                 AS category,
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE lower(vp.vendor_name) = lower(ma.v_name)
    )                                            AS has_profile,
    COALESCE(c.cnt, 0)                           AS confirmed_dealer_count,
    COALESCE(l.cnt, 0)                           AS likely_dealer_count,
    COALESCE(mo.cnt, 0)                          AS mentioned_only_count
  FROM mention_agg ma
  LEFT JOIN public.vendor_metric_scores vms ON vms.vendor_name = ma.v_name
  LEFT JOIN public.vendor_intelligence_cache vic ON vic.vendor_name = ma.v_name
  LEFT JOIN public.vendor_metadata vmd ON vmd.vendor_name = ma.v_name
  LEFT JOIN (
    SELECT vendor_name AS v_name, COUNT(*) AS gap_count
    FROM public.vendor_feature_gaps
    GROUP BY vendor_name
  ) fg ON fg.v_name = ma.v_name
  LEFT JOIN confirmed c ON c.v_name = ma.v_name
  LEFT JOIN likely l ON l.v_name = ma.v_name
  LEFT JOIN mentioned_only mo ON mo.v_name = ma.v_name
  ORDER BY ma.mentions_30d DESC;
END;
$$;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` or `npx supabase migration up` (whichever pattern this project uses)

Verify: The function should appear in Supabase. Test with:
```sql
SELECT * FROM get_sales_opportunity_signals(3) LIMIT 5;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*_sales_opportunity_signals.sql
git commit -m "feat(sales-targets): add get_sales_opportunity_signals RPC"
```

---

## Task 4: React Query Hooks

**Files:**
- Create: `src/hooks/useSalesOpportunities.ts`
- Create: `src/hooks/useSalesVendorDealers.ts`

- [ ] **Step 1: Create the main data hook**

```ts
// src/hooks/useSalesOpportunities.ts

import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { SalesOpportunitySignal } from "@/types/sales-targets";

export function useSalesOpportunities(minMentions: number = 3) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["sales-opportunity-signals", minMentions],
    queryFn: async (): Promise<SalesOpportunitySignal[]> => {
      const { data, error } = await supabase.rpc(
        "get_sales_opportunity_signals" as never,
        { p_min_mentions: minMentions } as never
      );

      if (error) {
        console.error("[SalesTargets] RPC error:", error);
        throw error;
      }

      return (data as unknown as SalesOpportunitySignal[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Create the dealer drill-down hook**

```ts
// src/hooks/useSalesVendorDealers.ts

import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { VendorDealer } from "@/types/sales-targets";

export function useSalesVendorDealers(vendorName: string, enabled: boolean) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["sales-vendor-dealers", vendorName],
    queryFn: async (): Promise<VendorDealer[]> => {
      // 1. Confirmed users from tech stack
      const { data: techStackData } = await supabase
        .from("user_tech_stack" as never)
        .select("user_id, sentiment_score, switching_intent, status" as never)
        .ilike("vendor_name" as never, vendorName as never)
        .eq("is_current" as never, true as never);

      // 2. Community mentions with member attribution
      const { data: mentionData } = await supabase
        .from("vendor_mentions")
        .select("member_id, dimension, type, sentiment_score")
        .ilike("vendor_name", vendorName);

      // 3. Get unique member IDs from mentions
      const mentionMemberIds = [
        ...new Set(
          (mentionData || [])
            .filter((m: any) => m.member_id)
            .map((m: any) => m.member_id)
        ),
      ];

      // 4. Fetch member details
      const allMemberIds = [...mentionMemberIds];
      const { data: members } = allMemberIds.length > 0
        ? await supabase
            .from("members" as never)
            .select("id, clerk_user_id, name, dealership_name, rooftops, state, region" as never)
            .in("id" as never, allMemberIds as never)
        : { data: [] };

      // 5. Build confirmed user IDs set
      const confirmedUserIds = new Set(
        (techStackData || []).map((t: any) => t.user_id)
      );

      // 6. Map members to clerk_user_id for confirmed lookup
      const membersByClerkId = new Map<string, any>();
      const membersById = new Map<string, any>();
      for (const m of (members || []) as any[]) {
        if (m.clerk_user_id) membersByClerkId.set(m.clerk_user_id, m);
        membersById.set(m.id, m);
      }

      // 7. Build dealer list
      const dealers: VendorDealer[] = [];
      const seenMemberIds = new Set<string>();

      // Confirmed users (from tech stack)
      for (const ts of (techStackData || []) as any[]) {
        const member = membersByClerkId.get(ts.user_id);
        if (!member) continue;
        seenMemberIds.add(member.id);
        dealers.push({
          member_id: member.id,
          name: member.name || "Unknown",
          dealership_name: member.dealership_name,
          status: "Confirmed User",
          sentiment: ts.sentiment_score,
          rooftops: member.rooftops,
          region: member.state || member.region,
          switching: ts.switching_intent === true,
          mention_count: (mentionData || []).filter(
            (m: any) => m.member_id === member.id
          ).length,
        });
      }

      // Community members (not already confirmed)
      for (const memberId of mentionMemberIds) {
        if (seenMemberIds.has(memberId as string)) continue;
        const member = membersById.get(memberId as string);
        if (!member) continue;

        const memberMentions = (mentionData || []).filter(
          (m: any) => m.member_id === memberId
        );
        const hasUsageDimension = memberMentions.some((m: any) =>
          ["adopted", "support", "reliable", "integrates", "worth_it"].includes(
            m.dimension
          )
        );

        const avgSentiment =
          memberMentions.length > 0
            ? memberMentions.reduce(
                (sum: number, m: any) => sum + (m.sentiment_score || 0),
                0
              ) / memberMentions.length
            : null;

        dealers.push({
          member_id: member.id,
          name: member.name || "Unknown",
          dealership_name: member.dealership_name,
          status: hasUsageDimension ? "Likely User" : "Mentioned Only",
          sentiment: avgSentiment,
          rooftops: member.rooftops,
          region: member.state || member.region,
          switching: false,
          mention_count: memberMentions.length,
        });
      }

      // Sort: Confirmed > Likely > Mentioned Only
      const statusOrder = { "Confirmed User": 0, "Likely User": 1, "Mentioned Only": 2 };
      dealers.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      return dealers;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSalesOpportunities.ts src/hooks/useSalesVendorDealers.ts
git commit -m "feat(sales-targets): add React Query hooks for opportunities and dealers"
```

---

## Task 5: AI Synopsis Edge Function

**Files:**
- Create: `supabase/functions/generate-sales-synopsis/index.ts`

- [ ] **Step 1: Create the edge function**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/generate-sales-synopsis/index.ts
git commit -m "feat(sales-targets): add AI synopsis edge function"
```

---

## Task 6: AI Synopsis Hook

**Files:**
- Create: `src/hooks/useSalesSynopsis.ts`

- [ ] **Step 1: Create the synopsis hook**

```ts
// src/hooks/useSalesSynopsis.ts

import { useState, useCallback, useRef } from "react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { SalesOpportunitySignal, SalesSynopsis } from "@/types/sales-targets";

const SYNOPSIS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sales-synopsis`;

export function useSalesSynopsis() {
  const supabase = useClerkSupabase();
  const [cache, setCache] = useState<Record<string, SalesSynopsis>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  const generate = useCallback(
    async (signal: SalesOpportunitySignal) => {
      const key = signal.vendor_name;

      // Return cached result
      if (cache[key]) return;

      // Already loading
      if (loading[key]) return;

      setLoading((prev) => ({ ...prev, [key]: true }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      try {
        // Fetch recent mentions for context
        const { data: mentions } = await supabase
          .from("vendor_mentions")
          .select("type, headline, quote, dimension")
          .ilike("vendor_name", signal.vendor_name)
          .order("created_at", { ascending: false })
          .limit(10);

        const controller = new AbortController();
        abortControllers.current[key] = controller;

        const response = await fetch(SYNOPSIS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            signal,
            mentions: mentions || [],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Synopsis generation failed (${response.status})`);
        }

        const synopsis: SalesSynopsis = await response.json();
        setCache((prev) => ({ ...prev, [key]: synopsis }));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setErrors((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err.message : "Failed to generate synopsis",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
        delete abortControllers.current[key];
      }
    },
    [cache, loading, supabase]
  );

  const retry = useCallback(
    (signal: SalesOpportunitySignal) => {
      const key = signal.vendor_name;
      setCache((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      generate(signal);
    },
    [generate]
  );

  return { cache, loading, errors, generate, retry };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSalesSynopsis.ts
git commit -m "feat(sales-targets): add AI synopsis generation hook"
```

---

## Task 7: AI Synopsis Component

**Files:**
- Create: `src/components/admin/sales-targets/AISynopsis.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/admin/sales-targets/AISynopsis.tsx

import { Loader2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import type { SalesSynopsis } from "@/types/sales-targets";

interface AISynopsisProps {
  synopsis: SalesSynopsis | undefined;
  isLoading: boolean;
  error: string | undefined;
  onRetry: () => void;
}

export function AISynopsis({ synopsis, isLoading, error, onRetry }: AISynopsisProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-zinc-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating sales synopsis...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-red-400 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
        <button
          onClick={onRetry}
          className="ml-2 flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!synopsis) return null;

  return (
    <div className="py-3 px-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        <Sparkles className="h-3 w-3" />
        AI Sales Synopsis
      </div>
      <p className="text-sm text-zinc-300">{synopsis.data_summary}</p>
      <p className="text-sm text-amber-400 font-medium">{synopsis.pitch_angle}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sales-targets/AISynopsis.tsx
git commit -m "feat(sales-targets): add AI synopsis display component"
```

---

## Task 8: Dealer Sub-Table Component

**Files:**
- Create: `src/components/admin/sales-targets/DealerSubTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/admin/sales-targets/DealerSubTable.tsx

import { Loader2, Users } from "lucide-react";
import type { VendorDealer } from "@/types/sales-targets";

const STATUS_BADGE: Record<string, string> = {
  "Confirmed User": "bg-green-900/50 text-green-400 border-green-800",
  "Likely User": "bg-amber-900/50 text-amber-400 border-amber-800",
  "Mentioned Only": "bg-zinc-800 text-zinc-400 border-zinc-700",
};

interface DealerSubTableProps {
  dealers: VendorDealer[] | undefined;
  isLoading: boolean;
}

export function DealerSubTable({ dealers, isLoading }: DealerSubTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-zinc-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dealers...
      </div>
    );
  }

  if (!dealers || dealers.length === 0) {
    return (
      <div className="py-3 px-4 text-zinc-500 text-sm">
        No known dealers for this vendor.
      </div>
    );
  }

  return (
    <div className="py-3 px-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        <Users className="h-3 w-3" />
        Known Dealers ({dealers.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <th className="py-2 pr-4">Dealer</th>
              <th className="py-2 pr-4">Dealership</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Sentiment</th>
              <th className="py-2 pr-4">Rooftops</th>
              <th className="py-2 pr-4">Region</th>
              <th className="py-2 pr-4">Switching?</th>
              <th className="py-2">Mentions</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => (
              <tr
                key={d.member_id}
                className="border-b border-zinc-800/50 text-zinc-300"
              >
                <td className="py-2 pr-4">{d.name}</td>
                <td className="py-2 pr-4 text-zinc-400">
                  {d.dealership_name || "—"}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs border ${STATUS_BADGE[d.status]}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {d.sentiment !== null
                    ? `${Math.round(d.sentiment)}/10`
                    : "—"}
                </td>
                <td className="py-2 pr-4">{d.rooftops ?? "—"}</td>
                <td className="py-2 pr-4 text-zinc-400">{d.region || "—"}</td>
                <td className="py-2 pr-4">
                  {d.status === "Confirmed User" && d.switching ? (
                    <span className="text-red-400 font-medium">Yes</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2">{d.mention_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sales-targets/DealerSubTable.tsx
git commit -m "feat(sales-targets): add dealer sub-table component"
```

---

## Task 9: Expandable Vendor Row Component

**Files:**
- Create: `src/components/admin/sales-targets/SalesTargetsRow.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/admin/sales-targets/SalesTargetsRow.tsx

import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
} from "lucide-react";
import type { SalesOpportunityRow, SalesOpportunitySignal, SalesSynopsis } from "@/types/sales-targets";
import { useSalesVendorDealers } from "@/hooks/useSalesVendorDealers";
import { DealerSubTable } from "./DealerSubTable";
import { AISynopsis } from "./AISynopsis";

interface SalesTargetsRowProps {
  row: SalesOpportunityRow;
  synopsisCache: Record<string, SalesSynopsis>;
  synopsisLoading: Record<string, boolean>;
  synopsisErrors: Record<string, string>;
  onGenerateSynopsis: (signal: SalesOpportunitySignal) => void;
  onRetrySynopsis: (signal: SalesOpportunitySignal) => void;
}

const TrendIcon = ({ direction }: { direction: string | null }) => {
  if (direction === "improving")
    return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (direction === "declining")
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-zinc-500" />;
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-amber-400";
  return "text-zinc-400";
}

function healthColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export function SalesTargetsRow({
  row,
  synopsisCache,
  synopsisLoading,
  synopsisErrors,
  onGenerateSynopsis,
  onRetrySynopsis,
}: SalesTargetsRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: dealers, isLoading: dealersLoading } = useSalesVendorDealers(
    row.vendor_name,
    expanded
  );

  // Trigger synopsis generation when expanded
  useEffect(() => {
    if (expanded) {
      onGenerateSynopsis(row);
    }
  }, [expanded]);

  return (
    <>
      <tr
        className="border-b border-zinc-800 hover:bg-zinc-900/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
            <span className="font-medium text-zinc-100">{row.vendor_name}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          {row.category ? (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">
              {row.category}
            </span>
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-zinc-300">{row.mentions_30d}</td>
        <td className="py-3 px-4 text-zinc-400">{row.total_mentions}</td>
        <td className="py-3 px-4 text-zinc-300">{row.negative_pct}%</td>
        <td className="py-3 px-4 text-zinc-300">
          {row.nps_score !== null ? row.nps_score : "—"}
        </td>
        <td className={`py-3 px-4 ${healthColor(row.health_score)}`}>
          {row.health_score !== null ? Math.round(row.health_score) : "—"}
        </td>
        <td className="py-3 px-4">
          <TrendIcon direction={row.trend_direction} />
        </td>
        <td className="py-3 px-4 text-zinc-300">{row.feature_gap_count}</td>
        <td className="py-3 px-4 text-zinc-300">{row.known_dealers}</td>
        <td className="py-3 px-4">
          {row.has_profile ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </td>
        <td className={`py-3 px-4 font-medium ${scoreColor(row.pain_score)}`}>
          {row.pain_score}
        </td>
        <td className={`py-3 px-4 font-medium ${scoreColor(row.buzz_score)}`}>
          {row.buzz_score}
        </td>
        <td className={`py-3 px-4 font-medium ${scoreColor(row.gap_score)}`}>
          {row.gap_score}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={14} className="bg-zinc-950 border-b border-zinc-800">
            <DealerSubTable dealers={dealers} isLoading={dealersLoading} />
            <div className="border-t border-zinc-800">
              <AISynopsis
                synopsis={synopsisCache[row.vendor_name]}
                isLoading={synopsisLoading[row.vendor_name] || false}
                error={synopsisErrors[row.vendor_name]}
                onRetry={() => onRetrySynopsis(row)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sales-targets/SalesTargetsRow.tsx
git commit -m "feat(sales-targets): add expandable vendor row component"
```

---

## Task 10: Sales Targets Table Component

**Files:**
- Create: `src/components/admin/sales-targets/SalesTargetsTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/admin/sales-targets/SalesTargetsTable.tsx

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type {
  SalesOpportunityRow,
  SalesOpportunitySignal,
  SalesSynopsis,
  SortField,
  SortDirection,
} from "@/types/sales-targets";
import { SalesTargetsRow } from "./SalesTargetsRow";

interface SalesTargetsTableProps {
  rows: SalesOpportunityRow[];
  synopsisCache: Record<string, SalesSynopsis>;
  synopsisLoading: Record<string, boolean>;
  synopsisErrors: Record<string, string>;
  onGenerateSynopsis: (signal: SalesOpportunitySignal) => void;
  onRetrySynopsis: (signal: SalesOpportunitySignal) => void;
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "vendor_name", label: "Vendor" },
  { key: "category", label: "Category" },
  { key: "mentions_30d", label: "30d" },
  { key: "total_mentions", label: "Total" },
  { key: "negative_pct", label: "Neg %" },
  { key: "nps_score", label: "NPS" },
  { key: "health_score", label: "Health" },
  { key: "trend_direction", label: "Trend" },
  { key: "feature_gap_count", label: "Gaps" },
  { key: "known_dealers", label: "Dealers" },
  { key: "has_profile", label: "Profile" },
  { key: "pain_score", label: "Pain" },
  { key: "buzz_score", label: "Buzz" },
  { key: "gap_score", label: "Gap" },
];

function compareValues(a: any, b: any, dir: SortDirection): number {
  // Handle nulls — push to end
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  // Booleans
  if (typeof a === "boolean") {
    const diff = (b === true ? 1 : 0) - (a === true ? 1 : 0);
    return dir === "asc" ? -diff : diff;
  }

  // Strings
  if (typeof a === "string") {
    const cmp = a.localeCompare(b);
    return dir === "asc" ? cmp : -cmp;
  }

  // Numbers
  const diff = (a as number) - (b as number);
  return dir === "asc" ? diff : -diff;
}

export function SalesTargetsTable({
  rows,
  synopsisCache,
  synopsisLoading,
  synopsisErrors,
  onGenerateSynopsis,
  onRetrySynopsis,
}: SalesTargetsTableProps) {
  const [sortField, setSortField] = useState<SortField>("mentions_30d");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      compareValues(
        a[sortField as keyof SalesOpportunityRow],
        b[sortField as keyof SalesOpportunityRow],
        sortDir
      )
    );
  }, [rows, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 text-zinc-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-zinc-300" />
    ) : (
      <ArrowDown className="h-3 w-3 text-zinc-300" />
    );
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No vendors match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="py-2 px-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors select-none"
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <SortIcon field={col.key} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <SalesTargetsRow
              key={row.vendor_name}
              row={row}
              synopsisCache={synopsisCache}
              synopsisLoading={synopsisLoading}
              synopsisErrors={synopsisErrors}
              onGenerateSynopsis={onGenerateSynopsis}
              onRetrySynopsis={onRetrySynopsis}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sales-targets/SalesTargetsTable.tsx
git commit -m "feat(sales-targets): add sortable table component"
```

---

## Task 11: Sales Targets Tab Container

**Files:**
- Create: `src/components/admin/sales-targets/SalesTargetsTab.tsx`

- [ ] **Step 1: Create the tab container**

```tsx
// src/components/admin/sales-targets/SalesTargetsTab.tsx

import { useState, useMemo } from "react";
import { Loader2, Target } from "lucide-react";
import { useSalesOpportunities } from "@/hooks/useSalesOpportunities";
import { useSalesSynopsis } from "@/hooks/useSalesSynopsis";
import { computeOpportunityRows } from "./scoring";
import { SalesTargetsTable } from "./SalesTargetsTable";

export function SalesTargetsTab() {
  const [minMentions, setMinMentions] = useState(3);
  const [showAll, setShowAll] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const effectiveMin = showAll ? 1 : minMentions;
  const { data: signals, isLoading, error } = useSalesOpportunities(effectiveMin);
  const synopsis = useSalesSynopsis();

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    if (!signals) return [];
    const cats = [...new Set(signals.map((s) => s.category).filter(Boolean))] as string[];
    return cats.sort();
  }, [signals]);

  // Compute rows with scores, apply category filter
  const rows = useMemo(() => {
    if (!signals) return [];
    const filtered =
      categoryFilter === "all"
        ? signals
        : signals.filter((s) => s.category === categoryFilter);
    return computeOpportunityRows(filtered);
  }, [signals, categoryFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-400">
        Failed to load sales opportunity data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {rows.length} vendors
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        {/* Category filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="all">All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Min mentions slider */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Min Mentions</label>
          <input
            type="range"
            min={1}
            max={50}
            value={minMentions}
            onChange={(e) => setMinMentions(Number(e.target.value))}
            disabled={showAll}
            className="w-24 accent-zinc-500"
          />
          <span className="text-xs text-zinc-400 w-6 text-right">
            {showAll ? 1 : minMentions}
          </span>
        </div>

        {/* Show all toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Show All</label>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`w-8 h-4 rounded-full transition-colors ${
              showAll ? "bg-green-600" : "bg-zinc-700"
            } relative`}
          >
            <div
              className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                showAll ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <SalesTargetsTable
          rows={rows}
          synopsisCache={synopsis.cache}
          synopsisLoading={synopsis.loading}
          synopsisErrors={synopsis.errors}
          onGenerateSynopsis={synopsis.generate}
          onRetrySynopsis={synopsis.retry}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sales-targets/SalesTargetsTab.tsx
git commit -m "feat(sales-targets): add tab container with filters"
```

---

## Task 12: Integrate into AdminDashboard

**Files:**
- Modify: `src/pages/admin/AdminDashboard.tsx`

- [ ] **Step 1: Add tab switcher to AdminDashboard**

Modify `AdminDashboard.tsx` to add a tab bar at the top that switches between the existing "System Stats" content and the new "Sales Targets" tab.

The current `AdminDashboard` component contains all the system stats inline. Wrap the existing stats content so it's shown when the "System" tab is active, and render `SalesTargetsTab` when "Sales Targets" is active.

Changes to make:

1. Add `import { SalesTargetsTab } from "@/components/admin/sales-targets/SalesTargetsTab";` and `import { Target } from "lucide-react";` to the imports.

2. Add a `tab` state: `const [tab, setTab] = useState<"system" | "sales">("system");`

3. Replace the return JSX. The heading section becomes a tab bar, and the stats sections are wrapped in a conditional:

```tsx
return (
  <div className="space-y-8 max-w-5xl">
    <div>
      <h1 className="text-xl font-bold text-zinc-100">Dashboard</h1>
      <div className="flex gap-1 mt-3">
        <button
          onClick={() => setTab("system")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "system"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          System
        </button>
        <button
          onClick={() => setTab("sales")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === "sales"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Target className="h-3.5 w-3.5" />
          Sales Targets
        </button>
      </div>
    </div>

    {tab === "system" ? (
      <>
        {/* All existing stat sections go here — unchanged */}
      </>
    ) : (
      <SalesTargetsTab />
    )}
  </div>
);
```

The existing `<section>` blocks for Vendor Queue, Topics, Groups, and Tasks move inside the `tab === "system"` fragment, completely unchanged.

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev` (or `npx vite dev`)

Verify:
- AdminDashboard at `/admin` shows two tabs: "System" and "Sales Targets"
- "System" tab shows the existing stat cards (unchanged)
- "Sales Targets" tab loads and shows the opportunity table (or loading state)
- Clicking a vendor row expands it to show dealer sub-table and AI synopsis

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminDashboard.tsx
git commit -m "feat(sales-targets): integrate Sales Targets tab into AdminDashboard"
```

---

## Task 13: Deploy Edge Function & Migration

- [ ] **Step 1: Push the migration to Supabase**

Run: `npx supabase db push`

Verify: `SELECT * FROM get_sales_opportunity_signals(3) LIMIT 3;` returns data in Supabase SQL editor.

- [ ] **Step 2: Deploy the edge function**

Run: `npx supabase functions deploy generate-sales-synopsis`

Verify: The function appears in the Supabase dashboard under Edge Functions.

- [ ] **Step 3: Smoke test end-to-end**

1. Open the admin dashboard
2. Click "Sales Targets" tab
3. Verify vendors load with correct counts
4. Sort by different columns
5. Filter by category
6. Adjust min mentions slider
7. Expand a vendor row — verify dealer sub-table loads
8. Verify AI synopsis generates below the dealer list
9. Test the "Retry" button by temporarily breaking the edge function URL

- [ ] **Step 4: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix(sales-targets): smoke test fixes"
```
