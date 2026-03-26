# CDG Pulse — Master Plan

**Date:** 2026-03-26
**Vision:** Transform CDG Pulse from a reputation monitoring tool into the Bloomberg of automotive retail technology.
**Year 1 Target:** $1.85M ARR (90 vendor subscriptions at founding rates)

---

# 1. THE OPPORTUNITY

CDG Pulse is the only platform in automotive retail where a vendor can see what dealers say about them in private — before it becomes churn, before it becomes a lost deal, before a competitor finds out first.

600+ vendors are being discussed across CDG's private dealer communities. 2,466+ structured mentions across 19 categories. Five dimensions of analysis. And not a single vendor can see any of it unless they pay us.

Every vendor in this space spends $50K-$500K/year on trade shows, sponsorships, and advertising hoping to influence dealers. We're offering the actual conversation — what dealers say when no vendor is in the room.

---

# 2. CURRENT STATE — DATA AUDIT (March 2026)

### What We Have

| Metric | Count |
|--------|-------|
| Total unique vendors discussed | 619 |
| Total structured mentions | 2,466+ |
| Vendors with metadata | 576 |
| Vendors with 5+ mentions (sellable) | 96 |
| Vendors with 10+ mentions | 44 |
| Vendors with 20+ mentions (deep data) | 15 |
| Vendor categories | 19 |
| Vendor profiles claimed | 4 |
| Categories with benchmarks | 5 of 21 |

### Top 15 Vendors by Mention Volume

| Vendor | Mentions | Category |
|--------|----------|----------|
| Cox Automotive | 250 (336 with product lines) | DMS/Multi |
| Tekion | 88 | DMS |
| DriveCentric | 86 | CRM |
| CDK | 69 (98 with product lines) | DMS |
| Reynolds & Reynolds | 59 (87 with product lines) | DMS |
| vAuto | 53 | Inventory |
| Numa | 50 | AI/Automation |
| VinCue | 43 | Inventory |
| CarGurus | 38 | Inventory/Marketplace |
| Podium | 37 | Marketing/Communication |
| Elead | 29 | CRM |
| Retail Management System | 28 | DMS |
| CallRevu | 25 | Call Management |
| Dynatron | 25 | Fixed Ops |
| WarrCloud | 23 | Fixed Ops |

### Critical Gaps

| Gap | Impact | Effort |
|-----|--------|--------|
| **Metric scores are all null** | Cannot demo vendor dashboard — Tier 2/3 dead on arrival | Medium |
| **271 vendors miscategorized** ("other"/"unknown") | Category intelligence story collapses | Medium |
| **Only 96 vendors at 5+ mentions** | 90-vendor target requires 94% conversion on sellable pool | High |
| **No vendor subscription/tier tracking** | Can't manage who's paying what | Low |
| **Sales Targets RPC not built** | Sales team has no tool to identify targets | Medium |

---

# 3. DATA STRATEGY — THREE CONVERGING STREAMS

### Stream 1: WhatsApp Groups (Owned — The Moat)
- CDG owns all groups — this is the competitive advantage nobody can replicate
- AI extraction pipeline running (Gemini): messages → structured mentions with sentiment, NPS tiers, dimensional analysis
- 5 dimensions: product stability, customer experience, value perception, integration quality, adoption
- Expanding group coverage over time

### Stream 2: Dealer Tech Stacks (Submitted)
- Dealers self-report their technology stack
- Segmented by dealer type: independent / multi-store / large group
- Creates co-occurrence maps (which vendors are paired together)
- Foundation for integration intelligence and stickiness scoring
- Surface: "72% of large groups use CDK, but only 31% of independents do"

### Stream 3: Public Source Monitoring (New)
- DealerRefresh forums, Reddit (r/askcarsales, r/cardealership)
- G2/Capterra reviews (structured sentiment for benchmarking)
- Job postings (signals of tech adoption and switching)
- Vendor press releases and integration partner pages
- Prioritize sources that reinforce categories where WhatsApp data is deepest

