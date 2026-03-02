# Vendor Intelligence Platform Design

> Shifting CDGPulse from a Review Site to a Vendor Intelligence Platform.
> Vendors are the customers. Negative feedback becomes actionable signal.

## Product Vision

The vendor dashboard transforms from a review inbox into a **Command Center + Strategic Advisor**. Vendors never see raw mentions as the primary experience. Instead they see computed scores, trend lines, benchmark rankings, and AI-generated action plans. Raw mentions become invisible infrastructure — supporting evidence behind insights, not the product itself.

**Hard split:** The public vendor profile (dealer-facing) remains unchanged. The vendor dashboard is a completely separate intelligence product with its own data views, scores, and recommendations visible only to the vendor.

---

## Four Pillars

### 1. Constructive Insights
Transform raw mentions into actionable trend scores. "Product is buggy" becomes a declining Product Stability score with a specific recommendation to investigate integration reliability.

### 2. Comparative Benchmarking
Show vendors how they rank against category averages in Product Stability, Customer Experience, and Value Perception. No competitor names exposed. Privacy-safe aggregate comparisons.

### 3. Sentiment Velocity / Health Score
A single 0-100 composite score that tells a vendor whether they're getting better or worse. Always visible, always trending.

### 4. Feature Request Aggregation
Categorize negative feedback into specific feature gaps ranked by frequency and recency, mapped to the business metrics they affect.

---

## Dashboard Structure

### Top Bar: Health Score
- Single 0-100 composite score, always visible
- Trend arrow (up/down/stable)
- Spark line showing the last 6 months

### Primary Sections (single scrollable page, not tabs)

**1. Performance Metrics**
Three business-oriented score cards:
- Product Stability (0-100)
- Customer Experience (0-100)
- Value Perception (0-100)

Each shows: score, trend direction, one-line AI-generated insight.

**2. Benchmarks**
- Horizontal bar chart: vendor scores vs. category median
- Percentile rank badges: "Top 15%", "Middle 50%", "Bottom 25%"
- Trend comparison: "Your CX is improving faster than your category average"

**3. Action Plan**
- 3-5 AI-generated recommendations ranked by impact
- Each links to aggregated evidence (grouped themes, not raw quotes)
- Expandable to show supporting data

### Secondary Sections (collapsed/expandable)

**4. Feature Gap Analysis**
- Ranked list of feature gaps from negative feedback
- Each shows: gap label, mention count, trend, recency, affected metric

**5. Trend Deep Dive**
- Monthly velocity charts for each metric

**6. Edit Profile**
- Stays as-is, accessible via settings icon

### What's Removed from Vendor Dashboard
- Direct mentions feed as a primary view
- Raw dimensional sentiment percentages
- Overview/Mentions/Dimensions/Intel tab structure

---

## Business Metric Model

### Three Metrics Mapped from Existing Dimensions

| Business Metric | Source Dimensions | What It Captures |
|---|---|---|
| **Product Stability** | `reliable` + `integrates` | Does the product work? Does it play nice with other tools? |
| **Customer Experience** | `support` + `adopted` | Is the vendor responsive? Are dealers actually using it? |
| **Value Perception** | `worth_it` + pricing signals | Is it worth the price? Is pricing transparent? |

### Score Computation (0-100)

Each metric pulls mentions tagged with its source dimensions from the **last 90 days** (rolling window). The score is a weighted composite of four factors:

- **Sentiment ratio (40%)** — Percentage of positive mentions vs. total
- **Volume confidence (20%)** — More mentions = higher confidence, scales logarithmically
- **Recency bias (20%)** — Recent mentions weighted more heavily than older ones
- **Velocity (20%)** — Is the ratio improving or declining? Trending up scores higher than static

### Health Score

Weighted average of the three metrics:
- Product Stability: **35%**
- Customer Experience: **40%**
- Value Perception: **25%**

Customer Experience weighted highest because support/adoption complaints are the strongest churn signal in dealer communities.

### Minimum Threshold

Scores only compute when a vendor has **5+ total mentions** across the relevant dimensions. Below that, display "Gathering data" instead of a potentially misleading number.

---

## Comparative Benchmarking

### Category Averages

Each vendor belongs to a category (DMS, CRM, Digital Retailing, etc.) via `vendor_metadata.category`. Benchmarks compare against all qualifying vendors in the same category.

**Computation:**
- Take all vendors in the category with 5+ mentions
- Calculate the **median** score for each metric (not mean — prevents one large vendor from skewing)
- Recomputed daily

### What Vendors See

Per metric:
- Their score vs. category median (visual bar comparison)
- Percentile rank: "Top 15%", "Middle 50%", "Bottom 25%"
- Trend comparison: improving faster or slower than category average

### Privacy Rules

- Never reveal how many vendors are in the benchmark pool
- Never reveal individual competitor scores
- If a category has **fewer than 4 qualifying vendors**, show "Not enough category data yet" instead
- Category averages stored in `category_benchmarks` table

### Phase 1 Scope

- No sub-category benchmarking (enterprise vs. independent)
- No cross-category comparisons
- Simple horizontal bar chart visualization

---

## Recommendation Engine (Hybrid)

### Layer 1: Rule-Based Triggers

Rules evaluate against computed metrics and fire when conditions are met. Each rule has a category, condition, and priority.

