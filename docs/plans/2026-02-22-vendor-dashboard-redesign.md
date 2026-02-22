# Vendor Dashboard Redesign

## Problem

The current vendor experience bolts a small 3-tab dashboard onto the public profile page. Vendors see the same view as everyone else with a minor panel on top. The vision is for vendors to have a dedicated management workspace — their default home for metrics, mentions, profile editing, and competitive intel — with a "View as Member" link to preview the public profile.

## Decision: Standalone Dashboard Page (Approach A)

A new top-level route `/vendor-dashboard` with its own sidebar layout, completely separate from the public profile at `/vendors/{name}`. The public profile stays untouched. The old `VendorDashboard` component embedded in VendorProfile.tsx is removed.

## Route & Access

- **Route:** `/vendor-dashboard`
- **Protection:** Redirects to `/` if user has no approved `vendor_profiles` row
- **Entry points:**
  - Site header shows "Dashboard" link when `isVendorOwner` is true
  - Public profile page shows "Manage Profile" button for owners (replaces claim button spot)
  - Claim button remains for non-owner authenticated users

## Layout

Full-width page with fixed left sidebar (w-56) and scrollable main content area. Light theme matching the public site aesthetic.

### Sidebar

- Vendor logo + name at top (small)
- Nav links with icons:
  - **Overview** (BarChart3) — default landing
  - **Mentions** (MessageSquare)
  - **Edit Profile** (Pencil)
  - **Market Intel** (TrendingUp)
- Divider
- **View as Member** (ExternalLink) — opens `/vendors/{name}` in new tab
- **Back to CDG Pulse** (ArrowLeft) — links to `/vendors`

## Section 1: Overview (Default Landing)

At-a-glance health of the vendor's presence on CDG Pulse.

**Stat cards row (3 cards):**
- **Total Mentions** — big number + trend badge (up/down/stable % from `get_vendor_trend`)
- **Positive Sentiment** — percentage, color coded (emerald >=70%, yellow 50-69%, red <50%)
- **Concerns Flagged** — warning count, red-tinted if high

**Recent Activity:**
- Last 5 mentions as compact list (headline, type badge, timestamp)
- "View all mentions" link navigates to Mentions section

**Data:** `get_vendor_profile` (stats) + `get_vendor_trend` (direction/change) + `vendor_mentions` (recent 5)

## Section 2: Mentions & Respond

Full-page mention management replacing the cramped Respond tab.

**Filter bar:** Toggle pills (All | Positive | Concerns) with counts. Sorted newest first.

**Mention cards (vertical list):** Each card shows:
- Type badge (positive = emerald, concern = amber)
- Headline + anonymized snippet
- Timestamp
- Response area: expandable textarea + "Post Response" if no reply exists; shows response with "Responded" badge if already replied

**Data:** `vendor_mentions` (filtered by vendor_name, last 50) + `vendor_responses` (by mention_id)

## Section 3: Edit Profile

Where vendors customize their public profile appearance.

### Brand Assets
- **Banner image** — preview with upload overlay. jpg/png, max 2MB. Stored in Supabase storage `vendor-banners` bucket.
- **Logo** — circular preview with upload overlay. Uses existing `vendor-logos` bucket + RLS policies.
- **Screenshots gallery** — grid with drag-to-reorder, delete per image, "Add screenshot" button. New `vendor-screenshots` storage bucket needed.

### Profile Details (form)
- Tagline (text input)
- Description (textarea)
- Website URL (text input)
- LinkedIn URL (text input)
- Headquarters (text input)
- Contact email (text input)
- "Save Changes" button writes to `vendor_profiles` row

**Not editable:** Vendor name (key identifier). Category badges (derived from mention data).

## Section 4: Market Intel

Full-page competitive intelligence.

**Your Position card:**
- Own stats: total mentions, positive %, concern count
- Trend indicator (arrow + % change vs previous period)

**Competitor Comparison table:**
- Columns: Vendor Name | Mentions | Positive % | Co-occurrences
- Own vendor row highlighted at top with "You" badge
- Up to 4 competitors from `get_compared_vendors`
- Positive % color coded (emerald >=70%, yellow 50-69%, red <50%)

**Data:** `get_vendor_profile` + `get_compared_vendors` + `get_vendor_trend`

## What Changes on VendorProfile.tsx

- Remove the `VendorDashboard` component and its import
- Replace the "Claim this profile" button logic: if owner, show "Manage Profile" linking to `/vendor-dashboard`; if non-owner authenticated user, show "Claim this profile" (existing behavior)
- Keep `useVendorOwnership` hook (still needed for the button logic)
- Keep `ClaimProfileModal` (still needed for non-owners)

## Backend Work

- **New storage bucket:** `vendor-screenshots` with RLS policies mirroring `vendor-logos`
- **No new RPCs:** All data already available via existing functions
- **Profile updates:** Direct `vendor_profiles` table UPDATE (RLS policy already allows owners to update their own row)

## Theme

Light theme matching the public site. White/light gray backgrounds, standard border colors, public-site typography. Not the dark admin theme.