### Recency Weighting Model

Third-party data is valuable but not equal to proprietary WhatsApp data. Weight it accordingly.

**Source Weights:**

| Source | Base Weight | Rationale |
|--------|------------|-----------|
| WhatsApp (CDG groups) | 1.0 | Private, current, highest signal quality |
| DealerRefresh | 0.7 | Industry-specific, public but high quality |
| G2/Capterra | 0.6 | Structured reviews, but potentially gamed |
| Reddit | 0.5 | Public, mixed quality, less dealer-specific |
| Job postings | 0.3 | Indirect signal (adoption proxy) |
| Press releases | 0.2 | Vendor-controlled narrative |

**Recency Decay (multiplier on top of source weight):**

| Age | Multiplier |
|-----|-----------|
| < 30 days | 1.0 |
| 30-90 days | 0.8 |
| 3-6 months | 0.5 |
| 6-12 months | 0.3 |
| > 12 months | 0.1 |

**Effective weight = source_weight x recency_multiplier**

Examples:
- WhatsApp mention from last week = 1.0 x 1.0 = **1.0**
- G2 review from 2 months ago = 0.6 x 0.8 = **0.48**
- Reddit post from 8 months ago = 0.5 x 0.3 = **0.15**

### Mention Growth Targets

| Timeframe | WhatsApp/Month | Third-Party/Month | Total | Vendors at 5+ |
|-----------|---------------|-------------------|-------|---------------|
| Now | ~200 | 0 | 200 | 96 |
| Month 2 (manual sprint) | ~200 | +500 (one-time) | 700 | ~150 |
| Month 3 (scrapers running) | ~200 | ~200 | 400 | ~170 |
| Month 6 | ~300 | ~300 | 600 | ~200+ |

**Target:** 200+ vendors at 5+ weighted mentions by month 3 — a 2:1 ratio of sellable vendors to sales targets.

---

# 4. TIER STRUCTURE

| Tier | Name | Annual Price | Founding Price | Positioning | Tagline |
|------|------|-------------|----------------|-------------|---------|
| 1 | Verified Vendor | $18K/year | $12K/year | Credential + participation | "Get Verified" |
| 2 | Growth Vendor | $37K/year | $25K/year | Outcomes + lead gen | "Get Discovered" |
| 3 | Intelligence Vendor | $75K/year | $50K/year | Deep data + strategic intelligence | "Get Intelligence" |

### Tier Philosophy

- **Tier 1 is NOT a product.** It's a credential and a taste. If a vendor can take action and close business from it, it belongs in Tier 2+.
- **Tier 2 gates distribution.** Leads, exposure, and data = Tier 2+. That's the leverage.
- **Tier 3 is the moat.** Competitive benchmarking, integration intelligence, predictive signals, and API access make it irreplaceable.

### Product Naming

- **Pulse Snapshot** — Tier 1 (directional signals only)
- **Pulse Insights** — Tier 2 (actionable intelligence + lead gen)
- **Pulse Intelligence** — Tier 3 (full data layer + strategic advisory)

### Tier 1: Verified Vendor — "Get Verified"

**What they get:**
- Verified badge on CDG Pulse profile
- Ability to respond to reviews/sentiment publicly
- Company profile (website link, description)
- Inclusion in vendor directory (no prioritization)
- **Pulse Snapshot:** High-level sentiment (Positive/Neutral/Negative), trend arrow, profile views this month, top concerns in their category (aggregated, no breakdowns)

**What they DON'T get:**
- No leads
- No boosted placement
- No data insights or benchmarking
- No targeting or segmentation
- No integrations or API access

**The psychology:** Tier 1 should make vendors think: "I can see something here, but I can't actually do much with it." That validates the data exists and creates curiosity.

**Language to use:** "Snapshot," "High-level trends," "Early signals," "Directional only"
**Language to avoid:** "Full access," "Early access to everything," "Complete intelligence"

### Tier 2: Growth Vendor — "Get Discovered"

