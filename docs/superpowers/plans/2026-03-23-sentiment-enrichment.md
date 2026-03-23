# Sentiment Enrichment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace binary positive/warning sentiment with a 4-value enum (positive, negative, neutral, mixed), a 1–5 intensity score, and a stored NPS-style tier (promoter/passive/detractor).

**Architecture:** Single SQL migration adds enum values, new columns, backfills `warning→negative`, and updates all RPCs. Edge function updates enrich the Gemini prompt. A new `reclassify-mentions` edge function backfills existing data via AI. Frontend updates are minimal — most color/label infrastructure already exists.

**Tech Stack:** PostgreSQL (enum, columns, RPCs), Deno edge functions (Gemini API), React/TypeScript (dashboard components, TanStack Query hooks)

**Design doc:** `docs/plans/2026-03-23-sentiment-enrichment-design.md`

---

## File Structure

### New files
- `supabase/migrations/2026XXXX_sentiment_enrichment.sql` — schema + RPC updates
- `supabase/functions/reclassify-mentions/index.ts` — AI backfill edge function

### Modified files
- `supabase/functions/transform-external-review/index.ts` — expand Gemini prompt, map new fields
- `supabase/migrations/20260306183000_sync_wam_processed_to_public_vendor_mentions.sql` — (new migration replaces these functions)
- `src/types/admin.ts:239-245` — add NPS tier colors to SENTIMENT_COLORS
- `src/hooks/useVendorIntelligenceDashboard.ts:6-17,75-80` — expand MetricComponentData and SentimentHistoryPoint interfaces
- `src/hooks/useSupabaseVendorData.ts:4-20,22-32,59-83,440-448` — expand VendorPulseMention type, VendorDimension, feed result types
- `src/components/vendor-dashboard/DashboardDimensions.tsx:36-60,77-91` — 4-segment bar chart, sentiment label update
- `src/components/vendor-dashboard/TrendDeepDive.tsx:46-54` — stacked area chart with new sentiment types
- `src/components/vendor-dashboard/DashboardSegments.tsx:34-51` — NPS tier distribution per segment

---

## Chunk 1: Schema Migration

### Task 1: Create the migration file with enum expansion and new columns

**Files:**
- Create: `supabase/migrations/20260323100000_sentiment_enrichment.sql`

- [ ] **Step 1: Write the migration — enum expansion**

```sql
-- ============================================================
-- Sentiment Enrichment
-- Expands binary positive/warning to 4-value sentiment,
-- adds intensity score (1-5) and NPS tier.
-- ============================================================

-- ── Expand review_type enum ─────────────────────────────────
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'negative';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'neutral';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'mixed';
```

- [ ] **Step 2: Add new columns to vendor_mentions**

```sql
-- ── New columns on vendor_mentions ──────────────────────────
ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS sentiment_score SMALLINT
    CHECK (sentiment_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS nps_tier TEXT
    CHECK (nps_tier IN ('promoter', 'passive', 'detractor'));

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_nps_tier
  ON public.vendor_mentions(nps_tier)
  WHERE nps_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_mentions_sentiment_score
  ON public.vendor_mentions(sentiment_score)
  WHERE sentiment_score IS NOT NULL;
```

- [ ] **Step 3: Backfill warning → negative**

```sql
-- ── Backfill warning → negative ─────────────────────────────
-- warning stays in the enum (Postgres limitation) but is deprecated.
UPDATE public.vendor_mentions
  SET type = 'negative'
  WHERE type = 'warning';
```

- [ ] **Step 4: Add neutral_count column to vendor_segment_scores**

```sql
-- ── Expand vendor_segment_scores ────────────────────────────
ALTER TABLE public.vendor_segment_scores
  ADD COLUMN IF NOT EXISTS negative_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neutral_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mixed_count INTEGER NOT NULL DEFAULT 0;

-- Backfill: rename warning_count data into negative_count
UPDATE public.vendor_segment_scores
  SET negative_count = warning_count;
```

- [ ] **Step 5: Add NPS tier helper function**

```sql
-- ── NPS tier derivation function ────────────────────────────
CREATE OR REPLACE FUNCTION public.derive_nps_tier(
  p_type public.review_type,
  p_score SMALLINT
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_type = 'positive' AND p_score >= 5 THEN
    RETURN 'promoter';
  ELSIF p_type IN ('negative', 'warning') THEN
    RETURN 'detractor';
  ELSIF p_type IN ('neutral', 'mixed') THEN
    RETURN 'passive';
  ELSIF p_type = 'positive' AND p_score <= 2 THEN
    RETURN 'detractor';
  ELSE
    -- positive with score 3-4, or NULL score
    RETURN 'passive';
  END IF;
END;
$$;
```

- [ ] **Step 6: Commit schema changes**

