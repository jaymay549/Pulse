import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Search, Crown, Share2, CreditCard, ArrowRight, Building2, Shield } from "lucide-react";
import { SignIn, UserButton, useClerk } from "@clerk/clerk-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SmartSearchBar } from "@/components/ui/smart-search-bar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";

// Components
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
} from "@/components/vendors";
import UpgradeModal from "@/components/UpgradeModal";
import QuoteCardModal from "@/components/wins/QuoteCardModal";
import VendorPricingTiers from "@/components/vendors/VendorPricingTiers";

// Hooks
import { useVendorFilters, categories } from "@/hooks/useVendorFilters";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useVendorReviews, VendorEntry } from "@/hooks/useVendorReviews";
import { useVendorWebsites } from "@/hooks/useVendorWebsites";
import { useVerifiedVendor } from "@/hooks/useVerifiedVendor";
import { useVendorResponses } from "@/hooks/useVendorResponses";

// Supabase data
import { fetchVendorPulseFeed, fetchVendorsList } from "@/hooks/useSupabaseVendorData";

// Utils
import { getAccessLevel, isProUser } from "@/utils/tierUtils";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "What DMS should I use for a mid-size dealership?",
  "Compare Cox Automotive vs CDK",
  "Which vendors have the most warnings?",
  "Best CRM for customer follow-up?",
];