**Everything in Tier 1, plus:**
- Priority placement in relevant categories
- Dealer intent signals ("3 dealers in the Southeast discussed evaluating your category this week" — no names, just volume/region/segment)
- Lead capture (dealers can request demo/intro, CDG brokers the connection)
- CDG Circles Workshop participation (lead gen lever)
- Analytics dashboard: profile views over time, engagement, sentiment trends, category ranking
- Top 3 most common integration partners (teaser)

**ROI story:** "If this generates 2 qualified leads per month and you close 1, you've paid for the entire year in one deal."

### Tier 3: Intelligence Vendor — "Get Intelligence"

**Everything in Tier 2, plus:**
- Competitive benchmarking: head-to-head scores against named competitors across all 5 dimensions
- Segment-level positioning: "You're winning with independents but losing large groups to Competitor X"
- Win/loss signals: switching language detection, migration flows (Vendor A → Vendor B patterns)
- Integration intelligence: ecosystem mapping, stickiness scoring, integration gap detection
- Market trends: quarterly "State of the Category" reports
- Custom strategy sessions: quarterly walkthrough of their data with recommendations
- API & data feeds: JSON endpoints for scores, mentions, trends, benchmarks
- Featured placement across CDG ecosystem (Pulse, newsletter, events)

**ROI story:** "If this prevents one enterprise deal from churning, it pays for 3 years of this subscription."

### Tier Distribution for Integration Data
- Tier 1: Nothing
- Tier 2: "Your top 3 most common integration partners" (teaser)
- Tier 3: Full ecosystem map, stickiness scores, integration sentiment, gap detection

---

# 5. SALES PLAYBOOK

*Hand this section to the head of sales.*

## Who to Target First

**Rule: Sell where the data is thickest.**

### Tier 3 Priority Targets (15 vendors with 20+ mentions)

| Vendor | Mentions | Why they'll buy |
|--------|----------|-----------------|
| Cox Automotive | 250 | Market leader, needs to monitor threats. 336 total with product lines (vAuto, VinSolutions, Dealertrack, Xtime, AutoTrader) |
| Tekion | 88 | Disruptor, needs to prove momentum to the market |
| DriveCentric | 86 | Growing fast, needs competitive positioning |
| CDK | 69 | Incumbent under pressure, needs early warning on churn |
| Reynolds & Reynolds | 59 | Incumbent — needs to know where they're losing |
| vAuto | 53 | Category leader in inventory, wants to protect position |
| Numa | 50 | AI player, needs validation from the dealer community |
| VinCue | 43 | Challenger brand, wants to know how they stack up |
| CarGurus | 38 | Marketplace player expanding into dealer tools |
| Podium | 37 | Communication platform, competing in crowded space |
| Elead | 29 | CRM under CDK umbrella, identity question |
| Retail Management System | 28 | Reynolds product line, niche but deep data |
| CallRevu | 25 | Call management leader, defensible category |
| Dynatron | 25 | Fixed ops, needs to see dealer sentiment |
| WarrCloud | 23 | Fixed ops, emerging player |

### Tier 2 Priority Targets
The next ~80 vendors with 5-19 mentions. Sort by mention count descending and work the list. Focus on vendors in categories where category benchmarks already exist (inventory, marketing, fixed-ops, ai-automation, training).

### Tier 1 Priority Targets
Everyone else with 5+ mentions. Also: vendors you KNOW are in the space but don't have enough organic mentions yet — third-party data will fill them in.

## How to Sell Each Tier

### The Tier 1 Pitch (60 seconds)
"Dealers in our private communities are already talking about [Vendor]. We've captured [X] structured mentions across [dimensions]. Right now, you can't see any of it. For $12K/year as a founding partner, you get a verified profile, the ability to respond publicly, and a Pulse Snapshot that shows you the high-level direction. This is the founding rate — it goes to $18K when we exit beta."

**Close:** "This is a seat at the table. Would you rather find out what dealers think from us, or from your competitor who signed up first?"

