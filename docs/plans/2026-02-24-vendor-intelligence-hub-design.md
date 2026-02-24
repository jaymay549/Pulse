# Vendor Intelligence Hub Design

## Problem

CDG Pulse currently surfaces raw dealer quotes as the primary product offering. This puts the burden on users to read dozens of quotes and draw their own conclusions. The data is rich — pricing mentions, implementation stories, switching narratives — but it's presented as a flat feed. The product should synthesize intelligence from quotes, not just display them.

## Key Constraints

- **Vendors are the primary customers.** The product must not rank, score against, or create adversarial dynamics between vendors. No leaderboards. No head-to-head comparisons that declare winners.
- **Dealers generate the data.** The dealer experience must be useful enough to keep them contributing and engaging, but vendor revenue is the business.
- **Compete with 20 Groups.** The real alternative is expensive, exclusive peer groups. CDG Pulse wins by being always-on, accessible, and personalized.

## Core Concept

Shift from **quote feed** to **vendor intelligence profiles**. Quotes become supporting evidence for synthesized insights, not the headline. The same data serves two audiences:

- **Dealers** see research pages that help them evaluate vendors
- **Vendors** see reputation dashboards that help them understand and respond to dealer sentiment

## Design

### 1. Vendor Profile Page (Redesigned)

#### Vendor Header
No change — logo, name, website, category, claim button.

#### Vendor Pulse Summary
AI-synthesized narrative at the top of every profile (minimum 5 mentions required):

> "Based on 47 dealer mentions, [Vendor] is recognized for strong reporting capabilities and data transparency. Dealers frequently cite the custom dashboard builder as a standout feature. The most common friction points are onboarding timelines (3-6 months reported) and limited after-hours support. In the DMS category, dealers are primarily looking for seamless integration with their existing tools, responsive support, and transparent pricing — [Vendor] aligns well on the first but has room to grow on the latter two."

Two parts:
1. What dealers say about this vendor — synthesized from their specific feedback
2. What dealers want in this category — synthesized from all feedback across the category, giving context for how this vendor fits the broader market need

#### Dealer Satisfaction Dimensions
Dimensional breakdowns extracted from quotes (not a single score — feedback the vendor can act on):

| Dimension | Sentiment | Based on |
|-----------|-----------|----------|
| Product Quality | Mostly positive | 47 mentions |
| Customer Support | Mixed | 32 mentions |
| Pricing / Value | Mostly positive | 28 mentions |
| Implementation | Needs attention | 19 mentions |
| Integrations | Mostly positive | 14 mentions |

Positioned as "what dealers are saying about [dimension]" — not ratings or judgments.

#### "Dealers Like You" Panel
Filter bar that re-calculates all insights for a dealer segment:

- All Dealers | Small (1-3 stores) | Mid-size (4-15 stores) | Large (15+) | Your Region

When filtered, scores, themes, and summaries recalculate for that segment. Only shows for segments with 5+ data points.

#### Key Themes (Upgraded)
Presented as synthesized insight paragraphs, not just labels:

- **What dealers praise:** Multi-sentence summary of positive themes with specifics
- **What dealers warn about:** Multi-sentence summary of concerns with specifics

#### Pricing Intelligence
Anonymized, aggregated pricing from dealer mentions:
- Reported range, most common price point, contract terms
- Labeled with sample size ("Based on 14 dealer-reported data points")

#### Switching Intel
- How many dealers switched TO this vendor (and from where)
- How many dealers switched FROM this vendor (and to where)
- Net switching trend (positive/negative/stable)
- No comparison to specific competitors — just flow data

#### Supporting Quotes
Raw quotes live below the fold as "What dealers are saying" — evidence backing the synthesized insights. Not the headline.

### 2. Category Pages (Redesigned)

No leaderboards. No rankings. Categories become **landscape overviews**.

#### Category Summary
AI-synthesized paragraph on what dealers in this category are talking about — key trends, common pain points, what dealers are looking for. Category-level, not vendor-specific.

#### Vendor Directory
Alphabetical or mention-count-sorted grid of vendors in the category. Each card shows:
- Vendor name, logo, tagline
- Mention count
- "View Profile" link

No scores on the grid. No ranking indicators. Discovery, not judgment.

#### Category Themes
"Top topics dealers discuss about [category] tools" — category-level themes like "integration complexity," "reporting capabilities," "onboarding timelines."

