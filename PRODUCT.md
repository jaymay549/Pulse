# Product

## Register

product

## Users

Two distinct populations on opposite sides of one platform:

1. **Dealers** (free / pro / executive) — automotive dealership staff who joined a WhatsApp dealer group and now use CDG Pulse to read structured intel pulled from those conversations. Authenticated via Clerk. Their job-to-be-done: "what's the noise on vendor X, and is it worth my time / contract?"
2. **Vendors** (verified_vendor) — automotive SaaS / service vendors who sell into dealers. Authenticated via Supabase magic link, separate from Clerk. Their job-to-be-done is more emotional: "where do I stand, what are dealers saying about me, and what should I do about it?" Tier-gated dashboard (T1 info-only, T2 actionable). Often viewed by sales / CS leadership at the vendor company, not engineers.

Admins are a third small population (sales team) who provision vendor credentials and moderate the AI pipeline. They live in `/admin/*`.

## Product Purpose

Turn raw WhatsApp dealer-group chatter into competitive intelligence both sides will pay for. For dealers: vendor reputation lookups before signing a contract. For vendors: a credible mirror of how the market actually talks about them, plus a roadmap for improving that perception. The strategic moat is the data — real conversations, not survey-ware. The UI's job is to make that signal feel undeniable.

## Brand Personality

**Three words: Confident, sharp, premium.**

Voice is concise and authoritative. We never hedge. We show evidence (real quote counts, real co-occurrences, real dates) rather than asserting. The interface should feel like Bloomberg Terminal got a quiet shadcn redesign: dense where information density earns it, restrained everywhere else. Numbers are sacred — tabular numerics, deliberate precision. Headings are heavy (font-black) because the product is making strong claims.

Emotional goal varies by surface:
- **Dealer surfaces** — calm, expert clarity. "We did the work for you."
- **Vendor surfaces** — competitive pressure with dignity. The vendor should leave the dashboard motivated to act, never humiliated. Upgrade prompts (T1 → T2) earn their place by showing locked value, not by guilt-tripping.

## Anti-references

- Generic SaaS hero-metric template (huge number + arrow + "+12% MoM"). We've outgrown it; it's the AI slop default.
- Purple-gradient-on-white "AI startup" look. We're an industry-specific intelligence product, not a B2B template.
- Dashboard-as-pinboard with identical card grids and Lucide icons in every header. Cards are an answer of last resort here.
- Anything that reads as snark or shame toward vendors. They are paying customers; the dashboard must respect that even when reporting bad news.
- Bouncy / spring / playful motion. We're a serious analytics product — motion is exponential ease-out, fast, purposeful.

## Design Principles

1. **Evidence before assertion.** Every claim should sit next to the data that backs it (mention count, source, timestamp). Vendors and dealers both pay for proof, not vibes.
2. **Pressure with dignity.** Vendor-facing copy and visual emphasis should make the gap real without making the vendor feel mocked. Upgrades are unlocked, not extorted.
3. **Density earns its keep.** Use whitespace generously by default; spike density only on surfaces (leaderboards, intel tables, queue views) where the user is actively scanning.
4. **The numbers are the design.** Tabular numerics, deliberate alignment, restrained color around the digit itself. If a number is the answer, frame it; don't decorate it.
5. **Tier-gating is a product surface, not a paywall.** Locked content should feel like a teaser of something specific and known, not a blurry overlay.

## Accessibility & Inclusion

- WCAG AA targets across all surfaces. Sentiment colors (emerald / amber / red) must always pair with a non-color cue (icon, label, position, or shape) — vendors with deuteranopia must read the leaderboard correctly.
- All interactive controls keyboard-reachable; focus rings use the existing `--ring` token (vivid blue) at 2px.
- Reduced-motion users see no animated rank reveals or sparkline draw-ins; static positions only.
- Vendors view the dashboard on laptops / large tablets in office light. Dealers may view on phones in a dealership floor under fluorescent or sunlit conditions — surfaces that are dealer-primary must hold up at 320px wide and high ambient light.