### The Tier 1 → Tier 2 Upsell (after 30-60 days on Tier 1)
"You've been seeing the Snapshot — the directional signals. But I know you've been wanting more. We just launched Pulse Insights. You'd get dealer intent alerts when someone in your category is shopping, lead capture so dealers can request a demo directly through your profile, and priority placement when dealers browse your category. Your Snapshot shows [X trend] — wouldn't you want to know which dealers are behind that signal?"

### The Tier 3 Pitch (for large vendors)
"You spend $[X] on NADA, $[X] on Digital Dealer, $[X] on marketing — all to influence dealers. What if you could see exactly what they say when you're not in the room? CDG Pulse Intelligence gives you head-to-head competitive benchmarking across five dimensions, segment-level positioning so you know where you're winning and losing by dealer type, switching signals so you can intervene before a customer churns, and integration intelligence so you know which partnerships are keeping dealers loyal. We deliver a quarterly strategy session where we walk your team through the data. This is the information your competitors would kill for."

**Close:** "The question isn't whether this data is valuable. It's whether you want to see it before your competitor does."

## Objection Handling

### "How do you get this data?"
"CDG runs the largest private dealer community network in automotive retail. Thousands of dealers discuss their technology stack, vendor experiences, and buying decisions in our WhatsApp groups every day. We use AI to extract structured insights from those conversations — no dealer is identified, everything is aggregated. We also monitor public forums, review sites, and industry sources to ensure comprehensive coverage."

### "How many dealers are we talking about?"
"Our community includes [X] dealers across [X] WhatsApp groups, plus we monitor major public forums like DealerRefresh and review platforms. The data represents independent dealers, multi-store operations, and large groups — and we segment insights by those categories so you can see how different dealer types perceive you."

### "Why should I trust this data?"
"This isn't survey data where people say what they think you want to hear. These are private conversations between dealers — the most honest feedback you'll ever get. We process it through AI with human review, and we score across five specific dimensions so you can see exactly where you're strong and where you need work."

### "$50K is a lot for data."
"You spent more than that on your NADA booth. This tells you what dealers said about you at NADA after you left. One prevented churn on an enterprise account pays for three years of this."

### "We already monitor our reviews."
"You're monitoring what dealers say publicly, when they know you're watching. We're showing you what they say privately, when they don't. That's a completely different conversation."

### "Can I see a demo?"
"Absolutely. I'll show you your Pulse profile with your current sentiment data, and you'll see exactly what dealers are saying. Just know — once you see it, you'll want to keep seeing it."

## Sales Process

1. **Identify** — Use the Sales Targets tool in admin to sort vendors by Pain Score, Buzz Score, and mention volume
2. **Research** — Expand the vendor row to see the AI synopsis and pitch angle
3. **Outreach** — Lead with a specific insight: "Dealers in [category] mentioned you [X] times this month, with [sentiment]. Want to see what they're saying?"
4. **Demo** — Show their actual profile page with real data. Let the data sell.
5. **Close Tier 1** — Founding rate urgency. "This rate is only available during beta."
6. **Nurture** — Monthly check-in showing their Pulse Snapshot trends
7. **Upsell Tier 2** — After 30-60 days: "Your Snapshot shows [signal]. Wouldn't you want to see who's behind it?"
8. **Upsell Tier 3** — After they've seen Tier 2 value: "Ready to see how you compare to [Competitor]?"

## Key Numbers to Know

- **619** total vendors discussed in CDG communities
- **2,466+** structured mentions with sentiment and dimensional analysis
- **96** vendors with 5+ mentions (sellable today, growing to 200+ with third-party data)
- **15** vendors with 20+ mentions (deep intelligence candidates)
- **19** vendor categories tracked
- **5** dimensions: product stability, customer experience, value perception, integration quality, adoption
- **3** dealer segments: independent, multi-store, large group

---

# 6. IMPLEMENTATION PLAN — 8-WEEK SPRINT

*For product/engineering. What to build and in what order to start selling.*