```bash
cd /Users/jasonmayhew/CDGPulse/cdgpulsecom/.worktrees/sentiment-enrichment
git add supabase/migrations/20260323100000_sentiment_enrichment.sql
git commit -m "feat: add sentiment enrichment schema — expanded enum, intensity score, NPS tier"
```

---

### Task 2: Update RPCs — `_compute_metric_score` with weighted scoring

**Files:**
- Modify: `supabase/migrations/20260323100000_sentiment_enrichment.sql` (append)

The existing `_compute_metric_score` in `20260226100000_vendor_intelligence_platform.sql` uses binary positive/total counting. We replace it with weighted scoring.

- [ ] **Step 1: Write the updated `_compute_metric_score` function**

Append to the migration file:

```sql
-- ── Updated _compute_metric_score with weighted sentiment ───
CREATE OR REPLACE FUNCTION _compute_metric_score(
  p_vendor_name TEXT,
  p_dimensions TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
  v_positive INTEGER;
  v_negative INTEGER;
  v_neutral INTEGER;
  v_mixed INTEGER;
  v_sentiment_ratio NUMERIC;
  v_volume_confidence NUMERIC;
  v_recency_score NUMERIC;
  v_velocity_score NUMERIC;
  v_recent_positive INTEGER;
  v_recent_total INTEGER;
  v_prior_positive INTEGER;
  v_prior_total INTEGER;
  v_score NUMERIC;
  v_weighted_pos NUMERIC;
  v_weight_sum NUMERIC;
  v_avg_score NUMERIC;
BEGIN
  -- Count by type in last 90 days (treat legacy 'warning' as 'negative')
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*) FILTER (WHERE type IN ('negative', 'warning')),
    COUNT(*) FILTER (WHERE type = 'neutral'),
    COUNT(*) FILTER (WHERE type = 'mixed')
  INTO v_total, v_positive, v_negative, v_neutral, v_mixed
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  IF v_total < 5 THEN
    RETURN jsonb_build_object(
      'score', NULL,
      'mention_count', v_total,
      'below_threshold', true
    );
  END IF;

  -- 1. Weighted sentiment ratio (0-100)
  -- Use sentiment_score as weight when available; neutrals excluded from ratio
  SELECT
    COALESCE(
      SUM(CASE
        WHEN type = 'positive' THEN COALESCE(sentiment_score, 3)
        ELSE 0
      END) /
      NULLIF(SUM(CASE
        WHEN type != 'neutral' THEN COALESCE(sentiment_score, 3)
        ELSE 0
      END), 0) * 100,
      CASE WHEN v_positive > 0 THEN (v_positive::NUMERIC / NULLIF(v_total - v_neutral, 0)) * 100 ELSE 0 END
    )
  INTO v_sentiment_ratio
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  -- 2. Volume confidence (0-100, log-scaled) — neutrals count toward volume
  v_volume_confidence := LEAST(100, LN(v_total + 1) / LN(2) * 20);

  -- 3. Recency bias (0-100) — weight positive mentions by recency
  SELECT
    COALESCE(SUM(
      CASE WHEN type = 'positive'
        THEN EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))
             * COALESCE(sentiment_score, 3)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE WHEN type != 'neutral'
        THEN EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / (30 * 86400))
             * COALESCE(sentiment_score, 3)
        ELSE 0
      END
    ), 0)
  INTO v_weighted_pos, v_weight_sum
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days';

  IF v_weight_sum > 0 THEN
    v_recency_score := (v_weighted_pos / v_weight_sum) * 100;
  ELSE
    v_recency_score := 50;
  END IF;

  -- 4. Velocity (0-100, 50 = stable)
  SELECT
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*) FILTER (WHERE type != 'neutral')
  INTO v_recent_positive, v_recent_total
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '30 days';

  SELECT
    COUNT(*) FILTER (WHERE type = 'positive'),
    COUNT(*) FILTER (WHERE type != 'neutral')
  INTO v_prior_positive, v_prior_total
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days'
    AND created_at < now() - INTERVAL '30 days';

  IF v_recent_total > 0 AND v_prior_total > 0 THEN
    v_velocity_score := 50 + (
      (v_recent_positive::NUMERIC / v_recent_total)
      - (v_prior_positive::NUMERIC / v_prior_total)
    ) * 150;
    v_velocity_score := GREATEST(0, LEAST(100, v_velocity_score));
  ELSE
    v_velocity_score := 50;
  END IF;

  -- Composite
  v_score := ROUND(
    v_sentiment_ratio   * 0.4 +
    v_volume_confidence * 0.2 +
    v_recency_score     * 0.2 +
    v_velocity_score    * 0.2
  );
  v_score := GREATEST(0, LEAST(100, v_score));

  -- Average sentiment score for mentions with scores
  SELECT AVG(sentiment_score)
  INTO v_avg_score
  FROM public.vendor_mentions
  WHERE vendor_name = p_vendor_name
    AND dimension = ANY(p_dimensions)
    AND is_hidden = false
    AND created_at >= now() - INTERVAL '90 days'
    AND sentiment_score IS NOT NULL;

  RETURN jsonb_build_object(
    'score', v_score,
    'mention_count', v_total,
    'below_threshold', false,
    'sentiment_ratio', ROUND(v_sentiment_ratio, 1),
    'volume_confidence', ROUND(v_volume_confidence, 1),
    'recency_score', ROUND(v_recency_score, 1),
    'velocity_score', ROUND(v_velocity_score, 1),
    'positive_count', v_positive,
    'negative_count', v_negative,
    'neutral_count', v_neutral,
    'mixed_count', v_mixed,
    'avg_sentiment_score', ROUND(COALESCE(v_avg_score, 0), 1),
    'recent_mentions', v_recent_total,
    'prior_mentions', v_prior_total
  );
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260323100000_sentiment_enrichment.sql
git commit -m "feat: update _compute_metric_score with weighted sentiment scoring"
```

