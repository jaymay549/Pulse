# CDG Pulse Homepage Redesign (G2-Inspired)

**Date:** 2026-02-23
**Goal:** Redesign the main page to follow G2's design philosophy (category-grid launchpad, no review feed on landing) while keeping CDG branding, AI-first positioning, and all existing functionality. The landing page should tell the story of why users are there and adapt by user type.

## Design Decisions

- **Primary CTA:** Ask an AI question (differentiator vs G2)
- **Below-fold content:** Category grid (G2-style) replaces trending chips + review feed
- **Category navigation:** Same-page filtering (no new routes)
- **Category card style:** Icon cards with top vendor logos previewed inside
- **Category view:** Vendor listing (horizontal scroll) + reviews below
- **Landing adapts by auth/tier:** Anonymous gets pitch, free gets tips, pro gets streamlined grid

## Page States

### State 1: Landing (Anonymous Users)

Top-to-bottom:

1. **Nav header** (unchanged)
2. **Hero section**
   - Headline: "What do you want to know about auto vendors?"
   - SmartSearchBar (search + AI query)
   - Suggested prompt chips
   - Stats line (X+ recommendations, Y+ warnings, Z categories)
3. **Value proposition section** (NEW)
   - 3-column feature highlights with icons:
     - "Real Dealer Reviews" - Community-sourced insights from verified auto dealers
     - "AI-Powered Insights" - Ask anything about vendors, get instant answers
     - "Track Vendor Sentiment" - See recommendations and warnings at a glance
4. **Category grid** (NEW - replaces CategoryPills + TrendingVendorChips + review feed)
   - 3 columns desktop, 2 tablet, 1 mobile
   - Each card contains:
     - Category icon (emoji)
     - Category name
     - Review count
     - Top 2-3 vendor logos as small avatars with "+N" overflow
   - Sorted by review count descending
   - No "All" card (the grid IS "all")
   - White cards, subtle border, hover lifts with shadow
5. **Social proof bar** (NEW)
   - Stats: X+ reviews, Y+ dealers, Z categories
6. **"How it works"** (NEW)
   - 3 steps: Search/Browse -> Read real reviews -> Make informed decisions
7. **Pricing / CTA** (existing VendorPricingTiers component)
8. **Footer** (unchanged)

### State 2: Landing (Signed-in Free Users)

1. **Nav header**
2. **Hero section** (same)
3. **Quick tips section** (NEW)
   - "Did you know?" style tip cards:
     - "Ask the AI to compare vendors side-by-side"
     - "Filter by warnings to spot red flags"
     - "Browse by category to find alternatives"
4. **Category grid** (same as anonymous)
5. **Upgrade banner** (NEW - highlights what they're missing)
   - Warnings access, AI chat, unlimited reviews
6. **Footer**

### State 3: Landing (Pro Users)

1. **Nav header**
2. **Hero section** (condensed - smaller headline, search stays prominent)
3. **Category grid** (same)
4. **Footer**

### State 4: Category View (after clicking a category card)

Triggered when user clicks any category card from the grid.

1. **Nav header**
2. **Hero (condensed)** - Search bar stays prominent, headline shrinks/hides. Breadcrumb appears: "< All Categories"
3. **Category header** - Icon + category name + review count
4. **Category pills** - Horizontal scrollable pills for quick switching (reuse existing CategoryPills component)
5. **Vendor listing** - Horizontal scroll of compact vendor cards:
   - Logo (Avatar)
   - Vendor name
   - Review count
   - Positive/warning counts as colored badges
   - Click navigates to vendor profile page
   - (Reuses existing category vendor cards section)
6. **Review feed** - Existing VendorCard grid (2-column, md breakpoint)
7. **Infinite scroll** - unchanged for pro users
8. **Upgrade section** - for non-pro users (unchanged)
9. **Footer**

### State 5: Vendor View (unchanged)

Selecting a vendor from the vendor listing or search navigates to `/vendors/:vendorName` (existing VendorProfile page). No changes needed.

## Components

### New Components

1. **CategoryGrid** - The main category card grid for the landing page
   - Props: categories, categoryCounts, onCategorySelect, topVendorsByCategory
   - Renders the 3-col grid with icon cards + vendor logo previews
   - Needs data: top 2-3 vendors per category (names + logos)

2. **ValuePropSection** - 3-column feature highlights for anonymous users
   - Static content, no data dependencies

3. **HowItWorksSection** - 3-step explainer for anonymous users
   - Static content

4. **QuickTipsSection** - Tip cards for signed-in free users
   - Static content with contextual CTAs

### Modified Components

1. **VendorsV2** (main page) - Major restructure of the rendering logic:
   - Landing state: render new sections based on auth/tier
   - Category state: add breadcrumb, condense hero
   - Remove TrendingVendorChips from landing
   - Remove review feed from landing

### Unchanged Components

- SmartSearchBar, VendorCard, VendorCardDetail, FilterBar, AIInsightBanner
- CategoryPills (reused in category view, hidden on landing)
- InlineAIChat, UpgradePromptCard, UpgradeTeaser, UpgradeModal
- VendorPricingTiers (reused for anonymous landing)

## Data Requirements

- **Top vendors per category:** Need to fetch or derive the top 2-3 vendors (by review count) for each category to show logos in the category grid cards. Can use the existing `fetchVendorCountsIndex` or `categoryCounts` data. May need a new lightweight call or compute from existing data on mount.
- All other data hooks remain unchanged.

## Categories (17 total, no "All" in grid)

| ID | Label | Icon |
|----|-------|------|
| dms-crm | DMS & CRM | laptop |
| digital-retailing | Digital Retailing | cart |
| marketing | Marketing & Ads | megaphone |
| fixed-ops | Fixed Ops | wrench |
| ai-automation | AI & Automation | robot |
| equity-mining | Equity Mining | gem |
| recon | Reconditioning | car |
| inventory | Inventory | package |
| training | Training | graduation |
| accounting | Accounting | chart |
| hr-payroll | HR & Payroll | people |
| service-products | Service Products | bottle |
| diagnostics | Diagnostics | search |
| security | Security & Tracking | lock |
| lead-providers | Lead Providers | phone |
| call-management | Call Management | mobile |
| it-support | IT Support | desktop |

## Branding Constraints

- Font: Inter (font-sans)
- Primary: Blue (214 100% 50%)
- Secondary/Accent: Yellow/Gold (48 100% 50%) - CDG brand color
- Cards: White on off-white background
- Headings: font-black, tracking-tight
- Keep existing CDG Pulse logo in header
