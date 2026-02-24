# Homepage Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the CDG Pulse main page to follow G2's category-grid launchpad pattern, with content that adapts by user type (anonymous/free/pro) to tell the product story and pitch upgrades.

**Architecture:** The landing state of VendorsV2 is replaced with new section components (CategoryGrid, ValuePropSection, HowItWorksSection, QuickTipsSection) that render conditionally based on auth/tier state. When a category is selected, the page transitions to the existing category+review view with a condensed hero and breadcrumb. No new routes or data hooks needed - top vendors per category are derived from initial mention data.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Framer Motion, Lucide React icons, shadcn/ui components

---

## Reference Files

Before starting, read these files to understand existing patterns:

- `src/pages/VendorsV2.tsx` - Main page to modify (line 719+ is the JSX)
- `src/components/vendors/index.ts` - Component barrel exports
- `src/hooks/useVendorFilters.ts` - Category definitions (lines 12-31)
- `src/components/vendors/CategoryPills.tsx` - Existing category component (reused in category view)
- `src/components/vendors/TrendingVendorChips.tsx` - Will be removed from landing
- `src/components/vendors/VendorCard.tsx` - Existing review card (unchanged)
- `src/index.css` - Design tokens and CSS variables
- `tailwind.config.ts` - Tailwind theme config
- `docs/plans/2026-02-23-homepage-redesign-design.md` - Full design spec

---

### Task 1: Create CategoryGrid Component

**Files:**
- Create: `src/components/vendors/CategoryGrid.tsx`
- Modify: `src/components/vendors/index.ts`

**Step 1: Create CategoryGrid.tsx**

Create the category grid component that displays category cards in a responsive grid. Each card shows the category icon, name, review count, and top vendor logos.

```tsx
// src/components/vendors/CategoryGrid.tsx
import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Category } from "@/hooks/useVendorFilters";

interface TopVendor {
  name: string;
  logoUrl: string | null;
}

interface CategoryGridProps {
  categories: Category[];
  categoryCounts: Record<string, number>;
  topVendorsByCategory: Record<string, TopVendor[]>;
  onCategorySelect: (categoryId: string) => void;
  className?: string;
}

export function CategoryGrid({
  categories,
  categoryCounts,
  topVendorsByCategory,
  onCategorySelect,
  className,
}: CategoryGridProps) {
  // Filter out "all" and sort by count descending
  const gridCategories = categories
    .filter((cat) => cat.id !== "all")
    .sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0));

  return (
    <div className={cn("", className)}>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Browse by Category
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {gridCategories.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          const topVendors = topVendorsByCategory[cat.id] || [];
          const displayVendors = topVendors.slice(0, 3);
          const overflowCount = topVendors.length - 3;

          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className="text-left p-4 bg-white rounded-xl border border-border/50 hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {count} review{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
              </div>

              {/* Top vendor logos */}
              {displayVendors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {displayVendors.map((vendor) => (
                    <Avatar key={vendor.name} className="h-6 w-6 border border-border/50">
                      <AvatarImage src={vendor.logoUrl || undefined} alt={vendor.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                        {vendor.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflowCount > 0 && (
                    <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                      +{overflowCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Add export to barrel file**

Add to `src/components/vendors/index.ts`:
```ts
export { CategoryGrid } from "./CategoryGrid";
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds (component not yet used)

**Step 4: Commit**

```bash
git add src/components/vendors/CategoryGrid.tsx src/components/vendors/index.ts
git commit -m "feat: add CategoryGrid component for G2-style landing page"
```

---

### Task 2: Create ValuePropSection Component

**Files:**
- Create: `src/components/vendors/ValuePropSection.tsx`
- Modify: `src/components/vendors/index.ts`

**Step 1: Create ValuePropSection.tsx**

Static component for anonymous users. 3-column feature highlights.

