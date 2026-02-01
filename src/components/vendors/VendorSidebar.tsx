import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Category, categories } from "@/hooks/useVendorFilters";

interface VendorSidebarProps {
  selectedCategory: string;
  onCategorySelect: (categoryId: string) => void;
  categoryCounts: Record<string, number>;
  vendorsInCategory: { name: string; count: number }[];
  showMoreCategories: boolean;
  onToggleMoreCategories: () => void;
  onVendorSelect?: (vendorName: string) => void;
  selectedVendor?: string;
  className?: string;
}

export const VendorSidebar: React.FC<VendorSidebarProps> = ({
  selectedCategory,
  onCategorySelect,
  categoryCounts,
  vendorsInCategory,
  showMoreCategories,
  onToggleMoreCategories,
  onVendorSelect,
  selectedVendor,
  className,
}) => {
  // Track promoted category (selected from secondary, temporarily shown in primary)
  const [promotedCategory, setPromotedCategory] = React.useState<string | null>(null);

  // Sort categories by mention count (descending), keeping "All" at the top
  const sortedCategories = React.useMemo(() => {
    const allCategory = categories.find(cat => cat.id === "all");
    const otherCategories = categories.filter(cat => cat.id !== "all");
    
    // Sort by mention count (descending)
    const sorted = otherCategories.sort((a, b) => {
      const countA = categoryCounts[a.id] || 0;
      const countB = categoryCounts[b.id] || 0;
      return countB - countA;
    });
    
    // Put "All" first, then sorted categories
    return allCategory ? [allCategory, ...sorted] : sorted;
  }, [categoryCounts]);

  // Sync promotion state when selectedCategory changes externally
  React.useEffect(() => {
    const basePrimary = sortedCategories.slice(0, 7);
    const baseSecondary = sortedCategories.slice(7);
    const isSecondaryCategory = baseSecondary.some(cat => cat.id === selectedCategory);
    
    setPromotedCategory(currentPromoted => {
      // Don't change if selected category is already the promoted one
      if (selectedCategory === currentPromoted) {
        return currentPromoted;
      }
      
      if (isSecondaryCategory) {
        // If selected category is secondary, promote it
        return selectedCategory;
      } else {
        // If selected category is primary, clear promotion
        return null;
      }
    });
  }, [selectedCategory, sortedCategories]);

  // Handle category selection with promotion logic
  const handleCategorySelect = React.useCallback((categoryId: string) => {
    // Check if this category is in the secondary list (before promotion)
    const basePrimary = sortedCategories.slice(0, 7);
    const baseSecondary = sortedCategories.slice(7);
    const isSecondaryCategory = baseSecondary.some(cat => cat.id === categoryId);
    
    // If selecting a secondary category, promote it and collapse "More"
    if (isSecondaryCategory) {
      setPromotedCategory(categoryId);
      // Collapse "More" section if it's currently open
      if (showMoreCategories) {
        onToggleMoreCategories();
      }
    } else if (categoryId !== promotedCategory) {
      // If selecting a different primary category (not the currently promoted one), clear promotion
      setPromotedCategory(null);
    }
    // If selecting the currently promoted category from primary list, keep it promoted
    
    onCategorySelect(categoryId);
  }, [sortedCategories, promotedCategory, showMoreCategories, onToggleMoreCategories, onCategorySelect]);

  // Split into primary and secondary, with promoted category moved to primary
  const { primaryCategoriesSorted, secondaryCategoriesSorted } = React.useMemo(() => {
    const basePrimary = sortedCategories.slice(0, 7);
    const baseSecondary = sortedCategories.slice(7);
    
    // If a category is promoted, move it to primary (at the bottom, before "More")
    if (promotedCategory) {
      const promotedCat = baseSecondary.find(cat => cat.id === promotedCategory);
      if (promotedCat) {
        // Remove from secondary
        const newSecondary = baseSecondary.filter(cat => cat.id !== promotedCategory);
        // Add to primary (at the end, before "More")
        const newPrimary = [...basePrimary, promotedCat];
        return {
          primaryCategoriesSorted: newPrimary,
          secondaryCategoriesSorted: newSecondary,
        };
      }
    }
    
    return {
      primaryCategoriesSorted: basePrimary,
      secondaryCategoriesSorted: baseSecondary,
    };
  }, [sortedCategories, promotedCategory]);

  return (
    <aside className={cn("w-60 flex-shrink-0", className)}>
      <div className="sticky top-20 space-y-6">
        {/* Categories Section */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            Categories
          </h3>
          <nav className="space-y-1">
            {primaryCategoriesSorted.map((cat) => (
              <CategoryButton
                key={cat.id}
                category={cat}
                count={categoryCounts[cat.id] || 0}
                isSelected={selectedCategory === cat.id}
                onClick={() => handleCategorySelect(cat.id)}
              />
            ))}

            {/* More Categories Expander */}
            {secondaryCategoriesSorted.length > 0 && (
              <>
                <button
                  onClick={onToggleMoreCategories}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {showMoreCategories ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    More ({secondaryCategoriesSorted.length})
                  </span>
                </button>

                {showMoreCategories && (
                  <div className="pl-2 space-y-1">
                    {secondaryCategoriesSorted.map((cat) => (
                      <CategoryButton
                        key={cat.id}
                        category={cat}
                        count={categoryCounts[cat.id] || 0}
                        isSelected={selectedCategory === cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </nav>
        </div>

        {/* Vendors in Category Section */}
        {selectedCategory !== "all" && vendorsInCategory.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              Showing vendors in {categories.find(c => c.id === selectedCategory)?.label || selectedCategory}
            </h3>
            <nav className="space-y-0.5 max-h-64 overflow-y-auto scrollbar-hide">
              {vendorsInCategory.slice(0, 15).map(({ name, count }) => (
                <button
                  key={name}
                  onClick={() => onVendorSelect?.(name)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors",
                    selectedVendor === name
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="truncate">{name}</span>
                  <span className={cn(
                    "text-xs tabular-nums",
                    selectedVendor === name ? "opacity-80" : "opacity-60"
                  )}>
                    {count}
                  </span>
                </button>
              ))}
              {vendorsInCategory.length > 15 && (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  +{vendorsInCategory.length - 15} more vendors
                </p>
              )}
            </nav>
          </div>
        )}
      </div>
    </aside>
  );
};

interface CategoryButtonProps {
  category: Category;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

const CategoryButton: React.FC<CategoryButtonProps> = ({
  category,
  count,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground font-medium"
          : "text-foreground hover:bg-muted/50"
      )}
    >
      <span className="flex items-center gap-2">
        <span>{category.icon}</span>
        <span>{category.label}</span>
      </span>
      <span className={cn(
        "text-xs font-medium tabular-nums px-1.5 py-0.5 rounded",
        isSelected
          ? "bg-primary-foreground/20"
          : "bg-muted text-muted-foreground"
      )}>
        {count}
      </span>
    </button>
  );
};

export default VendorSidebar;