---

### Task 3: Update RPCs — `get_vendor_dimensions` and `get_vendor_sentiment_history`

**Files:**
- Modify: `supabase/migrations/20260323100000_sentiment_enrichment.sql` (append)

These RPCs are defined in `supabase/migrations/20260312200000_entity_aware_dashboard_rpcs.sql`. We CREATE OR REPLACE them in our new migration.

- [ ] **Step 1: Write updated `get_vendor_dimensions`**

```sql
-- ── Updated get_vendor_dimensions ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_vendor_dimensions(p_vendor_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(d))
    FROM (
      SELECT
        dimension,
        COUNT(*) AS mention_count,
        COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE type IN ('negative', 'warning')) AS negative_count,
        COUNT(*) FILTER (WHERE type = 'mixed') AS mixed_count,
        COUNT(*) FILTER (WHERE type = 'neutral') AS neutral_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE type = 'positive')
          / NULLIF(COUNT(*) FILTER (WHERE type != 'neutral'), 0)
        ) AS positive_percent,
        ROUND(AVG(sentiment_score) FILTER (WHERE sentiment_score IS NOT NULL), 1) AS avg_intensity,
        COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoter_count,
        COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passive_count,
        COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractor_count
      FROM public.vendor_mentions
      WHERE (
        (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
      )
        AND is_hidden = false
        AND dimension IS NOT NULL
        AND dimension != 'other'
      GROUP BY dimension
      ORDER BY COUNT(*) DESC
    ) d
  ), '[]'::jsonb);
END;
$$;
```

- [ ] **Step 2: Write updated `get_vendor_sentiment_history`**

```sql
-- ── Updated get_vendor_sentiment_history ─────────────────────
CREATE OR REPLACE FUNCTION public.get_vendor_sentiment_history(
  p_vendor_name TEXT,
  p_months INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
BEGIN
  SELECT r.vendor_entity_id INTO v_entity_id
  FROM public.resolve_vendor_family_name_only(p_vendor_name) r
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(m) ORDER BY m.month)
    FROM (
      SELECT
        to_char(date_trunc('month', conversation_time), 'YYYY-MM') AS month,
        COUNT(*) AS total_mentions,
        COUNT(*) FILTER (WHERE type = 'positive') AS positive_count,
        COUNT(*) FILTER (WHERE type IN ('negative', 'warning')) AS negative_count,
        COUNT(*) FILTER (WHERE type = 'neutral') AS neutral_count,
        COUNT(*) FILTER (WHERE type = 'mixed') AS mixed_count,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE type = 'positive')
          / NULLIF(COUNT(*) FILTER (WHERE type != 'neutral'), 0)
        ) AS positive_percent,
        ROUND(AVG(sentiment_score) FILTER (WHERE sentiment_score IS NOT NULL), 1) AS avg_intensity,
        COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoter_count,
        COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passive_count,
        COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractor_count
      FROM public.vendor_mentions
      WHERE (
        (v_entity_id IS NOT NULL AND vendor_entity_id = v_entity_id) OR
        (v_entity_id IS NULL AND lower(vendor_name) = lower(p_vendor_name))
      )
        AND is_hidden = false
        AND conversation_time >= date_trunc('month', now()) - (p_months || ' months')::interval
      GROUP BY date_trunc('month', conversation_time)
      ORDER BY date_trunc('month', conversation_time)
    ) m
  ), '[]'::jsonb);
END;
$$;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260323100000_sentiment_enrichment.sql
git commit -m "feat: update dimension and sentiment history RPCs with enriched counts"
```

---