const VendorsV2 = () => {
  // URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isUpdatingFromUrlRef = useRef(false);

  // UI State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<VendorEntry | null>(null);
  const [selectedCardForShare, setSelectedCardForShare] =
    useState<VendorEntry | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // AI Chat state
  const [aiQuery, setAiQuery] = useState<{ text: string; id: number } | null>(null);
  const aiQueryIdRef = useRef(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Clerk Auth
  const {
    isAuthenticated,
    user,
    role,
    tier,
    isAdmin,
    isLoading: isAuthLoading,
    fetchWithAuth,
    getToken,
  } = useClerkAuth();
  const { signOut } = useClerk();

  // Vendor data from WAM
  const [wamMentions, setWamMentions] = useState<VendorEntry[]>([]);
  const [isWamLoading, setIsWamLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [paginationInfo, setPaginationInfo] = useState<{
    page: number;
    pageSize: number;
    totalCount: number;
    totalPositiveCount?: number;
    totalWarningCount?: number;
    totalSystemCount?: number;
    categoryCounts?: Record<string, number>;
    hasMore: boolean;
  } | null>(null);
  
  // Vendor counts for search results (fetched separately to get accurate totals)
  type VendorCounts = { total: number; positive: number; warning: number };
  const [searchVendorCounts, setSearchVendorCounts] = useState<Record<string, VendorCounts>>({});
  const [searchVendorNames, setSearchVendorNames] = useState<Record<string, string>>({});
  const [categoryVendorCounts, setCategoryVendorCounts] = useState<Record<string, VendorCounts>>({});
  const [categoryVendorNames, setCategoryVendorNames] = useState<Record<string, string>>({});

  // All vendor names for search autocomplete (fetched from vendors-list endpoint)
  const [allVendorsList, setAllVendorsList] = useState<string[]>([]);

  // Cache category vendor index so switching filters doesn't re-paginate every time
  const categoryVendorIndexCacheRef = useRef<
    Record<string, { counts: Record<string, VendorCounts>; names: Record<string, string> }>
  >({});

  const fetchVendorCountsIndex = useCallback(
    async (opts: { category?: string; search?: string }) => {
      const counts: Record<string, VendorCounts> = {};
      const names: Record<string, string> = {};

      // Fetch all mentions for this category/search via Supabase RPC (single call, large page)
      let offset = 0;
      const pageSize = 500;
      let hasMore = true;

      while (hasMore) {
        const data = await fetchVendorPulseFeed({
          category: opts.category || null,
          search: opts.search || null,
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
        });

        for (const mention of data.mentions) {
          const vendorNameRaw = mention.vendorName;
          if (!vendorNameRaw) continue;

          const key = vendorNameRaw.toLowerCase();
          if (!counts[key]) counts[key] = { total: 0, positive: 0, warning: 0 };
          if (!names[key]) names[key] = vendorNameRaw;

          counts[key].total += 1;
          if (mention.type === "positive") counts[key].positive += 1;
          else if (mention.type === "warning") counts[key].warning += 1;
        }

        hasMore = data.hasMore;
        offset += pageSize;
        if (data.mentions.length === 0) break;
      }

      return { counts, names };
    },
    [],
  );

  // Fallback vendor data from backend table (keeps /vendors usable if WAM is flaky)
  const { reviews: dbReviews, isLoading: isDbLoading } = useVendorReviews();

  // Verified vendor hooks
  const { profile: vendorProfile, isVerified, canRespondTo } = useVerifiedVendor();
  const { getWebsiteForVendor, getLogoForVendor } = useVendorWebsites();

  // Helper to get logo URL from logo.dev or metadata
  const getVendorLogoUrl = useCallback((vendorName: string, websiteUrl?: string | null) => {
    const metadataLogo = getLogoForVendor(vendorName);
    if (metadataLogo) return metadataLogo;

    const logoDevToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
    if (!logoDevToken || !vendorName) return null;

    let domain = websiteUrl || "";
    if (domain && !domain.startsWith("http")) {
      domain = `https://${domain}`;
    }

    if (domain) {
      try {
        const url = new URL(domain);
        domain = url.hostname.replace("www.", "");
      } catch {
        domain = "";
      }
    }

    if (!domain) {
      domain =
        vendorName
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9.-]/g, "") + ".com";
    }

    return `https://img.logo.dev/${domain}?token=${logoDevToken}&size=128&format=png&fallback=monogram`;
  }, [getLogoForVendor]);

  const mentions = useMemo(() => {
    return wamMentions.length > 0 ? wamMentions : dbReviews;
  }, [wamMentions, dbReviews]);

  // Access level - simplified 2-tier system
  const accessLevel = getAccessLevel(tier);
  const isProUserValue = isProUser(tier);

  // Filter hook
  const {
    selectedCategory,
    searchQuery,
    typeFilter,
    setSelectedCategory,
    setSearchQuery,
    setTypeFilter,
    clearSearch,
    filteredData,
    categoryCounts,
    vendorsInCategory,
    selectedCategoryData,
    positiveCount,
    warningCount,
    totalCount,
  } = useVendorFilters({
    data: mentions,
    selectedVendor,
    externalCategoryCounts: paginationInfo?.categoryCounts,
    externalPositiveCount: paginationInfo?.totalPositiveCount,
    externalWarningCount: paginationInfo?.totalWarningCount,
    externalTotalCount: paginationInfo?.totalSystemCount,
  });

  // Sync URL params to state (for browser back/forward and initial load)
  useEffect(() => {
    if (isUpdatingFromUrlRef.current) return;

    const urlSearch = searchParams.get("search") || "";
    const urlCategory = searchParams.get("category") || "all";
    const urlVendor = searchParams.get("vendor") || null;
    const urlType = searchParams.get("type") || "all";

    // Check if any URL param differs from state
    const needsUpdate = 
      urlSearch !== searchQuery ||
      urlCategory !== selectedCategory ||
      urlVendor !== selectedVendor ||
      (urlType !== typeFilter && (urlType === "all" || urlType === "positive" || urlType === "warning"));

    if (!needsUpdate) return;

    // Update state from URL params
    isUpdatingFromUrlRef.current = true;
    
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
    if (urlCategory !== selectedCategory) {
      setSelectedCategory(urlCategory);
    }
    if (urlVendor !== selectedVendor) {
      setSelectedVendor(urlVendor);
    }
    if (urlType !== typeFilter && (urlType === "all" || urlType === "positive" || urlType === "warning")) {
      setTypeFilter(urlType as "all" | "positive" | "warning");
    }

    // Reset flag after state updates are queued
    setTimeout(() => {
      isUpdatingFromUrlRef.current = false;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only depend on searchParams to detect URL changes

  // Sync state to URL params (when user changes filters)
  // Note: searchQuery is NOT synced to URL - it's only for autocomplete
  useEffect(() => {
    if (isUpdatingFromUrlRef.current) return;

    const newParams = new URLSearchParams(searchParams);

    if (selectedCategory !== "all") {
      newParams.set("category", selectedCategory);
    } else {
      newParams.delete("category");
    }

    if (selectedVendor) {
      newParams.set("vendor", selectedVendor);
    } else {
      newParams.delete("vendor");
    }

    if (typeFilter !== "all") {
      newParams.set("type", typeFilter);
    } else {
      newParams.delete("type");
    }

    // Only update if params actually changed
    const currentParamsStr = searchParams.toString();
    const newParamsStr = newParams.toString();
    if (currentParamsStr !== newParamsStr) {
      setSearchParams(newParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedVendor, typeFilter]); // Depend on state, not searchParams

  // Get review IDs for fetching responses
  const reviewIds = useMemo(
    () => mentions.map((m) => Number(m.id)),
    [mentions],
  );
  const { responses, addResponse, updateResponse, deleteResponse } =
    useVendorResponses(reviewIds);

  const isDataLoading =
    isWamLoading || (wamMentions.length === 0 && isDbLoading);

  // Fetch Vendor Pulse mentions from Supabase
  // Note: searchQuery is NOT used here - it only affects autocomplete dropdown
  useEffect(() => {
    const fetchMentions = async () => {
      setIsWamLoading(true);
      try {
        const data = await fetchVendorPulseFeed({
          category: selectedCategory !== "all" ? selectedCategory : null,
          vendorName: selectedVendor || null,
          type: typeFilter !== "all" ? typeFilter : null,
        });

        setWamMentions(data.mentions as any[]);
        setPaginationInfo({
          page: data.page,
          pageSize: data.pageSize,
          totalCount: data.totalCount,
          totalPositiveCount: data.totalPositiveCount,
          totalWarningCount: data.totalWarningCount,
          totalSystemCount: data.totalSystemCount,
          categoryCounts: data.categoryCounts,
          hasMore: data.hasMore,
        });
      } catch (err) {
        console.error("Failed to fetch mentions:", err);
      } finally {
        setIsWamLoading(false);
      }
    };

    fetchMentions();
  }, [isAuthenticated, selectedCategory, selectedVendor, typeFilter]);

  // Fetch category vendor index (all vendors + accurate counts) for sidebar + category vendor chips
  useEffect(() => {
    const fetchCategoryVendorIndex = async () => {
      if (selectedCategory === "all") {
        setCategoryVendorCounts({});
        setCategoryVendorNames({});
        return;
      }

      const cached = categoryVendorIndexCacheRef.current[selectedCategory];
      if (cached) {
        setCategoryVendorCounts(cached.counts);
        setCategoryVendorNames(cached.names);
        return;
      }

      const { counts, names } = await fetchVendorCountsIndex({
        category: selectedCategory,
      });

      if (cancelled) return;

      categoryVendorIndexCacheRef.current[selectedCategory] = { counts, names };
      setCategoryVendorCounts(counts);
      setCategoryVendorNames(names);
    };

    let cancelled = false;
    (async () => {
      try {
        await fetchCategoryVendorIndex();
      } catch (err) {
        if (!cancelled) console.error("Failed to fetch category vendor index:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, fetchVendorCountsIndex]);

  // Fetch all vendor names on mount for search autocomplete
  useEffect(() => {
    const loadAllVendors = async () => {
      try {
        const vendors = await fetchVendorsList();
        setAllVendorsList(vendors.map((v) => v.name));
      } catch (err) {
        console.error("Failed to fetch vendors list for search:", err);
      }
    };

    loadAllVendors();
  }, []);

  // Fetch vendor names for search autocomplete (quick, single RPC call)
  useEffect(() => {
    const fetchSearchVendors = async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSearchVendorCounts({});
        setSearchVendorNames({});
        return;
      }

      try {
        const data = await fetchVendorPulseFeed({
          search: searchQuery.trim(),
          pageSize: 100,
        });

        const counts: Record<string, { total: number; positive: number; warning: number }> = {};
        const names: Record<string, string> = {};

        for (const mention of data.mentions) {
          const vendorNameRaw = mention.vendorName;
          if (!vendorNameRaw) continue;

          const key = vendorNameRaw.toLowerCase();
          if (!counts[key]) counts[key] = { total: 0, positive: 0, warning: 0 };
          if (!names[key]) names[key] = vendorNameRaw;

          counts[key].total += 1;
          if (mention.type === "positive") counts[key].positive += 1;
          else if (mention.type === "warning") counts[key].warning += 1;
        }

        setSearchVendorCounts(counts);
        setSearchVendorNames(names);
      } catch (err) {
        console.error("Failed to fetch search vendors:", err);
      }
    };

    fetchSearchVendors();
  }, [searchQuery]);

  const vendorsInCategoryAccurate = useMemo(() => {
    if (selectedCategory === "all") return vendorsInCategory;

    const fromIndex = Object.entries(categoryVendorCounts)
      .map(([key, c]) => ({
        name: categoryVendorNames[key] ?? key,
        count: c.total,
      }))
      .filter((v) => v.count > 0)
      .sort((a, b) => b.count - a.count);

    return fromIndex.length > 0 ? fromIndex : vendorsInCategory;
  }, [selectedCategory, vendorsInCategory, categoryVendorCounts, categoryVendorNames]);

  // Load more mentions (for pro users)
  const loadMoreMentions = useCallback(async () => {
    if (!paginationInfo?.hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = paginationInfo.page + 1;
      const data = await fetchVendorPulseFeed({
        category: selectedCategory !== "all" ? selectedCategory : null,
        vendorName: selectedVendor || null,
        type: typeFilter !== "all" ? typeFilter : null,
        page: nextPage,
        pageSize: paginationInfo.pageSize || 40,
      });

      // Append new mentions to existing ones
      setWamMentions((prev) => [...prev, ...(data.mentions as any[])]);
      setPaginationInfo({
        page: data.page,
        pageSize: data.pageSize,
        totalCount: data.totalCount,
        totalPositiveCount: data.totalPositiveCount,
        totalWarningCount: data.totalWarningCount,
        totalSystemCount: data.totalSystemCount,
        categoryCounts: data.categoryCounts,
        hasMore: data.hasMore,
      });
    } catch (err) {
      console.error("Failed to load more mentions:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    paginationInfo,
    selectedCategory,
    selectedVendor,
    typeFilter,
  ]);

  // Infinite scroll: observe a sentinel element at the bottom
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProUserValue || !paginationInfo?.hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMentions();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    const sentinel = loadMoreRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [isProUserValue, paginationInfo?.hasMore, isLoadingMore, loadMoreMentions]);

  // Sort categories by mention count (descending), keeping "All" at the top
  const sortedCategories = useMemo(() => {
    const allCategory = categories.find((cat) => cat.id === "all");
    const otherCategories = categories.filter((cat) => cat.id !== "all");

    // Sort by mention count (descending)
    const sorted = otherCategories.sort((a, b) => {
      const countA = categoryCounts[a.id] || 0;
      const countB = categoryCounts[b.id] || 0;
      return countB - countA;
    });

    // Put "All" first, then sorted categories
    return allCategory ? [allCategory, ...sorted] : sorted;
  }, [categoryCounts]);

  // Calculate visible entries based on access level
  // Non-pro users see limited results with blurred vendor names to entice upgrades
  const visibleEntries = useMemo(() => {
    if (accessLevel.unlimitedAccess) {
      return filteredData;
    }

    // For non-pro users: show all filtered data (backend already limits and blurs content)
    // The backend returns max 5 results for free/community users with redacted vendor names
    return filteredData;
  }, [filteredData, accessLevel.unlimitedAccess]);

  const remainingCount = Math.max(
    0,
    filteredData.length - visibleEntries.length,
  );
  const showTeaserCard = !accessLevel.unlimitedAccess && remainingCount > 0;

  // Use total counts from paginationInfo if available, otherwise fall back to mentions length
  const totalVerifiedCount = paginationInfo?.totalPositiveCount ?? mentions.filter(e => e.type === "positive").length;
  const totalWarningCountValue = paginationInfo?.totalWarningCount ?? mentions.filter((e) => e.type === "warning").length;

  // Handle share
  const handleShare = async () => {
    const shareData = {
      title: "Vendor Reviews from CDG Circles",
      text: "Real vendor reviews from verified auto dealers.",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    clearSearch();
    setSelectedVendor(null);
    setTypeFilter("all");
  };

  // Handle vendor chip click - navigate to vendor profile page
  const handleVendorSelect = (vendorName: string) => {
    // Navigate to vendor profile page
    navigate(`/vendors/${encodeURIComponent(vendorName)}`);
  };

  // Handle AI query from smart search bar
  const handleAISubmit = (query: string) => {
    if (isProUserValue) {
      aiQueryIdRef.current += 1;
      setAiQuery({ text: query, id: aiQueryIdRef.current });
      setShowUpgradePrompt(false);
    } else {
      setShowUpgradePrompt(true);
      setAiQuery(null);
    }
  };

  // Handle clearing the AI chat
  const handleAIChatClose = () => {
    setAiQuery(null);
    setShowUpgradePrompt(false);
  };

  // Get all unique vendor names for autocomplete
  const allVendorNames = useMemo(() => {
    // Use the complete vendors list from the API
    // Already sorted by mention count from the backend
    return allVendorsList;
  }, [allVendorsList]);

  // Create suggestions with logos for the search bar
  const vendorSuggestionsWithLogos = useMemo(() => {
    return allVendorNames.map((name) => {
      const websiteUrl = getWebsiteForVendor(name);
      const logoUrl = getVendorLogoUrl(name, websiteUrl);
      return { name, logoUrl };
    });
  }, [allVendorNames, getWebsiteForVendor, getVendorLogoUrl]);

  // Get matching vendors for search results (with review counts)
  const matchingVendors = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const query = searchQuery.toLowerCase().trim();
    
    // Get vendors that match the search query
    const matching = allVendorNames
      .filter((name) => name.toLowerCase().includes(query))
      .map((name) => {
        // Use vendor counts from separate fetch if available, otherwise fall back to paginated data
        const vendorNameLower = name.toLowerCase();
        const counts = searchVendorCounts[vendorNameLower];
        
        if (counts) {
          return {
            name,
            reviewCount: counts.total,
            positiveCount: counts.positive,
            warningCount: counts.warning,
          };
        }
        
        // Fallback: count from current page (less accurate)
        const vendorReviews = mentions.filter(
          (m) => m.vendorName?.toLowerCase() === vendorNameLower
        );
        return {
          name,
          reviewCount: vendorReviews.length,
          positiveCount: vendorReviews.filter((r) => r.type === "positive").length,
          warningCount: vendorReviews.filter((r) => r.type === "warning").length,
        };
      })
      .filter((v) => v.reviewCount > 0) // Only show vendors with reviews
      .sort((a, b) => b.reviewCount - a.reviewCount) // Sort by review count
      .slice(0, 12); // Limit to top 12 vendors
    
    return matching;
  }, [searchQuery, allVendorNames, searchVendorCounts, mentions]);

  // Category vendors - similar to matchingVendors but for category pages
  const categoryVendors = useMemo(() => {
    if (selectedCategory === "all" || selectedVendor !== null) return [];
    
    return vendorsInCategoryAccurate
      .map((vendor) => {
        // Use category vendor index if available, otherwise fall back to paginated data
        const vendorNameLower = vendor.name.toLowerCase();
        const counts = categoryVendorCounts[vendorNameLower];
        
        if (counts) {
          return {
            name: vendor.name,
            reviewCount: counts.total,
            positiveCount: counts.positive,
            warningCount: counts.warning,
          };
        }
        
        // Fallback: count from current filtered data (less accurate)
        const vendorReviews = filteredData.filter(
          (m) => m.vendorName?.toLowerCase() === vendorNameLower
        );
        return {
          name: vendor.name,
          reviewCount: vendorReviews.length,
          positiveCount: vendorReviews.filter((r) => r.type === "positive").length,
          warningCount: vendorReviews.filter((r) => r.type === "warning").length,
        };
      })
      .filter((v) => v.reviewCount > 0) // Only show vendors with reviews
      .sort((a, b) => b.reviewCount - a.reviewCount) // Sort by review count
      .slice(0, 12); // Limit to top 12 vendors
  }, [selectedCategory, selectedVendor, vendorsInCategoryAccurate, categoryVendorCounts, filteredData]);

  // Handle type filter change
  const handleTypeFilterChange = (filter: "all" | "positive" | "warning") => {
    if (filter === "warning" && !accessLevel.unlimitedAccess) {
      // Scroll to tiers section instead of showing modal
      const tiersSection = document.getElementById("tiers-section");
      if (tiersSection) {
        const offset = 100;
        const elementPosition =
          tiersSection.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
      }
      return;
    }
    setTypeFilter(filter);
  };

  return (
    <>
      <Helmet>
        <title>Vendor Pulse | CDG Circles - Real Dealer Insights</title>
        <meta
          name="description"
          content="Monitor what dealers are saying about your company. Real-time vendor intelligence from verified automotive dealers."
        />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--vendor-bg))] overflow-x-hidden">
        {/* Navigation */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Left: Logo */}
              <div className="flex items-center gap-2">
                <Link to="/" className="flex items-center">
                  <img src={cdgPulseLogo} alt="CDG Pulse" className="h-6" />
                </Link>
              </div>

              {/* Spacer for center alignment */}
              <div className="hidden md:flex flex-1" />

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="hidden lg:flex text-foreground/60 hover:text-foreground h-8 px-3 text-xs"
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Share
                </Button>

                {!isAuthenticated && !isAuthLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSignIn(true)}
                    className="h-8 px-3 text-xs border-black/10 hover:bg-black/[0.03]"
                  >
                    Sign In
                  </Button>
                )}

                {isAuthenticated && !isProUserValue && (
                  <Button
                    variant="yellow"
                    size="sm"
                    onClick={() => {
                      const email = user?.email;
                      const portalUrl = email
                        ? `${import.meta.env.VITE_STRIPE_PORTAL_URL
                        }?prefilled_email=${encodeURIComponent(email)}`
                        : import.meta.env.VITE_STRIPE_PORTAL_URL;
                      window.open(portalUrl, "_blank");
                    }}
                    className="hidden lg:flex font-semibold h-8 px-3 text-xs"
                  >
                    <Crown className="h-3.5 w-3.5 mr-1.5" />
                    Upgrade
                  </Button>
                )}

                {isAuthenticated && isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="hidden sm:flex text-xs h-8 px-3 border-black/10">
                      <Shield className="h-3.5 w-3.5 mr-1.5" />
                      Admin
                    </Button>
                  </Link>
                )}

                {isAuthenticated && (
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "h-7 w-7",
                      },
                    }}
                    afterSignOutUrl="/vendors"
                    signInUrl="/auth?redirect=/vendors"
                  >
                    <UserButton.MenuItems>
                      <UserButton.Action
                        label="Subscription"
                        labelIcon={<CreditCard className="h-4 w-4" />}
                        open="subscription"
                      />
                    </UserButton.MenuItems>
                    <UserButton.UserProfilePage
                      label="Subscription"
                      labelIcon={<CreditCard className="h-4 w-4" />}
                      url="subscription"
                    >
                      <SubscriptionManagement />
                    </UserButton.UserProfilePage>
                  </UserButton>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content -- single column */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          {/* Hero -- only on default "all" view with no vendor selected */}
          {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
            <div className="max-w-3xl mx-auto text-center pt-10 sm:pt-16 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-[11px] font-semibold tracking-wide uppercase text-amber-700 mb-6">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                Live Intelligence
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl italic text-foreground mb-4 leading-[1.05] tracking-[-0.01em]">
                What are dealers saying about{" "}
                <span className="not-italic text-amber-600 decoration-amber-300 underline decoration-2 underline-offset-4">your vendors</span>?
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground/80 max-w-xl mx-auto leading-relaxed">
                Real insights from verified automotive dealers. Search, compare, and get AI-powered analysis.
              </p>
            </div>
          )}

          {/* Smart Search Bar -- always visible, centered */}
          <div className={cn(
            "mx-auto w-full transition-all duration-300",
            selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt
              ? "max-w-2xl"
              : "max-w-full"
          )}>
            {/* Category context header when filtering */}
            {selectedCategory !== "all" && selectedCategoryData && (
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-2xl">{selectedCategoryData.icon}</span>
                <span className="text-lg font-bold text-foreground tracking-tight">
                  {selectedCategoryData.label}
                </span>
                <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  {categoryCounts[selectedCategory] || 0} reviews
                </span>
              </div>
            )}

            <SmartSearchBar
              placeholder="Search vendors or ask a question..."
              suggestions={vendorSuggestionsWithLogos}
              onVendorSelect={handleVendorSelect}
              onAISubmit={handleAISubmit}
              onSearchChange={setSearchQuery}
              isPro={isProUserValue}
              isLoading={!!aiQuery}
              className=""
            />

            {/* Suggested prompt chips -- only on landing state */}
            {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleAISubmit(prompt)}
                    className="text-[13px] px-3.5 py-1.5 rounded-full border border-black/[0.08] bg-white text-foreground/50 hover:text-foreground hover:border-amber-300 hover:bg-amber-50/50 transition-all duration-200 hover:shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Stats line -- only on landing state */}
            {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
              <div className="flex justify-center items-center gap-5 mt-5 text-[13px] text-muted-foreground/70">
                <span><strong className="text-foreground font-semibold tabular-nums">{totalVerifiedCount}+</strong> recommendations</span>
                <span className="text-black/10">|</span>
                <span><strong className="text-foreground font-semibold tabular-nums">{totalWarningCountValue}+</strong> warnings</span>
                <span className="text-black/10">|</span>
                <span><strong className="text-foreground font-semibold tabular-nums">{categories.length - 1}</strong> categories</span>
              </div>
            )}

            {/* Inline AI Chat -- shown when pro user submits a query */}
            {aiQuery && (
              <InlineAIChat
                initialQuery={aiQuery.text}
                queryId={aiQuery.id}
                onClose={handleAIChatClose}
                className="mt-5"
              />
            )}

            {/* Upgrade prompt -- shown when free user tries AI */}
            {showUpgradePrompt && (
              <UpgradePromptCard
                onUpgrade={() => setShowUpgradeModal(true)}
                onDismiss={() => setShowUpgradePrompt(false)}
                className="mt-5"
              />
            )}
          </div>

          {/* Category Pills */}
          <CategoryPills
            categories={sortedCategories}
            selectedCategory={selectedCategory}
            categoryCounts={categoryCounts}
            onCategorySelect={handleCategoryChange}
            className="mt-8"
          />

          {/* Rest of content */}
          <div className="mt-8">
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

            {/* Trending Vendor Chips */}
            {selectedVendor === null && selectedCategory === "all" && (
              <TrendingVendorChips
                onVendorSelect={handleVendorSelect}
                getLogoUrl={(vendorName) => getVendorLogoUrl(vendorName)}
                className="mt-0 mb-4"
              />
            )}

            {/* Category Vendors Section - Show when category is selected */}
            {selectedCategory !== "all" && categoryVendors.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-foreground/30 shrink-0" />
                  <h2 className="text-sm font-semibold text-foreground/50 uppercase tracking-wider">
                    Vendors
                  </h2>
                  <span className="text-[11px] text-foreground/30 font-medium">{categoryVendors.length}</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {categoryVendors.map((vendor) => {
                    const vendorWebsiteUrl = getWebsiteForVendor(vendor.name);
                    const vendorLogoUrl = getVendorLogoUrl(vendor.name, vendorWebsiteUrl);

                    return (
                      <button
                        key={vendor.name}
                        onClick={() => handleVendorSelect(vendor.name)}
                        className="text-left p-3.5 bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_16px_-4px_rgba(0,0,0,0.08)] transition-all duration-200 group shrink-0 w-[260px]"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 border border-black/[0.06] shrink-0">
                            <AvatarImage src={vendorLogoUrl || undefined} alt={vendor.name} />
                            <AvatarFallback className="bg-amber-50 text-amber-700 font-bold text-xs">
                              {vendor.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-700 transition-colors line-clamp-1">
                                {vendor.name}
                              </h3>
                              <ArrowRight className="h-3 w-3 text-foreground/20 group-hover:text-amber-600 transition-all shrink-0 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100" />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/40">
                              <span className="font-medium">{vendor.reviewCount} review{vendor.reviewCount !== 1 ? "s" : ""}</span>
                              {vendor.positiveCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium">
                                  {vendor.positiveCount} positive
                                </span>
                              )}
                              {vendor.warningCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-500 font-medium">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleEntries.map((entry) => {
                  const isSearchingAsNonPro = !isProUserValue && searchQuery.trim().length > 0;
                  const isLocked = entry.isLocked === true || isSearchingAsNonPro || !isAuthenticated;
                  const showVendorNames = isSearchingAsNonPro ? false : !!entry.vendorName;

                  const vendorWebsiteUrl = entry.vendorName
                    ? getWebsiteForVendor(entry.vendorName)
                    : null;
                  const vendorLogoUrl = entry.vendorName
                    ? getVendorLogoUrl(entry.vendorName, vendorWebsiteUrl)
                    : null;
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
                  <div className="flex items-center gap-2.5 text-foreground/40">
                    <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-amber-400 border-t-transparent" />
                    <span className="text-[13px]">Loading more...</span>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!isWamLoading && filteredData.length === 0 && (
              <div className="text-center py-20">
                <Search className="h-10 w-10 text-foreground/15 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground/70 mb-1.5">
                  No reviews found
                </h3>
                <p className="text-sm text-foreground/40">
                  Try selecting a different category
                </p>
              </div>
            )}

            {/* Loading State */}
            {isWamLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-48 bg-white rounded-xl animate-pulse shadow-[0_0_0_1px_rgba(0,0,0,0.03)]"
                  />
                ))}
              </div>
            )}

            {/* Upgrade Section for Non-Pro Users */}
            {!accessLevel.unlimitedAccess && !isAuthenticated && (
              <VendorPricingTiers
                totalReviews={paginationInfo?.totalSystemCount ?? wamMentions.length}
                totalWarnings={totalWarningCountValue}
                onSignInClick={() => setShowSignIn(true)}
              />
            )}

            {/* Authenticated Non-Pro Upgrade Banner */}
            {!accessLevel.unlimitedAccess && isAuthenticated && (
              <div className="mt-10">
                <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-transparent border border-amber-200/40 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-amber-100/80">
                      <Crown className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground tracking-tight">
                        Unlock All Reviews
                      </h3>
                      <p className="text-foreground/50 text-sm">
                        Access all {paginationInfo?.totalSystemCount ?? wamMentions.length} reviews including{" "}
                        {totalWarningCountValue} warnings.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="yellow"
                    size="lg"
                    className="font-semibold whitespace-nowrap rounded-xl"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="py-10 mt-16 border-t border-black/[0.04]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-5">
              <Link to="/">
                <img
                  src={cdgPulseLogo}
                  alt="CDG Pulse"
                  className="h-5 opacity-40 hover:opacity-60 transition-opacity"
                />
              </Link>

              <p className="max-w-xl text-center text-[11px] text-foreground/30 leading-relaxed">
                <span className="font-medium text-foreground/40">Disclaimer:</span> CDG Pulse does
                not endorse or recommend any vendor. All reviews are
                community-generated and reflect individual experiences.
              </p>

              <div className="flex items-center gap-6 text-[12px] text-foreground/30">
                <a
                  href="https://www.dealershipguy.com/terms-of-use/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground/60 transition-colors"
                >
                  Terms
                </a>
                <a
                  href="https://www.dealershipguy.com/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground/60 transition-colors"
                >
                  Privacy
                </a>
                <span>© {new Date().getFullYear()} Car Dealership Guy</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <VendorCardDetail
        entry={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        onShare={(entry) => setSelectedCardForShare(entry)}
        onVendorSelect={handleVendorSelect}
        onCategorySelect={handleCategoryChange}
        vendorWebsite={
          selectedCard?.vendorName
            ? getWebsiteForVendor(selectedCard.vendorName)
            : null
        }
        vendorLogo={
          selectedCard?.vendorName
            ? getVendorLogoUrl(
                selectedCard.vendorName,
                getWebsiteForVendor(selectedCard.vendorName),
              )
            : null
        }
        vendorResponse={
          selectedCard ? responses[Number(selectedCard.id)] : null
        }
        canRespondAsVendor={
          selectedCard?.vendorName
            ? canRespondTo(selectedCard.vendorName)
            : false
        }
        onAddResponse={(text) =>
          selectedCard
            ? addResponse(Number(selectedCard.id), text)
            : Promise.resolve(false)
        }
        onUpdateResponse={updateResponse}
        onDeleteResponse={deleteResponse}
      />

      {selectedCardForShare && (() => {
        const vendorWebsiteUrl = selectedCardForShare.vendorName
          ? getWebsiteForVendor(selectedCardForShare.vendorName)
          : null;
        const vendorLogoUrl = selectedCardForShare.vendorName
          ? getVendorLogoUrl(selectedCardForShare.vendorName, vendorWebsiteUrl)
          : null;
        
        return (
          <QuoteCardModal
            isOpen={!!selectedCardForShare}
            onClose={() => setSelectedCardForShare(null)}
            quote={selectedCardForShare.quote}
            title={selectedCardForShare.title}
            type={selectedCardForShare.type}
            vendorName={selectedCardForShare.vendorName || undefined}
            vendorLogo={vendorLogoUrl}
          />
        );
      })()}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        targetTier="pro"
      />

      {/* Clerk Sign In Modal */}
      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent
          className="p-0 border-0 bg-transparent shadow-none sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={() => setShowSignIn(false)}
        >
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full flex justify-center",
                  card: "w-full max-w-md border-0 shadow-none",
                },
              }}
              fallbackRedirectUrl="/vendors"
              signUpFallbackRedirectUrl="/vendors"
            />
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default VendorsV2;
