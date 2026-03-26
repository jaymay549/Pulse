# Sales Targets Page Redesign ("Command Center") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Sales Targets page into a high-scannability "Command Center" for the sales team, using progressive disclosure to hide secondary metrics while emphasizing core opportunity signals.

**Architecture:** Consolidate 14 columns into a "High-Signal" main table. Move secondary data into a two-column "Intelligence Dossier" expanded view. Use visual indicators (segment bars, pulse trends) instead of raw numbers for better at-a-glance scanning.

**Tech Stack:** React, Tailwind CSS, Lucide Icons, Framer Motion (already available in project if needed, or CSS animations).

---

### Task 1: Typography and Tailwind Configuration

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add Monospace Font to Tailwind config**
Add a `mono` font family to the theme extend section.

```typescript
// tailwind.config.ts
extend: {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
  },
  // ...
}
```

- [ ] **Step 2: Run verification**
(No easy automated test for this, but manual check of any element with `font-mono` class later)

- [ ] **Step 3: Commit**
```bash
git add tailwind.config.ts
git commit -m "style: add monospace font family for data precision"
```

### Task 2: Consolidated Main Table Header

**Files:**
- Modify: `src/components/admin/sales-targets/SalesTargetsTable.tsx`

- [ ] **Step 1: Refactor COLUMNS to "High-Signal" set**
Consolidate columns to: Vendor, Opportunity (Pain/Buzz/Gap), The Pulse (Trend), and Volume (30d).

```typescript
// src/components/admin/sales-targets/SalesTargetsTable.tsx
const COLUMNS: { key: SortField; label: string; tooltip: string; width?: string }[] = [
  { key: "vendor_name", label: "Vendor", tooltip: "Vendor & Category", width: "w-1/3" },
  { key: "pain_score", label: "Opportunity", tooltip: "Pain, Buzz, and Gap Scores", width: "w-1/4" },
  { key: "trend_direction", label: "The Pulse", tooltip: "Sentiment Trend (30d)", width: "w-1/6" },
  { key: "mentions_30d", label: "Volume", tooltip: "Mentions in the last 30 days", width: "w-1/6" },
];
```

- [ ] **Step 2: Update table header rendering**
Apply `font-mono` to headers and ensure layout is sharp.

- [ ] **Step 3: Commit**
```bash
git add src/components/admin/sales-targets/SalesTargetsTable.tsx
git commit -m "feat: consolidate main table columns for scannability"
```

### Task 3: "Command Center" Row Layout

**Files:**
- Modify: `src/components/admin/sales-targets/SalesTargetsRow.tsx`
- Create: `src/components/admin/sales-targets/ScoreLevelIndicator.tsx`
- Create: `src/components/admin/sales-targets/TrendPulse.tsx`

- [ ] **Step 1: Create ScoreLevelIndicator component**
A component to show a 5-segment bar for scores.

```tsx
// src/components/admin/sales-targets/ScoreLevelIndicator.tsx
export function ScoreLevelIndicator({ score, label, colorClass }: { score: number, label: string, colorClass: string }) {
  const segments = Math.round(score / 20);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase text-zinc-500 font-mono">{label}</span>
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className={`h-1.5 w-3 rounded-sm ${i < segments ? colorClass : 'bg-zinc-800'} ${score >= 70 && i < segments ? 'shadow-[0_0_8px_rgba(248,113,113,0.4)]' : ''}`} 
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TrendPulse component**
A 3-segment visual showing sentiment direction.

```tsx
// src/components/admin/sales-targets/TrendPulse.tsx
export function TrendPulse({ direction }: { direction: string | null }) {
  const getColors = () => {
    if (direction === "improving") return ["bg-green-900/30", "bg-green-900/30", "bg-green-500"];
    if (direction === "declining") return ["bg-red-500", "bg-red-900/30", "bg-red-900/30"];
    return ["bg-zinc-800", "bg-zinc-500", "bg-zinc-800"];
  };
  const colors = getColors();
  return (
    <div className="flex gap-1">
      {colors.map((c, i) => <div key={i} className={`h-3 w-1.5 rounded-full ${c}`} />)}
    </div>
  );
}
```

- [ ] **Step 3: Update SalesTargetsRow main row rendering**
Combine Vendor/Category, use Indicators, and Pulse.

- [ ] **Step 4: Commit**
```bash
git add src/components/admin/sales-targets/SalesTargetsRow.tsx src/components/admin/sales-targets/ScoreLevelIndicator.tsx src/components/admin/sales-targets/TrendPulse.tsx
git commit -m "feat: implement high-signal row components"
```

### Task 4: "Intelligence Dossier" Expanded View

**Files:**
- Modify: `src/components/admin/sales-targets/SalesTargetsRow.tsx`

- [ ] **Step 1: Refactor expanded section into 2-column Briefing/Vital Signs grid**
Hide metrics (NPS, Health, etc.) from main row and move to this view.

- [ ] **Step 2: Style "Strategic Briefing" (AISynopsis wrapper)**
Add "PITCH ANGLE" header and field report styling.

- [ ] **Step 3: Implement "Vital Signs" cards**
A 2x4 grid for metrics like NPS, Health, Feature Gaps, Has Profile, Known Dealers, Total Mentions.

- [ ] **Step 4: Commit**
```bash
git add src/components/admin/sales-targets/SalesTargetsRow.tsx
git commit -m "feat: implement 'Intelligence Dossier' expanded view"
```

### Task 5: Animation and Final Polish

**Files:**
- Modify: `src/components/admin/sales-targets/SalesTargetsRow.tsx`
- Modify: `src/components/admin/sales-targets/DealerSubTable.tsx`
- Modify: `src/components/admin/sales-targets/AISynopsis.tsx`

- [ ] **Step 1: Add staggered entrance animations**
Use CSS transitions or Framer Motion for sliding in dossier sections.

- [ ] **Step 2: Add row hover "crosshair" effect**
```css
/* in tailwind or index.css */
.target-row-hover {
  @apply border border-transparent transition-all;
}
.target-row-hover:hover {
  @apply border-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.05)];
}
```

- [ ] **Step 3: Polish DealerSubTable with "Verified" badges**
Add styling for "Confirmed User" (green), "Likely User" (amber), and "Mentioned Only" (zinc).

- [ ] **Step 4: Commit**
```bash
git add src/components/admin/sales-targets/SalesTargetsRow.tsx src/components/admin/sales-targets/DealerSubTable.tsx src/components/admin/sales-targets/AISynopsis.tsx
git commit -m "style: final visual polish and staggered animations"
```