### Task 4: Update RPCs — `compute_vendor_segments` and `get_vendor_dashboard_intel`

**Files:**
- Modify: `supabase/migrations/20260323100000_sentiment_enrichment.sql` (append)

- [ ] **Step 1: Write updated `compute_vendor_segments`**

Replace the function. Each axis INSERT needs to count the new types and compute NPS counts. Here's the SIZE axis as template — ROLE, GEO, OEM follow the same pattern:

```sql
-- ── Updated compute_vendor_segments ─────────────────────────
CREATE OR REPLACE FUNCTION public.compute_vendor_segments(p_vendor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_min_bucket INTEGER := 3;
BEGIN
  DELETE FROM public.vendor_segment_scores WHERE vendor_name = p_vendor_name;

  -- SIZE axis
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'size',
    CASE
      WHEN m.rooftops = 1 THEN '1 rooftop'
      WHEN m.rooftops BETWEEN 2 AND 5 THEN '2-5 rooftops'
      WHEN m.rooftops >= 6 THEN '6+ rooftops'
    END AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0, -- warning_count (deprecated, keep 0)
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.rooftops IS NOT NULL
  GROUP BY bucket
  HAVING count(*) >= v_min_bucket;

  -- ROLE axis (same pattern)
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'role', m.role_band AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0,
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.role_band IS NOT NULL AND m.role_band <> '' AND m.role_band <> 'Unknown'
  GROUP BY m.role_band
  HAVING count(*) >= v_min_bucket;

  -- GEO axis (same pattern)
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'geo', m.region AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0,
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.region IS NOT NULL AND m.region <> ''
  GROUP BY m.region
  HAVING count(*) >= v_min_bucket;

  -- OEM axis (same pattern)
  INSERT INTO public.vendor_segment_scores (
    vendor_name, segment_axis, segment_bucket,
    mention_count, positive_count, warning_count, negative_count,
    neutral_count, mixed_count, positive_pct, computed_at
  )
  SELECT
    p_vendor_name, 'oem', public._classify_oem_mix(m.oems) AS bucket,
    count(*),
    count(*) FILTER (WHERE vm.type = 'positive'),
    0,
    count(*) FILTER (WHERE vm.type IN ('negative', 'warning')),
    count(*) FILTER (WHERE vm.type = 'neutral'),
    count(*) FILTER (WHERE vm.type = 'mixed'),
    CASE
      WHEN count(*) FILTER (WHERE vm.type != 'neutral') = 0 THEN 0
      ELSE ROUND(
        count(*) FILTER (WHERE vm.type = 'positive')::NUMERIC
        / count(*) FILTER (WHERE vm.type != 'neutral') * 100
      )::INTEGER
    END,
    now()
  FROM public.vendor_mentions vm
  JOIN public.members m ON m.id = vm.member_id
  WHERE vm.vendor_name = p_vendor_name
    AND vm.is_hidden = false
    AND m.oems IS NOT NULL AND array_length(m.oems, 1) > 0
    AND public._classify_oem_mix(m.oems) IS NOT NULL
  GROUP BY public._classify_oem_mix(m.oems)
  HAVING count(*) >= v_min_bucket;
END;
$$;
```

- [ ] **Step 2: Write updated `get_vendor_dashboard_intel` sentiment_history section**

The full function is 150+ lines. Only the sentiment_history subquery (lines 552-577 of the original migration) changes. Replace it in the new migration:

```sql
-- ── Updated get_vendor_dashboard_intel ───────────────────────
-- (Only showing the sentiment_history subquery change.
--  The full CREATE OR REPLACE must include the entire function body.
--  Copy the existing function from 20260226100000 and replace
--  the v_history subquery with this:)

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'month', to_char(d.month, 'YYYY-MM'),
      'total_mentions', COALESCE(c.total, 0),
      'positive_count', COALESCE(c.positive, 0),
      'negative_count', COALESCE(c.neg, 0),
      'neutral_count', COALESCE(c.neut, 0),
      'mixed_count', COALESCE(c.mix, 0),
      'health_estimate', CASE
        WHEN COALESCE(c.total, 0) = 0 THEN NULL
        WHEN COALESCE(c.total - c.neut, 0) = 0 THEN NULL
        ELSE ROUND(c.positive::NUMERIC / (c.total - c.neut) * 100)
      END,
      'promoter_count', COALESCE(c.promoters, 0),
      'passive_count', COALESCE(c.passives, 0),
      'detractor_count', COALESCE(c.detractors, 0)
    ) ORDER BY d.month
  ), '[]'::JSONB) INTO v_history
  FROM generate_series(
    date_trunc('month', now() - INTERVAL '5 months'),
    date_trunc('month', now()),
    INTERVAL '1 month'
  ) d(month)
  LEFT JOIN (
    SELECT
      date_trunc('month', created_at) AS month,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE type = 'positive') AS positive,
      COUNT(*) FILTER (WHERE type IN ('negative', 'warning')) AS neg,
      COUNT(*) FILTER (WHERE type = 'neutral') AS neut,
      COUNT(*) FILTER (WHERE type = 'mixed') AS mix,
      COUNT(*) FILTER (WHERE nps_tier = 'promoter') AS promoters,
      COUNT(*) FILTER (WHERE nps_tier = 'passive') AS passives,
      COUNT(*) FILTER (WHERE nps_tier = 'detractor') AS detractors
    FROM public.vendor_mentions
    WHERE vendor_name = p_vendor_name AND is_hidden = false
    GROUP BY 1
  ) c ON c.month = d.month;
```

