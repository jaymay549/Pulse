# Main Page Redesign — AI-Powered Smart Search

## Goal

Redesign the VendorsV2 main page to center around a single smart search bar that doubles as both vendor autocomplete and an inline AI chat advisor (pro users only), replacing the current sidebar layout with a ChatGPT-style search-first experience.

## Design Decisions

### 1. Hero & Layout

- **Single-column layout** — the left sidebar with categories is removed entirely.
- **Centered hero** with minimal content above the search bar:
  - Small "Updated Daily" badge
  - Heading: "What do you want to know about auto vendors?"
  - Large smart search bar (the focal point)
  - Row of suggested prompt chips below the bar
  - Stats line (vendor count, mention count, category count)
- **Horizontal scrollable category pills** replace the sidebar, positioned below the hero section spanning full width.
- Rest of page (trending vendor chips, vendor grid) remains as-is but now renders full-width (no sidebar column).
- Hero collapses/shrinks when a category is selected or a vendor is picked, giving more room to results.

### 2. Smart Search Bar Behavior

The search bar always shows vendor autocomplete matches as the user types (same logo + name dropdown as today). The user's **action** determines what happens:

- **Click a dropdown suggestion** → navigate to that vendor's profile page (search mode).
- **Press Enter** → send the full input text to the AI chat (AI mode), regardless of whether vendor names matched in the dropdown.
- **Escape** → clear input, close dropdown.

No intent-detection heuristic is needed. The interaction model is unambiguous.

- A **Sparkles icon** on the right side of the input indicates "Enter = Ask AI" (pro users only; hidden for free tier).
- **Suggested prompt chips** below the search bar: clicking a chip populates the input AND immediately sends it to AI. Chips are only shown when the input is empty (landing state).

### 3. AI Response — Inline Expansion

When a pro user presses Enter:

1. The autocomplete dropdown closes.
2. A response container expands **inline below the search bar**, pushing the category pills and vendor grid down.
3. A loading state (pulsing Sparkles or skeleton) shows while the response streams.
4. The response streams in via SSE from the existing `vendor-ai-chat` edge function.
5. Markdown is rendered using the existing `ChatMarkdown` component.

**Multi-turn conversation:**

- After a response completes, the search bar clears but stays focused for follow-up questions.
- A conversation area accumulates user/assistant message pairs above the latest response, scrollable if long.
- A "Clear chat" (X) button dismisses the thread and returns to landing state.

The existing **FAB `VendorAIChat` component is removed** — this inline experience replaces it.

### 4. Free Tier Upgrade Prompt

When a non-pro user presses Enter:

- The autocomplete dropdown closes.
- Instead of calling the AI, an **upgrade card** appears in the inline expansion area:
  - Sparkles icon + "AI Vendor Advisor is a Pro feature"
  - One-liner: "Get instant answers about vendors, comparisons, and recommendations"
  - CTA button: "Upgrade to Pro" → links to the pricing/upgrade page
  - Dismiss X to close and return to landing state.
- The Sparkles icon in the search bar is **not shown** for free users.
- Suggested prompt chips **are still visible** for free users (social proof / feature teaser). Clicking one shows the same upgrade card.
- Vendor autocomplete click-to-navigate works identically for all tiers.

## Components Affected

| Component | Change |
|---|---|
| `src/pages/VendorsV2.tsx` | Remove sidebar, restructure to single-column hero layout, integrate inline AI chat |
| `src/components/ui/vendor-search-bar.tsx` | Rewrite as SmartSearchBar with dual behavior (click = profile, Enter = AI) |
| `src/components/vendors/VendorAIChat.tsx` | Delete — replaced by inline chat in SmartSearchBar |
| `src/components/vendors/VendorSidebar.tsx` | Remove from page (may keep file if used elsewhere) |
| New: inline AI response/conversation component | Streams SSE, renders markdown, multi-turn |
| New: upgrade prompt component | Shown to free-tier users |
| New: category pills component | Horizontal scrollable pills replacing sidebar |
