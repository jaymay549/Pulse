# Sentiment Enrichment: Beyond Binary

**Date:** 2026-03-23
**Status:** Ready for implementation

## Problem

Dealer sentiment is stored as a binary `positive` / `warning` enum. External star ratings, AI-extracted nuance, and intensity signals are all collapsed into this binary before storage. The UI already has color mappings for `mixed`, `neutral`, `negative` but nothing populates them from real data.

## Solution

Three complementary changes that build on each other:

1. **Expand the enum** from 2 to 4 values: `positive`, `negative`, `neutral`, `mixed`
2. **Add a 1-5 intensity score** per mention
3. **Store an NPS-style tier** (promoter / passive / detractor) derived from #1 + #2

## Design

### Schema Changes

**Expand `review_type` enum:**

```sql
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'negative';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'neutral';
ALTER TYPE public.review_type ADD VALUE IF NOT EXISTS 'mixed';
```

**Backfill `warning` → `negative`:**

```sql
UPDATE public.vendor_mentions SET type = 'negative' WHERE type = 'warning';
```

Note: `warning` cannot be removed from the enum (Postgres limitation) but is treated as deprecated going forward.

**New columns on `vendor_mentions`:**

```sql
ALTER TABLE public.vendor_mentions
  ADD COLUMN IF NOT EXISTS sentiment_score SMALLINT
    CHECK (sentiment_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS nps_tier TEXT
    CHECK (nps_tier IN ('promoter', 'passive', 'detractor'));
```

**NPS tier derivation:**

| type | sentiment_score | nps_tier |
|------|----------------|----------|
| positive | 5 | promoter |
| positive | 3-4 | passive |
| positive | 1-2 | detractor |
| neutral | any | passive |
| mixed | any | passive |
| negative | any | detractor |

### Pipeline Changes

**1. Transform External Reviews** (`supabase/functions/transform-external-review/index.ts`)

Update Gemini prompt to return:
- `sentiment`: one of `positive`, `negative`, `neutral`, `mixed`
- `sentiment_score`: 1-5 intensity

Compute `nps_tier` before inserting. Preserve star ratings from external reviews as the `sentiment_score` when available.

**2. WAM Sync** (`sync_single_wam_processed_mention`)

- Accept and pass through richer sentiment values
- Map upstream sentiment directly to expanded enum instead of collapsing to binary
- Accept `sentiment_score` if upstream provides it
- Compute `nps_tier` at sync time
- Update trigger to fire on `sentiment_score` changes

**3. Backfill Edge Function** (new: `reclassify-mentions`)

- Batch processes existing mentions through Gemini for reclassification
- Input: existing `quote` text
- Output: new `type`, `sentiment_score`, `nps_tier`
- Idempotent: skips rows that already have a `sentiment_score`
- Configurable batch size, same pattern as `transform-external-review`

### RPC & Scoring Changes

**`_compute_metric_score`**
- Use `sentiment_score` as a weight: a score-5 positive contributes more than a score-2 positive
- Sentiment ratio becomes a weighted average, not simple percentage
- `neutral` mentions count toward volume confidence but excluded from sentiment ratio

**`get_vendor_dimensions`**
- Replace hardcoded `0 AS mixed_count, 0 AS neutral_count` with actual counts
- Add NPS tier counts per dimension

**`get_vendor_sentiment_history`**
- Add `neutral_count`, `mixed_count`, `negative_count` to monthly breakdowns

**`compute_vendor_segments` / `vendor_segment_scores`**
- Add `neutral_count` column
- Update `positive_pct` denominator to exclude neutrals: `positive / (positive + negative + mixed)`
- Add NPS tier distribution per segment

**`get_vendor_dashboard_intel`**
- Sentiment history gains new counts
- Health estimate uses weighted scoring

**No changes needed:** `compute_category_benchmarks`, `compute_vendor_feature_gaps` (consume metric scores, not raw mentions).

### Frontend Changes

**`DashboardDimensions.tsx`**
- Bar chart: 4-segment stacked bar (positive, neutral, mixed, negative) instead of 2
- `getSentimentLabel` uses actual `mixed` data instead of inferring from percentages

**`TrendDeepDive.tsx`**
- Stacked area charts showing composition shifts over time

**`DashboardSegments.tsx`**
- NPS tier distribution per segment (e.g., "6+ rooftop dealers are 40% promoters")

**Types (`admin.ts`)**
- Add `promoter`, `passive`, `detractor` color mappings to `SENTIMENT_COLORS`

**Hooks (`useVendorIntelligenceDashboard.ts`)**
- Update `SentimentHistoryPoint` and `MetricComponentData` interfaces for new counts

### Backfill Strategy

- Schema migration is pure SQL (enum expansion, new columns, `warning` → `negative` backfill)
- AI reclassification is a separate edge function (`reclassify-mentions`)
- Processes in batches, skips rows with existing `sentiment_score`
- Existing data stays `positive` or `negative` until reclassified
- Historical dashboard numbers may shift after backfill — this is expected and desired
