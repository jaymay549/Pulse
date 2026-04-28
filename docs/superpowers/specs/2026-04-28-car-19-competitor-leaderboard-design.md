# CAR-19 · Competitor Comparison Leaderboard

Linear: [CAR-19](https://linear.app/cardealershipguy/issue/CAR-19/competitor-comparison-leaderboard) (related: [CAR-36](https://linear.app/cardealershipguy/issue/CAR-36/improve-competitive-comparison-ranking-display))
Branch: `jason/car-19-competitor-comparison-leaderboard`
Status: design approved, ready for implementation plan.

## Goal

Replace the current `DashboardIntel` competitor comparison table on the vendor Market Intel tab with a multi-metric leaderboard that lets a vendor read, in one glance, where they rank versus their competitors and where the specific gaps are.

The current view sorts vendors by raw discussion volume, weakly highlights the vendor's own row, and offers no segment benchmark. The replacement ranks by composite Pulse Score, breaks the rank down across the three dimensions already computed in `useVendorIntelligenceDashboard` (Product Stability, Customer Experience, Value Perception), shows the segment median, surfaces 90-day rank movement, and frames Tier 2 as an additional diagnostic capability rather than a paywall.

## Why now

Vendors put a high value on seeing where they rank against competitors. Today's table is sorted by the wrong metric, doesn't tell them what "good" looks like, and doesn't differentiate Tier 2 value beyond what Tier 1 already pays for. The data we need (composite health score, per-dimension scores, segment medians, velocity) already lands in the dashboard from `get_vendor_dashboard_intel`. The blocker is presentation, not data.

## Constraints

- Must drop into the existing vendor dashboard shell. No new layout chrome.
- Must follow `DESIGN.md`: Inter + JetBrains Mono, slate / white surfaces, primary blue marking the vendor's own row, gold reserved for Tier 2 capability cues, emerald / amber / red sentiment scale, font-black tracking-tight headings, tabular numerics on every score.
- Must follow `PRODUCT.md`: pressure with dignity. Both T1 and T2 are paying customers. No paywall language, no blur overlays on the leaderboard itself.
- Tier-gating must be enforced server-side eventually, but for v1 it is implemented inline in the component via `useVendorTier()`. The visual difference between T1 and T2 is what happens on row click, not what is visible in the table.
- WCAG AA. Sentiment colors must always pair with a non-color cue (rank position, label, or icon).
- Reduced-motion users see no staggered reveals; rows render in their final positions.

## Scope

In:

1. The leaderboard component itself, replacing `DashboardIntel`'s competitor table.
2. RPC extensions to `get_compared_vendors` to return scored multi-metric ranking, segment median, rank delta, and a `widened_to` slug.
3. RPC extension to `get_vendor_dashboard_intel` (or a sibling RPC) to return the same per-dimension scores for each comparison vendor, not just the viewing vendor.
4. A new nullable column on `vendor_profiles`: `competitor_override jsonb` that an admin can populate to manually curate the competitor set for a specific vendor profile.
5. Client-side handling of two edge cases: thin segment auto-widening, and below-threshold dimension cells.
6. Motion: staggered fade-in on first render, FLIP repositioning on sort-chip change.
7. Tier 2 capability card rendered for T1 vendors below the leaderboard.

Out:

1. The Tier 2 diagnostic drawer that renders when a Tier 2 vendor clicks a row. CAR-19 explicitly calls this out as a separate phase. Hooks (the chevron affordance, the row click handler) ship in v1; the drawer itself ships in a follow-up issue.
2. The admin UI to set `vendor_profiles.competitor_override`. The column ships in v1; the admin form to populate it is a follow-up.
3. Changes to `PulseBriefing.tsx`'s inline top-competitor summary on the Intelligence Hub. It continues to render as-is.
4. A period selector (30D / 1Y). v1 ships a single 90-day window. Add a selector later if vendors actually request one.
5. Dark mode polish. The vendor dashboard ships in light mode today; dark mode tokens exist in `index.css` but are not parity-tested for this surface.

## Surface and layout

The leaderboard renders as a single rounded-xl card sitting on the existing `--vendor-bg` shell, replacing the current `DashboardIntel` competitor table. Top to bottom:

1. **Header strip.** Eyebrow in mono small-caps slate-400 ("Competitive Standing · CRM · North America"), heading in font-black tracking-tight slate-900 ("Where you rank, across every metric."), one-line slate-500 subtitle. Live pill aligned right: emerald dot + "LIVE · 90D" in mono uppercase.
2. **Sort chips.** Mono small-caps "Sort by" label followed by pill buttons: Pulse Score (default selected, slate-900 background), Product Stability, Customer Experience, Value Perception, Volume. Selecting a chip re-sorts the leaderboard rows by that metric.
3. **Leaderboard table.** Eight columns:
   - rank (mono, slate-400)
   - vendor name + meta ("· 142 mentions" in mono slate-400)
   - Pulse score + delta pill
   - Product Stability score
   - Customer Experience score
   - Value Perception score
   - 90-day sparkline (slate-300 bars, primary blue for the vendor's own row, emerald cap on rising trends)
   - chevron (slate-300 default, slate-500 on row hover, primary blue on the vendor's row)
   The vendor's own row uses a primary-blue tint background that bleeds to the card edge with a 24px negative margin and re-padded 24px content. The row's text uses primary blue, not slate-900.
4. **Median row.** Inserted at the position where the segment median Pulse Score would sort within the visible rows (between the highest-scoring vendor below the median and the lowest-scoring vendor above it). Renders as a one-line dashed-bordered strip in mono small-caps slate-500: "Segment median · CRM" with the median value in each numeric column.
5. **Below-the-table panel.** Two sub-cards laid out as a 2-column grid with 16px gap.
   - Left ("Your shape"): slate-50 background, slate-200 border, mono small-caps kicker, font-black slate-900 headline, multi-line summary that auto-narrates the multi-dimensional read in slate-700 with semantic emerald / red emphasis.
   - Right ("Available in Tier 2"): subtle gold-tinted gradient background (`linear-gradient(180deg, #FFFBEB 0%, #fff 100%)`), gold-tinted border, gold mono kicker, font-black slate-900 headline, slate-600 body, gold-bulleted list of capabilities, ghost CTA button "Talk to your CSM about Tier 2 →" in slate-900 outline that fills slate-900 on hover. Mono footer reading "Already on Tier 2? Click any row above." Card is rendered only for T1; absent for T2.
6. **Show-all expand.** When the segment has more vendors than the default rendered set (top 5 + median + the vendor's row + ±1 neighbors when the vendor is outside the top 5), a slate-200 dashed bottom-of-card affordance reads "Show all N vendors" in slate-500, where N is the total `qualifying_vendor_count` from the segment payload. Clicking expands the table inline to show every vendor in the segment, with the median row repositioned to its sorted position within the now-full list.

## Data model

Authoritative source for both rank and per-dimension scores: `get_vendor_dashboard_intel.metrics.{health_score, product_stability, customer_experience, value_perception}` and `get_vendor_dashboard_intel.benchmarks.{product_stability_median, customer_experience_median, value_perception_median, qualifying_vendor_count}`.

The current RPCs are insufficient because:

- `get_compared_vendors` returns vendors ranked by co-occurrence with `mention_count` and `positive_percent` only. It does not return per-dimension scores.
- `get_vendor_dashboard_intel` returns the full multi-metric data only for the vendor being viewed.

Two backend extensions, both additive, both behind the existing `wam`-schema RPC pattern. No frontend type churn beyond extending the existing `ComparedVendor` interface in `DashboardIntel.tsx` and the existing `DashboardBenchmarks` interface in `useVendorIntelligenceDashboard.ts`.

### Extension 1: `get_compared_vendors` v2

Add the following inputs and outputs. Existing callers (`PulseBriefing.tsx` line 248) continue to receive the legacy fields and ignore the new ones, so this is non-breaking.

Inputs:

- Existing: `p_vendor_name text`, `p_limit integer`.
- New: `p_segment_override jsonb default null`. When non-null, an array of canonical vendor names that defines the explicit competitor set, bypassing the auto-derived category segment. Sourced from the new `vendor_profiles.competitor_override` column.

Outputs (per vendor row):

- Existing: `vendor_name`, `mention_count`, `positive_percent`, `co_occurrence_count`.
- New: `health_score numeric`, `product_stability_score numeric`, `customer_experience_score numeric`, `value_perception_score numeric`, `rank integer`, `rank_delta_90d integer` (positive means moved up, negative means moved down, null means insufficient history), `is_above_median boolean`.

Outputs (response envelope):

- Existing: `vendors` array.
- New: `segment jsonb` with shape `{ category: text, widened_to: text | null, qualifying_vendor_count: integer, median: { product_stability, customer_experience, value_perception, health_score } }`.

Behavior changes:

- Default sort is composite `health_score` desc. Tie-broken by `mention_count` desc.
- When `qualifying_vendor_count < 3` for the vendor's resolved category, the RPC auto-widens to the parent category (per the existing DMS / CRM widening pattern) and returns the broader category slug in `segment.widened_to`. The vendor list and median both reflect the widened set.
- When `p_segment_override` is provided, the RPC ignores the category-derived segment entirely and returns the override set, in composite-rank order, with a median computed over those vendors. `segment.widened_to` is null in this case; `segment.category` carries a sentinel value of `"override"`.

### Extension 2: `vendor_profiles.competitor_override`

New column on `public.vendor_profiles`:

```sql
competitor_override jsonb null
```

Shape when populated: `["Acme CRM", "DealerStream", "Quokka Auto", "VinPath"]`. Names match canonical vendor names from `vendor_entities`. Validation that names exist is enforced by the admin write path, not in the RPC. The leaderboard component looks at `vendor_profiles.competitor_override`; if present, it passes the array to `get_compared_vendors` as `p_segment_override`. If absent, the RPC falls back to the auto-derived category.

The admin UI to populate this column is out of scope for this spec, but the column ships now so the leaderboard can already consume it once admins populate it via SQL or a future form.

### Extension 3: per-vendor multi-metric data for the table

Two implementation options:

- **Option A — return scores in `get_compared_vendors` v2.** The four numeric score columns are added directly to each vendor row. Single RPC call, simpler client.
- **Option B — separate batch RPC `get_dashboard_metrics_for_vendors(p_names text[])`.** Returns the same shape as `get_vendor_dashboard_intel.metrics` for each name. Two RPC calls (compared vendors + batch metrics), more flexible if other surfaces want the batch later.

This spec picks **A**. The dashboard's pulse score and dimension scores are already computed in the materialized layer that `get_vendor_dashboard_intel` reads from, so joining them onto the comparison query is cheap. Two RPC calls would mean extra round-trip on a high-attention dashboard surface for no concrete near-term benefit.

## Component breakdown

New file: `src/components/vendor-dashboard/CompetitorLeaderboard.tsx`. Replaces the competitor-table portion of `DashboardIntel.tsx`. The "Your Position" card at the top of `DashboardIntel.tsx` stays as-is for v1.

Internal structure of `CompetitorLeaderboard.tsx`:

- `CompetitorLeaderboard` (default export) — top-level card. Owns the React Query for the multi-metric compared vendors. Resolves the active sort metric and the active row set (top 5 + you ± 1 vs full segment). Reads `useVendorTier()` for T1 / T2 conditional rendering.
- `LeaderboardHeader` — title strip with eyebrow, heading, sub, and live pill.
- `SortChips` — controlled pill bar; emits the active metric key.
- `LeaderboardTable` — pure presentational table. Receives the resolved row set, the median row, and the active sort metric. Renders rows, the median strip, and the show-all expand.
- `LeaderboardRow` — single row. Computes its own sentiment color class per cell, renders the sparkline as a 12-bar inline SVG (not a Recharts chart, since these are decorative micro-trends and a full chart per row is overkill).
- `MedianRow` — dashed-edged strip rendering segment median values.
- `YourShapeCard` — auto-narrated summary. Pure formatting given the vendor's per-dimension ranks and scores.
- `Tier2CapabilityCard` — conditional, T1 only. Static content for v1.
- `ShowAllToggle` — slate-200 dashed strip at the foot of the table; emits expand / collapse.

`DashboardIntel.tsx` shrinks to render the existing "Your Position" hero + a single `<CompetitorLeaderboard vendorName={vendorName} />` underneath it. The current local table JSX and `ComparedVendor` interface move to the new component.

## Tier behavior

Resolution path: `CompetitorLeaderboard` reads the vendor tier from the `VendorTierContext` provided by `VendorDashboardPage` via `useVendorTier()`. No tier (admin full-access mode) renders as Tier 2.

What changes between T1 and T2:

- T1 renders the `Tier2CapabilityCard`. T2 does not. The card is the only visible difference between the tiers; everything else in the leaderboard is identical.
- Row chevron, hover states, and click affordances render for both tiers. The row click handler resolves at render time:
  - Tier 1: expands an inline strip directly under the clicked row, sharing the row's full width, slate-50 background, slate-200 top and bottom borders. The strip reads "Diagnostic mode is available in Tier 2 — see the dealer quotes, feature gaps, and competitor moves driving this row's scores." Right-aligned in the strip is the same CTA used in the Tier 2 capability card. No drawer, no blur. Clicking the row again collapses the strip.
  - Tier 2: opens the diagnostic drawer (out of scope for this spec; the v1 click handler in the new component ships with an explicit branch that calls `console.warn("CompetitorLeaderboard: Tier 2 drawer not yet implemented")` and is replaced wholesale by the follow-up drawer issue).

This deliberately avoids `GatedCard`'s blur overlay. Both tiers see the full leaderboard in the same fidelity. The tier difference is in what happens on click, not in what is visible.

## Edge cases

### Thin segment

Trigger: `segment.qualifying_vendor_count < 3` after the RPC's auto-widen pass.

Behavior: RPC has already widened to the parent category (or, if the vendor's category has no parent, returned what it has). UI renders a small slate note above the sort chips reading: *"Compared against the broader [widened category] category. Your specific segment doesn't yet have enough qualifying vendors."* The note uses slate-500 12px, no icon, no border. The leaderboard renders normally with the widened set.

Fallback when even the widened set yields fewer than 2 vendors (vendor truly is alone): the leaderboard collapses to a one-row "Gathering" empty state. Headline: "Not enough data yet to rank you against competitors." Body: copy adapted from `HealthScoreHero`'s gathering state. No median, no sort chips. The Tier 2 capability card still renders for T1 vendors so the upsell path is preserved.

### Below-threshold dimension cells

Trigger: a vendor's dimension score is null because `MetricComponentData.below_threshold = true`.

Behavior: the cell renders a small slate-300 pill labeled "Gathering" in mono 10px small-caps, no border, no background. Hover or focus reveals a slate-700 popover with the explanation: "Not enough discussion in this dimension to score yet."

This is visually distinct from a real low score. Below-threshold cells do not affect rank ordering on that metric (the vendor sorts to the bottom of that specific column with the null value, but their composite rank is unaffected because the composite score is only computed when all required dimensions clear threshold).

### Insufficient rank-delta history

Trigger: the RPC returns `rank_delta_90d = null` for that vendor row, which it does when no comparable prior 90-day window exists (vendor first appeared in mentions less than 90 days ago, or the prior window had insufficient qualifying data to compute a rank).

Behavior: the rank-delta column for that vendor row renders the static text "New" in slate-400 mono, replacing the `▲` / `▼` glyph. Hover or focus reveals a slate-700 popover: "Not enough prior history to show 90-day rank movement yet."

## Motion

- First render: rows fade in with a 60ms staggered delay per row, exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`), 400ms total. Median row and below-the-table panel fade in with the last row's delay.
- Sort chip change: rows reposition via FLIP. 280ms with the system's standard `cubic-bezier(0.4, 0, 0.2, 1)`. Sentiment colors and sparkline contents do not animate; only y-position.
- Row hover: chevron translates 2px right and shifts to slate-500 in 150ms.
- `prefers-reduced-motion: reduce`: all of the above collapse to instant placement; only color hover transitions remain.

No bouncing, no spring, no elastic. No animated number tickers; rank deltas are presented as static glyph + integer.

## Accessibility

- Every score cell has a non-color cue: the rank position itself for ordinal information, the score number itself for magnitude, and a screen-reader-only label per cell ("Pulse score: 62, amber range, below segment median").
- The vendor's own row carries `aria-current="true"`, not just a color tint.
- Sort chips are buttons in a labeled toolbar (`role="toolbar"`, `aria-label="Sort leaderboard"`).
- The median row carries `role="separator"` so screen readers announce the section break.
- The Tier 2 capability card is reachable in tab order; the CTA is a `<button>`, not a styled `<div>`.
- Focus ring uses the existing `--ring` token at 2px.

## Telemetry

Events to emit (existing analytics layer if present, or a follow-up wiring task if not):

- `leaderboard_viewed` on first render of `CompetitorLeaderboard`. Payload: vendor tier, segment category, was-widened, qualifying vendor count, rank.
- `leaderboard_sort_changed` on sort chip click. Payload: from-metric, to-metric.
- `leaderboard_row_clicked` on row click. Payload: vendor tier, clicked-vendor name, was-own-row.
- `leaderboard_show_all_expanded` on expand. Payload: total vendors revealed.
- `tier2_card_cta_clicked` on the T1 capability card CTA. Payload: source = "competitor_leaderboard".

These power the question of whether T1 vendors are converting on the diagnostic capability hook.

## Testing strategy

No unit framework is configured in this repo. Coverage is via Playwright e2e per existing convention. The test surface for v1:

- Happy path: T1 vendor with a well-populated segment renders 5+ rows, median row, sort chips work, show-all expand reveals the full segment.
- T2 path: T2 vendor sees the leaderboard but does not see the Tier 2 capability card.
- Thin segment: a vendor whose category yields `qualifying_vendor_count < 3` renders the "broader category" note and the widened leaderboard.
- Empty segment: a vendor with no qualifying competitors at all renders the gathering empty state.
- Below-threshold cell: a row with a null dimension score renders the "Gathering" pill, not "—".
- Reduced motion: with `prefers-reduced-motion: reduce`, no staggered reveal occurs.
- Keyboard nav: tab order moves through sort chips, then rows, then show-all, then the Tier 2 CTA. Enter on a row triggers the click handler.

## Open questions for implementation phase

1. v1 ships rank_delta_90d as null for every row (no prior-snapshot table exists yet). UI renders "—" not "New" in the delta column for v1; the prior-window computation lands in a follow-up. The widening hierarchy is hardcoded to the existing dms/crm pattern; a category_hierarchy table is also a follow-up.
2. The "Show all N" expand should probably remember its expanded state per session; whether it should remember across sessions (localStorage) is up to the implementer.
3. Whether the Tier 2 capability card should render *above* or *below* the leaderboard for T1 vendors. This spec ships it below; if early feedback shows T1 vendors miss it, move it above the table in a v1.1.

## Anti-scope

Things explicitly not part of this spec, called out so they do not creep in mid-implementation:

- No redesign of the "Your Position" hero above the leaderboard. It stays as-is.
- No changes to `DashboardOverview` or `PulseBriefing` competitor surfacing.
- No changes to dealer-facing competitor views.
- No new icon set. Use lucide-react glyphs already in the project.
- No animated number ticker on the rank delta column. Static integer + glyph.
- No share-card or screenshot-export feature. Not asked for, not in scope.

## References

- Linear: [CAR-19](https://linear.app/cardealershipguy/issue/CAR-19/competitor-comparison-leaderboard), [CAR-36](https://linear.app/cardealershipguy/issue/CAR-36/improve-competitive-comparison-ranking-display)
- Existing component being replaced: [src/components/vendor-dashboard/DashboardIntel.tsx](../../../src/components/vendor-dashboard/DashboardIntel.tsx)
- Data hook: [src/hooks/useVendorIntelligenceDashboard.ts](../../../src/hooks/useVendorIntelligenceDashboard.ts)
- Tier visibility config: [src/types/tier-config.ts](../../../src/types/tier-config.ts), seed at [supabase/migrations/20260416000000_tier_config_subcomponents.sql](../../../supabase/migrations/20260416000000_tier_config_subcomponents.sql)
- Project context: [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md)
- Brainstorming visual mockups: `.superpowers/brainstorm/23318-1777390838/content/04-multimetric-t2-reframed.html`
