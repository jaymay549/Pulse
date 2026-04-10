import { useState, useMemo, useCallback } from "react";
import { VendorEntry } from "./useVendorReviews";
import { VENDOR_CATEGORIES } from "@/constants/vendorCategories";

export type TypeFilter = "all" | "positive" | "warning" | "negative" | "neutral" | "mixed";

import type { VendorCategory } from "@/constants/vendorCategories";
export type Category = VendorCategory;

export const categories: Category[] = [
  { id: "all", label: "All", icon: "📊", aiHint: "" },
  ...VENDOR_CATEGORIES,
];

// Primary categories shown by default (top 6)
export const primaryCategories = categories.slice(0, 7);

// Secondary categories shown when "More" is clicked
export const secondaryCategories = categories.slice(7);

interface UseVendorFiltersOptions {
  data: VendorEntry[];
  selectedVendor?: string | null;
  externalCategoryCounts?: Record<string, number>;
  externalPositiveCount?: number;
  externalWarningCount?: number;
  externalTotalCount?: number;
}

interface UseVendorFiltersReturn {
  // State
  selectedCategory: string;
  searchQuery: string;
  typeFilter: TypeFilter;
  showMoreCategories: boolean;

  // Setters
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setTypeFilter: (filter: TypeFilter) => void;
  setShowMoreCategories: (show: boolean) => void;
  clearSearch: () => void;
  resetFilters: () => void;

  // Derived state
  filteredData: VendorEntry[];
  categoryCounts: Record<string, number>;
  vendorsInCategory: { name: string; count: number }[];
  selectedCategoryData: Category | undefined;
  positiveCount: number;
  warningCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
}

export function useVendorFilters({
  data,
  selectedVendor,
  externalCategoryCounts,
  externalPositiveCount,
  externalWarningCount,
  externalTotalCount
}: UseVendorFiltersOptions): UseVendorFiltersReturn {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showMoreCategories, setShowMoreCategories] = useState(false);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedCategory("all");
    setSearchQuery("");
    setTypeFilter("all");
  }, []);

  // Calculate counts per category
  const categoryCounts = useMemo(() => {
    if (externalCategoryCounts) return externalCategoryCounts;

    const counts: Record<string, number> = {};
    counts["all"] = data.length;
    categories.forEach(cat => {
      if (cat.id !== "all") {
        counts[cat.id] = data.filter(entry =>
          entry.category === cat.id ||
          ((cat.id === "dms" || cat.id === "crm") && entry.category === "dms-crm")
        ).length;
      }
    });
    return counts;
  }, [data, externalCategoryCounts]);

  // Filter and sort data based on all filters
  // NOTE: Search filtering is handled SERVER-SIDE via API params. We don't re-filter by searchQuery here
  // because vendor names may be redacted for non-pro users, causing client-side search to fail.
  // Category and type filters are applied client-side for UI responsiveness.
  const filteredData = useMemo(() => {
    const filtered = data.filter(entry => {
      const matchesCategory =
        selectedCategory === "all" ||
        entry.category === selectedCategory ||
        ((selectedCategory === "dms" || selectedCategory === "crm") && entry.category === "dms-crm");
      const matchesType = typeFilter === "all" || entry.type === typeFilter;

      return matchesCategory && matchesType;
    });

    // Return filtered data in the order received from the server (sorted by date)
    return filtered;
  }, [data, selectedCategory, typeFilter]);

  // Get unique vendors within selected category
  // Note: This should always show ALL vendors in the category, regardless of search query
  // The sidebar needs to show all vendors so users can browse and select different ones
  const vendorsInCategory = useMemo(() => {
    if (selectedCategory === "all") return [];

    const vendorCounts: Record<string, number> = {};
    const categoryData = data.filter(entry =>
      entry.category === selectedCategory ||
      ((selectedCategory === "dms" || selectedCategory === "crm") && entry.category === "dms-crm")
    );

    categoryData.forEach(entry => {
      if (entry.vendorName) {
        vendorCounts[entry.vendorName] = (vendorCounts[entry.vendorName] || 0) + 1;
      }
    });

    return Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [data, selectedCategory]);

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  // Calculate type counts (before type filter is applied)
  // NOTE: Search filtering is handled server-side, so we only filter by category here
  const dataBeforeTypeFilter = useMemo(() => {
    return data.filter(entry => {
      const matchesCategory =
        selectedCategory === "all" ||
        entry.category === selectedCategory ||
        ((selectedCategory === "dms" || selectedCategory === "crm") && entry.category === "dms-crm");
      return matchesCategory;
    });
  }, [data, selectedCategory]);

  const positiveCount = externalPositiveCount ?? dataBeforeTypeFilter.filter(e => e.type === "positive").length;
  const warningCount = externalWarningCount ?? dataBeforeTypeFilter.filter(e => e.type === "warning" || e.type === "negative").length;
  const totalCount = externalTotalCount ?? dataBeforeTypeFilter.length;

  const hasActiveFilters = selectedCategory !== "all" || searchQuery !== "" || typeFilter !== "all";

  return {
    selectedCategory,
    searchQuery,
    typeFilter,
    showMoreCategories,
    setSelectedCategory,
    setSearchQuery,
    setTypeFilter,
    setShowMoreCategories,
    clearSearch,
    resetFilters,
    filteredData,
    categoryCounts,
    vendorsInCategory,
    selectedCategoryData,
    positiveCount,
    warningCount,
    totalCount,
    hasActiveFilters,
  };
}