## Phase 0: Emergency Fixes (Week 1-2)

**Goal:** Make the existing product demoable. Nothing else matters if you can't show a vendor their dashboard.

### 0.1 — Fix Metric Score Computation
- Diagnose why `vendor_metric_scores` has all null values
- The `refresh_vendor_metrics` cron exists but appears to produce no scores
- Likely issue: scoring requires mentions with proper NPS tiers and dimensional data — check if those fields are populated
- Fix the computation, manually trigger a refresh, verify scores appear on the vendor dashboard
- **Success criteria:** Top 15 vendors by mention count all have health scores, product stability, CX, and value perception scores

### 0.2 — Category Cleanup
- 271 vendors are categorized as "other" or "unknown" in `vendor_metadata`
- Run an AI-assisted bulk recategorization:
  - Pull all vendors with category = "other" or NULL
  - For each, send vendor name + their mention text samples to Gemini
  - Map to one of the 19 existing categories
  - Bulk update `vendor_metadata`
- **Success criteria:** <20 vendors remain in "other/unknown" and every category with 4+ vendors has benchmark data

### 0.3 — Category Benchmark Refresh
- After recategorization, re-run category benchmark computation
- Currently only 5 of 21 categories have qualifying vendors — this should jump to 10+
- **Success criteria:** At least 10 categories have non-null benchmarks with qualifying_vendor_count >= 2

---

## Phase 1: Data Enrichment (Week 2-4)

**Goal:** Get the sellable vendor pool above 150 at 5+ mentions so the 90-vendor target has breathing room.

### 1.1 — Manual Enrichment Sprint (Top 100 vendors)
- For each of the top 100 vendors by existing mention count:
  - Pull G2 reviews (scrape or API)
  - Pull Capterra reviews
  - Search DealerRefresh for vendor name
  - Search Reddit (r/askcarsales, r/cardealership) for vendor name
- Feed results through the existing Gemini extraction pipeline
- Store as `vendor_mentions` with a `source` field to distinguish from WhatsApp
- Apply recency weighting per the model in Section 3
- **Success criteria:** 150+ vendors at 5+ weighted mentions

### 1.2 — Automated Scraping Pipeline
- Build scrapers for the top 3 sources (DealerRefresh, Reddit, G2)
- Run on cron (daily or weekly depending on source volume)
- Same extraction → weighting → storage flow as manual sprint
- Dedup against existing mentions (same vendor + same source + similar content = skip)
- **Success criteria:** Pipeline runs unattended, adds 50+ new mentions/week

### 1.3 — Source Tracking Schema
- Add to `vendor_mentions`:
  - `source` (TEXT): 'whatsapp', 'g2', 'capterra', 'dealerrefresh', 'reddit', 'manual'
  - `source_url` (TEXT): Original URL for third-party mentions
  - `source_date` (TIMESTAMP): Original publication date (vs. our `created_at`)
  - `source_weight` (NUMERIC): Computed weight based on source type + recency
- Update all existing mentions: `source = 'whatsapp'`, `source_weight = 1.0`
- Update metric computation RPCs to use weighted mentions

---

## Phase 2: Sales Infrastructure (Week 3-5)

**Goal:** Give the sales team the tools to identify, prioritize, and pitch vendors.

### 2.1 — Vendor Tier Tracking
- Add `subscription_tier` field to `vendor_profiles` (or create `vendor_subscriptions` table)
- Values: NULL (prospect), 'tier_1', 'tier_2', 'tier_3'
- Add `subscription_start_date`, `subscription_end_date`, `is_founding_rate` (BOOLEAN)
- Surface in admin panel for tracking

### 2.2 — Sales Targets RPC
- Implement `get_sales_opportunity_signals()` per the existing spec
- Add `source_breakdown` to the return: how many mentions are WhatsApp vs. third-party
- This feeds the Sales Targets tab in admin

### 2.3 — Sales Targets UI
- Build the Sales Targets tab per spec (table with Pain/Buzz/Gap scores, expandable rows with dealer drill-down and AI synopsis)
- This is the sales team's daily workbench

