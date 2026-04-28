---
phase: quick-260416-phu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/vendor-dashboard/VendorDashboardLayout.tsx
  - src/components/vendor-dashboard/VendorDashboardSidebar.tsx
  - src/components/vendor-dashboard/VendorCommandCenter.tsx
  - src/components/vendor-dashboard/HealthScoreHero.tsx
  - src/components/vendor-dashboard/MetricCard.tsx
  - src/components/vendor-dashboard/DashboardOverview.tsx
  - src/components/vendor-dashboard/PulseBriefing.tsx
  - src/components/vendor-dashboard/DashboardIntel.tsx
  - src/components/vendor-dashboard/DashboardMentions.tsx
  - src/components/vendor-dashboard/DashboardDimensions.tsx
  - src/components/vendor-dashboard/DashboardSegments.tsx
  - src/components/vendor-dashboard/DashboardCategories.tsx
  - src/components/vendor-dashboard/DashboardDealerSignals.tsx
  - src/components/vendor-dashboard/DashboardDemoRequests.tsx
  - src/components/vendor-dashboard/DashboardScreenshots.tsx
  - src/components/vendor-dashboard/DashboardEditProfile.tsx
  - src/components/vendor-dashboard/NPSChart.tsx
  - src/components/vendor-dashboard/MetricsBenchmarkChart.tsx
  - src/components/vendor-dashboard/FeatureGapList.tsx
  - src/components/vendor-dashboard/TrendDeepDive.tsx
  - src/pages/VendorDashboardPage.tsx
autonomous: false
requirements: [CAR-28]
must_haves:
  truths:
    - "Dashboard feels premium and enterprise-grade for $12K-25K/yr vendor clients"
    - "Consistent spacing, typography, and visual rhythm across all sections"
    - "Most important data (health score, metrics, key insights) has clear visual hierarchy"
    - "Dashboard is clean and minimalist — reduced visual noise, increased whitespace"
    - "Mobile responsive across all dashboard sections"
    - "Loading, empty, and error states are polished and consistent"
  artifacts:
    - path: "src/components/vendor-dashboard/VendorDashboardLayout.tsx"
      provides: "Refined layout shell with consistent spacing"
    - path: "src/components/vendor-dashboard/VendorDashboardSidebar.tsx"
      provides: "Polished navigation with clear active states"
    - path: "src/components/vendor-dashboard/VendorCommandCenter.tsx"
      provides: "Intelligence Hub as premium landing experience"
  key_links:
    - from: "VendorDashboardLayout.tsx"
      to: "all section components"
      via: "consistent padding/spacing propagation"
      pattern: "p-4 sm:p-6 lg:p-8"
---

<objective>
CAR-28: Polish the vendor dashboard to enterprise demo-ready quality. These vendors (CDK, Reynolds, Cox, Drive Centric) pay $12K-$25K/yr. The dashboard must feel premium, minimalist, and confident.

Purpose: First impressions drive sales. A polished vendor dashboard builds trust with enterprise buyers and demonstrates product maturity.
Output: Refined vendor dashboard with consistent spacing, clean typography, clear hierarchy, and minimalist aesthetic across all sections.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/vendor-dashboard/VendorDashboardLayout.tsx
@src/components/vendor-dashboard/VendorDashboardSidebar.tsx
@src/components/vendor-dashboard/VendorCommandCenter.tsx
@src/components/vendor-dashboard/HealthScoreHero.tsx
@src/components/vendor-dashboard/MetricCard.tsx
@src/components/vendor-dashboard/DashboardOverview.tsx
@src/components/vendor-dashboard/PulseBriefing.tsx
@src/components/vendor-dashboard/DashboardIntel.tsx
@src/components/vendor-dashboard/DashboardMentions.tsx
@src/components/vendor-dashboard/DashboardDimensions.tsx
@src/components/vendor-dashboard/DashboardSegments.tsx
@src/components/vendor-dashboard/DashboardCategories.tsx
@src/components/vendor-dashboard/DashboardDealerSignals.tsx
@src/components/vendor-dashboard/DashboardDemoRequests.tsx
@src/components/vendor-dashboard/DashboardScreenshots.tsx
@src/components/vendor-dashboard/DashboardEditProfile.tsx
@src/components/vendor-dashboard/NPSChart.tsx
@src/components/vendor-dashboard/MetricsBenchmarkChart.tsx
@src/components/vendor-dashboard/FeatureGapList.tsx
@src/components/vendor-dashboard/TrendDeepDive.tsx
@src/pages/VendorDashboardPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Layout shell, sidebar, and shared visual system polish</name>
  <files>
    src/components/vendor-dashboard/VendorDashboardLayout.tsx
    src/components/vendor-dashboard/VendorDashboardSidebar.tsx
    src/pages/VendorDashboardPage.tsx
  </files>
  <action>