| Rule | Condition | Priority | Category |
|---|---|---|---|
| Metric Drop Alert | Any metric drops >10 points in 30 days | High | Urgent |
| Dimension Weakness | Any source dimension <40% positive | High | Improvement |
| Momentum Win | Any metric up >15 points in 30 days | Medium | Celebrate |
| Below Category | Any metric >15 points below category median | Medium | Competitive |
| Feature Gap Cluster | 3+ mentions cite same missing feature in 60 days | Medium | Product |
| Volume Spike | Mention volume up >50% MoM | Low | Awareness |
| Stale Data | No new mentions in 60 days | Low | Engagement |

Rules evaluated during daily score computation. When a rule fires, it writes a row to `vendor_recommendations` with the rule ID, affected metric/dimension, and aggregated supporting data.

### Layer 2: LLM Language Generation

For each fired recommendation, an LLM generates a 2-3 sentence insight using a structured prompt containing:
- The rule context (what triggered it)
- The metric values (current, previous, delta)
- Aggregated theme summaries (not raw mention text)

Example output:
> "Your Product Stability score dropped 14 points this month, driven primarily by integration reliability concerns. 5 dealer mentions in the last 30 days cited data sync issues with their DMS. Consider prioritizing API stability in your next release cycle."

### Guardrails

- LLM **never** sees raw mention text — only aggregated theme labels and counts
- Output cached in `vendor_recommendations.insight_text`
- Max **5 active recommendations** per vendor at any time, ranked by priority
- Recommendations expire after **30 days** or when the triggering condition resolves

---

## Feature Request Aggregation

### Extraction Process

Mentions with negative sentiment are grouped by theme using the existing `get_vendor_themes` RPC (warning themes). Phase 1 uses these existing theme clusters directly — no new NLP pipeline.

### What Vendors See

A ranked list of feature gaps, each showing:
- **Gap label** — Short descriptor (e.g., "DMS Integration Reliability")
- **Mention count** — References in the last 90 days
- **Trend indicator** — More or less frequent?
- **Recency** — When was the last mention?
- **Metric mapping** — Which business metric this gap affects

### Phase 1 Scope

- Gap labels from existing warning theme clusters
- No deduplication of similar themes (phase 2 refinement)
- Max 10 gaps displayed, sorted by mention count descending

---

## Data Architecture

### New Tables

| Table | Purpose | Recomputed |
|---|---|---|
| `vendor_metric_scores` | Three metric scores + health score per vendor | Daily |
| `category_benchmarks` | Median scores per category | Daily |
| `vendor_recommendations` | Active recommendations with LLM-generated text | Daily |
| `vendor_feature_gaps` | Aggregated feature gaps from negative feedback | Daily |

### New RPCs

| RPC | Purpose |
|---|---|
| `compute_vendor_metrics` | Calculates three business metrics + health score |
| `compute_category_benchmarks` | Aggregates category medians from qualifying vendors |
| `get_vendor_dashboard_intel` | Single call returning metrics, benchmarks, recommendations, and feature gaps |

### New Edge Functions

| Function | Purpose | Trigger |
|---|---|---|
| `compute-daily-scores` | Orchestrates full daily pipeline: metrics -> benchmarks -> rules -> LLM recommendations -> feature gaps | Cron (daily) |

### Unchanged

- `vendor_mentions` — Raw data source, untouched
- `vendor_intelligence_cache` — Still powers public profile
- `vendor_metadata`, `vendor_profiles`, `vendor_custom_content` — No changes
- All existing RPCs — Still used by public profile

---

## Frontend Implementation

### New Components

| Component | Purpose |
|---|---|
| `VendorCommandCenter.tsx` | Top-level layout, replaces tab navigation with single scrollable page |
| `HealthScoreHero.tsx` | Prominent health score with spark line and trend arrow |
| `MetricCard.tsx` | Reusable card for each business metric (score, trend, AI insight) |
| `MetricsBenchmarkChart.tsx` | Horizontal bar chart with vendor scores vs. category median |
| `ActionPlan.tsx` | Ranked AI recommendations, expandable to show aggregated evidence |
| `FeatureGapList.tsx` | Ranked feature gaps with counts, trends, metric mapping |
| `TrendDeepDive.tsx` | Expandable monthly velocity charts per metric |

### Data Flow

Single hook `useVendorIntelligenceDashboard(vendorName)` calls `get_vendor_dashboard_intel` RPC. Returns everything the dashboard needs in one query — no waterfall.

### Design Approach

- Existing shadcn-ui primitives (Card, Badge, Progress)
- Recharts for charts (already in project)
- No new dependencies
- Dark, professional aesthetic — Bloomberg terminal for vendor reputation, not a consumer review site

### What Remains

- Edit Profile accessible from settings icon
- Mention flagging works through recommendation drill-down, not a dedicated tab

---

## Implementation Order

### Step 1: Database & Computation
1. Create new tables (`vendor_metric_scores`, `category_benchmarks`, `vendor_recommendations`, `vendor_feature_gaps`)
2. Create `compute_vendor_metrics` RPC
3. Create `compute_category_benchmarks` RPC
4. Create `get_vendor_dashboard_intel` RPC

### Step 2: Edge Function
5. Build `compute-daily-scores` edge function (orchestrator)
6. Integrate rule-based recommendation triggers
7. Add LLM recommendation generation

### Step 3: Frontend
8. Build `useVendorIntelligenceDashboard` hook
9. Build `HealthScoreHero` component
10. Build `MetricCard` component
11. Build `MetricsBenchmarkChart` component
12. Build `ActionPlan` component
13. Build `FeatureGapList` component
14. Build `TrendDeepDive` component
15. Build `VendorCommandCenter` layout
16. Replace current dashboard page

### Step 4: Polish
17. Test with real vendor data
18. Tune scoring weights based on output quality
19. Refine LLM prompts for recommendation tone