### 2.4 — Tier-Gated Vendor Dashboard
- Gate dashboard features by vendor subscription tier:
  - Tier 1: Pulse Snapshot only (sentiment direction, view count, top concerns)
  - Tier 2: Full analytics dashboard + intent signals + lead capture
  - Tier 3: Everything — competitive benchmarking, integration intelligence, API access
- Currently the dashboard shows everything to everyone — add tier checks

---

## Phase 3: Product Depth (Week 5-8)

**Goal:** Make Tier 2 and Tier 3 undeniably valuable.

### 3.1 — Dealer Intent Signal Pipeline
- Flag WhatsApp messages with switching/evaluation language
- Tag by category, region, dealer segment
- Build alert system for Tier 2 vendors
- No dealer identities — aggregated signals only

### 3.2 — Lead Capture Flow
- "Request Demo" button on vendor profiles
- Dealer submits interest → CDG brokers connection → vendor receives lead
- Track in `vendor_demo_requests` (table already exists)
- Basic conversion metrics for renewal conversations

### 3.3 — Priority Placement
- Tier 2+ vendors rank higher in category browsing/search
- Simple sort weight in the vendor list query

### 3.4 — Competitive Benchmarking (Tier 3)
- Head-to-head comparison view: vendor vs. named competitors across 5 dimensions
- Requires working metric scores (Phase 0) and proper categorization (Phase 0)
- Segment-level overlay: scores by independent / multi-store / large group

### 3.5 — Integration Intelligence (Tier 3)
- Build co-occurrence maps from tech stack data
- Tag integration-pair mentions in WhatsApp conversations
- Stickiness scoring: which integration partners correlate with low switching signals
- Integration gap detection: "I wish X worked with Y" signal extraction

---

# 7. STRATEGIC ROADMAP — 6/12/18 MONTHS

*Beyond the 8-week sprint. Where the product goes to justify growing revenue and expanding the business.*

## Months 1-6: "Make Tier 2 Real, Deepen the Data"

**Goal:** Get Tier 2 to a state where vendors see immediate ROI. Establish the public data pipeline.

**Product:**
- Dealer intent signals live for Tier 2 vendors
- Lead capture flow operational with conversion tracking
- Priority placement in category browsing
- Analytics dashboard polished (VP of Marketing opens it weekly)
- Tech stack collection formalized as first-class data product, segmented by independent / multi-store / large group

**Data:**
- Automated scraping pipeline running on 3+ sources
- 200+ vendors at 5+ weighted mentions
- Category assignments cleaned, 10+ categories with qualifying benchmarks
- Entity resolution expanded beyond the initial 3 vendor families

**Tier 1 (Pulse Snapshot) — Keep Intentionally Limited:**
- High-level sentiment: Positive / Neutral / Negative with trend arrow
- "X dealers viewed your profile this month" (no identities)
- Aggregated top concerns in category (no breakdowns)
- Explicit: "Detailed insights and dealer-level intelligence are available in higher tiers"

---

## Months 6-12: "Make Tier 3 Worth $50K"

**Goal:** Cross from "vendor review site" into "market intelligence platform." The Bloomberg transition.

### Competitive Benchmarking (Tier 3 Anchor)
- **Head-to-head comparisons:** Not just "you're at 72" but "you're at 72, your top competitor is at 81, and here's the dimension where they're beating you." Single highest-value screen in the product.
- **Segment-level competitive positioning:** "You're winning with independents but losing large groups to Competitor X." Combined with tech stack segmentation: shows exactly where market share is strong vs. eroding.
- **Win/loss signals:** Mine conversations and public sources for switching language. Track directional flows: Vendor A → Vendor B migration patterns. "In Q1, we detected 12 dealers discussing switching away from you, primarily citing integration issues."