Note: The implementer must copy the FULL `get_vendor_dashboard_intel` function from `20260226100000_vendor_intelligence_platform.sql:458-614` and replace only the `v_history` subquery (lines 552-577) with the above. Everything else in the function stays the same.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260323100000_sentiment_enrichment.sql
git commit -m "feat: update segment computation and dashboard intel RPCs"
```

---

### Task 5: Update WAM sync function

**Files:**
- Modify: `supabase/migrations/20260323100000_sentiment_enrichment.sql` (append)

The WAM sync currently collapses all non-positive sentiment to `warning`. Update it to pass through richer values and compute NPS tier.

- [ ] **Step 1: Write updated `sync_single_wam_processed_mention`**

```sql
-- ── Updated WAM sync with enriched sentiment ────────────────
CREATE OR REPLACE FUNCTION public.sync_single_wam_processed_mention(
  p_id TEXT,
  p_vendor_name TEXT,
  p_category TEXT,
  p_sentiment TEXT,
  p_snippet_anon TEXT,
  p_headline TEXT,
  p_dimension TEXT,
  p_conversation_time TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_type public.review_type;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Map sentiment to expanded enum
  v_type := CASE lower(coalesce(p_sentiment, ''))
    WHEN 'positive' THEN 'positive'::public.review_type
    WHEN 'negative' THEN 'negative'::public.review_type
    WHEN 'neutral'  THEN 'neutral'::public.review_type
    WHEN 'mixed'    THEN 'mixed'::public.review_type
    ELSE 'negative'::public.review_type  -- fallback for unknown values
  END;

  v_created_at := COALESCE(NULLIF(p_conversation_time, '')::timestamptz, now());

  INSERT INTO public.vendor_mentions (
    id, vendor_name, category, type, title, quote, explanation,
    dimension, conversation_time, created_at, source, is_hidden
  )
  VALUES (
    p_id, p_vendor_name,
    COALESCE(NULLIF(p_category, ''), 'other'),
    v_type,
    COALESCE(NULLIF(p_headline, ''), 'Vendor mention'),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_snippet_anon, ''), ''),
    COALESCE(NULLIF(p_dimension, ''), 'other'),
    v_created_at, v_created_at,
    'community', false
  )
  ON CONFLICT (id) DO UPDATE SET
    vendor_name = EXCLUDED.vendor_name,
    category = EXCLUDED.category,
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    quote = EXCLUDED.quote,
    explanation = EXCLUDED.explanation,
    dimension = EXCLUDED.dimension,
    conversation_time = EXCLUDED.conversation_time,
    created_at = LEAST(public.vendor_mentions.created_at, EXCLUDED.created_at),
    source = EXCLUDED.source,
    is_hidden = false;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260323100000_sentiment_enrichment.sql
