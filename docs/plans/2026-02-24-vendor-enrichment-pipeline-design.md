# Vendor Enrichment Pipeline & Moderation Design

## Problem

Vendor profiles with few community mentions feel empty. Features like Vendor Pulse Summary and CDG Intelligence require 5+ dealer mentions to render anything useful. Additionally, those two components are redundant — both answer "what do dealers think about this vendor?" in slightly different formats.

Vendors are paying customers and need a way to dispute unfair feedback without having direct censorship power.

## Goals

1. Pull in external reviews (G2, Capterra, TrustRadius, Reddit, etc.), rewrite them into CDG Pulse voice, and display them alongside organic mentions with no source attribution
2. Give verified vendors a flag-and-review system for unfair mentions, with CDG admins as gatekeepers
3. Bootstrap thin/empty profiles with AI-generated overviews from public data, plus vendor self-reported content for claimed profiles
4. Consolidate CDG Intelligence and Vendor Pulse Summary into a single adaptive component

---

## Section 1: External Review Ingestion Pipeline

A new Supabase edge function (`ingest-external-reviews`) runs daily. For each vendor in `vendor_metadata`, it uses Firecrawl to scrape reviews from public sources — G2, Capterra, TrustRadius, Reddit, and Google Business reviews where applicable.

Raw reviews get queued into a new table:

```sql
CREATE TABLE external_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  source TEXT NOT NULL,                -- "g2", "capterra", "reddit", etc. (internal only)
  raw_text TEXT NOT NULL,
  raw_rating NUMERIC,                  -- original star rating if available
  source_date TIMESTAMPTZ,             -- when the original review was posted
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'transformed', 'rejected', 'duplicate')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

A second edge function (`transform-external-review`) picks up pending items and uses AI to:

1. Rewrite into CDG Pulse voice — short headline + anonymized dealer-style quote
2. Classify sentiment, dimension, and category using the same taxonomy as WhatsApp mentions
3. Deduplicate against existing mentions (fuzzy match on content)
4. Write the result into `vendor_mentions` with a new `source` column (`"community"` for WhatsApp, `"external"` for ingested) and `source_review_id` FK back to the queue

The `source` column is internal only — no UI ever exposes it.

---

## Section 2: Verified Vendor Moderation System

### Database

```sql
CREATE TABLE mention_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL,            -- FK to vendor_mentions
  vendor_profile_id UUID NOT NULL,     -- FK to vendor_profiles (who flagged)
  reason TEXT NOT NULL
    CHECK (reason IN ('inaccurate', 'unfair', 'outdated', 'spam', 'other')),
  note TEXT,                           -- vendor's explanation
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'upheld', 'dismissed')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Vendor-facing (Dashboard Mentions tab)

- Each mention gets a flag icon button
- Clicking opens a modal: pick a reason, write an optional note, submit
- Flagged mentions show a subtle "Under review" badge on the vendor's dashboard only — the public profile shows nothing different until an admin acts
- Vendors can see their flag history and outcomes

### Admin-facing (Admin dashboard)

- New "Flagged Mentions" queue alongside the existing mention approval queue
- Admin sees: the mention, the vendor's flag reason/note, mention source, and sentiment
- Three actions: **Uphold** (hides mention from public profile), **Dismiss** (flag rejected, mention stays), or **Edit** (admin rewrites the mention to be fairer, then dismisses the flag)
- Upheld mentions set `is_hidden = true` on `vendor_mentions` — filtered out of all public queries but retained in the database

### Guardrails

- Rate limit: verified vendors can flag up to 5 mentions per month
- Flagging does not affect AI summary generation — hidden mentions still feed into aggregate sentiment so vendors cannot game their score by hiding all negatives

---

## Section 3: Profile Bootstrapping Layer

### Tier 1: AI-Generated Overview (all vendors, automatic)

Extend the existing `vendor-enrich` edge function. After it scrapes website/LinkedIn data via Firecrawl, add a step that generates a structured "About" block:

```sql
ALTER TABLE vendor_metadata ADD COLUMN auto_summary TEXT;
ALTER TABLE vendor_metadata ADD COLUMN auto_products TEXT[];
ALTER TABLE vendor_metadata ADD COLUMN auto_segments TEXT[];
ALTER TABLE vendor_metadata ADD COLUMN auto_integrations TEXT[];
ALTER TABLE vendor_metadata ADD COLUMN auto_summary_generated_at TIMESTAMPTZ;
```