### Integration Intelligence
- **Ecosystem mapping:** Co-occurrence maps from tech stack data showing which vendors are commonly paired. Identify "sticky" stacks (low switching discussion) vs. fragile stacks (high switching discussion).
- **Integration sentiment:** Tag which specific vendor pairing is being discussed. "CDK + VinSolutions integration is broken" vs. generic "CDK has integration complaints."
- **Stickiness scoring:** "Your customers who integrate with Vendor B have 3x lower churn signals." Tells vendors exactly which integration partnerships to invest in and which to fix.
- **Integration gap detection:** Surface "I wish X worked with Y" signals. Ranked list of most-requested integrations a vendor doesn't have — product roadmap signal and partnership opportunity.

### Market Trends & Custom Reports
- **Quarterly market reports:** Automated but curated. "The State of DMS in Q3 2026." Tier 3: included. Non-subscribers: sell standalone for $5K-$15K per report.
- **Custom strategy sessions:** Once a quarter, walk Tier 3 vendor through their data. Services layer, not product feature — low engineering cost, high stickiness. Vendors build strategy around your data = they never cancel.

### API & Data Feeds
- JSON endpoints for scores, mentions, trends, benchmarks
- Start simple, expand based on actual requests
- Goal is lock-in: once their team builds workflows around your data, they won't leave

---

## Months 12-18: "Become the Platform They Can't Operate Without"

**Goal:** Move from "intelligence product" to "infrastructure layer the automotive tech ecosystem runs on." Stop competing with G2. Start competing with nobody.

