# Design

Captured from the live codebase (`tailwind.config.ts`, `src/index.css`, `src/components/vendor-dashboard/*`). This is what the app actually looks like today, not an aspirational brief. Edit when shipping changes that move the system.

## Theme

Light by default. Dealers and vendors view this product mid-day on laptops and phones in well-lit environments (dealership floor, vendor HQ). Dark mode tokens exist in `index.css` but the product is shipped and used in light mode; treat dark as a future variant, not a parity requirement.

No `#000` and no `#fff` in new work — base neutrals come from the slate scale tinted toward the primary blue hue. Backgrounds are `--vendor-bg` (warm off-white, `0 0% 98%`) for app shells and pure card white (`0 0% 100%`) for elevated surfaces.

## Color

**Strategy: Restrained.** Tinted slate/white surfaces with one dominant action accent (vivid blue) and a small fixed set of semantic accents. Brand identity is carried by typography weight and data density, not by saturated surfaces.

### Roles

| Role | HSL | Hex equiv | Usage |
|---|---|---|---|
| `--primary` | `214 100% 50%` | #0070FF | Vivid blue. Primary buttons, focus ring, link-blue. Use sparingly. |
| `--secondary` | `48 100% 50%` | #FFCC00 | Saturated yellow. Reserved for top-level brand moments only. Do not use for "warning" — that's `--vendor-warning`. |
| `--accent` | `214 100% 50%` | same as primary | Alias of primary. |
| `--vendor-warning` | `0 84% 60%` | #EF4444 | Concerns, negative sentiment, action-required state. |
| `--vendor-success` | `142 76% 36%` | #15A34A | Recommendations, positive sentiment, healthy ranges. |
| `--vendor-pro` | `45 93% 47%` | #E0A106 | Gold reserved exclusively for Pro/T2 cues (locks, tier badges, upgrade affordances). Never decorative. |
| `--vendor-bg` | `0 0% 98%` | #FAFAFA | App-shell warm off-white. |
| `--vendor-card` | `0 0% 100%` | #FFFFFF | Elevated surfaces. |
| `--vendor-border` | `0 0% 90%` | #E5E5E5 | Default divider. |

### Sentiment scale (used in `sentimentColor()` helpers and Pulse / NPS components)

