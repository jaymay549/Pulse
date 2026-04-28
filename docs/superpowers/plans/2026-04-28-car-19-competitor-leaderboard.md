# CAR-19 · Competitor Comparison Leaderboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `DashboardIntel` competitor comparison table with a multi-metric Bloomberg-style leaderboard ranked by composite Pulse Score, broken out across the three existing dimensions (Product Stability, Customer Experience, Value Perception), with segment median benchmark line, 90-day rank movement, thin-segment auto-widening, and a Tier 2 diagnostic-mode capability card for Tier 1 vendors.

**Architecture:** One additive Postgres column on `vendor_profiles` for the manual admin competitor-override list. One backwards-compatible v2 of the `get_compared_vendors` RPC that returns full multi-metric scores per vendor, segment metadata (median, qualifying_vendor_count, widened_to), and 90-day rank delta. One new React component `CompetitorLeaderboard.tsx` decomposed into focused subcomponents. The component reads tier from existing `useVendorTier()` context; tier difference is in row-click behavior, not what is visible.

**Tech Stack:** PostgreSQL (Supabase, public schema), TypeScript, React 18, TanStack Query, Tailwind CSS + shadcn primitives, lucide-react, Playwright for e2e tests.

**Spec:** [docs/superpowers/specs/2026-04-28-car-19-competitor-leaderboard-design.md](../specs/2026-04-28-car-19-competitor-leaderboard-design.md)