Runs for every vendor — claimed or not. The AI writes a neutral, factual overview based on public information. No sentiment, no opinions, just what the company does. Even a vendor with zero mentions has a useful profile page.

### Tier 2: Vendor Self-Reported Content (verified vendors only)

```sql
CREATE TABLE vendor_custom_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL UNIQUE,  -- FK to vendor_profiles
  vendor_name TEXT NOT NULL UNIQUE,
  highlights TEXT[],                        -- up to 5 product highlights
  customer_segments TEXT[],
  integration_partners TEXT[],
  custom_description TEXT,                  -- max 500 chars
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

On the public profile, self-reported content overrides auto-generated fields where present. Displayed in a section labeled "From the vendor" so dealers know the source. Auto-generated overview fills gaps where the vendor hasn't provided content.

---

## Section 4: Consolidated Intelligence Component

Replace `VendorPulseSummary` and `AIInsightBanner` (on the vendor profile page) with a single **Vendor Intelligence Card**.

### Three states based on data availability

**State 1 — Rich (5+ total mentions):**
- AI-generated narrative summary
- Sentiment indicator with trend direction
- Quick stats row: total mentions, positive %, top dimension

**State 2 — Thin (1-4 mentions):**
- Shorter AI summary working with limited data
- No trend — replaced with "Based on early feedback" label
- Stats row shows what's available

**State 3 — Empty (zero mentions):**
- Falls back to AI-generated overview from bootstrapping layer
- Shows auto-generated About block (products, segments, integrations)
- Subtle line: "Community insights will appear as dealer feedback grows"
- Verified vendors' self-reported content appears here too

### What gets removed

- `VendorPulseSummary.tsx` — deleted
- `AIInsightBanner.tsx` — removed from vendor profile page (kept on main vendors list page for category-level insights)
- `generate-vendor-pulse-summary` edge function — logic folded into new `generate-vendor-intelligence`
- `vendor_pulse_summaries` table — replaced by:

```sql
CREATE TABLE vendor_intelligence_cache (
  vendor_name TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('rich', 'thin', 'empty')),
  summary_text TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'mixed', 'neutral')),
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  top_dimension TEXT,
  stats JSONB,                          -- { total, positive, warnings, external_count }
  generated_at TIMESTAMPTZ DEFAULT now(),
  mention_count_at_generation INTEGER NOT NULL DEFAULT 0
);
```

---

## Section 5: Public Profile Layout

```
┌─────────────────────────────────────────────────┐
│  HERO (banner, logo, name, tagline, links)      │
│  — unchanged —                                  │
├─────────────────────────────────────────────────┤
│  VENDOR INTELLIGENCE CARD                       │
│  (replaces CDG Intelligence & Pulse Summary)    │
│  Shows state 1/2/3 depending on data            │
├─────────────────────────────────────────────────┤
│  ABOUT SECTION (new)                            │
│  Vendor self-reported content (if verified)     │
│  OR auto-generated overview (if unclaimed)      │
│  Products · Segments · Integrations             │
├─────────────────────────────────────────────────┤
│  STATS ROW                                      │
│  Sentiment breakdown + trend (unchanged)        │
├─────────────────────────────────────────────────┤
│  DIMENSIONAL INSIGHTS (unchanged)               │
├─────────────────────────────────────────────────┤
│  PRICING & SWITCHING INTEL (unchanged)          │
├─────────────────────────────────────────────────┤
│  MENTIONS FEED                                  │
│  Community + external (indistinguishable)        │
│  All styled the same, no source attribution     │
└─────────────────────────────────────────────────┘
```

## Refresh Cycles

- **External review ingestion:** daily via cron-triggered edge function
- **Review transformation:** runs immediately after ingestion (chained)
- **Vendor intelligence cache:** regenerates when mention count changes by 3+ since last generation, or weekly — whichever comes first
- **Auto-summary bootstrapping:** runs once at vendor creation, refreshes monthly

## RLS Policies

- `external_review_queue` — admin-only read/write
- `mention_flags` — vendors can insert/read their own, admins can read/update all
- `vendor_custom_content` — vendors can read/write their own, public read for all
- `vendor_intelligence_cache` — public read, edge-function-only write
- `vendor_mentions.source` — no RLS change needed; column is never selected in public-facing query return types