Polish the layout shell and sidebar for enterprise-grade minimalism:

**VendorDashboardLayout.tsx:**
- Increase main content padding: ensure consistent `p-6 sm:p-8 lg:p-10` for breathing room
- Remove the footer links (Help Center, API Docs, Privacy) — these are placeholder `#` links that add clutter. Keep just the copyright line, make it more subtle
- Soften the header: reduce visual weight of the breadcrumb — make the separator lighter, use `text-slate-300` for "Dashboard" prefix
- Ensure `max-w-[1200px]` is consistent and the `animate-in` fade is subtle (reduce from 500ms to 300ms)
- Add slightly more top padding to the main content area to separate from header

**VendorDashboardSidebar.tsx:**
- Increase vertical spacing between nav groups from `space-y-7` to `space-y-8`
- Soften the group headers: reduce letter-spacing from `tracking-widest` to `tracking-wider`, use `text-[10px]` instead of `text-[11px]` for lighter visual weight
- Increase the active state indicator from a tiny 1px dot to a subtle left border accent (2px wide, indigo-500, using `border-l-2` on the active item instead of the absolute-positioned dot)
- Remove the hover shadow-sm on footer links — keep it flat and clean
- Ensure the brand area uses consistent padding that aligns with nav items
- Make "Control Center" subtitle even more subtle — `text-[10px]` and `text-slate-300`

**VendorDashboardPage.tsx:**
- Remove the `max-w-5xl` wrapper div around children — the layout component already constrains width via `max-w-[1200px]`. This double-constraint may cause narrower-than-intended content
  </action>
  <verify>
    <automated>cd /Users/miguel/Pulse && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Layout shell has increased whitespace, cleaner footer, refined sidebar with consistent group spacing and left-border active indicator, and no double width constraint</done>
</task>

<task type="auto">
  <name>Task 2: Intelligence Hub and Overview — premium hero and chart polish</name>
  <files>
    src/components/vendor-dashboard/VendorCommandCenter.tsx
    src/components/vendor-dashboard/HealthScoreHero.tsx
    src/components/vendor-dashboard/MetricCard.tsx
    src/components/vendor-dashboard/DashboardOverview.tsx
    src/components/vendor-dashboard/PulseBriefing.tsx
    src/components/vendor-dashboard/NPSChart.tsx
    src/components/vendor-dashboard/MetricsBenchmarkChart.tsx
    src/components/vendor-dashboard/FeatureGapList.tsx
    src/components/vendor-dashboard/TrendDeepDive.tsx
  </files>
  <action>
Polish the two primary landing pages (Intelligence Hub and Overview) for maximum demo impact:

**VendorCommandCenter.tsx:**
- Reduce the Intelligence Header visual weight: remove the indigo icon box (the `h-10 w-10 rounded-xl bg-indigo-600` div with Target icon) — just use the text heading. Enterprise dashboards let data speak, not icons
- Clean up the header section: reduce bottom border padding, make category badge and description more compact
- Ensure consistent `space-y-10` or `space-y-8` between major sections (standardize on one value)
- Reduce loading state animation — `animate-pulse` on text is distracting. Just show the spinner and static text

