import { useState, useMemo, useCallback } from "react";
import { VendorEntry } from "./useVendorReviews";

export type TypeFilter = "all" | "positive" | "warning";

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export const categories: Category[] = [
  { id: "all", label: "All", icon: "📊" },
  { id: "dms-crm", label: "DMS & CRM", icon: "💻" },
  { id: "digital-retailing", label: "Digital Retailing", icon: "🛒" },
  { id: "marketing", label: "Marketing & Ads", icon: "📣" },
  { id: "fixed-ops", label: "Fixed Ops", icon: "🔧" },
  { id: "ai-automation", label: "AI & Automation", icon: "🤖" },
  { id: "equity-mining", label: "Equity Mining", icon: "💎" },
  { id: "recon", label: "Reconditioning", icon: "🚗" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "training", label: "Training", icon: "🎓" },
  { id: "accounting", label: "Accounting", icon: "📊" },
  { id: "hr-payroll", label: "HR & Payroll", icon: "👥" },
  { id: "service-products", label: "Service Products", icon: "🧴" },
  { id: "diagnostics", label: "Diagnostics", icon: "🔍" },
  { id: "security", label: "Security & Tracking", icon: "🔐" },
  { id: "lead-providers", label: "Lead Providers", icon: "📞" },
  { id: "call-management", label: "Call Management", icon: "📱" },
  { id: "it-support", label: "IT Support", icon: "🖥️" },
];

// Primary categories shown by default (top 6)
export const primaryCategories = categories.slice(0, 7);

// Secondary categories shown when "More" is clicked
export const secondaryCategories = categories.slice(7);

interface UseVendorFiltersOptions {
  data: VendorEntry[];
  selectedVendor?: string | null;
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

export function useVendorFilters({ data, selectedVendor }: UseVendorFiltersOptions): UseVendorFiltersReturn {
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
    const counts: Record<string, number> = {};
    counts["all"] = data.length;
    categories.forEach(cat => {
      if (cat.id !== "all") {
        counts[cat.id] = data.filter(entry => entry.category === cat.id).length;
      }
    });
    return counts;
  }, [data]);

  // Filter and sort data based on all filters
  const filteredData = useMemo(() => {
    const filtered = data.filter(entry => {
      const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
      const matchesType = typeFilter === "all" || entry.type === typeFilter;

      if (searchQuery === "") return matchesCategory && matchesType;

      const query = searchQuery.toLowerCase();
      
      // When a vendor is selected (from sidebar/suggestions), only match on vendorName exactly
      // This prevents showing entries for other vendors that just mention the selected vendor
      if (selectedVendor && selectedVendor.trim().toLowerCase() === query) {
        const matchesVendorName = entry.vendorName?.toLowerCase() === query;
        return matchesCategory && matchesType && matchesVendorName;
      }
      
      // Freeform search: allow matching in all fields
      const matchesVendorName = entry.vendorName?.toLowerCase().includes(query);
      const matchesTitle = entry.title?.toLowerCase().includes(query);
      const matchesQuote = entry.quote?.toLowerCase().includes(query);
      const matchesExplanation = entry.explanation?.toLowerCase().includes(query);

      return matchesCategory && matchesType && (matchesVendorName || matchesTitle || matchesQuote || matchesExplanation);
    });

    // Shuffle results randomly for variety on each load
    return [...filtered].sort(() => Math.random() - 0.5);
  }, [data, selectedCategory, typeFilter, searchQuery, selectedVendor]);

  // Get unique vendors within selected category
  // Note: This should always show ALL vendors in the category, regardless of search query
  // The sidebar needs to show all vendors so users can browse and select different ones
  const vendorsInCategory = useMemo(() => {
    if (selectedCategory === "all") return [];

    const vendorCounts: Record<string, number> = {};
    const categoryData = data.filter(entry => entry.category === selectedCategory);
    
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
  const dataBeforeTypeFilter = useMemo(() => {
    return data.filter(entry => {
      const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
      if (searchQuery === "") return matchesCategory;

      const query = searchQuery.toLowerCase();
      
      // When a vendor is selected (from sidebar/suggestions), only match on vendorName exactly
      if (selectedVendor && selectedVendor.trim().toLowerCase() === query) {
        const matchesVendorName = entry.vendorName?.toLowerCase() === query;
        return matchesCategory && matchesVendorName;
      }
      
      // Freeform search: allow matching in all fields
      const matchesVendorName = entry.vendorName?.toLowerCase().includes(query);
      const matchesTitle = entry.title?.toLowerCase().includes(query);
      const matchesQuote = entry.quote?.toLowerCase().includes(query);
      const matchesExplanation = entry.explanation?.toLowerCase().includes(query);

      return matchesCategory && (matchesVendorName || matchesTitle || matchesQuote || matchesExplanation);
    });
  }, [data, selectedCategory, searchQuery, selectedVendor]);

  const positiveCount = dataBeforeTypeFilter.filter(e => e.type === "positive").length;
  const warningCount = dataBeforeTypeFilter.filter(e => e.type === "warning").length;
  const totalCount = dataBeforeTypeFilter.length;

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
