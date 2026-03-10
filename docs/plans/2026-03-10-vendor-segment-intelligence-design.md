# Vendor Segment Intelligence — Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

Vendors see aggregate sentiment scores but have no visibility into *which dealer segments* rate them well or poorly. A GM at a 10-rooftop group has different needs than a BDC manager at a single point — vendors need to know where they're strong and where they're weak.

## Solution

Add a "Segments" tab to the vendor dashboard that breaks down sentiment across 4 axes derived from attributed member data.

## Segment Axes & Buckets

| Axis | Buckets | Source Field |
|------|---------|-------------|
| Size | 1 rooftop, 2-5 rooftops, 6+ rooftops | `members.rooftops` |
| Role | Executive (GM/Owner/DP), Manager (dept heads), Frontline (sales/BDC/advisors) | `members.role_band` |
| Geography | Region (Northeast, Southeast, Midwest, West, etc.) | `members.region` |
| OEM Mix | Domestic-heavy, Import-heavy, Luxury-heavy, Mixed | Derived from `members.oems` array |

**Minimum threshold:** 3+ attributed mentions per bucket to display. Below that, bucket is suppressed.

## Data Layer

### Table: `vendor_segment_scores`

| Column | Type | Notes |
|--------|------|-------|
| vendor_name | TEXT | |
| segment_axis | TEXT | size, role, geo, oem |
| segment_bucket | TEXT | e.g. "6+ rooftops" |
| mention_count | INTEGER | |
| positive_count | INTEGER | |
| warning_count | INTEGER | |
| positive_pct | INTEGER | |
| computed_at | TIMESTAMPTZ | |
| **PK** | | (vendor_name, segment_axis, segment_bucket) |

### Function: `compute_vendor_segments(p_vendor_name TEXT)`

- Joins `vendor_mentions` (where `member_id IS NOT NULL`) to `members`
- Buckets each mention across the 4 axes
- Upserts into `vendor_segment_scores`
- Suppresses buckets with < 3 mentions (deletes stale rows)
- OEM derivation: maps OEM names to domestic/import/luxury, then picks the dominant category or "Mixed"

### RPC: `get_vendor_segment_intel(p_vendor_name TEXT)`

Returns JSONB:

```json
{
  "total_attributed": 42,
  "standout": "Single-point dealers rate you 22 points higher than large groups.",
  "axes": {
    "size": [
      { "bucket": "1 rooftop", "mentions": 12, "positive_pct": 83 },
      { "bucket": "2-5 rooftops", "mentions": 8, "positive_pct": 62 },
      { "bucket": "6+ rooftops", "mentions": 5, "positive_pct": 40 }
    ],
    "role": [],
    "geo": [],
    "oem": []
  }
}
```

The `standout` field is auto-generated: finds the axis with the largest spread between highest and lowest positive_pct buckets and generates a one-liner.

### Cron Integration

`compute_vendor_segments` is called inside `refresh_all_vendor_metrics()` for vendors with 3+ attributed mentions.

## Frontend

### `DashboardSegments.tsx`

- Registered as "segments" tab in `VendorDashboardLayout`
- Header: "Audience Segments" with subtitle showing total attributed mention count
- Standout callout banner at top (amber/highlight style)
- 2x2 grid of segment cards, one per axis

### Segment Card

Each card contains:
- Axis label (e.g. "Dealership Size")
- Horizontal bars per bucket:
  - Green fill width proportional to `positive_pct`
  - Bucket label on the left, mention count on the right
  - Sorted by `positive_pct` descending (strongest segment first)
- Buckets below threshold shown grayed: "Not enough data"

### `useVendorSegmentIntel.ts`

React Query hook wrapping the RPC. Same pattern as `useVendorIntelligenceDashboard`.

### Empty State

If vendor has < 3 total attributed mentions: "Segment insights will appear as more dealer feedback is attributed." Clean single message, no empty cards.

## Dependencies

1. **Member attribution backfill** — most mentions need `member_id` populated
2. **OEM category mapping** — small lookup mapping OEM names to domestic/import/luxury

## Files to Create/Modify

**New files:**
- `supabase/migrations/XXXXXXXX_vendor_segment_intelligence.sql` — table, compute function, RPC, cron hook
- `src/components/vendor-dashboard/DashboardSegments.tsx` — segment tab component
- `src/hooks/useVendorSegmentIntel.ts` — React Query hook

**Modified files:**
- `src/components/vendor-dashboard/VendorDashboardLayout.tsx` — add "segments" nav entry
- `src/pages/VendorDashboardPage.tsx` — render DashboardSegments for "segments" section
- `supabase/migrations/20260310100000_refresh_vendor_metrics_cron.sql` — add segments to refresh loop (or new migration to alter function)