- **≥ 70%** — `text-emerald-600` (#059669)
- **50–69%** — `text-yellow-600` / `text-amber-600` (#CA8A04 / #D97706)
- **< 50%** — `text-red-500` (#EF4444)

### Indigo accent — Intelligence Engine cue

A muted indigo (`text-indigo-500`, `bg-indigo-50`, `border-indigo-100`) is reserved for "AI/intelligence engine" surfaces — the small `Sparkles` glyphs, tooltips that explain the model, Pulse Score nudges. Do not use indigo elsewhere. It is a category cue, not a decoration.

## Typography

- **Sans (body + UI):** `Inter, system-ui, sans-serif`.
- **Mono (numerics, terminal feel):** `JetBrains Mono, Menlo, Monaco, Consolas, monospace`.
- **Headings:** Globally bound to `font-black tracking-tight` via `@layer base`. This is the project's signature — every `h1`–`h6` is heavy and tight by default. Do not override to a lighter weight without strong reason.
- **Big numbers:** `font-black tracking-tighter` at the largest scale (Health Score: `text-4xl font-black tracking-tighter`). Always pair with `font-variant-numeric: tabular-nums` when a value can change.
- **Small caps labels:** `text-[10px] font-bold uppercase tracking-widest text-slate-400` is the canonical micro-label pattern (e.g. "PULSE SCORE", "GROWTH TREND"). Reuse it — don't invent new label sizes.
- **Body copy:** `text-[13px] leading-relaxed text-slate-600` for paragraph text inside cards. Page-level body is `text-sm` / `text-slate-500`.
- **Hierarchy steps:** `text-[10px]` (label) → `text-[12px]` (caption) → `text-[13px]` (body) → `text-sm` (page body) → `text-base` → `text-lg` (card title) → `text-xl` (section heading) → `text-2xl` (page heading) → `text-4xl` (hero number). Ratio is roughly 1.2–1.3 between adjacent steps.

## Spacing & Layout

- Page section gap: `mt-6` between major panels on the dashboard.
- Card interior: `p-6` standard, `p-6 sm:p-8` for hero cards.
- Stack gap inside cards: `space-y-3` for label/title/body, `gap-4` for grid cells.
- Container max widths follow shadcn defaults; vendor dashboard pages live in the existing `VendorDashboardLayout` shell.
- Cards are used heavily today, but per `PRODUCT.md` they are not the default answer — prefer inline / progressive structure where it works.

## Radius

- `--radius: 0.5rem` (8px) is the system default (`rounded-lg`).
- `rounded-xl` (12px) for primary cards.
- `rounded-full` for pill badges, sentiment chips, status indicators.
- `rounded-md` (6px) for small chips, mock-button surfaces.
- Avoid mixing radii on the same element (e.g. `rounded-t-xl rounded-b-md` is non-system).

## Elevation

- `shadow-card` token: `0 2px 8px hsl(214 10% 20% / 0.08)` — the default card shadow.
- `shadow-bold` token: `0 4px 20px hsl(214 100% 50% / 0.3)` — primary-action emphasis only.
- Most cards use a 1px `--vendor-border` instead of a shadow. Combine border + shadow only on hovered or focused state.

## Motion

- Standard easing: `cubic-bezier(0.4, 0, 0.2, 1)` (`--transition-smooth`). Per `PRODUCT.md` design law, prefer exponential ease-out (`ease-out-quart`) for bigger reveals.
- Existing keyframes: `accordion-down/up` (200ms), `slide-in-left` (400ms), `marquee` (80s loop), `shimmer` (loading shimmer).
- Number-to-number transitions: 1000ms `ease-out` (see Health Score circular progress `transition-all duration-1000 ease-out`). Reuse this duration for rank/score changes.
- No bounce, no spring, no elastic.
- Respect `prefers-reduced-motion` — animated reveals must collapse to instant placement.

## Iconography

- Library: `lucide-react`.
- Default size in dashboard chrome: `h-3 w-3` (badges) → `h-4 w-4` (inline) → `h-5 w-5` (panel headers).
- Stroke weight: default 2; bump to 3 (`stroke-[3]`) for emphasis arrows in trend badges.
- `Sparkles` is the AI/intelligence cue (always indigo). `ShieldCheck` for "exceptional" health. `TrendingUp` / `Activity` / `ArrowUp` / `ArrowDown` / `Minus` for trend states.

## Components in use (anchor patterns)

- `HealthScoreHero` — circular SVG progress + black tracking-tighter number + small-caps label + status pill + sparkline. The reference for any "your headline number" surface.
- `MetricCard` — small rounded-xl cards with bordered slate-50 inner blocks, used in 3-up grids on the dashboard.
- `Badge` (shadcn) — pill-shaped, used for trend deltas and tier markers.
- `DashboardIntel` (today's competitor table) — to be replaced by the Competitor Comparison Leaderboard (CAR-19).

## Tabular numerics

Anywhere a number compares across rows or changes over time, apply `font-variant-numeric: tabular-nums` (or the Tailwind `tabular-nums` utility). This is enforced in the existing intel table and must continue.

## Don'ts

- No gradient text. Period. We use solid colors and let weight / size carry emphasis.
- No side-stripe colored borders > 1px on rows or cards. Use full borders, background tints, or leading icons instead.
- No glassmorphism / backdrop-blur as decoration. Reserve for genuine layered overlays.
- No identical icon-headed card grids. If three cards repeat the same shape, the design is lazy.
- No em dashes in copy. Use commas, colons, semicolons, periods, or parentheses.