**HealthScoreHero.tsx:**
- Remove the decorative background blur circles (`absolute ... bg-indigo-50/50 blur-3xl`) — they add visual noise without value
- Tighten the layout: reduce gap between score circle and text from `gap-8` to `gap-6`
- Make the status pill (`Exceptional` / `Solid Performance` / `Action Required`) less prominent — use `text-[12px]` and reduce padding
- Tone down the italic description text — remove `italic`, use regular weight, `text-[13px]` and `text-slate-400` for subtlety
- Sparkline area chart container: remove the border and background (`bg-slate-50/50 ... border border-slate-100`) — let it float cleanly

**MetricCard.tsx:**
- Reduce overall padding from `p-6` to `p-5` for tighter cards
- Remove the `font-extrabold` on the metric label — use `font-bold` for less visual shouting
- Make the "REPORTS" and "POSITIVE" badges less prominent — use `text-[9px]` and reduce padding
- Tone down the AI insight box: remove the Quote icon overlay (visual noise), keep the colored background but use even subtler opacity

**DashboardOverview.tsx:**
- Remove the gradient glow effect on PulseBriefing wrapper (the `absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-5` div) — it is subtle but unnecessary for minimalism
- Reduce section gap from `space-y-8` to `space-y-6` for tighter rhythm
- Activity feed mentions: reduce card padding from `p-4` to `p-3.5`, remove the `hover:shadow-md hover:border-indigo-100` effect — flat is cleaner
- Make the "Load More Activity" button less prominent — remove dashed border, use ghost variant

**NPSChart.tsx:**
- Read the component and ensure consistent card styling with other cards (same border radius, shadow, padding)

**MetricsBenchmarkChart.tsx, FeatureGapList.tsx, TrendDeepDive.tsx:**
- Read each component and apply the same minimalist treatment: reduce decorative elements, ensure consistent card borders (`border-slate-200`), remove unnecessary hover effects, standardize heading sizes to `text-sm font-bold`

**PulseBriefing.tsx:**
- Read the full component. Ensure section headings use consistent sizing (`text-sm font-bold`). Remove any gradient or glow decorations. Reduce icon visual weight where used as section markers
  </action>
  <verify>
    <automated>cd /Users/miguel/Pulse && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Intelligence Hub and Overview pages have reduced decorative noise, consistent card styling, tighter spacing, and a premium minimalist feel suitable for enterprise demos</done>
</task>

<task type="auto">
  <name>Task 3: Secondary pages — consistent polish across all remaining sections</name>
  <files>
    src/components/vendor-dashboard/DashboardIntel.tsx
    src/components/vendor-dashboard/DashboardMentions.tsx
    src/components/vendor-dashboard/DashboardDimensions.tsx
    src/components/vendor-dashboard/DashboardSegments.tsx
    src/components/vendor-dashboard/DashboardCategories.tsx
    src/components/vendor-dashboard/DashboardDealerSignals.tsx
    src/components/vendor-dashboard/DashboardDemoRequests.tsx
    src/components/vendor-dashboard/DashboardScreenshots.tsx
    src/components/vendor-dashboard/DashboardEditProfile.tsx
  </files>
  <action>
Apply consistent minimalist polish across all remaining dashboard sections. Read each file fully before editing. The goal is visual consistency with the refined Intelligence Hub and Overview — not redesigning, just harmonizing.

**Across ALL secondary section components, apply these patterns:**

1. **Page headers**: Standardize to `text-2xl font-bold text-slate-900 tracking-tight` (not `text-3xl font-extrabold` — reserve that weight for the two main pages). Subtitles: `text-sm text-slate-500 mt-1`

2. **Card styling**: Ensure all Card components use `border-slate-200 shadow-sm` (not `shadow-md` or `shadow-lg`). Remove any `hover:shadow-md` effects — keep cards flat and clean. Use `rounded-xl` consistently (not mixing `rounded-2xl` and `rounded-xl`)

3. **Chart consistency**: All Recharts components should use:
   - CartesianGrid: `stroke="#f1f5f9" vertical={false}` with `strokeDasharray="3 3"`
   - XAxis/YAxis ticks: `fontSize: 11, fill: "#94a3b8", fontWeight: 500`
   - Tooltip: `borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12`
   - Consistent height: 200-240px for standard charts

