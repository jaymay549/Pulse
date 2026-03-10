import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Category } from "@/hooks/useVendorFilters";

interface TopVendor {
  name: string;
  logoUrl: string | null;
  reviewCount?: number;
  positiveCount?: number;
  warningCount?: number;
}

interface CategoryGridProps {
  categories: Category[];
  categoryCounts: Record<string, number>;
  topVendorsByCategory: Record<string, TopVendor[]>;
  onCategorySelect: (categoryId: string) => void;
  onVendorSelect?: (vendorName: string) => void;
  maxCategories?: number;
  className?: string;
}

export function CategoryGrid({
  categories,
  categoryCounts,
  topVendorsByCategory,
  onCategorySelect,
  onVendorSelect,
  maxCategories,
  className,
}: CategoryGridProps) {
  const allCategories = categories.filter((cat) => cat.id !== "all");
  const gridCategories = maxCategories ? allCategories.slice(0, maxCategories) : allCategories;

  // Internal hover/active state for the two-panel preview
  const [activeCategory, setActiveCategory] = useState<string>(
    gridCategories[0]?.id || ""
  );

  const activeVendors = topVendorsByCategory[activeCategory] || [];
  const activeCategoryData = gridCategories.find((c) => c.id === activeCategory);

  return (
    <div className={cn("", className)}>
      {/* Section header with "See all" link */}
      <div className="flex items-end justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          Most Popular Vendor Categories
        </h2>
        {activeCategoryData && (
          <button
            onClick={() => onCategorySelect(activeCategory)}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            See all {activeCategoryData.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Two-panel layout: categories list + vendor cards */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel: category list */}
        <div className="lg:w-56 shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {gridCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-foreground/70 border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop: vertical list */}
          <nav className="hidden lg:flex flex-col gap-0.5">
            {gridCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onMouseEnter={() => setActiveCategory(cat.id)}
                  onClick={() => onCategorySelect(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right panel: vendor cards grid */}
        <div className="flex-1 min-w-0">
          {/* "See all" link for the active category on mobile */}
          {activeCategoryData && (
            <div className="flex items-center justify-between mb-3 lg:hidden">
              <span className="text-sm font-semibold text-foreground">
                {activeCategoryData.icon} {activeCategoryData.label}
              </span>
              <button
                onClick={() => onCategorySelect(activeCategory)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                See all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {activeVendors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {activeVendors.map((vendor) => (
                <button
                  key={vendor.name}
                  onClick={() => onVendorSelect?.(vendor.name)}
                  className="text-left p-3 bg-white rounded-xl border border-border/50 hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  {/* Vendor logo */}
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 mb-2 border border-border/50">
                    <AvatarImage src={vendor.logoUrl || undefined} alt={vendor.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm font-bold">
                      {vendor.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Review stats */}
                  {vendor.reviewCount !== undefined && vendor.reviewCount > 0 && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {vendor.positiveCount !== undefined && vendor.positiveCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium text-[10px]">
                          {vendor.positiveCount} rec
                        </span>
                      )}
                      {vendor.warningCount !== undefined && vendor.warningCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium text-[10px]">
                          {vendor.warningCount} concern
                        </span>
                      )}
                    </div>
                  )}

                  {/* Vendor name + review count */}
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {vendor.name}
                  </h3>
                  {vendor.reviewCount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {vendor.reviewCount} review{vendor.reviewCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
              No vendor data available for this category yet
            </div>
          )}

          {/* "See all" button below vendor grid on desktop */}
          {activeCategoryData && activeVendors.length > 0 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => onCategorySelect(activeCategory)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                See all {activeCategoryData.label} vendors
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