git commit -m "feat: update WAM sync to pass through enriched sentiment values"
```

---

## Chunk 2: Edge Functions

### Task 6: Update `transform-external-review` Gemini prompt

**Files:**
- Modify: `supabase/functions/transform-external-review/index.ts:51-77` (prompt), `:113-126` (insert)

- [ ] **Step 1: Update `buildTransformPrompt` to request richer sentiment**

In `supabase/functions/transform-external-review/index.ts`, replace the `buildTransformPrompt` function (lines 51-77):

```typescript
function buildTransformPrompt(review: {
  vendor_name: string;
  raw_text: string;
}): string {
  return `You are transforming an external review into CDG Pulse voice — a platform where car dealers discuss vendor technology.

VENDOR: ${review.vendor_name}

ORIGINAL REVIEW:
${review.raw_text}

Transform this into a dealer-style mention. Return JSON:
{
  "headline": "Short punchy headline (5-10 words) capturing the key point",
  "quote": "1-2 sentence anonymized dealer-style quote. Conversational tone, like something said in a group chat.",
  "dimension": "one of: worth_it, reliable, integrates, support, adopted, other",
  "sentiment": "one of: positive, negative, neutral, mixed",
  "sentiment_score": 1-5 integer (1=very negative/weak, 3=moderate, 5=very positive/strong),
  "category": "one of: crm, dms, marketing, data-analytics, inventory, website, service-bdc, desking-fi, compliance, phone, other"
}

Sentiment guide:
- positive: clearly favorable, recommending, praising
- negative: clearly unfavorable, complaining, warning others away
- neutral: factual observation without strong opinion, just reporting usage
- mixed: contains both significant praise and significant criticism

Sentiment score guide:
- 1: extremely negative / barely any positive signal
- 2: mostly negative or weak positive
- 3: moderate / balanced
- 4: mostly positive or mildly negative
- 5: extremely positive / enthusiastic endorsement, or very harsh criticism

Rules:
- Sound like organic dealer conversation, not a formal review
- Remove all identifying information (reviewer name, company, location)
- Keep the core insight but rewrite in casual tone
- Be honest — preserve both positives and negatives
- If the review has a star rating, use it to inform sentiment_score (1 star=1, 5 stars=5)
- Return only valid JSON, no markdown fences`;
}
```

- [ ] **Step 2: Update the insert logic to use new fields**

In the same file, replace the insert block (lines 113-126):

```typescript
    // Compute NPS tier
    const score = parsed.sentiment_score || 3;
    let npsTier: string;
    if (parsed.sentiment === "positive" && score >= 5) {
      npsTier = "promoter";
    } else if (parsed.sentiment === "negative" || parsed.sentiment === "warning") {
      npsTier = "detractor";
    } else if (parsed.sentiment === "positive" && score <= 2) {
      npsTier = "detractor";
    } else {
      npsTier = "passive";
    }

    // Map sentiment to type enum
    const typeMap: Record<string, string> = {
      positive: "positive",
      negative: "negative",
      neutral: "neutral",
      mixed: "mixed",
    };

    // Insert into vendor_mentions
    const { error: insertError } = await supabase
      .from("vendor_mentions")
      .insert({
        vendor_name: review.vendor_name,
        category: parsed.category || null,
        headline: parsed.headline,
        quote: parsed.quote,
        dimension: parsed.dimension || "other",
        sentiment: parsed.sentiment,
        type: typeMap[parsed.sentiment] || "negative",
        sentiment_score: score,
        nps_tier: npsTier,
        source: "external",
        source_review_id: review.id,
        approved_at: new Date().toISOString(),
      });
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/transform-external-review/index.ts
git commit -m "feat: expand transform-external-review with 4-value sentiment, intensity, NPS tier"
```

---

### Task 7: Create `reclassify-mentions` edge function

**Files:**
- Create: `supabase/functions/reclassify-mentions/index.ts`

This function batch-processes existing mentions through Gemini to reclassify them with the enriched sentiment model. It's idempotent — skips rows that already have `sentiment_score`.

- [ ] **Step 1: Create the edge function**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";

interface ReclassifyRequest {
  batch_size?: number;
  dry_run?: boolean;
}

interface ReclassifyResult {
  mention_id: string;
  old_type: string;
  new_type: string;
  sentiment_score: number;
  nps_tier: string;
  success: boolean;
  error?: string;
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
          temperature: 0.2, // Lower temp for consistent reclassification
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

function buildReclassifyPrompt(mention: {
  vendor_name: string;
  quote: string;
  headline: string | null;
  type: string;
  dimension: string;
}): string {
  return `Reclassify this vendor mention with enriched sentiment.

VENDOR: ${mention.vendor_name}
CURRENT TYPE: ${mention.type}
DIMENSION: ${mention.dimension}
HEADLINE: ${mention.headline || "N/A"}
QUOTE: ${mention.quote}

Return JSON:
{
  "sentiment": "one of: positive, negative, neutral, mixed",
  "sentiment_score": 1-5 integer
}

Sentiment guide:
- positive: clearly favorable, recommending, praising
- negative: clearly unfavorable, complaining, warning others away
- neutral: factual observation without strong opinion
- mixed: contains both significant praise and significant criticism

Score guide:
- 1: extremely negative or barely any positive
- 2: mostly negative or weak positive
- 3: moderate / balanced
- 4: mostly positive or mild negative
- 5: extremely positive / enthusiastic, or very harsh criticism