```tsx
// src/components/vendors/ValuePropSection.tsx
import React from "react";
import { MessageSquare, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValuePropSectionProps {
  className?: string;
}

const VALUE_PROPS = [
  {
    icon: MessageSquare,
    title: "Real Dealer Reviews",
    description: "Community-sourced insights from verified auto dealers in CDG Circles. No fake reviews, no vendor spin.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Insights",
    description: "Ask anything about vendors and get instant answers powered by real dealer conversations.",
  },
  {
    icon: BarChart3,
    title: "Track Vendor Sentiment",
    description: "See recommendations and warnings at a glance. Know what dealers really think before you buy.",
  },
];

export function ValuePropSection({ className }: ValuePropSectionProps) {
  return (
    <div className={cn("", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {VALUE_PROPS.map((prop) => (
          <div key={prop.title} className="text-center px-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-3">
              <prop.icon className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">
              {prop.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {prop.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add export to barrel file**

Add to `src/components/vendors/index.ts`:
```ts
export { ValuePropSection } from "./ValuePropSection";
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/vendors/ValuePropSection.tsx src/components/vendors/index.ts
git commit -m "feat: add ValuePropSection for anonymous user landing"
```

---

### Task 3: Create HowItWorksSection Component

**Files:**
- Create: `src/components/vendors/HowItWorksSection.tsx`
- Modify: `src/components/vendors/index.ts`

**Step 1: Create HowItWorksSection.tsx**

Static 3-step explainer for anonymous users.

```tsx
// src/components/vendors/HowItWorksSection.tsx
import React from "react";
import { Search, BookOpen, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HowItWorksSectionProps {
  className?: string;
}

const STEPS = [
  {
    icon: Search,
    step: "1",
    title: "Search or Browse",
    description: "Find vendors by name or explore categories like DMS, CRM, F&I, and more.",
  },
  {
    icon: BookOpen,
    step: "2",
    title: "Read Real Reviews",
    description: "See what verified dealers are actually saying — the good and the bad.",
  },
  {
    icon: CheckCircle,
    step: "3",
    title: "Make Informed Decisions",
    description: "Compare vendors with confidence using community-driven intelligence.",
  },
];

export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  return (
    <div className={cn("", className)}>
      <h2 className="text-xl font-bold text-foreground text-center mb-6">
        How It Works
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STEPS.map((step) => (
          <div key={step.step} className="text-center px-2">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-secondary/20 text-yellow-700 font-bold text-lg mb-3">
              {step.step}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">
              {step.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add export to barrel file**

Add to `src/components/vendors/index.ts`:
```ts
export { HowItWorksSection } from "./HowItWorksSection";
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/vendors/HowItWorksSection.tsx src/components/vendors/index.ts
git commit -m "feat: add HowItWorksSection for anonymous user landing"
```

---

### Task 4: Create QuickTipsSection Component

**Files:**
- Create: `src/components/vendors/QuickTipsSection.tsx`
- Modify: `src/components/vendors/index.ts`

**Step 1: Create QuickTipsSection.tsx**

Tip cards for signed-in free users with contextual CTAs.

```tsx
// src/components/vendors/QuickTipsSection.tsx
import React from "react";
import { Lightbulb, Sparkles, AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickTipsSectionProps {
  onAISubmit?: (query: string) => void;
  className?: string;
}

const TIPS = [
  {
    icon: Sparkles,
    title: "Compare Vendors with AI",
    description: "Try asking: \"Compare CDK vs Reynolds\" in the search bar to get an instant AI breakdown.",
    color: "text-primary bg-primary/10",
  },
  {
    icon: AlertTriangle,
    title: "Spot Red Flags Early",
    description: "Upgrade to Pro to filter by warnings and see what dealers are cautioning others about.",
    color: "text-red-600 bg-red-50",
  },
  {
    icon: Layers,
    title: "Browse by Category",
    description: "Explore DMS, CRM, F&I, and 14 more categories to find the right vendors for your dealership.",
    color: "text-yellow-700 bg-yellow-50",
  },
];

export function QuickTipsSection({ className }: QuickTipsSectionProps) {
  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-4 w-4 text-yellow-600" />
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
          Tips to Get Started
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className="p-4 bg-white rounded-xl border border-border/50"
          >
            <div className={cn("inline-flex items-center justify-center h-8 w-8 rounded-lg mb-2.5", tip.color)}>
              <tip.icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {tip.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tip.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add export to barrel file**

Add to `src/components/vendors/index.ts`:
```ts
export { QuickTipsSection } from "./QuickTipsSection";
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/vendors/QuickTipsSection.tsx src/components/vendors/index.ts
git commit -m "feat: add QuickTipsSection for free user landing"
```

---

### Task 5: Compute Top Vendors Per Category Data

**Files:**
- Modify: `src/pages/VendorsV2.tsx`

This task adds a `useMemo` that derives top vendors per category from the already-loaded mention data. No new API calls.

**Step 1: Add state and memo**

In `VendorsV2.tsx`, after the `mentions` useMemo (around line 194), add:

```tsx
// Derive top vendors per category from loaded mentions (for CategoryGrid)
const topVendorsByCategory = useMemo(() => {
  const result: Record<string, { name: string; logoUrl: string | null }[]> = {};

  // Group mentions by category, count vendors within each
  const categoryVendorMap: Record<string, Record<string, number>> = {};

  for (const mention of mentions) {
    if (!mention.category || !mention.vendorName) continue;
    if (!categoryVendorMap[mention.category]) {
      categoryVendorMap[mention.category] = {};
    }
    const vendorKey = mention.vendorName.toLowerCase();
    categoryVendorMap[mention.category][vendorKey] =
      (categoryVendorMap[mention.category][vendorKey] || 0) + 1;
  }

  // For each category, get top vendors by mention count
  for (const [categoryId, vendors] of Object.entries(categoryVendorMap)) {
    const sorted = Object.entries(vendors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    result[categoryId] = sorted.map(([vendorKey]) => {
      // Find the original casing from mentions
      const original = mentions.find(
        (m) => m.vendorName?.toLowerCase() === vendorKey
      );
      const name = original?.vendorName || vendorKey;
      const websiteUrl = getWebsiteForVendor(name);
      const logoUrl = getVendorLogoUrl(name, websiteUrl);
      return { name, logoUrl };
    });
  }

  return result;
}, [mentions, getWebsiteForVendor, getVendorLogoUrl]);
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (memo defined but not yet consumed in JSX)

**Step 3: Commit**

```bash
git add src/pages/VendorsV2.tsx
git commit -m "feat: derive top vendors per category for category grid"
```

---

### Task 6: Rewire VendorsV2 Landing State

**Files:**
- Modify: `src/pages/VendorsV2.tsx`

This is the main integration task. The landing state (when `selectedCategory === "all"` and `selectedVendor === null` and no AI query active) changes from showing CategoryPills + TrendingVendorChips + review feed to showing the new section components.

**Step 1: Update imports**

Add the new components to the import block in VendorsV2.tsx (around line 14-24):

```tsx
import {
  VendorCard,
  VendorCardDetail,
  AIInsightBanner,
  FilterBar,
  UpgradeTeaser,
  TrendingVendorChips,
  CategoryPills,
  InlineAIChat,
  UpgradePromptCard,
  CategoryGrid,
  ValuePropSection,
  HowItWorksSection,
  QuickTipsSection,
} from "@/components/vendors";
```

Also add `ChevronLeft` to the lucide-react import:

```tsx
import { Search, Crown, Share2, CreditCard, ArrowRight, Building2, Shield, ChevronLeft } from "lucide-react";
```

**Step 2: Add helper boolean for landing state**

After the `isProUserValue` line (around line 200), add:

```tsx
// Landing state = no category/vendor/AI selected
const isLandingState = selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt;
```

**Step 3: Replace the main content JSX**

The main content area (inside `<div className="max-w-7xl mx-auto ...">`, starting around line 826) needs restructuring. The key changes:

**A) Condense the hero when not on landing:**

Replace the hero section conditional (lines ~828-843) with:

```tsx
{/* Hero -- full on landing, condensed on category/vendor view */}
{isLandingState && (
  <div className="max-w-2xl mx-auto text-center pt-8 sm:pt-12 pb-6">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/30 text-xs font-semibold text-yellow-800 mb-4">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
      </span>
      Updated Daily
    </div>
    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-6 leading-[1.1] tracking-tight">
      What do you want to know about{" "}
      <span className="text-yellow-600">auto vendors</span>?
    </h1>
  </div>
)}

{/* Breadcrumb -- shown when category or vendor is selected */}
{!isLandingState && selectedCategory !== "all" && (
  <button
    onClick={() => handleCategoryChange("all")}
    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4 mb-2"
  >
    <ChevronLeft className="h-4 w-4" />
    All Categories
  </button>
)}
```

**B) Keep the search bar section as-is** (lines ~846-919) - it works for all states.

**C) Replace everything after the search bar section** (from CategoryPills through the review grid, ~lines 922-1165) with the new conditional rendering:

```tsx
{/* === LANDING STATE: Category grid + pitch sections === */}
{isLandingState && (
  <div className="mt-8 space-y-12">
    {/* Value prop - anonymous only */}
    {!isAuthenticated && (
      <ValuePropSection />
    )}

    {/* Quick tips - signed-in free users only */}
    {isAuthenticated && !isProUserValue && (
      <QuickTipsSection />
    )}

    {/* Category Grid - all users */}
    <CategoryGrid
      categories={sortedCategories}
      categoryCounts={categoryCounts}
      topVendorsByCategory={topVendorsByCategory}
      onCategorySelect={handleCategoryChange}
    />

    {/* How it works - anonymous only */}
    {!isAuthenticated && (
      <HowItWorksSection />
    )}

    {/* Pricing - anonymous only */}
    {!isAuthenticated && (
      <VendorPricingTiers
        totalReviews={paginationInfo?.totalSystemCount ?? wamMentions.length}
        totalWarnings={totalWarningCountValue}
        onSignInClick={() => setShowSignIn(true)}
      />
    )}

    {/* Upgrade banner - signed-in free users */}
    {isAuthenticated && !isProUserValue && (
      <div className="p-6 rounded-xl bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border-2 border-yellow-400/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-yellow-500/20">
            <Crown className="h-7 w-7 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Unlock Full Access
            </h3>
            <p className="text-muted-foreground text-sm">
              See all {paginationInfo?.totalSystemCount ?? wamMentions.length} reviews, warnings, and AI insights.
            </p>
          </div>
        </div>
        <Button
          variant="yellow"
          size="lg"
          className="font-bold whitespace-nowrap"
          onClick={() => setShowUpgradeModal(true)}
        >
          <Crown className="h-4 w-4 mr-2" />
          Upgrade to Pro
        </Button>
      </div>
    )}
  </div>
)}

{/* === CATEGORY/VENDOR STATE: Existing filtered view === */}
{!isLandingState && (
  <div className="mt-6">
    {/* Category Pills - for switching between categories */}
    <CategoryPills
      categories={sortedCategories}
      selectedCategory={selectedCategory}
      categoryCounts={categoryCounts}
      onCategorySelect={handleCategoryChange}
    />

    <div className="mt-6">
      {/* AI Insight Banner */}
      {(selectedVendor !== null || selectedCategory !== "all") && (
        <AIInsightBanner
          data={wamMentions}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          selectedVendor={selectedVendor}
          isProUser={isProUserValue}
          getToken={getToken}
          onUpgradeClick={() => setShowUpgradeModal(true)}
          className="mb-6"
        />
      )}

      {/* Filter Bar -- only when vendor selected */}
      {selectedVendor !== null && (
        <div className="mb-6">
          <FilterBar
            typeFilter={typeFilter}
            onTypeFilterChange={handleTypeFilterChange}
            positiveCount={positiveCount}
            warningCount={warningCount}
            totalCount={totalCount}
            canAccessWarnings={accessLevel.unlimitedAccess}
            onWarningsLocked={() => setShowUpgradeModal(true)}
          />
        </div>
      )}

      {/* Category Vendors Section */}
      {selectedCategory !== "all" && categoryVendors.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Vendors ({categoryVendors.length})
            </h2>
          </div>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {categoryVendors.map((vendor) => {
              const vendorWebsiteUrl = getWebsiteForVendor(vendor.name);
              const vendorLogoUrl = getVendorLogoUrl(vendor.name, vendorWebsiteUrl);

              return (
                <button
                  key={vendor.name}
                  onClick={() => handleVendorSelect(vendor.name)}
                  className="text-left p-3 sm:p-4 bg-white rounded-lg border border-border/50 hover:border-primary/50 hover:shadow-md transition-all group shrink-0 w-[280px] sm:w-[300px]"
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border/50 shrink-0">
                      <AvatarImage src={vendorLogoUrl || undefined} alt={vendor.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs sm:text-sm">
                        {vendor.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {vendor.name}
                        </h3>
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{vendor.reviewCount} review{vendor.reviewCount !== 1 ? "s" : ""}</span>
                        {vendor.positiveCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium text-xs">
                            {vendor.positiveCount} positive
                          </span>
                        )}
                        {vendor.warningCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium text-xs">
                            {vendor.warningCount} warning{vendor.warningCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Grid */}
      {visibleEntries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {visibleEntries.map((entry) => {
            const isSearchingAsNonPro = !isProUserValue && searchQuery.trim().length > 0;
            const isLocked = entry.isLocked === true || isSearchingAsNonPro || !isAuthenticated;
            const showVendorNames = isSearchingAsNonPro ? false : !!entry.vendorName;

            const vendorWebsiteUrl = entry.vendorName ? getWebsiteForVendor(entry.vendorName) : null;
            const vendorLogoUrl = entry.vendorName ? getVendorLogoUrl(entry.vendorName, vendorWebsiteUrl) : null;
            const vendorResponse = responses[Number(entry.id)] || null;

            return (
              <VendorCard
                key={entry.id}
                entry={entry}
                isLocked={isLocked}
                showVendorNames={showVendorNames}
                isFullAccess={accessLevel.unlimitedAccess}
                isAuthenticated={isAuthenticated}
                vendorResponse={vendorResponse}
                vendorWebsite={vendorWebsiteUrl}
                vendorLogo={vendorLogoUrl}
                onCardClick={(e) => setSelectedCard(e)}
                onVendorClick={handleVendorSelect}
                onUpgradeClick={() => {
                  if (isAuthenticated) {
                    setShowUpgradeModal(true);
                  } else {
                    window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                  }
                }}
              />
            );
          })}

          {/* Teaser Card */}
          {showTeaserCard && (
            <UpgradeTeaser
              remainingCount={remainingCount}
              isAuthenticated={isAuthenticated}
              onUpgradeClick={() => {
                if (isAuthenticated) {
                  setShowUpgradeModal(true);
                } else {
                  window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                }
              }}
            />
          )}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {isProUserValue && paginationInfo?.hasMore && visibleEntries.length > 0 && (
        <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Loading more reviews...</span>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isWamLoading && filteredData.length === 0 && (
        <div className="text-center py-16">
          <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">No reviews found</h3>
          <p className="text-muted-foreground">Try selecting a different category</p>
        </div>
      )}

      {/* Loading State */}
      {isWamLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Upgrade sections for non-pro in category view */}
      {!accessLevel.unlimitedAccess && !isAuthenticated && (
        <VendorPricingTiers
          totalReviews={paginationInfo?.totalSystemCount ?? wamMentions.length}
          totalWarnings={totalWarningCountValue}
          onSignInClick={() => setShowSignIn(true)}
        />
      )}

      {!accessLevel.unlimitedAccess && isAuthenticated && (
        <div className="mt-8">
          <div className="p-6 rounded-xl bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border-2 border-yellow-400/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/20">
                <Crown className="h-7 w-7 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Upgrade to See All Reviews</h3>
                <p className="text-muted-foreground text-sm">
                  Unlock all {paginationInfo?.totalSystemCount ?? wamMentions.length} reviews including {totalWarningCountValue} warnings.
                </p>
              </div>
            </div>
            <Button
              variant="yellow"
              size="lg"
              className="font-bold whitespace-nowrap"
              onClick={() => setShowUpgradeModal(true)}
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Unlock
            </Button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Visual verification**

Run: `npm run dev`
Verify:
- Landing page shows hero + search + category grid (no review feed, no trending chips)
- Anonymous users see value props + how it works + pricing
- Clicking a category shows breadcrumb + pills + vendor listing + reviews
- Clicking "All Categories" breadcrumb returns to landing grid
- AI search still works from landing state
- Vendor search autocomplete still works

**Step 6: Commit**

```bash
git add src/pages/VendorsV2.tsx
git commit -m "feat: rewire VendorsV2 landing state with category grid and pitch sections"
```

---

### Task 7: Clean Up Dead Code

**Files:**
- Modify: `src/pages/VendorsV2.tsx`

**Step 1: Remove TrendingVendorChips import if unused**

Check if `TrendingVendorChips` is still referenced anywhere in VendorsV2.tsx. If the landing-state refactor removed its only usage, remove it from the import statement.

Remove from the import block:
```tsx
TrendingVendorChips,
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no unused import warnings

**Step 3: Commit**

```bash
git add src/pages/VendorsV2.tsx
git commit -m "chore: remove unused TrendingVendorChips import from landing page"
```

---

### Task 8: Final Visual QA and Polish

**Files:**
- Potentially: any of the new components or `VendorsV2.tsx`

**Step 1: Run dev server and test all states**

Run: `npm run dev`

Test matrix:
- [ ] Anonymous landing: hero + value props + category grid + how it works + pricing
- [ ] Signed-in free landing: hero + tips + category grid + upgrade banner
- [ ] Pro landing: hero (condensed) + category grid
- [ ] Category selected: breadcrumb + pills + vendor cards + review feed
- [ ] Vendor selected: existing behavior unchanged
- [ ] AI query from landing: inline chat appears correctly
- [ ] Mobile responsive: grid collapses to 1 column, everything stacks
- [ ] Tablet: grid is 2 columns

**Step 2: Fix any visual issues found**

Adjust spacing, typography, or responsive breakpoints as needed.

**Step 3: Production build check**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish: final visual QA adjustments for homepage redesign"
```