### 3. Dealer Onboarding (Minimal)

One screen, three questions on first visit or sign-up:

1. How many rooftops do you operate? (1-3 / 4-15 / 15+)
2. What region? (Northeast / Southeast / Midwest / Southwest / West / Canada)
3. What are you shopping for? (multi-select from categories — optional)

Powers "Dealers Like You" filtering. Skippable — defaults to "All Dealers."

### 4. Vendor Dashboard (What Vendors Pay For)

When a vendor logs in, they see their profile as a business intelligence dashboard:

- **Sentiment over time:** Positive mention rate trending by quarter/month
- **Dimensional feedback:** Which dimensions are trending up/down, with the mentions driving the trend
- **Dealer segment breakdown:** How different dealer sizes/regions perceive them
- **Theme alerts:** Emerging themes — "3 dealers mentioned integration issues with [tool] this month"
- **Co-occurrence data:** "You were mentioned alongside Vendor X in 12 conversations" — not who's better, just awareness
- **Response management:** Respond to themes and individual quotes, track response visibility

#### Future Vendor Upsells
- Custom quarterly PDF intelligence briefings
- Real-time alert notifications (email/Slack) for new mentions
- Audience insights (what dealers research before/after viewing your profile)
- Enhanced profile branding and case study hosting

### 5. Data Extraction Pipeline Changes

Current extraction: vendor name, quote text, positive/warning/insight type.

New extraction adds:
- **Dimension tags:** Which dimensions does this quote address (support, pricing, implementation, integrations, product quality)
- **Dealership size:** If mentioned in the conversation
- **Pricing data:** Dollar amounts, contract terms, per-unit costs
- **Switching signals:** "Switched from X" / "leaving Y" / "moved to Z"
- **Sentiment score:** Per-dimension sentiment (positive/mixed/negative)

Runs on new incoming messages and backfilled against existing quotes.

### 6. Minimum Threshold Rule

No synthesized insights until a vendor has at least 5 feedbacks:

| Feature | Below 5 mentions | 5+ mentions |
|---------|-------------------|-------------|
| Vendor Pulse Summary | Hidden | Shown |
| Dimensional scores | Hidden | Shown |
| Pricing intelligence | Hidden | Shown |
| Theme clusters | Hidden | Shown |
| Switching intel | Hidden | Shown |
| "Dealers Like You" filtering | Hidden | Shown (per-segment threshold also applies) |
| Raw quotes | Shown | Shown |
| Vendor response capability | Available | Available |

Below threshold, the profile shows: vendor info, existing quotes, and a note: "More insights will appear as dealer feedback grows."

The 5-mention threshold also applies per segment — if only 2 mid-size dealers mentioned a vendor, the "Dealers Like You" panel won't show synthesized data for mid-size. Falls back to "All Dealers."

### 7. What Stays, What Changes, What's New

| Element | Status | Details |
|---------|--------|---------|
| Quote feed | Demoted | Moves below the fold as supporting evidence |
| Vendor profiles | Upgraded | Becomes intelligence scorecards with pulse summary |
| Category grid | Upgraded | Becomes category landscape overviews (no rankings) |
| AI Chat | Stays | Enhanced with structured data for better answers |
| Theme clusters | Upgraded | Becomes synthesized insight paragraphs |
| Pricing tiers | Stays | Free users see basic info, Pro sees dimensional breakdowns and "dealers like you" |
| Search | Stays | Same smart search |
| Share/quote cards | Stays | Still useful for social sharing |
| Vendor responses | Upgraded | Can respond to themes, not just individual quotes |

### 8. Access Control by Tier

| Feature | Free Dealer | Pro Dealer | Vendor Pro |
|---------|-------------|------------|------------|
| Vendor Pulse Summary | Truncated preview | Full | Full (own profile) |
| Dimensional insights | Hidden | Full | Full (own profile) |
| "Dealers Like You" | Hidden | Full | N/A |
| Pricing intelligence | Hidden | Full | Full (own profile) |
| Switching intel | Hidden | Full | Full (own profile) |
| Category landscapes | Basic | Full | N/A |
| AI Chat | Hidden | Full | N/A |
| Raw quotes | 5 max, redacted | Full | Full (own profile) |
| Theme responses | N/A | N/A | Full |
| Sentiment dashboard | N/A | N/A | Full |