Rules:
- Be consistent — similar quotes should get similar scores
- The current type is a hint but you can change it
- Return only valid JSON, no markdown fences`;
}

function deriveNpsTier(sentiment: string, score: number): string {
  if (sentiment === "positive" && score >= 5) return "promoter";
  if (sentiment === "negative" || sentiment === "warning") return "detractor";
  if (sentiment === "positive" && score <= 2) return "detractor";
  return "passive";
}

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

    const body: ReclassifyRequest = await req.json();
    const batchSize = body.batch_size || 20;
    const dryRun = body.dry_run || false;

    // Get mentions without sentiment_score (not yet reclassified)
    const { data: mentions, error: fetchError } = await supabase
      .from("vendor_mentions")
      .select("id, vendor_name, quote, headline, type, dimension")
      .is("sentiment_score", null)
      .eq("is_hidden", false)
      .not("quote", "eq", "")
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ reclassified: 0, remaining: 0, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ReclassifyResult[] = [];

    for (const mention of mentions) {
      try {
        const prompt = buildReclassifyPrompt(mention);
        const raw = await callGemini(GEMINI_API_KEY, prompt);
        const parsed = JSON.parse(raw);

        const sentiment = parsed.sentiment || "negative";
        const score = Math.max(1, Math.min(5, parsed.sentiment_score || 3));
        const npsTier = deriveNpsTier(sentiment, score);

        const typeMap: Record<string, string> = {
          positive: "positive",
          negative: "negative",
          neutral: "neutral",
          mixed: "mixed",
        };
        const newType = typeMap[sentiment] || "negative";

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("vendor_mentions")
            .update({
              type: newType,
              sentiment_score: score,
              nps_tier: npsTier,
            })
            .eq("id", mention.id);

          if (updateError) throw updateError;
        }

        results.push({
          mention_id: mention.id,
          old_type: mention.type,
          new_type: newType,
          sentiment_score: score,
          nps_tier: npsTier,
          success: true,
        });

        console.log(
          `[${mention.vendor_name}] ${mention.id}: ${mention.type} → ${newType} (score=${score}, tier=${npsTier})`
        );
      } catch (e) {
        results.push({
          mention_id: mention.id,
          old_type: mention.type,
          new_type: mention.type,
          sentiment_score: 0,
          nps_tier: "",
          success: false,
          error: (e as Error).message,
        });
      }
    }

    // Count remaining
    const { count } = await supabase
      .from("vendor_mentions")
      .select("id", { count: "exact", head: true })
      .is("sentiment_score", null)
      .eq("is_hidden", false)
      .not("quote", "eq", "");

    return new Response(
      JSON.stringify({
        reclassified: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        remaining: count || 0,
        dry_run: dryRun,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("reclassify-mentions error:", error);
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
git add supabase/functions/reclassify-mentions/index.ts
git commit -m "feat: add reclassify-mentions edge function for AI backfill"
```

---

## Chunk 3: Frontend Updates

### Task 8: Update TypeScript types and hooks

**Files:**
- Modify: `src/types/admin.ts:239-245`
- Modify: `src/hooks/useVendorIntelligenceDashboard.ts:6-17,75-80`
- Modify: `src/hooks/useSupabaseVendorData.ts:4-20,22-32,440-448`

- [ ] **Step 1: Add NPS tier colors to `SENTIMENT_COLORS`**

In `src/types/admin.ts`, find the `SENTIMENT_COLORS` block (line 239) and add NPS tier entries:

```typescript
export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-green-600 bg-green-50 border-green-200",
  negative: "text-red-600 bg-red-50 border-red-200",
  neutral: "text-gray-600 bg-gray-50 border-gray-200",
  mixed: "text-amber-600 bg-amber-50 border-amber-200",
  unknown: "text-gray-400 bg-gray-50 border-gray-200",
  promoter: "text-emerald-700 bg-emerald-50 border-emerald-200",
  passive: "text-slate-600 bg-slate-50 border-slate-200",
  detractor: "text-rose-700 bg-rose-50 border-rose-200",
};
```

- [ ] **Step 2: Update `SentimentHistoryPoint` in `useVendorIntelligenceDashboard.ts`**

Replace the interface at line 75:

```typescript
export interface SentimentHistoryPoint {
  month: string;
  total_mentions: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  mixed_count: number;
  health_estimate: number | null;
  avg_intensity: number | null;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
}
```

- [ ] **Step 3: Update `MetricComponentData` in `useVendorIntelligenceDashboard.ts`**

Replace the interface at line 6:

```typescript
export interface MetricComponentData {
  score: number | null;
  mention_count: number;
  below_threshold: boolean;
  sentiment_ratio?: number;
  volume_confidence?: number;
  recency_score?: number;
  velocity_score?: number;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
  mixed_count?: number;
  avg_sentiment_score?: number;
  recent_mentions?: number;
  prior_mentions?: number;
}
```

- [ ] **Step 4: Update `VendorPulseMention` type in `useSupabaseVendorData.ts`**

At line 17, expand the type union:

```typescript
  type: "positive" | "warning" | "negative" | "neutral" | "mixed";
```

- [ ] **Step 5: Update `VendorDimension` interface in `useSupabaseVendorData.ts`**

Find and replace the `VendorDimension` interface (line 440):

