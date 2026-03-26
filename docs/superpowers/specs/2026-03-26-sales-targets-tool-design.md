# Sales Targets Tool — Design Spec

**Date:** 2026-03-26
**Location:** New "Sales Targets" tab on AdminDashboard
**Purpose:** Surface vendor targeting opportunities for the sales team based on mention volume, sentiment, pain signals, feature gaps, and dealer adoption — with AI-generated pitch angles.

---

## Architecture: Hybrid (RPC for Data, Frontend for Scoring)

A lightweight Supabase RPC function aggregates raw signal data per vendor. The frontend handles all scoring, ranking, sorting, and filtering. This minimizes migration complexity and regression risk while keeping the UI fully flexible.

---

## 1. Data Layer — `get_sales_opportunity_signals()` RPC

A single PostgreSQL function returning one row per vendor with raw aggregated signals. No scoring or ranking — just numbers.

**Parameters:**
- `min_mentions` (INTEGER, default 3) — Minimum total mentions to include a vendor

**Returns per vendor:**

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `vendor_name` | TEXT | `vendor_mentions` | Canonical name (entity-resolved via `vendor_entities`) |
| `total_mentions` | INTEGER | `vendor_mentions` | All-time mention count |
| `mentions_30d` | INTEGER | `vendor_mentions` | Last 30 days |
| `positive_count` | INTEGER | `vendor_mentions` | type = 'positive' |
| `negative_count` | INTEGER | `vendor_mentions` | type = 'negative' or 'warning' |
| `neutral_count` | INTEGER | `vendor_mentions` | type = 'neutral' |
| `mixed_count` | INTEGER | `vendor_mentions` | type = 'mixed' |
| `promoter_count` | INTEGER | `vendor_mentions` | nps_tier = 'promoter' |
| `detractor_count` | INTEGER | `vendor_mentions` | nps_tier = 'detractor' |
| `passive_count` | INTEGER | `vendor_mentions` | nps_tier = 'passive' |
| `health_score` | NUMERIC | `vendor_metric_scores` | Current health score (0-100) |
| `trend_direction` | TEXT | `vendor_intelligence_cache` | 'improving' / 'declining' / 'stable' |
| `top_dimension` | TEXT | `vendor_intelligence_cache` | Most-discussed dimension |
| `feature_gap_count` | INTEGER | `vendor_feature_gaps` | Number of open gaps |
| `category` | TEXT | `vendor_metadata` | Vendor's product category |
| `has_profile` | BOOLEAN | `vendor_profiles` | Whether they've claimed a profile (proxy for customer status) |
| `confirmed_dealer_count` | INTEGER | `user_tech_stack` | Dealers with `is_current = true` for this vendor |
| `likely_dealer_count` | INTEGER | `vendor_mentions` + `members` | Distinct members with usage-implying dimensions (adopted, support, reliable, integrates, worth_it) who are NOT already in confirmed count |
| `mentioned_only_count` | INTEGER | `vendor_mentions` + `members` | Distinct members whose mentions are all dimension = 'other' or type = 'neutral' |

**Entity resolution:** Uses `vendor_entities` table to resolve canonical names, same pattern as `get_vendor_dashboard_intel`.

---

## 2. AI Synopsis — On-Demand Generation

**Trigger:** User clicks to expand a vendor row in the Sales Targets table.

**Input to Gemini AI:**
- The raw signal data for that vendor (from the RPC response already in client state)
- Up to 5 most recent negative mentions and 5 most recent positive mentions (fetched on expand via a small supplementary query)

**Output:** A 2-3 sentence synopsis with two parts:
1. **What the data says** — Summary of the vendor's current standing (e.g., "VinSolutions has 47 mentions in the last 30 days with 60% negative sentiment, trending worse. Dealers are frustrated with integration reliability and support response times.")
2. **Pitch angle** — Suggested outreach framing (e.g., "Lead with: 'Dealers are talking about your integration issues — we can show you exactly what they're saying and help you get ahead of it.'")

**Implementation:** A new Supabase Edge Function (`generate-sales-synopsis`) following the same pattern as `vendor-ai-chat` — receives vendor signal data + recent mentions, calls Gemini, returns the synopsis text.

**Caching:** Cached in React component state for the session. Re-expanding the same row reuses the cached synopsis. No persistent storage — fresh every session.

