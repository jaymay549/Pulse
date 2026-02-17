# Dealer Vendor Profile Redesign

## Date: 2026-02-17

## Goal

Transform the vendor profile page from a basic stats display into a genuine research tool for dealers evaluating vendors. Build the full experience first; paywall gating comes later.

## Data Available

- **1,711 vendor mentions** across 545 vendors with sentiment (positive/warning), category, quotes, timestamps
- **822 vendor processing queue entries** with conversation chunks containing co-occurring vendor mentions
- **94 vendor group mappings** for name deduplication
- **578 vendor metadata records** (10% enriched with descriptions/URLs)
- **29 pre-computed vendor/category insights** with AI headlines

## Design Decisions

- **Pulse Score removed** — formula is unreliable at low mention volumes; no credible way to score vendors with <20 mentions
- **Topics excluded from vendor profile** — topics are industry-wide themes, not vendor-specific; saved for a separate feature
- **Theme clustering via Supabase RPC** — groups mentions by title server-side for consistent, fast results without AI cost per page load
- **Peer vendors use co-occurrence with category fallback** — co-occurrence from processing queue shows real comparisons dealers make; same-category fills gaps for smaller vendors

## Database Changes

### New RPC: `get_vendor_themes(p_vendor_name text)`

Returns top 5 positive and top 5 warning theme clusters.

Per theme:
- `theme` — the mention title text
- `mention_count` — how many mentions share this title
- `percentage` — what % of that sentiment type this theme represents
- `sample_quote` — one representative quote (most recent)

SQL approach: GROUP BY title within each type, ORDER BY count DESC, LIMIT 5.

### New RPC: `get_compared_vendors(p_vendor_name text, p_limit int default 4)`

Two-stage:
1. **Co-occurrence:** Parse `ai_response` in `vendor_processing_queue` for vendor names that appear alongside the target vendor in the same conversation chunk. Count co-occurrences, rank by frequency.
2. **Fallback:** If co-occurrence returns fewer than `p_limit` results, fill remaining slots with top-mentioned vendors sharing the same categories in `vendor_mentions`.

Per peer vendor:
- `vendor_name`
- `mention_count` — total mentions for that peer
- `positive_percent` — their sentiment ratio
- `co_occurrence_count` — times discussed alongside target (null if from fallback)

### Modified RPC: `get_vendor_profile(p_vendor_name text)`

Add `trend` object to existing response:
- `current_positive_pct` — positive % in last 30 days
- `previous_positive_pct` — positive % in prior 30 days
- `direction` — "up" / "down" / "stable" (stable = <5pp difference)
- `mention_volume_change_pct` — volume change between periods
- Returns `null` if previous period has fewer than 3 mentions

## Frontend Changes

### VendorProfile.tsx

**Remove:**
- Pulse Score ring and all related state (`pulseScore`, `scoreTheme`, `circumference`, `ringOffset`, `displayScore` memos, animation useEffects)

**Replace:**
- "Coming soon" placeholder cards with real theme cluster lists from `get_vendor_themes`
- Each theme: title, mention count badge, sample quote in muted text
- Empty state: "No [positive/concern] themes recorded yet"

**Add:**
- "Frequently Compared With" section between stats row and themes
  - Header: "Frequently Compared With"
  - Subtext: "Vendors dealers often evaluate alongside {vendorName}"
  - Compact cards: name, logo, mention count, small sentiment bar
  - Cards link to that vendor's profile
  - Hidden if fewer than 2 peers found
- Filter tabs above Community Mentions: All / Positive / Concerns with count badges
  - Client-side filtering on already-loaded `allMentions`
  - State: `mentionFilter: "all" | "positive" | "warning"`

**Modify:**
- Total Mentions card: replace hardcoded TrendingUp icon with real trend data
  - Arrow + "Sentiment trending up/stable/declining" with percentage shift
  - "Not enough historical data" if trend is null

### New hooks

- `useVendorThemes.ts` — calls `get_vendor_themes` RPC
- `useComparedVendors.ts` — calls `get_compared_vendors` RPC

### Page section order

1. Hero (banner, logo, name, tagline, metadata pills, CTA card, CDG Intelligence strip)
2. Sentiment Breakdown + Total Mentions (with real trend)
3. Frequently Compared With
4. What Dealers Appreciate + Common Concerns
5. Community Mentions with filter tabs

## Out of Scope

- Topics integration (separate feature/page)
- Paywall gating (applied after full experience is built)
- Vendor metadata enrichment
- Pricing signals / adoption stage (insufficient data structure)
- Sentiment over time chart (trend indicator is sufficient for now)