4. **Badge styling**: Use `text-[10px] font-bold` consistently, not mixing `text-[10px]` and `text-xs`

5. **Empty states**: Ensure each section has a clean empty state — centered icon (h-10 w-10 in a rounded-full bg-slate-100 container), `text-sm font-medium text-slate-500` message, `text-xs text-slate-400` subtitle. No dashed borders on empty state cards

6. **Loading states**: Use a consistent pattern: centered `Loader2` with `h-6 w-6 animate-spin text-slate-400` and a static `text-sm text-slate-500` label below. No `animate-pulse` on text

7. **Section spacing**: Standardize `space-y-6` between major sections within each page

8. **Button consistency**: Action buttons use `text-xs font-medium` (not `font-bold`). Primary actions: `bg-indigo-600 hover:bg-indigo-700 text-white`. Secondary: `variant="outline"` with no extra shadow

**DashboardMentions.tsx specifically:**
- This is a complex component with filters, response forms, and flag modals. Focus only on the visual polish items above — do not restructure the component logic
- Ensure the mention cards have consistent padding (`p-4`), clean type badges, and no hover shadow effects

**DashboardDimensions.tsx specifically:**
- The radar chart and bar chart should use the standardized chart styling
- Dimension cards/rows should have consistent spacing

**DashboardSegments.tsx specifically:**
- Axis tabs and bucket cards should follow the card styling rules
- Loading and empty states should match the standard pattern

**DashboardEditProfile.tsx:**
- Form fields should have consistent spacing, clean labels, and subtle borders
- Save button should follow the primary button pattern
  </action>
  <verify>
    <automated>cd /Users/miguel/Pulse && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>All secondary dashboard sections have consistent typography, card styling, chart formatting, empty/loading states, and spacing that matches the polished Intelligence Hub and Overview</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Full vendor dashboard UI/UX polish — minimalist, enterprise-grade aesthetic across all sections (Intelligence Hub, Overview, Mentions, Dimensions, Segments, Intel, Categories, Dealer Signals, Demo Requests, Screenshots, Edit Profile)</what-built>
  <how-to-verify>
    1. Run `npm run dev` and open http://localhost:8080
    2. Navigate to the vendor dashboard (use admin mode: `/vendor-dashboard?vendor=CDK Global` or another known vendor)
    3. Check Intelligence Hub:
       - Health score hero is clean without blur decorations
       - Metric cards have tight, consistent styling
       - No gradient glow effects
    4. Check Overview:
       - Charts have consistent styling
       - Activity feed is flat and clean
       - PulseBriefing has no decorative glow wrapper
    5. Click through each sidebar section:
       - Consistent page header sizing (2xl bold, not 3xl extrabold)
       - Cards all use same border/shadow treatment
       - Empty states are polished and centered
       - Loading states show clean spinner without pulsing text
    6. Check sidebar:
       - Active item has left border accent (not tiny dot)
       - Group labels are subtle and evenly spaced
       - Footer links are flat (no hover shadow)
    7. Resize to mobile:
       - Content remains readable
       - Sidebar opens via hamburger menu
       - Cards stack properly
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues to fix</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No new trust boundaries — this is purely a CSS/styling refactor with no data flow changes.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-phu-01 | T (Tampering) | CSS classes | accept | Styling changes only — no data access, auth, or API modifications. Zero security surface. |
</threat_model>

<verification>
- `npm run build` succeeds with no TypeScript errors
- `npm run lint` produces no new warnings
- All vendor dashboard sections render without console errors
- Visual consistency verified across Intelligence Hub, Overview, and all secondary sections
</verification>

<success_criteria>
- Vendor dashboard feels premium and enterprise-grade
- Consistent spacing, typography, and card styling across all 11 sections
- Minimalist aesthetic — decorative elements (glows, blur, gradient accents) removed
- Clean sidebar navigation with clear active state
- Mobile responsive across all sections
- No functional regressions — all data queries, interactions, and navigation work identically
</success_criteria>

<output>
After completion, create `.planning/quick/260416-phu-car-28-improve-vendor-dashboard-ui-ux-mi/260416-phu-SUMMARY.md`
</output>