**Error handling:** If generation fails, show a brief error message with a "Retry" button. The table remains fully functional without the synopsis.

---

## 3. Frontend — Sales Targets Tab

### 3.1 Tab Placement

New tab on the existing `AdminDashboard` page, alongside the current system stats content.

### 3.2 Filter Bar

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Category | Dropdown (multi-select) | All | Filter by vendor product category |
| Min Mentions | Slider | 3 | Range 1-50, passed to RPC `min_mentions` param |
| Show All | Toggle | Off | Overrides min mentions to 1 |

### 3.3 Table Columns

| Column | Sortable | Description |
|--------|----------|-------------|
| Vendor Name | Yes | Canonical name, click to expand row |
| Category | Yes | Product category badge |
| Mentions (30d) | Yes | Recent volume — **default sort (desc)** |
| Total Mentions | Yes | All-time volume |
| Negative % | Yes | `(negative_count / total_mentions) * 100` |
| NPS Score | Yes | `((promoter_count - detractor_count) / (promoter_count + detractor_count + passive_count)) * 100` |
| Health Score | Yes | 0-100 |
| Trend | Yes | Arrow icon: green up / red down / gray flat |
| Gaps | Yes | Feature gap count |
| Known Dealers | Yes | `confirmed_dealer_count + likely_dealer_count` (excludes "Mentioned Only") |
| Profile | Yes | Checkmark if claimed |

### 3.4 Computed Opportunity Scores (Frontend)

These are additional sortable columns calculated client-side from the raw signal data:

| Score | Formula | Purpose |
|-------|---------|---------|
| **Pain Score** | Weighted combo: negative % (40%), detractor ratio (30%), declining trend bonus (30%) | Vendors getting roasted — need help |
| **Buzz Score** | Weighted combo: mentions_30d (60%), total_mentions (40%), normalized to 0-100 | High awareness = easier sell |
| **Gap Score** | Feature gap count normalized to 0-100 relative to max in dataset | Concrete problems we can show them |

Weights are hardcoded constants in the frontend, easy to tune later.

### 3.5 Expandable Row — Dealer Sub-table

Clicking a vendor row expands it to reveal two sections:

**Section A: Dealer Drill-down**

A sub-table of dealers associated with this vendor.

**Dealer classification logic:**
1. **Confirmed User** — Has entry in `user_tech_stack` with `is_current = true`
2. **Likely User** — No tech stack entry, but has mentions with dimension in (`adopted`, `support`, `reliable`, `integrates`, `worth_it`)
3. **Mentioned Only** — All mentions have dimension `other` or type `neutral`

**Sub-table columns:**

| Column | Description |
|--------|-------------|
| Dealer Name | From `members.name` |
| Dealership | From `members.dealership_name` |
| Status | Badge: "Confirmed User" / "Likely User" / "Mentioned Only" |
| Sentiment | Tech stack `sentiment_score` if available, otherwise average from their mentions |
| Rooftops | From `members.rooftops` |
| Region | From `members.state` / `members.region` |
| Switching? | Flag if `switching_intent = true` (confirmed users only) |
| Mentions | Count of their mentions for this vendor |

**Default sort:** Confirmed Users first, then Likely Users, then Mentioned Only.

**Data fetching:** Dealer list is fetched on-demand when the row expands (not included in the main RPC to keep it lightweight). A separate query joins `user_tech_stack` and `vendor_mentions` with `members`.

**Section B: AI Synopsis**

Displayed below the dealer sub-table. Shows loading spinner while generating, then the 2-3 sentence synopsis.

---

## 4. Data Flow

```
AdminDashboard (Sales Targets tab)
  │
  ├── On mount: call get_sales_opportunity_signals(min_mentions)
  │     └── Returns: one row per vendor with raw signals + dealer counts
  │
  ├── Frontend computes: Pain Score, Buzz Score, Gap Score
  │
  ├── User sorts/filters table
  │
  └── User clicks vendor row to expand:
        ├── Fetch dealer list (user_tech_stack + vendor_mentions + members)
        ├── Fetch recent mentions (5 positive + 5 negative)
        ├── Generate AI synopsis via Gemini
        └── Display dealer sub-table + synopsis inline
```

---

## 5. Non-Goals

- No CRM functionality (no notes, assignments, outreach tracking)
- No persistent storage of AI synopses
- No email/notification system
- No scoring logic in the RPC function
- No public-facing exposure — admin-only
