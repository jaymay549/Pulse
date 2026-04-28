# CAR-26: Freemium Dealer Access on Pulse

## Goal

Remove friction for unauthenticated dealers visiting Pulse. Show enough vendor intelligence to hook them, then convert them into the community via the existing Clerk sign-in modal.

## Principle

**Show the "what" but not the "why."** Dealers can see scores, breakdowns, and that data exists — but can't read actual dealer words, AI insights, or actionable details without signing up.

## What unauthenticated dealers see (free, no login)

| Section | Visible | Notes |
|---------|---------|-------|
| Vendor directory listing | Yes | Vendor names visible (not redacted) |
| Vendor profile page | Yes | Accessible via browse or direct link |
| Sentiment breakdown (% positive/warning) | Yes | Already partially visible |
| Dimensional breakdown (radar chart) | Yes | Currently gated — needs ungating |
| Dealer NPS score | Yes | Currently gated — needs ungating |
| Total discussion count (header stat) | Yes | Already visible |
| Vendor logo, category, tagline, description | Yes | Already visible |

## What stays gated (blurred + Clerk sign-in CTA)

| Section | Behavior |
|---------|----------|
| Conversation excerpts | Fully blurred, no preview text |
| CDG Intelligence briefing | Title visible, content gated |
| Themes (what dealers appreciate / common concerns) | Blurred with overlay |
| Competitive movement / switching intel | Blurred with overlay |
| Alternatives & competitors | Blurred with overlay |
| Search results | Paywall (existing SearchLockedPaywall) |
| Pagination / load more | Disabled |
| Discussion count on blurred cards | Hidden — no count shown |

## Sign-up flow

Clicking any gated section triggers the **existing `GainAccessModal`** (`src/components/GainAccessModal.tsx`) — the same "Gain Access" modal already used on the vendors page. Goal is to convert them into the Circles community.

## Implementation

### 1. Backend: Stop redacting vendor names for unauthenticated users

The RPC function `get_vendor_pulse_feed_v3` currently returns `****` for vendor names when the user is free/unauth tier. This needs to change so vendor names are always returned.

**Option A (preferred):** Modify the RPC function to always return real vendor names regardless of tier. Vendor names are not premium content — they're the front door.

**Option B (fallback):** If the RPC can't be changed easily, add a separate unauth-friendly query that fetches vendor names + basic stats only.

### 2. Frontend: Ungate dimensional breakdown and NPS for unauth users

In `VendorProfile.tsx`, the dimensional breakdown and NPS sections are behind auth/tier overlays. Remove the overlay for these specific sections so unauth users can see the radar chart and NPS score.

### 3. Frontend: Keep all other gating as-is

The existing blur/overlay/paywall behavior for excerpts, themes, competitive intel, search, and pagination stays exactly as it is. No changes needed.

### 4. Frontend: Ensure GainAccessModal is triggered consistently

When an unauth user clicks any gated section, it should open the existing `GainAccessModal` (not Clerk sign-in directly). Verify this is consistent across all gated touchpoints on both VendorsV2.tsx and VendorProfile.tsx.

## Files likely affected

- Supabase RPC function `get_vendor_pulse_feed_v3` (or equivalent) — vendor name redaction
- `src/pages/VendorsV2.tsx` — vendor name display for unauth users
- `src/pages/VendorProfile.tsx` — ungate dimensional breakdown + NPS sections
- `src/hooks/useClerkAuth.ts` — possibly, if auth state logic needs adjustment
- `src/components/vendors/VendorCard.tsx` — stop redacting names on cards

## Out of scope

- Tier gating for paid vendors (CAR-13)
- Profile editing or vendor dashboard access
- Any backend data model changes beyond name redaction
- New UI components or redesigns