```typescript
export interface VendorDimension {
  dimension: string;
  mention_count: number;
  positive_count: number;
  negative_count: number;
  mixed_count: number;
  neutral_count: number;
  positive_percent: number;
  avg_intensity: number | null;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/types/admin.ts src/hooks/useVendorIntelligenceDashboard.ts src/hooks/useSupabaseVendorData.ts
git commit -m "feat: update TypeScript types for enriched sentiment model"
```

---

### Task 9: Update `DashboardDimensions.tsx`

**Files:**
- Modify: `src/components/vendor-dashboard/DashboardDimensions.tsx`

- [ ] **Step 1: Update `getSentimentLabel` to use actual data**

Replace the function (around line 36):

```typescript
function getSentimentLabel(dim: VendorDimension) {
  const { positive_percent, promoter_count, detractor_count, mention_count } = dim;
  if (mention_count === 0) return { label: "No data", color: "text-gray-400", bg: "bg-gray-50" };
  if (positive_percent >= 75) return { label: "Mostly positive", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (positive_percent >= 50) return { label: "Mixed", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Needs attention", color: "text-red-600", bg: "bg-red-50" };
}
```

- [ ] **Step 2: Update bar chart to show 4-segment stacked bar**

In the Recharts `<BarChart>` section, replace the two `<Bar>` components with four:

```tsx
<Bar dataKey="positive_count" stackId="a" fill="#10b981" name="Positive" />
<Bar dataKey="neutral_count" stackId="a" fill="#94a3b8" name="Neutral" />
<Bar dataKey="mixed_count" stackId="a" fill="#f59e0b" name="Mixed" />
<Bar dataKey="negative_count" stackId="a" fill="#ef4444" name="Negative" />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/vendor-dashboard/DashboardDimensions.tsx
git commit -m "feat: update DashboardDimensions with 4-segment sentiment bar chart"
```

---

### Task 10: Update `TrendDeepDive.tsx`

**Files:**
- Modify: `src/components/vendor-dashboard/TrendDeepDive.tsx`

- [ ] **Step 1: Update chart data transformation**

The component maps `SentimentHistoryPoint[]` to chart data. Update to include new counts. Find the chart data transformation (around line 46) and expand:

```typescript
const chartData = history.map((point) => ({
  month: point.month,
  positive: point.positive_count,
  negative: point.negative_count,
  neutral: point.neutral_count,
  mixed: point.mixed_count,
  total: point.total_mentions,
  health: point.health_estimate,
  promoters: point.promoter_count,
  passives: point.passive_count,
  detractors: point.detractor_count,
}));
```

- [ ] **Step 2: Update area chart to show stacked composition**

Replace the single positive trend area with a stacked area:

```tsx
<Area type="monotone" dataKey="positive" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
<Area type="monotone" dataKey="neutral" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.4} />
<Area type="monotone" dataKey="mixed" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
<Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/vendor-dashboard/TrendDeepDive.tsx
git commit -m "feat: update TrendDeepDive with stacked sentiment composition chart"
```

---

### Task 11: Update `DashboardSegments.tsx` with NPS tier distribution

**Files:**
- Modify: `src/components/vendor-dashboard/DashboardSegments.tsx`

- [ ] **Step 1: Add NPS tier distribution to segment buckets**

The segment data from `get_vendor_segment_intel` doesn't currently include NPS tiers. For now, add a visual indicator using `positive_pct` as a proxy until the segment RPC returns NPS data:

Update the segment bucket card (around line 62) to show a mini NPS bar. Add after the existing positive_pct delta badge:

```tsx
{/* NPS-style interpretation */}
<div className="flex gap-1 mt-1">
  <div
    className="h-1.5 rounded-full bg-emerald-400"
    style={{ width: `${Math.min(bucket.positive_pct, 100)}%` }}
  />
  <div
    className="h-1.5 rounded-full bg-rose-400"
    style={{ width: `${Math.min(100 - bucket.positive_pct, 100)}%` }}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/vendor-dashboard/DashboardSegments.tsx
git commit -m "feat: add NPS-style sentiment bar to segment buckets"
```

---

### Task 12: TypeScript compile check and final commit

**Files:** All modified files

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd /Users/jasonmayhew/CDGPulse/cdgpulsecom/.worktrees/sentiment-enrichment
npx tsc --noEmit
```

Expected: No errors. If there are errors, fix them — likely missed type updates in components consuming the changed interfaces.

- [ ] **Step 2: Fix any type errors found**

Common issues:
- Components destructuring `{ warning_count }` need updating to `{ negative_count }`
- Any place using `type: "positive" | "warning"` needs the expanded union
- `VendorPulseFeedResult.totalWarningCount` may need renaming or aliasing

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from sentiment enrichment changes"
```