**Linear:** [CAR-19](https://linear.app/cardealershipguy/issue/CAR-19/competitor-comparison-leaderboard)

---

## Phase 0: Branch and orientation

### Task 0.1: Switch to the issue branch

**Files:** none (git only)

- [ ] **Step 1: Verify clean working tree**

  Run: `git status --short`
  Expected: only the spec, PRODUCT.md, DESIGN.md, .gitignore staged or committed; nothing else dirty.

- [ ] **Step 2: Create or switch to the Linear branch**

  ```bash
  git fetch origin
  git checkout -B jason/car-19-competitor-comparison-leaderboard
  ```

  If the branch already exists upstream, prefer `git checkout -t origin/jason/car-19-competitor-comparison-leaderboard`.

- [ ] **Step 3: Confirm spec and PRODUCT.md / DESIGN.md are present on this branch**

  Run: `ls docs/superpowers/specs/2026-04-28-car-19-competitor-leaderboard-design.md PRODUCT.md DESIGN.md`
  Expected: all three exist. If not, cherry-pick the commit that added them.

---

## Phase 1: Backend — schema column

Adds a single nullable `jsonb` column to `vendor_profiles` so admins can manually curate a competitor set per vendor profile. The admin write UI is out of scope; the column ships now.

### Task 1.1: Migration — add `competitor_override` column

**Files:**
- Create: `supabase/migrations/20260428100000_vendor_profiles_competitor_override.sql`

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260428100000_vendor_profiles_competitor_override.sql`:

  ```sql
  -- CAR-19: add manual competitor-override array to vendor_profiles.
  -- When non-null, downstream RPCs (e.g. get_compared_vendors v2) bypass the
  -- auto-derived category segment and rank only against this curated set.
  -- Shape: ["Acme CRM", "DealerStream", ...] using canonical names from
  -- vendor_entities. Validation that names exist is enforced at write time
  -- by the (future) admin form, not here.

  ALTER TABLE public.vendor_profiles
    ADD COLUMN IF NOT EXISTS competitor_override jsonb;

  COMMENT ON COLUMN public.vendor_profiles.competitor_override IS
    'Optional admin-curated competitor set for the leaderboard. When non-null, get_compared_vendors uses this instead of the category-derived segment. JSON array of canonical vendor names.';
  ```

- [ ] **Step 2: Apply the migration locally and confirm the column exists**

  Run:
  ```bash
  supabase db push
  ```
  (or `supabase migration up` depending on local Supabase CLI version).

  Verify with `psql` or via the Supabase MCP:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'vendor_profiles'
    AND column_name = 'competitor_override';
  ```
  Expected: one row, `data_type = jsonb`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

  ```bash
  git add supabase/migrations/20260428100000_vendor_profiles_competitor_override.sql
  git commit -m "feat(car-19): add vendor_profiles.competitor_override column for admin-curated leaderboard segments"
  ```

---

## Phase 2: Backend — RPC v2

Extends `public.get_compared_vendors` to return everything the leaderboard needs in one call. Backwards-compatible: existing callers (`PulseBriefing.tsx`, the soon-to-be-removed code path in `DashboardIntel.tsx`) still receive the legacy fields and ignore the new ones.

### Task 2.1: Migration — `get_compared_vendors` v2

**Files:**
- Create: `supabase/migrations/20260428110000_get_compared_vendors_v2.sql`
- Reference (read for context only): `supabase/migrations/20260312510000_fix_compared_vendors_dms_crm.sql`, `supabase/migrations/20260416100000_fix_dashboard_intel_case_insensitive.sql`

- [ ] **Step 1: Write the new migration**

  Create `supabase/migrations/20260428110000_get_compared_vendors_v2.sql`. The function keeps the same name and signature pattern as today, adds an optional `p_segment_override` parameter, and joins per-vendor scores from `public.vendor_metric_scores` plus segment medians from `public.category_benchmarks`. It auto-widens to the parent category family (the existing `_categories_match` helper covers DMS / CRM; reuse it) when `qualifying_vendor_count < 3`.

  ```sql
  -- CAR-19: get_compared_vendors v2.
  -- Backwards-compatible: legacy fields (vendor_name, mention_count,
  -- positive_percent, co_occurrence_count) are preserved on every row so
  -- existing callers (PulseBriefing.tsx) keep working.
  --
  -- New per-row fields:
  --   health_score, product_stability_score, customer_experience_score,
  --   value_perception_score, rank, rank_delta_90d, is_above_median.
  --
  -- New envelope field `segment`:
  --   { category, widened_to, qualifying_vendor_count,
  --     median: { health_score, product_stability, customer_experience, value_perception } }.
  --
  -- New optional input `p_segment_override`: when non-null, this jsonb array
  -- of canonical vendor names defines the explicit competitor set.

  CREATE OR REPLACE FUNCTION public.get_compared_vendors(
    p_vendor_name       TEXT,
    p_limit             INTEGER DEFAULT 8,
    p_segment_override  JSONB   DEFAULT NULL
  )
  RETURNS JSONB
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_entity_id        UUID;
    v_canonical        TEXT;
    v_category         TEXT;
    v_widened_to       TEXT;
    v_qualifying_count INTEGER;
    v_segment_origin   TEXT;
    v_own_health       NUMERIC;
    v_segment_names    TEXT[];
    v_vendors          JSONB;
    v_medians          JSONB;
  BEGIN
    -- Entity resolution (reuse existing helper)
    SELECT r.vendor_entity_id INTO v_entity_id
    FROM public.resolve_vendor_family_name_only(p_vendor_name) r LIMIT 1;

    IF v_entity_id IS NOT NULL THEN
      SELECT canonical_name INTO v_canonical
      FROM public.vendor_entities WHERE id = v_entity_id;
    END IF;
    v_canonical := COALESCE(v_canonical, p_vendor_name);

    -- ────────────────────────────────────────────────────────────────────
    -- Resolve segment: override > category (with auto-widen on thin segments)
    -- ────────────────────────────────────────────────────────────────────
    IF p_segment_override IS NOT NULL THEN
      v_segment_origin := 'override';
      v_segment_names  := ARRAY(SELECT jsonb_array_elements_text(p_segment_override));
      v_category       := NULL;
      v_widened_to     := NULL;
    ELSE
      SELECT category INTO v_category
      FROM public.vendor_metadata
      WHERE lower(vendor_name) = lower(v_canonical)
      LIMIT 1;

      v_segment_origin := 'category';

      -- Count qualifying vendors in category (using existing categories_match
      -- helper to fold dms/crm/dms-crm into one family). Build the segment
      -- name set.
      SELECT array_agg(DISTINCT vm.vendor_name)
      INTO v_segment_names
      FROM public.vendor_metadata vm
      JOIN public.vendor_metric_scores s
        ON lower(s.vendor_name) = lower(vm.vendor_name)
      WHERE public._categories_match(vm.category, v_category)
        AND s.health_score IS NOT NULL;

      v_qualifying_count := COALESCE(array_length(v_segment_names, 1), 0);

      -- Auto-widen if too thin. Today the only documented widening pair is
      -- dms/crm/dms-crm (handled by _categories_match already). Future:
      -- replace with category_hierarchy lookup. For now if widening did
      -- not produce >= 3 qualifying vendors, set widened_to = NULL and
      -- fall through with the small segment.
      IF v_qualifying_count < 3 AND v_category IS NOT NULL THEN
        v_widened_to := v_category;  -- caller can read this and surface a note.
      END IF;
    END IF;

    -- ────────────────────────────────────────────────────────────────────
    -- Compute medians for the resolved segment
    -- ────────────────────────────────────────────────────────────────────
    SELECT jsonb_build_object(
      'health_score',        ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.health_score)),
      'product_stability',   ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.product_stability)),
      'customer_experience', ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.customer_experience)),
      'value_perception',    ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.value_perception))
    )
    INTO v_medians
    FROM public.vendor_metric_scores s
    WHERE lower(s.vendor_name) = ANY(SELECT lower(unnest(v_segment_names)));

    -- ────────────────────────────────────────────────────────────────────
    -- Build the ranked vendor list (the viewing vendor is included so the
    -- frontend can render its own row in context). Limit to p_limit + the
    -- viewing vendor; frontend handles "show all" expand by re-calling with
    -- a larger p_limit.
    -- ────────────────────────────────────────────────────────────────────
    WITH
    metrics AS (
      SELECT
        s.vendor_name,
        s.health_score,
        s.product_stability,
        s.customer_experience,
        s.value_perception
      FROM public.vendor_metric_scores s
      WHERE lower(s.vendor_name) = ANY(SELECT lower(unnest(v_segment_names)))
    ),
    -- 90D rank delta: compare current health_score rank vs vendor_metric_scores_90d_prior
    -- if a snapshot table exists; otherwise rank_delta_90d is NULL.
    -- (See open question 1 in the spec — for v1 we ship NULL and add the
    -- prior-snapshot computation as a follow-up.)
    ranked AS (
      SELECT
        m.*,
        DENSE_RANK() OVER (ORDER BY m.health_score DESC NULLS LAST) AS rnk,
        m.health_score >= COALESCE((v_medians ->> 'health_score')::NUMERIC, 0) AS is_above_median
      FROM metrics m
    ),
    -- Mention counts and co-occurrence (preserved from v1 for backwards compat)
    own_members AS (
      SELECT DISTINCT member_id
      FROM public.vendor_mentions
      WHERE is_hidden = false
        AND member_id IS NOT NULL
        AND (
          (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
          (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
        )
    ),
    mention_agg AS (
      SELECT
        COALESCE(ve.canonical_name, vm.vendor_name) AS vname,
        COUNT(*)::INTEGER AS mc,
        ROUND(
          COUNT(*) FILTER (WHERE type = 'positive')::NUMERIC
          / NULLIF(COUNT(*), 0) * 100
        )::INTEGER AS pp,
        COUNT(DISTINCT vm.member_id) FILTER (
          WHERE vm.member_id IN (SELECT member_id FROM own_members)
        )::INTEGER AS cooc
      FROM public.vendor_mentions vm
      LEFT JOIN public.vendor_entities ve ON ve.id = vm.vendor_entity_id
      WHERE vm.is_hidden = false
        AND COALESCE(ve.canonical_name, vm.vendor_name) = ANY(v_segment_names)
      GROUP BY COALESCE(ve.canonical_name, vm.vendor_name)
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        -- legacy fields
        'vendor_name',         r.vendor_name,
        'mention_count',       COALESCE(ma.mc, 0),
        'positive_percent',    COALESCE(ma.pp, 0),
        'co_occurrence_count', COALESCE(ma.cooc, 0),
        -- new fields
        'health_score',              r.health_score,
        'product_stability_score',   r.product_stability,
        'customer_experience_score', r.customer_experience,
        'value_perception_score',    r.value_perception,
        'rank',                      r.rnk,
        'rank_delta_90d',            NULL::INTEGER,  -- v1: TODO follow-up
        'is_above_median',           r.is_above_median,
        'is_self',                   lower(r.vendor_name) = lower(v_canonical)
      )
      ORDER BY r.rnk ASC, COALESCE(ma.mc, 0) DESC
    )
    INTO v_vendors
    FROM ranked r
    LEFT JOIN mention_agg ma ON ma.vname = r.vendor_name
    LIMIT GREATEST(p_limit + 1, 6);  -- always return at least 6 rows so the
                                     -- "you ±1" windowing has neighbors.

    RETURN jsonb_build_object(
      'vendors', COALESCE(v_vendors, '[]'::jsonb),
      'segment', jsonb_build_object(
        'category',                  v_category,
        'origin',                    v_segment_origin,
        'widened_to',                v_widened_to,
        'qualifying_vendor_count',   COALESCE(v_qualifying_count, COALESCE(jsonb_array_length(v_vendors), 0)),
        'median',                    COALESCE(v_medians, '{}'::jsonb)
      )
    );
  END;
  $$;

  GRANT EXECUTE ON FUNCTION public.get_compared_vendors(TEXT, INTEGER, JSONB)
    TO authenticated, anon, service_role;
  ```

- [ ] **Step 2: Apply the migration locally**

  Run: `supabase db push`. Confirm no errors.

- [ ] **Step 3: Smoke-test the RPC against a vendor with a populated category**

  Pick a vendor known to have category data (e.g. CDK Global or an Acme-style fixture). Run:
  ```sql
  SELECT public.get_compared_vendors('CDK Global', 8, NULL);
  ```
  Expected: jsonb response with `vendors` array of 6+ rows and a `segment` object containing `category`, `qualifying_vendor_count`, `median.health_score`, etc. Each row should include both legacy fields (`mention_count`, `positive_percent`) and new fields (`health_score`, `product_stability_score`, `rank`).

- [ ] **Step 4: Smoke-test the override path**

  ```sql
  SELECT public.get_compared_vendors(
    'CDK Global',
    8,
    '["Reynolds and Reynolds", "Dealertrack", "Tekion"]'::jsonb
  );
  ```
  Expected: response with `segment.origin = "override"`, `segment.widened_to = null`, and the vendors array containing only the override set ranked by health_score.

- [ ] **Step 5: Smoke-test backwards compatibility**

  Confirm `PulseBriefing.tsx`'s call shape still works (signature is `(p_vendor_name, p_limit)` with the third arg defaulting to NULL):
  ```sql
  SELECT public.get_compared_vendors('CDK Global', 4);
  ```
  Expected: works without error. The response shape is a superset of the old shape; legacy fields are present on every row.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/20260428110000_get_compared_vendors_v2.sql
  git commit -m "feat(car-19): get_compared_vendors v2 — multi-metric scores, segment median, override support"
  ```

### Task 2.2: Decide on rank_delta_90d follow-up

**Files:** none (decision recorded in plan + spec)

The current migration ships `rank_delta_90d` as `NULL` for every row because we have not yet built the prior-snapshot table. The frontend will render "New" for every row in v1 if we leave this. Two options:

- **Option A — ship v1 with all-null deltas**, replace inline column rendering with a quiet "—" instead of "New" until the snapshot job exists. Add a follow-up Linear issue for the snapshot.
- **Option B — compute deltas inline** by re-running the rank query against `vendor_mentions` filtered to `> 90 days ago AND <= 180 days ago` and joining. Heavier, but a complete v1.

- [ ] **Step 1: Pick A or B and document in the plan**

  This plan ships **Option A**. The snapshot follow-up is filed as a v1.1 task (e.g. CAR-19a). Update the spec's "Open questions for implementation phase" entry #1 to reflect this decision.

- [ ] **Step 2: Update spec to reflect the v1 decision**

  Edit `docs/superpowers/specs/2026-04-28-car-19-competitor-leaderboard-design.md`. Replace open question 1 with:

  ```markdown
  1. v1 ships rank_delta_90d as null for every row (no prior-snapshot table exists yet). UI renders "—" not "New" in the delta column for v1; the prior-window computation lands in a follow-up. The widening hierarchy is hardcoded to the existing dms/crm pattern; a category_hierarchy table is also a follow-up.
  ```

- [ ] **Step 3: Commit the spec update**

  ```bash
  git add docs/superpowers/specs/2026-04-28-car-19-competitor-leaderboard-design.md
  git commit -m "docs(car-19): record v1 decision — rank_delta_90d ships null until snapshot job"
  ```

---

## Phase 3: Frontend — types and data hook

Extends the comparison-data types and adds a single React Query hook that the leaderboard component consumes.

### Task 3.1: Define new types

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/types.ts`

- [ ] **Step 1: Create the types file**

  Path: `src/components/vendor-dashboard/competitor-leaderboard/types.ts`. Drop in the full type set:

  ```ts
  // CAR-19: type definitions for the multi-metric competitor leaderboard.
  // Shapes mirror get_compared_vendors v2.

  export type SortMetric =
    | "pulse"
    | "product_stability"
    | "customer_experience"
    | "value_perception"
    | "volume";

  export interface LeaderboardVendor {
    vendor_name: string;
    is_self: boolean;
    rank: number;
    rank_delta_90d: number | null;
    is_above_median: boolean;
    health_score: number | null;
    product_stability_score: number | null;
    customer_experience_score: number | null;
    value_perception_score: number | null;
    mention_count: number;
    positive_percent: number;
    co_occurrence_count: number;
  }

  export interface LeaderboardSegment {
    category: string | null;
    origin: "category" | "override";
    widened_to: string | null;
    qualifying_vendor_count: number;
    median: {
      health_score: number | null;
      product_stability: number | null;
      customer_experience: number | null;
      value_perception: number | null;
    };
  }

  export interface LeaderboardPayload {
    vendors: LeaderboardVendor[];
    segment: LeaderboardSegment;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/types.ts
  git commit -m "feat(car-19): leaderboard payload types"
  ```

### Task 3.2: React Query hook

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/useLeaderboardData.ts`

- [ ] **Step 1: Create the hook**

  Path: `src/components/vendor-dashboard/competitor-leaderboard/useLeaderboardData.ts`:

  ```ts
  import { useQuery } from "@tanstack/react-query";
  import { useClerkSupabase } from "@/hooks/useClerkSupabase";
  import type { LeaderboardPayload } from "./types";

  interface Args {
    vendorName: string;
    limit?: number;
    /** Optional admin-curated competitor name list. */
    segmentOverride?: string[] | null;
  }

  export function useLeaderboardData({ vendorName, limit = 8, segmentOverride = null }: Args) {
    const supabase = useClerkSupabase();

    return useQuery<LeaderboardPayload>({
      queryKey: ["competitor-leaderboard", vendorName, limit, segmentOverride],
      enabled: !!vendorName,
      staleTime: 5 * 60 * 1000,
      queryFn: async () => {
        const { data, error } = await supabase.rpc(
          "get_compared_vendors" as never,
          {
            p_vendor_name: vendorName,
            p_limit: limit,
            p_segment_override: segmentOverride,
          } as never,
        );
        if (error) {
          console.error("[CompetitorLeaderboard] get_compared_vendors error:", error);
          throw error;
        }
        return data as unknown as LeaderboardPayload;
      },
    });
  }
  ```

- [ ] **Step 2: Confirm the project builds**

  Run: `npm run build`
  Expected: build succeeds. (No component imports the hook yet, but the file should type-check.)

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/useLeaderboardData.ts
  git commit -m "feat(car-19): useLeaderboardData hook"
  ```

---

## Phase 4: Frontend — visual primitives

Three small presentational helpers used across the leaderboard.

### Task 4.1: Sentiment-color helper

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/sentiment.ts`

- [ ] **Step 1: Create the file**

  ```ts
  // CAR-19: sentiment color tokens shared across leaderboard cells.
  // Mirrors DESIGN.md sentiment scale: ≥70 emerald, 50–69 amber, <50 red.

  export type SentimentTier = "hi" | "mid" | "lo" | "muted";

  export function sentimentTier(score: number | null): SentimentTier {
    if (score === null) return "muted";
    if (score >= 70) return "hi";
    if (score >= 50) return "mid";
    return "lo";
  }

  export function sentimentTextClass(score: number | null): string {
    switch (sentimentTier(score)) {
      case "hi": return "text-emerald-600";
      case "mid": return "text-amber-600";
      case "lo": return "text-red-500";
      default: return "text-slate-400";
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/sentiment.ts
  git commit -m "feat(car-19): sentiment color helpers"
  ```

### Task 4.2: Inline sparkline component

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/Sparkline.tsx`

- [ ] **Step 1: Create the component**

  These are decorative micro-trends; do not use Recharts. Render as 8 inline `<span>` bars in a flex row with explicit heights.

  ```tsx
  import { cn } from "@/lib/utils";

  interface SparklineProps {
    /** 8 normalized values 0–1 representing 90-day health-score trajectory. */
    values: number[];
    /** Apply primary-blue treatment (used on the vendor's own row). */
    isSelf?: boolean;
    /** Trend direction; when "up", the last bar is highlighted emerald. */
    trend?: "up" | "down" | "flat";
  }

  export function Sparkline({ values, isSelf = false, trend = "flat" }: SparklineProps) {
    const safe = (values.length === 8 ? values : padTo8(values)).map(clamp01);

    return (
      <div className="flex h-[22px] items-end justify-end gap-[1.5px]">
        {safe.map((v, i) => {
          const isLast = i === safe.length - 1;
          return (
            <span
              key={i}
              style={{ height: `${Math.max(v * 100, 8)}%` }}
              className={cn(
                "w-[3px] rounded-[1.5px]",
                isSelf
                  ? "bg-primary"
                  : isLast && trend === "up"
                  ? "bg-emerald-600"
                  : "bg-slate-300",
              )}
            />
          );
        })}
      </div>
    );
  }

  function clamp01(n: number) {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function padTo8(values: number[]): number[] {
    if (values.length >= 8) return values.slice(-8);
    const padded = [...Array(8 - values.length).fill(0), ...values];
    return padded;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/Sparkline.tsx
  git commit -m "feat(car-19): inline sparkline primitive"
  ```

---

## Phase 5: Frontend — leaderboard core

The main component plus its row and median pieces. No motion, no T1/T2 conditional behavior yet — just the static visual structure.

### Task 5.1: Sort chip control

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/SortChips.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  import { cn } from "@/lib/utils";
  import type { SortMetric } from "./types";

  interface SortChipsProps {
    value: SortMetric;
    onChange: (metric: SortMetric) => void;
  }

  const OPTIONS: Array<{ key: SortMetric; label: string }> = [
    { key: "pulse",               label: "Pulse Score" },
    { key: "product_stability",   label: "Product Stability" },
    { key: "customer_experience", label: "Customer Experience" },
    { key: "value_perception",    label: "Value Perception" },
    { key: "volume",              label: "Volume" },
  ];

  export function SortChips({ value, onChange }: SortChipsProps) {
    return (
      <div role="toolbar" aria-label="Sort leaderboard" className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Sort by
        </span>
        {OPTIONS.map((opt) => {
          const on = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                on
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/SortChips.tsx
  git commit -m "feat(car-19): sort chip control"
  ```

### Task 5.2: Leaderboard row

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/LeaderboardRow.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  import { ArrowDown, ArrowUp, ChevronRight, Minus } from "lucide-react";
  import { cn } from "@/lib/utils";
  import { Sparkline } from "./Sparkline";
  import { sentimentTextClass } from "./sentiment";
  import type { LeaderboardVendor } from "./types";

  interface LeaderboardRowProps {
    vendor: LeaderboardVendor;
    onClick: (vendor: LeaderboardVendor) => void;
    sparkline: number[];
    sparklineTrend: "up" | "down" | "flat";
  }

  export function LeaderboardRow({ vendor, onClick, sparkline, sparklineTrend }: LeaderboardRowProps) {
    const self = vendor.is_self;
    return (
      <button
        type="button"
        onClick={() => onClick(vendor)}
        aria-current={self ? "true" : undefined}
        aria-label={`Rank ${vendor.rank}, ${vendor.vendor_name}, Pulse score ${vendor.health_score ?? "not yet scored"}`}
        className={cn(
          "group grid w-full items-center gap-3.5 border-b border-slate-100 px-0 py-2.5 text-left text-xs transition-colors",
          "grid-cols-[30px_minmax(140px,2fr)_70px_70px_70px_70px_80px_12px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          self
            ? "-mx-6 bg-primary/[0.06] px-6 hover:bg-primary/[0.10]"
            : "hover:bg-slate-50",
        )}
      >
        <RankCell value={vendor.rank} self={self} />
        <NameCell name={vendor.vendor_name} mentions={vendor.mention_count} self={self} />
        <PulseCell vendor={vendor} self={self} />
        <ScoreCell value={vendor.product_stability_score} />
        <ScoreCell value={vendor.customer_experience_score} />
        <ScoreCell value={vendor.value_perception_score} />
        <div className="flex items-center justify-end">
          <Sparkline values={sparkline} isSelf={self} trend={sparklineTrend} />
        </div>
        <ChevronRight
          className={cn(
            "h-3 w-3 justify-self-end text-slate-300 transition-all",
            "group-hover:translate-x-0.5 group-hover:text-slate-500",
            self && "text-primary",
          )}
        />
      </button>
    );
  }

  function RankCell({ value, self }: { value: number; self: boolean }) {
    return (
      <span className={cn("font-mono text-[11.5px] font-semibold", self ? "text-primary" : "text-slate-400")}>
        {String(value).padStart(2, "0")}
      </span>
    );
  }

  function NameCell({ name, mentions, self }: { name: string; mentions: number; self: boolean }) {
    return (
      <span className="flex items-center gap-2">
        <span className={cn("font-semibold", self ? "text-primary" : "text-slate-900")}>
          {name}
        </span>
        <span className="font-mono text-[10px] font-medium text-slate-400">
          · {mentions} mentions
        </span>
      </span>
    );
  }

  function PulseCell({ vendor, self }: { vendor: LeaderboardVendor; self: boolean }) {
    const value = vendor.health_score;
    const delta = vendor.rank_delta_90d;
    return (
      <span className="flex items-baseline justify-end gap-1">
        {value === null ? (
          <GatheringPill />
        ) : (
          <>
            <span className={cn("font-mono text-sm font-bold tabular-nums", sentimentTextClass(value))}>
              {Math.round(value)}
            </span>
            {delta !== null && delta !== 0 && (
              <span
                className={cn(
                  "font-mono text-[9.5px] font-bold",
                  delta > 0 ? "text-emerald-600" : "text-red-500",
                )}
                aria-label={`Rank changed ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since prior window`}
              >
                {delta > 0 ? "+" : ""}{delta}
              </span>
            )}
          </>
        )}
      </span>
    );
  }

  function ScoreCell({ value }: { value: number | null }) {
    if (value === null) return (
      <span className="flex justify-end">
        <GatheringPill />
      </span>
    );
    return (
      <span className={cn("text-right font-mono text-xs font-bold tabular-nums", sentimentTextClass(value))}>
        {Math.round(value)}
      </span>
    );
  }

  function GatheringPill() {
    return (
      <span
        className="rounded-full px-1.5 py-[1px] font-mono text-[10px] font-bold uppercase tracking-wide text-slate-300"
        title="Not enough discussion in this dimension to score yet."
      >
        Gathering
      </span>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/LeaderboardRow.tsx
  git commit -m "feat(car-19): leaderboard row + cells"
  ```

### Task 5.3: Median strip

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/MedianRow.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  import type { LeaderboardSegment } from "./types";

  interface MedianRowProps {
    segment: LeaderboardSegment;
  }

  export function MedianRow({ segment }: MedianRowProps) {
    const m = segment.median;
    const labelCategory =
      segment.origin === "override"
        ? "Curated competitor set"
        : segment.widened_to
        ? `Broader ${segment.widened_to} category`
        : segment.category ?? "segment";

    return (
      <div
        role="separator"
        aria-label={`Segment median: Pulse ${m.health_score ?? "not available"}`}
        className="my-1.5 grid items-center gap-3.5 border-y border-dashed border-slate-400 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500 grid-cols-[30px_minmax(140px,2fr)_70px_70px_70px_70px_80px_12px]"
      >
        <span />
        <span className="text-slate-500">Segment median · {labelCategory}</span>
        <span className="text-right text-slate-500">{m.health_score ?? "—"}</span>
        <span className="text-right text-slate-500">{m.product_stability ?? "—"}</span>
        <span className="text-right text-slate-500">{m.customer_experience ?? "—"}</span>
        <span className="text-right text-slate-500">{m.value_perception ?? "—"}</span>
        <span />
        <span />
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/MedianRow.tsx
  git commit -m "feat(car-19): segment median strip"
  ```

### Task 5.4: Header strip

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/LeaderboardHeader.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  import type { LeaderboardSegment } from "./types";

  interface LeaderboardHeaderProps {
    segment: LeaderboardSegment;
  }

  export function LeaderboardHeader({ segment }: LeaderboardHeaderProps) {
    const eyebrowCategory =
      segment.origin === "override"
        ? "Curated competitor set"
        : segment.widened_to
        ? `${segment.widened_to.toUpperCase()} (broader category)`
        : (segment.category ?? "Segment").toUpperCase();

    return (
      <div className="flex items-end justify-between gap-6 border-b border-slate-200 pb-3.5">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Competitive Standing · {eyebrowCategory}
          </div>
          <h2 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.025em] text-slate-900">
            Where you rank, across every metric.
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
            90-day window, weighted composite. Click any row to expand the per-vendor breakdown.
          </p>
        </div>
        <span
          aria-label="Live, 90-day window"
          className="inline-flex items-center gap-1.5 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600"
        >
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-600">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-600 opacity-50" />
          </span>
          LIVE · 90D
        </span>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/LeaderboardHeader.tsx
  git commit -m "feat(car-19): leaderboard header strip"
  ```

### Task 5.5: Column-header strip

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/TableHeader.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  export function TableHeader() {
    const right = "text-right";
    return (
      <div
        className="grid items-center gap-3.5 border-b border-slate-200 pb-2.5 pt-3.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 grid-cols-[30px_minmax(140px,2fr)_70px_70px_70px_70px_80px_12px]"
      >
        <span />
        <span>Vendor</span>
        <span className={right}>Pulse</span>
        <span className={right}>Stability</span>
        <span className={right}>CX</span>
        <span className={right}>Value</span>
        <span className={right}>90D</span>
        <span />
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/TableHeader.tsx
  git commit -m "feat(car-19): leaderboard table header"
  ```

---

## Phase 6: Frontend — windowing and below-table panels

### Task 6.1: Row-windowing helper

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/window.ts`

Computes the visible row set per Q4-B (top 5 + you ± 1 when out of top 5 + median row position).

- [ ] **Step 1: Create the helper with full logic**

  ```ts
  import type { LeaderboardVendor } from "./types";

  export interface WindowedView {
    /** Rows above the median in display order. */
    aboveMedian: LeaderboardVendor[];
    /** Rows at or below the median in display order. */
    belowMedian: LeaderboardVendor[];
    /** Whether more vendors exist beyond what is rendered. */
    hasMore: boolean;
    /** Total qualifying vendors in the segment. */
    totalCount: number;
  }

  /**
   * Default render set:
   *  - Top 5 by rank.
   *  - The vendor's own row (always).
   *  - The vendor immediately above and below the vendor (when the vendor is
   *    outside the top 5).
   *  - Median strip rendered between rows where Pulse score crosses the
   *    segment median.
   */
  export function buildDefaultWindow(
    vendors: LeaderboardVendor[],
    medianHealth: number | null,
    expanded: boolean,
  ): WindowedView {
    const sorted = [...vendors].sort((a, b) => a.rank - b.rank);
    if (expanded) {
      return splitByMedian(sorted, medianHealth, sorted.length, false);
    }

    const top5 = sorted.slice(0, 5);
    const self = sorted.find((v) => v.is_self);
    const include = new Set(top5.map((v) => v.vendor_name));

    if (self && !include.has(self.vendor_name)) {
      const idx = sorted.findIndex((v) => v.vendor_name === self.vendor_name);
      [sorted[idx - 1], self, sorted[idx + 1]].forEach((v) => v && include.add(v.vendor_name));
    }

    const visible = sorted.filter((v) => include.has(v.vendor_name));
    return splitByMedian(visible, medianHealth, sorted.length, sorted.length > visible.length);
  }

  function splitByMedian(
    visible: LeaderboardVendor[],
    medianHealth: number | null,
    totalCount: number,
    hasMore: boolean,
  ): WindowedView {
    if (medianHealth === null) {
      return { aboveMedian: visible, belowMedian: [], hasMore, totalCount };
    }
    const above: LeaderboardVendor[] = [];
    const below: LeaderboardVendor[] = [];
    for (const v of visible) {
      if ((v.health_score ?? -Infinity) >= medianHealth) above.push(v);
      else below.push(v);
    }
    return { aboveMedian: above, belowMedian: below, hasMore, totalCount };
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/window.ts
  git commit -m "feat(car-19): row windowing helper"
  ```

### Task 6.2: "Your shape" auto-narrated card

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/YourShapeCard.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  import type { LeaderboardPayload, LeaderboardVendor } from "./types";

  interface YourShapeCardProps {
    payload: LeaderboardPayload;
  }

  type Dimension = "product_stability" | "customer_experience" | "value_perception";

  const DIMENSION_LABEL: Record<Dimension, string> = {
    product_stability:    "Product Stability",
    customer_experience:  "Customer Experience",
    value_perception:     "Value Perception",
  };

  export function YourShapeCard({ payload }: YourShapeCardProps) {
    const self = payload.vendors.find((v) => v.is_self);
    if (!self) return null;

    const ranks = computeDimensionRanks(payload.vendors);
    const median = payload.segment.median;

    const sorted: Array<{ key: Dimension; rank: number; score: number | null }> = (
      ["product_stability", "customer_experience", "value_perception"] as Dimension[]
    ).map((k) => ({ key: k, rank: ranks[k][self.vendor_name] ?? Infinity, score: scoreFor(self, k) }));

    sorted.sort((a, b) => a.rank - b.rank);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Your shape
        </div>
        <h3 className="mt-1 text-sm font-extrabold tracking-tight text-slate-900">
          {best.score !== null && worst.score !== null
            ? `You lead in ${DIMENSION_LABEL[best.key]}, but lag in ${DIMENSION_LABEL[worst.key]}.`
            : "Building your shape."}
        </h3>
        <p className="mt-2 text-[13px] leading-snug text-slate-700">
          {renderLines({ self, best, worst, median })}
        </p>
      </div>
    );
  }

  function scoreFor(v: LeaderboardVendor, k: Dimension): number | null {
    if (k === "product_stability") return v.product_stability_score;
    if (k === "customer_experience") return v.customer_experience_score;
    return v.value_perception_score;
  }

  function computeDimensionRanks(vendors: LeaderboardVendor[]): Record<Dimension, Record<string, number>> {
    const acc: Record<Dimension, Record<string, number>> = {
      product_stability: {}, customer_experience: {}, value_perception: {},
    };
    (Object.keys(acc) as Dimension[]).forEach((k) => {
      const sorted = [...vendors]
        .filter((v) => scoreFor(v, k) !== null)
        .sort((a, b) => (scoreFor(b, k) ?? 0) - (scoreFor(a, k) ?? 0));
      sorted.forEach((v, i) => { acc[k][v.vendor_name] = i + 1; });
    });
    return acc;
  }

  function renderLines({
    self, best, worst, median,
  }: {
    self: LeaderboardVendor;
    best:  { key: Dimension; rank: number; score: number | null };
    worst: { key: Dimension; rank: number; score: number | null };
    median: { product_stability: number | null; customer_experience: number | null; value_perception: number | null; health_score: number | null };
  }) {
    const bestMedian  = medianFor(median, best.key);
    const worstMedian = medianFor(median, worst.key);
    const delta90     = self.rank_delta_90d;

    return (
      <>
        Rank <strong className="font-bold text-slate-900">#{best.rank} in {DIMENSION_LABEL[best.key]}</strong>{" "}
        with a score of <span className="font-bold text-emerald-600">{best.score}</span>
        {bestMedian !== null && `, well above the segment median of ${bestMedian}`}.
        <br />
        Rank <strong className="font-bold text-slate-900">#{worst.rank} in {DIMENSION_LABEL[worst.key]}</strong>{" "}
        with <span className="font-bold text-red-500">{worst.score}</span>
        {worstMedian !== null && `, below the median of ${worstMedian}`}. This is what is holding your composite to #{self.rank}.
        {delta90 !== null && (
          <>
            <br />
            Pulse momentum:{" "}
            <span className={delta90 > 0 ? "font-bold text-emerald-600" : "font-bold text-red-500"}>
              {delta90 > 0 ? `+${delta90}` : delta90}
            </span>{" "}
            over last 90 days.
          </>
        )}
      </>
    );
  }

  function medianFor(
    median: { product_stability: number | null; customer_experience: number | null; value_perception: number | null; health_score: number | null },
    key: Dimension,
  ): number | null {
    if (key === "product_stability") return median.product_stability;
    if (key === "customer_experience") return median.customer_experience;
    return median.value_perception;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/YourShapeCard.tsx
  git commit -m "feat(car-19): your-shape auto-narrated card"
  ```

### Task 6.3: Tier 2 capability card (T1-only)

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/Tier2CapabilityCard.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  export function Tier2CapabilityCard() {
    return (
      <div
        className="flex flex-col gap-1.5 rounded-xl border p-5"
        style={{
          borderColor: "rgba(224,161,6,0.35)",
          background: "linear-gradient(180deg, #FFFBEB 0%, #fff 100%)",
        }}
      >
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
          ◆ Available in Tier 2
        </span>
        <h4 className="mt-1 text-sm font-extrabold tracking-tight text-slate-900">
          Diagnostic mode: see why you rank where you do.
        </h4>
        <p className="text-[13px] leading-snug text-slate-600">
          Tier 2 expands every score in this table into the underlying evidence:
        </p>
        <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-700">
          <CapabilityBullet>The dealer quotes driving each dimension score</CapabilityBullet>
          <CapabilityBullet>Specific feature gaps mapped to that dimension</CapabilityBullet>
          <CapabilityBullet>Competitor moves that shifted your rank in the last 90 days</CapabilityBullet>
        </ul>
        <button
          type="button"
          className="mt-2.5 self-start rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 font-sans text-xs font-semibold text-slate-900 transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Talk to your CSM about Tier 2 →
        </button>
        <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400">
          Already on Tier 2? Click any row above.
        </span>
      </div>
    );
  }

  function CapabilityBullet({ children }: { children: React.ReactNode }) {
    return (
      <li className="flex items-baseline gap-2">
        <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-amber-600" />
        <span>{children}</span>
      </li>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/Tier2CapabilityCard.tsx
  git commit -m "feat(car-19): tier 2 capability card"
  ```

### Task 6.4: Show-all toggle

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/ShowAllToggle.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  interface ShowAllToggleProps {
    expanded: boolean;
    totalCount: number;
    onToggle: () => void;
  }

  export function ShowAllToggle({ expanded, totalCount, onToggle }: ShowAllToggleProps) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 w-full rounded-md border border-dashed border-slate-200 py-2 font-sans text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-expanded={expanded}
      >
        {expanded ? "Show fewer vendors" : `Show all ${totalCount} vendors`}
      </button>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/ShowAllToggle.tsx
  git commit -m "feat(car-19): show-all expand toggle"
  ```

### Task 6.5: Widened-segment notice

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/WidenedNotice.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  interface WidenedNoticeProps {
    widenedTo: string;
  }

  export function WidenedNotice({ widenedTo }: WidenedNoticeProps) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Compared against the broader <span className="font-semibold text-slate-700">{widenedTo}</span> category. Your specific segment doesn{`'`}t yet have enough qualifying vendors.
      </p>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/WidenedNotice.tsx
  git commit -m "feat(car-19): widened-segment notice"
  ```

---

## Phase 7: Frontend — top-level component

### Task 7.1: CompetitorLeaderboard top-level

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx`
- Create: `src/components/vendor-dashboard/competitor-leaderboard/index.ts`

- [ ] **Step 1: Create the index re-export**

  Path: `src/components/vendor-dashboard/competitor-leaderboard/index.ts`:

  ```ts
  export { CompetitorLeaderboard } from "./CompetitorLeaderboard";
  ```

- [ ] **Step 2: Create the top-level component**

  Path: `src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx`:

  ```tsx
  import { useMemo, useState } from "react";
  import { useVendorTier } from "../GatedCard";
  import { LeaderboardHeader } from "./LeaderboardHeader";
  import { LeaderboardRow } from "./LeaderboardRow";
  import { MedianRow } from "./MedianRow";
  import { ShowAllToggle } from "./ShowAllToggle";
  import { SortChips } from "./SortChips";
  import { TableHeader } from "./TableHeader";
  import { Tier2CapabilityCard } from "./Tier2CapabilityCard";
  import { WidenedNotice } from "./WidenedNotice";
  import { YourShapeCard } from "./YourShapeCard";
  import { useLeaderboardData } from "./useLeaderboardData";
  import { buildDefaultWindow } from "./window";
  import type { LeaderboardVendor, SortMetric } from "./types";

  interface CompetitorLeaderboardProps {
    vendorName: string;
  }

  export function CompetitorLeaderboard({ vendorName }: CompetitorLeaderboardProps) {
    const tier = useVendorTier();
    const [sortBy, setSortBy] = useState<SortMetric>("pulse");
    const [expanded, setExpanded] = useState(false);
    const [activeRowVendor, setActiveRowVendor] = useState<LeaderboardVendor | null>(null);

    // Note: competitor_override is read in a follow-up task (8.x) once the
    // admin form ships. For v1 we always pass null.
    const { data, isLoading, isError } = useLeaderboardData({
      vendorName,
      limit: expanded ? 50 : 8,
      segmentOverride: null,
    });

    const sorted = useMemo(() => sortVendors(data?.vendors ?? [], sortBy), [data?.vendors, sortBy]);
    const window = useMemo(
      () => buildDefaultWindow(sorted, data?.segment.median.health_score ?? null, expanded),
      [sorted, data?.segment.median.health_score, expanded],
    );

    if (isLoading) return <p className="text-sm text-slate-500">Loading leaderboard…</p>;
    if (isError || !data) return <p className="text-sm text-slate-500">Could not load competitive standing.</p>;
    if (data.vendors.length < 2) return <EmptyState />;

    const isT1 = tier !== undefined && tier !== "tier_2";

    return (
      <section className="rounded-2xl bg-[#FAFAFA] p-7" aria-labelledby="competitor-leaderboard-heading">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div id="competitor-leaderboard-heading">
            <LeaderboardHeader segment={data.segment} />
          </div>
          {data.segment.widened_to && <WidenedNotice widenedTo={data.segment.widened_to} />}

          <SortChips value={sortBy} onChange={setSortBy} />
          <TableHeader />

          {window.aboveMedian.map((v) => (
            <LeaderboardRow
              key={v.vendor_name}
              vendor={v}
              sparkline={mockSparklineFor(v)}
              sparklineTrend={inferTrend(v)}
              onClick={setActiveRowVendor}
            />
          ))}
          <MedianRow segment={data.segment} />
          {window.belowMedian.map((v) => (
            <LeaderboardRow
              key={v.vendor_name}
              vendor={v}
              sparkline={mockSparklineFor(v)}
              sparklineTrend={inferTrend(v)}
              onClick={setActiveRowVendor}
            />
          ))}

          {window.hasMore && (
            <ShowAllToggle
              expanded={expanded}
              totalCount={data.segment.qualifying_vendor_count}
              onToggle={() => setExpanded((x) => !x)}
            />
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <YourShapeCard payload={data} />
            {isT1 && <Tier2CapabilityCard />}
          </div>
        </div>

        {activeRowVendor && (
          <RowClickResult
            tier={tier}
            vendor={activeRowVendor}
            onDismiss={() => setActiveRowVendor(null)}
          />
        )}
      </section>
    );
  }

  /**
   * Sort comparator. The visible composite column always shows Pulse, but the
   * row order changes with the sort key.
   */
  function sortVendors(vendors: LeaderboardVendor[], sortBy: SortMetric): LeaderboardVendor[] {
    const get = (v: LeaderboardVendor): number => {
      if (sortBy === "pulse") return v.health_score ?? -Infinity;
      if (sortBy === "product_stability") return v.product_stability_score ?? -Infinity;
      if (sortBy === "customer_experience") return v.customer_experience_score ?? -Infinity;
      if (sortBy === "value_perception") return v.value_perception_score ?? -Infinity;
      return v.mention_count;
    };
    return [...vendors].sort((a, b) => get(b) - get(a));
  }

  /**
   * v1 sparkline: derive a flat-to-current curve from the vendor's current
   * health_score so the column has visual rhythm. Replaced by real per-vendor
   * 90D sentiment_history wiring in a follow-up.
   */
  function mockSparklineFor(v: LeaderboardVendor): number[] {
    const target = (v.health_score ?? 50) / 100;
    const start = Math.max(0.2, target - 0.18);
    return Array.from({ length: 8 }, (_, i) => start + ((target - start) * i) / 7);
  }

  function inferTrend(v: LeaderboardVendor): "up" | "down" | "flat" {
    if (v.rank_delta_90d === null) return "flat";
    if (v.rank_delta_90d > 0) return "up";
    if (v.rank_delta_90d < 0) return "down";
    return "flat";
  }

  function EmptyState() {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
          Not enough data yet to rank you against competitors.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
          Our engine is currently gathering dealer feedback. Need 2+ qualifying vendors in your segment to render the leaderboard.
        </p>
      </section>
    );
  }

  /**
   * Row-click outcome. Tier 1 sees an inline strip directly under the table
   * pointing them at Tier 2. Tier 2 v1 ships a console.warn no-op (the real
   * drawer is a follow-up issue).
   */
  function RowClickResult({
    tier, vendor, onDismiss,
  }: {
    tier: string | undefined;
    vendor: LeaderboardVendor;
    onDismiss: () => void;
  }) {
    if (tier === "tier_2" || tier === undefined) {
      // eslint-disable-next-line no-console
      console.warn("CompetitorLeaderboard: Tier 2 drawer not yet implemented", vendor);
      // For v1, dismiss immediately so the click feels intentional but inert.
      // Replaced wholesale by the follow-up drawer issue.
      requestAnimationFrame(onDismiss);
      return null;
    }
    return (
      <div className="mt-4 grid grid-cols-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 text-[13px] text-slate-700 sm:grid-cols-[1fr_auto]">
        <span>
          Diagnostic mode is available in Tier 2. See the dealer quotes, feature gaps, and competitor moves driving <strong className="font-semibold text-slate-900">{vendor.vendor_name}</strong>{`'`}s scores.
        </span>
        <div className="flex gap-2 justify-self-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Dismiss
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 font-sans text-xs font-semibold text-white hover:opacity-90"
          >
            Talk to your CSM →
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Build verification**

  Run: `npm run build`
  Expected: build succeeds, no type errors. Component is reachable from `import { CompetitorLeaderboard } from "@/components/vendor-dashboard/competitor-leaderboard"`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx src/components/vendor-dashboard/competitor-leaderboard/index.ts
  git commit -m "feat(car-19): CompetitorLeaderboard top-level component"
  ```

---

## Phase 8: Wire-up — replace old table

### Task 8.1: Swap into DashboardIntel.tsx

**Files:**
- Modify: `src/components/vendor-dashboard/DashboardIntel.tsx`

The "Your Position" hero stays. The competitor table block (current lines ~203 to ~262 of `DashboardIntel.tsx`) is replaced by `<CompetitorLeaderboard vendorName={vendorName} />`. The `ComparedVendor` interface and the `competitors` query are removed (the leaderboard owns its own data fetch).

- [ ] **Step 1: Edit `DashboardIntel.tsx`**

  Remove the local `competitors` query (lines ~112–125), the local `rows` derivation (lines ~142–157), and the entire competitor-table JSX block (lines ~203–262). Add an import for the new component and render it under the "Your Position" card.

  Open `src/components/vendor-dashboard/DashboardIntel.tsx`. Apply these changes:

  Add import near the top with the other component imports:

  ```ts
  import { CompetitorLeaderboard } from "./competitor-leaderboard";
  ```

  Remove the `ComparedVendor` interface declaration block (the four-property interface around line 31).

  Remove the `// Competitors` block:

  ```ts
  // DELETE
  const { data: competitors = [], isLoading: competitorsLoading } = useQuery<ComparedVendor[]>({...});
  ```

  Update the `if (profileLoading || competitorsLoading)` early-return — drop `competitorsLoading`:

  ```ts
  // BEFORE
  if (profileLoading || competitorsLoading) {
    return <p className="text-sm text-slate-500">Loading intel...</p>;
  }
  // AFTER
  if (profileLoading) {
    return <p className="text-sm text-slate-500">Loading intel...</p>;
  }
  ```

  Remove the `rows` array derivation (the const that maps `[ownProfile, ...competitors]` into rows).

  Replace the competitor table JSX (the `<div>` containing the `<table>` with thead and tbody) with a single render of the new component:

  ```tsx
  <CompetitorLeaderboard vendorName={vendorName} />
  ```

  The replacement should sit directly below the "Your Position" card, with the existing `mt-6` spacing pattern preserved.

- [ ] **Step 2: Build verification**

  Run: `npm run build && npm run lint`
  Expected: both succeed. No unused-variable warnings; no orphaned `ComparedVendor` references.

- [ ] **Step 3: Manual smoke check in dev server**

  Run: `npm run dev`
  Open the app, log in as a vendor (or as an admin viewing a vendor), navigate to Market Intel. Expected: the new leaderboard renders in place of the old table with the Your Position card unchanged above it.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/vendor-dashboard/DashboardIntel.tsx
  git commit -m "feat(car-19): swap CompetitorLeaderboard into DashboardIntel"
  ```

### Task 8.2: Wire `competitor_override` from `vendor_profiles`

**Files:**
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx`
- Modify: `src/components/vendor-dashboard/DashboardIntel.tsx` (pass profile data through) OR resolve inside the leaderboard via a lightweight query.

For v1 simplicity, fetch the override inside the leaderboard component itself.

- [ ] **Step 1: Add the override query**

  In `CompetitorLeaderboard.tsx`, add a sibling React Query that reads the override:

  ```tsx
  import { useClerkSupabase } from "@/hooks/useClerkSupabase";
  // ...

  function useCompetitorOverride(vendorName: string): string[] | null {
    const supabase = useClerkSupabase();
    const { data } = useQuery({
      queryKey: ["competitor-override", vendorName],
      enabled: !!vendorName,
      staleTime: 10 * 60 * 1000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("vendor_profiles")
          .select("competitor_override")
          .ilike("vendor_name", vendorName)
          .maybeSingle();
        if (error) throw error;
        return (data?.competitor_override as string[] | null) ?? null;
      },
    });
    return data ?? null;
  }
  ```

  Use it in the component body:

  ```tsx
  const segmentOverride = useCompetitorOverride(vendorName);
  const { data, isLoading, isError } = useLeaderboardData({
    vendorName,
    limit: expanded ? 50 : 8,
    segmentOverride,
  });
  ```

- [ ] **Step 2: Build and verify**

  Run: `npm run build`
  Expected: build succeeds. With `competitor_override` null on every vendor (default), behavior is unchanged from Task 8.1.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx
  git commit -m "feat(car-19): wire competitor_override into leaderboard query"
  ```

---

## Phase 9: Motion and accessibility

### Task 9.1: Staggered fade-in on first render

**Files:**
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/LeaderboardRow.tsx`

- [ ] **Step 1: Add a `delayMs` prop and inline animation**

  Add to `LeaderboardRowProps`:
  ```ts
  delayMs?: number;
  ```

  Apply via inline style:
  ```tsx
  style={{
    animationDelay: `${delayMs ?? 0}ms`,
    animationFillMode: "both",
  }}
  className={cn(
    "motion-safe:animate-[leaderboard-row-in_400ms_cubic-bezier(0.16,1,0.3,1)_both]",
    // ...rest of existing classes
  )}
  ```

- [ ] **Step 2: Define the keyframe in `tailwind.config.ts`**

  Append to the `keyframes` block:
  ```ts
  "leaderboard-row-in": {
    "0%":   { opacity: "0", transform: "translateY(4px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
  ```

- [ ] **Step 3: Pass the delay from the parent**

  In `CompetitorLeaderboard.tsx`, pass `delayMs={index * 60}` when rendering rows.

- [ ] **Step 4: Verify reduced motion still works**

  In dev tools, enable `prefers-reduced-motion: reduce`. Refresh. Expected: rows render in their final position with no fade.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/LeaderboardRow.tsx src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx tailwind.config.ts
  git commit -m "feat(car-19): staggered row fade-in with reduced-motion guard"
  ```

### Task 9.2: FLIP repositioning on sort change

**Files:**
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx`

For v1, ship a simpler approach: when sort changes, re-mount each row with a fresh `key` so the keyframe replays. Real FLIP can be a v1.1 if the re-mount feels janky.

- [ ] **Step 1: Suffix the row key with the sort metric**

  ```tsx
  <LeaderboardRow key={`${v.vendor_name}-${sortBy}`} ... />
  ```

  This causes the existing fade-in keyframe to replay on sort change.

- [ ] **Step 2: Visual check**

  Run dev server. Toggle between sort chips. Expected: rows reorder with the same staggered fade.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx
  git commit -m "feat(car-19): replay row reveal on sort change"
  ```

### Task 9.3: Final accessibility pass

**Files:**
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx` (already has `aria-labelledby`)
- No new files

- [ ] **Step 1: Verify all interactive elements are reachable via Tab**

  Manually run through: SortChips → each row button → ShowAllToggle → Tier2CapabilityCard CTA. Every element should land focus with the existing primary-blue ring.

- [ ] **Step 2: Verify screen-reader output on the vendor's own row**

  In Safari VoiceOver or Chrome ChromeVox: the row should be announced as "current item, Rank 3, Your vendor, Pulse score 62, button". `aria-current="true"` carries this.

- [ ] **Step 3: Commit (no-op or minor fixes only)**

  If no changes were needed, skip the commit. Otherwise:
  ```bash
  git add -p
  git commit -m "fix(car-19): a11y cleanup on leaderboard"
  ```

---

## Phase 10: Telemetry

For v1, scaffolding only — no analytics layer is configured in this repo. The events should be wired through a stub `track()` function so the follow-up integration is one find-and-replace.

### Task 10.1: Telemetry stub and events

**Files:**
- Create: `src/components/vendor-dashboard/competitor-leaderboard/telemetry.ts`
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx`
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/SortChips.tsx`
- Modify: `src/components/vendor-dashboard/competitor-leaderboard/Tier2CapabilityCard.tsx`

- [ ] **Step 1: Create the stub**

  ```ts
  // CAR-19 telemetry. Currently a stub — wire into the project analytics layer
  // when one ships. All payloads are flat objects of primitives.

  type LeaderboardEvent =
    | { name: "leaderboard_viewed"; payload: { tier: string | undefined; segment_category: string | null; was_widened: boolean; qualifying_vendor_count: number; rank: number | null } }
    | { name: "leaderboard_sort_changed"; payload: { from: string; to: string } }
    | { name: "leaderboard_row_clicked"; payload: { tier: string | undefined; vendor_name: string; was_own_row: boolean } }
    | { name: "leaderboard_show_all_expanded"; payload: { total_vendors: number } }
    | { name: "tier2_card_cta_clicked"; payload: { source: string } };

  export function track(event: LeaderboardEvent): void {
    // eslint-disable-next-line no-console
    console.debug("[CompetitorLeaderboard][telemetry]", event.name, event.payload);
  }
  ```

- [ ] **Step 2: Wire the calls**

  In `CompetitorLeaderboard.tsx`:
  - Fire `leaderboard_viewed` once when the query resolves. Use `useEffect` keyed on `data?.segment.category` to avoid re-firing on every render.
  - Fire `leaderboard_sort_changed` from the parent's onChange handler when the chip changes — the parent owns `sortBy` and therefore knows both the previous and next values; do not push this responsibility into `SortChips.tsx`.
  - Fire `leaderboard_row_clicked` from the row click handler.
  - Fire `leaderboard_show_all_expanded` when `setExpanded(true)`.

  In `Tier2CapabilityCard.tsx`, accept an optional `onCtaClick` prop and call it from the CTA button. The parent (`CompetitorLeaderboard.tsx`) supplies the handler that calls `track({ name: "tier2_card_cta_clicked", payload: { source: "competitor_leaderboard" } })`. Keeping the dispatch in the parent matches the pattern used elsewhere in this component.

- [ ] **Step 3: Build verification**

  Run: `npm run build`. Expected: success.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/vendor-dashboard/competitor-leaderboard/telemetry.ts src/components/vendor-dashboard/competitor-leaderboard/CompetitorLeaderboard.tsx src/components/vendor-dashboard/competitor-leaderboard/SortChips.tsx src/components/vendor-dashboard/competitor-leaderboard/Tier2CapabilityCard.tsx
  git commit -m "feat(car-19): telemetry scaffolding for leaderboard events"
  ```

---

## Phase 11: Playwright tests

The repo uses Playwright for e2e per `playwright.config.ts`. The existing test directory pattern lives in the project root or a `tests/` folder; verify before adding.

### Task 11.1: Inventory existing test setup

**Files:** read-only

- [ ] **Step 1: Locate existing Playwright config and tests**

  Run: `cat playwright.config.ts && find . -path ./node_modules -prune -o -name '*.spec.ts' -print | head -20`
  Note the test directory and any auth helpers that are used to log in as a vendor.

- [ ] **Step 2: Decide where new tests live**

  Use the same directory and naming convention as existing tests. If none exist, create `tests/vendor-dashboard/competitor-leaderboard.spec.ts` and add a comment block referencing the convention used by `playwright.config.ts`.

### Task 11.2: Happy-path test

**Files:**
- Create: `tests/vendor-dashboard/competitor-leaderboard.spec.ts` (or matching existing convention)

- [ ] **Step 1: Write the happy-path test**

  ```ts
  import { test, expect } from "@playwright/test";

  test.describe("CompetitorLeaderboard — happy path", () => {
    test("renders header, sort chips, ranked rows, median strip, your shape card", async ({ page }) => {
      // Auth helper — adapt to the project's vendor-login pattern.
      await loginAsVendor(page, { tier: "tier_1", vendorName: "CDK Global" });

      await page.goto("/vendor-dashboard");
      await page.getByRole("button", { name: /market intel/i }).click();

      // Header
      await expect(page.getByRole("heading", { name: /where you rank/i })).toBeVisible();

      // Sort chips toolbar
      const toolbar = page.getByRole("toolbar", { name: /sort leaderboard/i });
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByRole("button", { name: "Pulse Score" })).toHaveAttribute("aria-pressed", "true");

      // At least 5 leaderboard rows + median separator
      const rows = page.getByRole("button", { name: /^Rank \d+/ });
      await expect(rows.first()).toBeVisible();
      expect(await rows.count()).toBeGreaterThanOrEqual(5);
      await expect(page.getByRole("separator", { name: /segment median/i })).toBeVisible();

      // Your shape card
      await expect(page.getByText(/Your shape/i)).toBeVisible();
    });
  });

  async function loginAsVendor(page: import("@playwright/test").Page, opts: { tier: string; vendorName: string }) {
    // Implementation depends on the existing vendor-auth helper. Reuse it.
    throw new Error("TODO: replace with the project vendor-auth helper " + JSON.stringify(opts));
  }
  ```

- [ ] **Step 2: Replace `loginAsVendor` with the actual helper**

  After Task 11.1 you know the existing pattern. Replace the placeholder with the real helper. If no helper exists yet, write a minimal one in `tests/helpers/auth.ts` that performs a Supabase magic-link bypass against a known test vendor. Document any test fixture needed in the test file.

- [ ] **Step 3: Run the test**

  Run: `npx playwright test tests/vendor-dashboard/competitor-leaderboard.spec.ts`
  Expected: pass.

- [ ] **Step 4: Commit**

  ```bash
  git add tests/
  git commit -m "test(car-19): happy-path playwright test for leaderboard"
  ```

### Task 11.3: T2-path, thin-segment, and empty-state tests

**Files:**
- Modify: `tests/vendor-dashboard/competitor-leaderboard.spec.ts`

- [ ] **Step 1: Add the T2 case**

  ```ts
  test("Tier 2 vendor does not see the Tier 2 capability card", async ({ page }) => {
    await loginAsVendor(page, { tier: "tier_2", vendorName: "CDK Global" });
    await page.goto("/vendor-dashboard");
    await page.getByRole("button", { name: /market intel/i }).click();
    await expect(page.getByText(/available in tier 2/i)).toHaveCount(0);
  });
  ```

- [ ] **Step 2: Add the thin-segment case**

  Pre-condition: a fixture vendor whose category yields `qualifying_vendor_count < 3`. If no such fixture exists, add one in `supabase/seed.sql` or use a dedicated test database.

  ```ts
  test("thin segment renders the broader-category note", async ({ page }) => {
    await loginAsVendor(page, { tier: "tier_1", vendorName: "Niche Test Vendor" });
    await page.goto("/vendor-dashboard");
    await page.getByRole("button", { name: /market intel/i }).click();
    await expect(page.getByText(/broader/i)).toBeVisible();
  });
  ```

- [ ] **Step 3: Add the empty-state case**

  ```ts
  test("vendor alone in segment shows gathering empty state", async ({ page }) => {
    await loginAsVendor(page, { tier: "tier_1", vendorName: "Solo Test Vendor" });
    await page.goto("/vendor-dashboard");
    await page.getByRole("button", { name: /market intel/i }).click();
    await expect(page.getByText(/Not enough data yet to rank you against competitors/i)).toBeVisible();
  });
  ```

- [ ] **Step 4: Run the suite**

  Run: `npx playwright test tests/vendor-dashboard/competitor-leaderboard.spec.ts`
  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add tests/
  git commit -m "test(car-19): T2, thin-segment, and empty-state tests"
  ```

### Task 11.4: Reduced-motion and keyboard-nav tests

**Files:**
- Modify: `tests/vendor-dashboard/competitor-leaderboard.spec.ts`

- [ ] **Step 1: Add reduced-motion**

  ```ts
  test("respects prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await loginAsVendor(page, { tier: "tier_1", vendorName: "CDK Global" });
    await page.goto("/vendor-dashboard");
    await page.getByRole("button", { name: /market intel/i }).click();
    const firstRow = page.getByRole("button", { name: /^Rank \d+/ }).first();
    // Element should be visible at full opacity immediately, with no in-flight animation.
    await expect(firstRow).toBeVisible();
    const animations = await firstRow.evaluate((el) => el.getAnimations().length);
    expect(animations).toBe(0);
  });
  ```

- [ ] **Step 2: Add keyboard-nav**

  ```ts
  test("keyboard tab order moves through chips, rows, expand toggle", async ({ page }) => {
    await loginAsVendor(page, { tier: "tier_1", vendorName: "CDK Global" });
    await page.goto("/vendor-dashboard");
    await page.getByRole("button", { name: /market intel/i }).click();

    await page.getByRole("toolbar", { name: /sort leaderboard/i }).press("Tab");
    // Expect focus to land on the first chip
    await expect(page.getByRole("button", { name: "Pulse Score" })).toBeFocused();

    // Five chips; six tabs lands on the first row
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /^Rank 01/ })).toBeFocused();
  });
  ```

- [ ] **Step 3: Run the suite**

  Run: `npx playwright test`
  Expected: pass.

- [ ] **Step 4: Commit**

  ```bash
  git add tests/
  git commit -m "test(car-19): reduced-motion and keyboard-nav tests"
  ```

---

## Phase 12: Final pass

### Task 12.1: Lint, build, manual end-to-end check

**Files:** none

- [ ] **Step 1: Lint**

  Run: `npm run lint`
  Expected: pass.

- [ ] **Step 2: Production build**

  Run: `npm run build`
  Expected: pass.

- [ ] **Step 3: Manual sanity in dev**

  Run: `npm run dev`. Visit Market Intel as a Tier 1 vendor and as a Tier 2 vendor. Verify:
  - The leaderboard renders with all four score columns.
  - Sort chips reorder rows.
  - Median row sits between rows whose Pulse score crosses the median.
  - "Show all N" appears when the segment has more vendors than the default 5+you-±1 set.
  - Tier 2 capability card is present for T1 only.
  - Row click on T1 opens the inline strip; row click on T2 dismisses immediately (per Phase 7 v1 stub).

- [ ] **Step 4: Open the PR**

  ```bash
  git push -u origin jason/car-19-competitor-comparison-leaderboard
  gh pr create --title "feat(car-19): multi-metric competitor leaderboard" --body "$(cat <<'EOF'
  ## Summary
  - Replaces the volume-sorted competitor table on Market Intel with a Bloomberg-style multi-metric leaderboard ranked by composite Pulse Score, with Stability / CX / Value Perception breakdowns and segment median benchmark.
  - Adds `vendor_profiles.competitor_override` column for admin-curated competitor sets.
  - Extends `get_compared_vendors` to v2 (backwards compatible) returning per-vendor scores, segment median, and 90D rank delta scaffolding.
  - Frames Tier 2 as an additional capability ("Diagnostic mode") rather than a paywall, since Tier 1 vendors are paying customers.

  ## Test plan
  - [ ] Tier 1 vendor sees full leaderboard + Tier 2 capability card.
  - [ ] Tier 2 vendor sees leaderboard without the capability card.
  - [ ] Thin-segment vendor (qualifying < 3) sees the broader-category note.
  - [ ] Solo-segment vendor sees the gathering empty state.
  - [ ] Sort chips reorder rows with stagger fade replay.
  - [ ] Reduced-motion vendor sees no animations.
  - [ ] Keyboard tab order: chips → rows → show-all → Tier 2 CTA.
  - [ ] `npm run lint && npm run build` pass.
  - [ ] `npx playwright test` passes.

  Spec: docs/superpowers/specs/2026-04-28-car-19-competitor-leaderboard-design.md
  Linear: https://linear.app/cardealershipguy/issue/CAR-19/competitor-comparison-leaderboard

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```

---

## Anti-scope check (do not implement in this plan)

- The Tier 2 diagnostic drawer (the panel that opens when a Tier 2 vendor clicks a row). v1 ships a `console.warn` no-op; the drawer ships in a follow-up.
- The admin UI to populate `vendor_profiles.competitor_override`. The column ships now; the form is a follow-up.
- A 30D / 1Y period selector. v1 ships 90D only.
- Real per-vendor 90D `sentiment_history` driving sparklines. v1 ships a derived flat-to-current curve from `health_score`. Follow-up wires the real series.
- A prior-window snapshot job for `rank_delta_90d`. v1 ships null deltas, frontend renders "—" not "New".
- Generalised `category_hierarchy` table. v1 reuses the existing `_categories_match` helper.

## Spec self-review (already done — see spec file)

The spec was self-reviewed before this plan was written. Section coverage in this plan:

- Surface and layout → Phases 5, 6, 7
- Data model (column + RPC v2) → Phases 1, 2
- Component breakdown → Phase 3 (types + hook), 4 (primitives), 5 (core), 6 (windowing + panels), 7 (top-level)
- Tier behavior → Phase 7 (T1/T2 conditional)
- Edge cases (thin segment, below-threshold, new vendor) → covered inline in Tasks 5.2, 6.5, 7.1
- Motion → Phase 9
- Accessibility → Phase 9
- Telemetry → Phase 10
- Testing → Phase 11
- Out-of-scope items are explicitly fenced off in Anti-scope.
