# Segment Insights Redesign — Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

The current Segments tab shows positive-percentage bars per bucket (size, role, geo, oem). This answers "who likes us?" but not **why** or **what to do about it.** Vendors don't find the data actionable.

We have `type`, `dimension`, and `headline` per mention, all tied to segment buckets via member attribution. That's enough to surface qualitative insights like "Owners flag integration gaps (Paychex, Paycom)" and cross-segment patterns like "Support scores drop 30pts with Sales Leadership vs C-Suite."

## Solution

Enhance the Segments tab with two new layers:

1. **Insight Cards** — dynamic, cross-segment actionable findings at the top
2. **Expanded Segment Cards** — keep bars, add expandable wins/flags per bucket with actual headlines

## Page Structure

Three layers top-to-bottom:

1. **Header** — "Audience Segments" + attributed mention count (unchanged)
2. **Insight Cards** — replaces the standalone standout banner. Dynamic list of computed insights.
3. **Segment Cards** — 2x2 grid. Bars with expandable qualitative detail per bucket.

## Insight Cards

### Insight Types

| Type | Example | Detection |
|------|---------|-----------|
| **Segment gap** | "Sales Leadership rates your support 30pts lower than C-Suite" | Big positive_pct spread within an axis, tied to a specific dimension |
| **Pain cluster** | "Owners flag integration issues (3 mentions)" | Warnings concentrate on one dimension within a bucket |
| **Strength signal** | "C-Suite highlights enterprise manageability" | Positives cluster on one dimension within a bucket |
| **Dimension divergence** | "Pricing perception varies by size: small stores love it, large groups push back" | Same dimension, different sentiment across buckets in an axis |

### Thresholds

- 3+ mentions required to generate an insight
- No hard cap on number of insights — show all that pass threshold
- Sorted by severity (1-3) desc, then supporting mention count desc

### Table: `vendor_segment_insights`

| Column | Type | Notes |
|--------|------|-------|
| vendor_name | TEXT | |
| insight_type | TEXT | gap, pain, strength, divergence |
| segment_axis | TEXT | size, role, geo, oem |
| segment_bucket | TEXT | nullable — some insights span buckets |
| dimension | TEXT | worth_it, support, integrates, etc. |
| headline | TEXT | one-liner finding |
| detail | TEXT | supporting context |
| severity | INTEGER | 1-3 for sort order |
| computed_at | TIMESTAMPTZ | |

## Enhanced Segment Cards

Each card keeps horizontal bars (sorted by positive_pct) and adds expandable detail.

### Expanded Bucket Detail

Clicking/toggling a bar row reveals:

- **Wins** — top 3 positive headlines for that bucket, with dimension badge
- **Flags** — top 3 warning headlines for that bucket, with dimension badge
- If fewer than 3, show what we have. If zero of either type, omit that section.

Collapsed by default. Chevron toggle on each row.

### Table: `vendor_segment_bucket_details`

| Column | Type | Notes |
|--------|------|-------|
| vendor_name | TEXT | |
| segment_axis | TEXT | |
| segment_bucket | TEXT | |
| type | TEXT | positive or warning |
| dimension | TEXT | |
| headline | TEXT | |

Stores up to 3 wins and 3 flags per bucket. Computed alongside bar data.

## Compute Pipeline

All computed inside the existing `compute_vendor_segments()` function, extended with:

1. **Bar data** — unchanged (size/role/geo/oem buckets with counts and positive_pct)
2. **Bucket details** — new: top 3 wins and top 3 flags per bucket by headline, grouped by dimension. Inserted into `vendor_segment_bucket_details`.
3. **Insights** — new: analysis pass after buckets are computed. Detects 4 insight types. Inserted into `vendor_segment_insights`.

### Insight Detection Logic

**Segment gap:** For each axis, find the dimension with the largest positive_pct spread between the highest and lowest bucket. Require 3+ mentions per bucket for that dimension and 15+ point spread.

**Pain cluster:** For each bucket, find dimensions where 3+ warnings exist. Generate insight naming the bucket, dimension, and count.

**Strength signal:** For each bucket, find dimensions where 3+ positives exist. Generate insight naming the bucket, dimension, and top headline.

**Dimension divergence:** For each dimension, check if sentiment direction (majority positive vs majority warning) flips across buckets within an axis. Require 3+ mentions per bucket.

### Cron

No change — `refresh_all_vendor_metrics()` already calls `compute_vendor_segments()`.

## RPC Changes

`get_vendor_segment_intel(p_vendor_name TEXT)` returns enhanced JSONB:

```json
{
  "total_attributed": 30,
  "insights": [
    {
      "type": "pain",
      "axis": "role",
      "bucket": "Owners",
      "dimension": "integrates",
      "headline": "Owners flag integration issues (3 mentions)",
      "detail": "Paychex, Paycom, data transfer during setup",
      "severity": 3
    }
  ],
  "axes": {
    "role": [
      {
        "bucket": "Owners",
        "mentions": 13,
        "positive_pct": 54,
        "wins": [
          { "headline": "Tekion Cadillac of DMS with CRM", "dimension": "other" },
          { "headline": "Integrates with forward-thinking vendors", "dimension": "integrates" }
        ],
        "flags": [
          { "headline": "Integration issues with Paychex, Paycom", "dimension": "integrates" },
          { "headline": "In-store trainers are inadequate", "dimension": "support" }
        ]
      }
    ]
  }
}
```

## Frontend

### Updated `DashboardSegments.tsx`

- Renders insight cards at the top
- Renders 2x2 segment card grid below

### New `SegmentInsightCard`

- Icon per insight_type: gap = TrendingDown, pain = AlertTriangle, strength = Trophy, divergence = ArrowLeftRight
- Bold one-liner headline
- Muted detail text
- Left border color: red (pain), green (strength), amber (gap/divergence)
- Sorted by severity desc

### Enhanced `SegmentCard`

- Bars unchanged
- Each bar row gets chevron toggle
- Expanded: wins (green bullet) + flags (red bullet) with dimension badge
- Collapsed by default

### Updated `useVendorSegmentIntel.ts`

- Hook shape adds `insights[]` at top level, `wins[]`/`flags[]` per bucket
- Same React Query pattern, same stale time

## Files to Create/Modify

**New tables (migration):**
- `vendor_segment_insights`
- `vendor_segment_bucket_details`

**Modified functions (migration):**
- `compute_vendor_segments()` — extended with bucket details + insight detection
- `get_vendor_segment_intel()` — returns richer payload

**Modified frontend:**
- `src/components/vendor-dashboard/DashboardSegments.tsx` — insight cards + enhanced segment cards
- `src/hooks/useVendorSegmentIntel.ts` — updated types and response shape

**New frontend components (in DashboardSegments.tsx or extracted):**
- `SegmentInsightCard`
- Enhanced `SegmentCard` with expandable bucket detail

## Dependencies

- Member attribution backfill (done — 1,137 mentions attributed)
- Existing segment bar computation (done)
