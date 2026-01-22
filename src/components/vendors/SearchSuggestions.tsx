import React, { useRef, useEffect } from "react";
import { Building2, Grid3X3, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { categories } from "@/hooks/useVendorFilters";
import { VendorEntry } from "@/hooks/useVendorReviews";

interface SearchSuggestionsProps {
  isOpen: boolean;
  onClose: () => void;
  data: VendorEntry[];
  categoryCounts: Record<string, number>;
  onVendorSelect: (vendorName: string) => void;
  onCategorySelect: (categoryId: string) => void;
  selectedCategory: string;
  searchQuery?: string;
  className?: string;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  isOpen,
  onClose,
  data,
  categoryCounts,
  onVendorSelect,
  onCategorySelect,
  selectedCategory,
  searchQuery = "",
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate top vendors - filter by selected category and search query if provided
  const topVendors = React.useMemo(() => {
    const vendorCounts: Record<string, number> = {};
    let filteredData = selectedCategory && selectedCategory !== "all"
      ? data.filter((entry) => entry.category === selectedCategory)
      : data;
    
    // Filter by search query if provided
    if (searchQuery && searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      filteredData = filteredData.filter((entry) => {
        return entry.vendorName?.toLowerCase().includes(query);
      });
    }
    
    filteredData.forEach((entry) => {
      if (entry.vendorName) {
        vendorCounts[entry.vendorName] = (vendorCounts[entry.vendorName] || 0) + 1;
      }
    });

    return Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));
  }, [data, selectedCategory, searchQuery]);

  // Sort categories by count (excluding "all"), take top ones
  const sortedCategories = React.useMemo(() => {
    return categories
      .filter((cat) => cat.id !== "all")
      .sort((a, b) => {
        const countA = categoryCounts[a.id] || 0;
        const countB = categoryCounts[b.id] || 0;
        return countB - countA;
      })
      .filter((cat) => (categoryCounts[cat.id] || 0) > 0);
  }, [categoryCounts]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Delay to avoid immediate close on focus
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Calculate filtered count based on search query and category
  const filteredCount = React.useMemo(() => {
    let filteredData = selectedCategory && selectedCategory !== "all"
      ? data.filter((entry) => entry.category === selectedCategory)
      : data;
    
    // Filter by search query if provided
    if (searchQuery && searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      filteredData = filteredData.filter((entry) => {
        const matchesVendorName = entry.vendorName?.toLowerCase().includes(query);
        const matchesTitle = entry.title?.toLowerCase().includes(query);
        const matchesQuote = entry.quote?.toLowerCase().includes(query);
        const matchesExplanation = entry.explanation?.toLowerCase().includes(query);
        return matchesVendorName || matchesTitle || matchesQuote || matchesExplanation;
      });
    }
    
    return filteredData.length;
  }, [data, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleVendorClick = (vendorName: string) => {
    onVendorSelect(vendorName);
    onClose();
  };

  const handleCategoryClick = (categoryId: string) => {
    onCategorySelect(categoryId);
    onClose();
  };

  const handleClearCategory = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCategorySelect("all");
    // Don't call onClose() - keep search suggestions open
  };

  const selectedCategoryData = categories.find((cat) => cat.id === selectedCategory);
  const hasCategorySelected = selectedCategory && selectedCategory !== "all";

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-border z-50 overflow-hidden",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
    >
      <div className="p-4 space-y-5">
        {/* Selected Category Banner */}
        {hasCategorySelected && selectedCategoryData && (
          <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedCategoryData.icon}</span>
              <span className="text-sm font-medium text-foreground">
                Showing vendors in <span className="font-semibold text-primary">{selectedCategoryData.label}</span>
              </span>
            </div>
            <button
              onClick={handleClearCategory}
              className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-primary/20 transition-colors group"
              aria-label="Clear category filter"
            >
              <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </button>
          </div>
        )}

        {/* Vendors Section */}
        {topVendors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Top Vendors
              </h3>
              <span className="text-xs text-muted-foreground/60">
                ({topVendors.length})
              </span>
            </div>
            <div className="relative -mx-4">
              <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide scroll-smooth">
                {topVendors.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => handleVendorClick(name)}
                    className={cn(
                      "flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg",
                      "bg-gradient-to-b from-muted/30 to-muted/60 border border-border/50",
                      "hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
                      "transition-all duration-150 group"
                    )}
                  >
                    <span className="text-sm font-medium text-foreground whitespace-nowrap group-hover:text-primary">
                      {name}
                    </span>
                    <span className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded bg-white/60 text-muted-foreground">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
              {/* Fade edges */}
              <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            </div>
          </div>
        )}

        {/* Categories Section - Hide when a category is selected */}
        {sortedCategories.length > 0 && !hasCategorySelected && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Categories
              </h3>
              <span className="text-xs text-muted-foreground/60">
                ({sortedCategories.length})
              </span>
            </div>
            <div className="relative -mx-4">
              <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide scroll-smooth">
                {sortedCategories.map((cat) => {
                  const count = categoryCounts[cat.id] || 0;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat.id)}
                      className={cn(
                        "flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg",
                        "transition-all duration-150 group",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-gradient-to-b from-muted/30 to-muted/60 border border-border/50 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                      )}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span
                        className={cn(
                          "text-sm font-medium whitespace-nowrap",
                          isSelected
                            ? "text-primary-foreground"
                            : "text-foreground group-hover:text-primary"
                        )}
                      >
                        {cat.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums px-1.5 py-0.5 rounded",
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-white/60 text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Fade edges */}
              <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            </div>
          </div>
        )}

        {/* View All Link */}
        <button
          onClick={() => {
            // Just close the suggestions, don't clear the search
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all {filteredCount} reviews
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default SearchSuggestions;
