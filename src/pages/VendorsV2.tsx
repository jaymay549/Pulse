import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Search, X, Crown, Share2, CreditCard, ArrowRight, Building2, Shield } from "lucide-react";
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
import ReviewMarquee from "@/components/vendors/ReviewMarquee";

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
  const [aiQuery, setAiQuery] = useState<string | null>(null);
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
      setAiQuery(query);
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
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Left: Logo */}
              <div className="flex items-center gap-2">
                <Link to="/" className="flex items-center">
                  <img src={cdgPulseLogo} alt="CDG Pulse" className="h-7" />
                </Link>
              </div>

              {/* Spacer for center alignment */}
              <div className="hidden md:flex flex-1" />

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="hidden lg:flex"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>

                {!isAuthenticated && !isAuthLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSignIn(true)}
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
                    className="hidden lg:flex font-bold"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                )}

                {isAuthenticated && isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="hidden sm:flex text-xs">
                      <Shield className="h-3.5 w-3.5 mr-1.5" />
                      Admin
                    </Button>
                  </Link>
                )}

                {isAuthenticated && (
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "h-8 w-8",
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

          {/* Smart Search Bar -- always visible, centered */}
          <div className={cn(
            "mx-auto w-full transition-all",
            selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt
              ? "max-w-2xl"
              : "max-w-full"
          )}>
            {/* Category context header when filtering */}
            {selectedCategory !== "all" && selectedCategoryData && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">{selectedCategoryData.icon}</span>
                <span className="text-lg font-bold text-foreground">
                  {selectedCategoryData.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({categoryCounts[selectedCategory] || 0} reviews)
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
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleAISubmit(prompt)}
                    className="text-sm px-3 py-1.5 rounded-full border border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Stats line -- only on landing state */}
            {selectedCategory === "all" && selectedVendor === null && !aiQuery && !showUpgradePrompt && (
              <div className="flex justify-center gap-4 mt-4 text-sm text-muted-foreground">
                <span><strong className="text-foreground">{totalVerifiedCount}+</strong> recommendations</span>
                <span className="text-border">&#8226;</span>
                <span><strong className="text-foreground">{totalWarningCountValue}+</strong> warnings</span>
                <span className="text-border">&#8226;</span>
                <span><strong className="text-foreground">{categories.length - 1}</strong> categories</span>
              </div>
            )}

            {/* Inline AI Chat -- shown when pro user submits a query */}
            {aiQuery && (
              <InlineAIChat
                initialQuery={aiQuery}
                onClose={handleAIChatClose}
                className="mt-4"
              />
            )}

            {/* Upgrade prompt -- shown when free user tries AI */}
            {showUpgradePrompt && (
              <UpgradePromptCard
                onUpgrade={() => setShowUpgradeModal(true)}
                onDismiss={() => setShowUpgradePrompt(false)}
                className="mt-4"
              />
            )}
          </div>

          {/* Category Pills */}
          <CategoryPills
            categories={sortedCategories}
            selectedCategory={selectedCategory}
            categoryCounts={categoryCounts}
            onCategorySelect={handleCategoryChange}
            className="mt-6"
          />

          {/* Rest of content */}
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

            {/* Trending Vendor Chips */}
            {selectedVendor === null && selectedCategory === "all" && (
              <TrendingVendorChips
                onVendorSelect={handleVendorSelect}
                getLogoUrl={(vendorName) => getVendorLogoUrl(vendorName)}
                className="mt-0 mb-3"
              />
            )}

            {/* Category Vendors Section - Show when category is selected */}
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
                          {/* Vendor Logo */}
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border/50 shrink-0">
                            <AvatarImage src={vendorLogoUrl || undefined} alt={vendor.name} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs sm:text-sm">
                              {vendor.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Vendor Info */}
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
                  // Backend handles all redaction - but force lock for non-authenticated users and non-pro users searching
                  const isSearchingAsNonPro = !isProUserValue && searchQuery.trim().length > 0;
                  const isLocked = entry.isLocked === true || isSearchingAsNonPro || !isAuthenticated;
                  // Hide vendor names when searching as non-pro user
                  const showVendorNames = isSearchingAsNonPro ? false : !!entry.vendorName;

                  // Get website and logo for this vendor
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

            {/* Infinite scroll sentinel - loads more when scrolled into view */}
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

            {/* Empty State - no reviews found */}
            {!isWamLoading && filteredData.length === 0 && (
              <div className="text-center py-16">
                <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">
                  No reviews found
                </h3>
                <p className="text-muted-foreground">
                  Try selecting a different category
                </p>
              </div>
            )}

            {/* Loading State */}
            {isWamLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-48 bg-muted/50 rounded-lg animate-pulse"
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
              <div className="mt-8">
                <div className="p-6 rounded-xl bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border-2 border-yellow-400/30 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-yellow-500/20">
                      <Crown className="h-7 w-7 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        Upgrade to See All Reviews
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Unlock all {paginationInfo?.totalSystemCount ?? wamMentions.length} reviews including{" "}
                        {totalWarningCountValue} warnings.
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

        {/* Footer */}
        <footer className="py-8 mt-12 border-t border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-6">
              <Link to="/">
                <img
                  src={cdgPulseLogo}
                  alt="CDG Pulse"
                  className="h-6 opacity-70"
                />
              </Link>

              <p className="max-w-2xl text-center text-xs text-muted-foreground/70">
                <span className="font-medium">Disclaimer:</span> CDG Pulse does
                not endorse or recommend any vendor. All reviews are
                community-generated and reflect individual experiences.
              </p>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <a
                  href="https://www.dealershipguy.com/terms-of-use/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Terms
                </a>
                <a
                  href="https://www.dealershipguy.com/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
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