### Predictive Intelligence
- **Churn prediction:** 12+ months of sentiment data, switching signals, integration pain, tech stack snapshots. Model tells Tier 3 vendors: "These 8 dealer segments have a high probability of switching away from you in the next 6 months, and here's why." Transition from analytics (what happened) to intelligence (what's about to happen).
- **Market movement alerts:** Real-time notifications on sentiment shifts. "Negative sentiment around your integration quality spiked 40% this week, driven by 5 conversations about your API downtime." Early warning system.
- **Category disruption scoring:** Track when new vendors get mentioned with increasing frequency and positive sentiment. Alert incumbents: "Emerging vendor X mentioned 15 times this month, up from 2 last quarter, 80% positive." Incumbents pay serious money to not be blindsided.

### The Data Marketplace
- **Syndicated research reports:** Quarterly and annual "State of the Category" reports sold to anyone — OEMs, private equity, consulting firms, dealer groups. $5K-$15K per report, pure margin.
- **OEM & dealer group partnerships:** OEMs (Toyota, Ford, GM) care about what software their dealers run. Large OEMs: six-figure annual feeds. Dealer groups (50+ rooftops): stack optimization recommendations across their portfolio.
- **M&A and investment intelligence:** PE is pouring money into auto retail tech. "Vendor X sentiment declined 30% over 12 months while Vendor Y surges" = due diligence data. Packaging exercise, not a major product build.

### Platform Ecosystem
- **Vendor-to-vendor integration marketplace:** Data on which integrations work well → become the matchmaker. Revenue via placement fees or referral cuts.
- **Certified stack recommendations:** "CDG Pulse Recommended Stacks" by dealer segment. Vendors compete to be on the list — monetize through Tier 3 perks or separately.
- **Annual benchmarking event:** "CDG Pulse Vendor Awards" backed by real data (not pay-to-play). Categories: Best CX Score, Fastest Rising Vendor, Best Integration Ecosystem. Cements CDG as the authority.

---

# 8. REVENUE MODEL

## Subscription Revenue — Year 1 (Founding Rates)

| Tier | Price | Target Vendors | ARR Contribution |
|------|-------|----------------|------------------|
| Verified (Tier 1) | $12K | 50 | $600K |
| Growth (Tier 2) | $25K | 30 | $750K |
| Intelligence (Tier 3) | $50K | 10 | $500K |
| **Total** | | **90** | **$1.85M** |

## Revenue Ramp

| Month | Tier 1 | Tier 2 | Tier 3 | Running ARR |
|-------|--------|--------|--------|-------------|
| 1-2 | 5 | 0 | 0 | $60K |
| 3-4 | 15 | 3 | 0 | $255K |
| 5-6 | 25 | 8 | 1 | $550K |
| 7-9 | 35 | 15 | 3 | $945K |
| 10-12 | 50 | 30 | 10 | $1.85M |

Assumes:
- Phase 0 complete by week 2 (demoable product)
- Phase 1 complete by week 4 (150+ sellable vendors)
- Sales team active from month 1 on Tier 1, month 3 on Tier 2, month 6 on Tier 3
- Tier 3 requires competitive benchmarking + integration intelligence (months 6-12 roadmap)

## Data Products (Phase 2+ of Strategic Roadmap)

| Product | Price | Buyer |
|---------|-------|-------|
| Quarterly Category Reports | $5K-$15K each | PE, OEMs, consultants |
| OEM Data Feeds | $100K-$250K/year | Major OEMs |
| Dealer Group Optimization | $25K-$50K/year | Large dealer groups |
| M&A Due Diligence Packages | $10K-$25K per engagement | PE firms, acquirers |

## Platform Revenue (Phase 3 of Strategic Roadmap)

| Product | Model |
|---------|-------|
| Integration Marketplace | Placement fees / referral cuts |
| Certified Stack Placement | Annual sponsorship |
| Benchmarking Event | Sponsorship + attendance |
| Awards Program | Vendor marketing licensing |

---

# 9. GO-TO-MARKET SEQUENCE

**Sell where the data is thickest.** Don't go broad — pick the 2-3 vendor categories where mention volume is highest and sell into those first.

1. **Week 1-2:** Fix metrics and categories (Phase 0). Product is not demoable until this is done.
2. **Week 2-4:** Manual data enrichment sprint + start scraping pipeline (Phase 1). Expand sellable pool to 150+.
3. **Month 1-2:** Close 5 Tier 1 (Verified) vendors in deepest categories. Use founding rate urgency.
4. **Month 2-4:** Build Tier 2 features (intent signals, lead capture, priority placement). Demo to Tier 1 vendors as upsell preview.
5. **Month 3-4:** Close 10 more Tier 1, upgrade first Tier 2 vendors.
6. **Month 4-6:** Upgrade Tier 1 → Tier 2. Close new Tier 2 vendors directly. 25 Tier 1 + 8 Tier 2 + 1 Tier 3 = $550K ARR.
7. **Month 6-9:** Launch competitive benchmarking and integration intelligence. Pitch Tier 3 to the largest vendors.
8. **Month 9-12:** First quarterly market reports. Test syndicated report sales. Push to $1.85M ARR.
9. **Month 12-18:** OEM conversations, PE/M&A packaging, platform ecosystem buildout.

---

# 10. KEY PRINCIPLES

1. **You can't sell what you can't demo.** Fix metric scores and categories before anything else.
2. **5+ mentions is the floor.** Below that, the data doesn't look credible to a paying vendor.
3. **Tier 1 is the wedge, not the product.** Every Tier 1 sale should be a Tier 2 upsell in 60 days.
4. **Third-party data is fuel, not the engine.** WhatsApp is the moat. Third-party fills gaps and adds volume. Always weight WhatsApp higher.
5. **Sell where data is thickest.** Don't pitch a vendor with 5 mentions when you have one with 50. Work the list top-down.
6. **Gate distribution hard.** Leads, exposure, and data = Tier 2+. That's the leverage.
7. **Segment everything.** Independent / multi-store / large group segmentation makes every data point 3x more valuable.
8. **Integration intelligence is a differentiator.** Nobody else has dealer-reported integration pairing data with sentiment.
9. **Freshness = retention.** If the dashboard stops updating, vendors cancel. Data pipeline health is a revenue metric.
10. **Future-proof Tier 1.** Explicitly state: "Future features, data products, and distribution are not included in this tier."
11. **The CoStar/Bloomberg play is real** — but only if you become the authoritative data source, not just a review aggregator.
