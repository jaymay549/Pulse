import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Search, X, Crown, Share2, Menu, CreditCard, ArrowRight, Building2 } from "lucide-react";
import { SignIn, UserButton, useClerk } from "@clerk/clerk-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";

// Components
import {
  VendorCard,
  VendorCardDetail,
  VendorSidebar,
  AIInsightBanner,
  FilterBar,
  UpgradeTeaser,
  TrendingVendorChips,
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

// Config
import { WAM_URL } from "@/config/wam";

// Utils
import { getAccessLevel, isProUser } from "@/utils/tierUtils";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clerk Auth
  const {
    isAuthenticated,
    user,
    role,
    tier,
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
  const [vendorCounts, setVendorCounts] = useState<Record<string, { total: number; positive: number; warning: number }>>({});

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
    showMoreCategories,
    setSelectedCategory,
    setSearchQuery,
    setTypeFilter,
    setShowMoreCategories,
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
  useEffect(() => {
    if (isUpdatingFromUrlRef.current) return;

    const newParams = new URLSearchParams(searchParams);
    
    if (searchQuery.trim()) {
      newParams.set("search", searchQuery.trim());
    } else {
      newParams.delete("search");
    }

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
  }, [searchQuery, selectedCategory, selectedVendor, typeFilter]); // Depend on state, not searchParams

  // Get review IDs for fetching responses
  const reviewIds = useMemo(
    () => mentions.map((m) => Number(m.id)),
    [mentions],
  );
  const { responses, addResponse, updateResponse, deleteResponse } =
    useVendorResponses(reviewIds);

  const isDataLoading =
    isWamLoading || (wamMentions.length === 0 && isDbLoading);

  // Handle search input click/focus - show upgrade modal for non-pro users
  const handleSearchClick = (e: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if (!isProUserValue) {
      e.preventDefault();
      setShowUpgradeModal(true);
      // Blur the input to prevent typing
      if (e.target instanceof HTMLInputElement) {
        e.target.blur();
      }
    }
  };

  // Fetch Vendor Pulse mentions from WAM
  useEffect(() => {
    const fetchMentions = async () => {
      setIsWamLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "all") params.append("category", selectedCategory);
        if (selectedVendor) params.append("vendorName", selectedVendor);
        if (searchQuery) params.append("search", searchQuery);
        if (typeFilter !== "all" && typeFilter !== undefined) params.append("type", typeFilter);

        const response = await fetchWithAuth(
          `${WAM_URL}/api/public/vendor-pulse/mentions?${params.toString()}`,
        );
        if (response.ok) {
          const data = await response.json();
          // Transform snake_case conversation_time to camelCase conversationTime
          const transformedMentions = (data.mentions || []).map((mention: any) => ({
            ...mention,
            conversationTime: mention.conversation_time || mention.conversationTime,
          }));
          setWamMentions(transformedMentions);
          // Store pagination info if provided
          if (data.page !== undefined) {
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
          }
        }
      } catch (err) {
        console.error("Failed to fetch mentions:", err);
      } finally {
        setIsWamLoading(false);
      }
    };

    fetchMentions();
  }, [isAuthenticated, fetchWithAuth, selectedCategory, selectedVendor, searchQuery, typeFilter]);

  // Fetch vendor counts separately when searching (to get accurate totals, not paginated)
  useEffect(() => {
    const fetchVendorCounts = async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setVendorCounts({});
        return;
      }

      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "all") params.append("category", selectedCategory);
        if (searchQuery) params.append("search", searchQuery);
        // Fetch a large page size to get all matching mentions for counting
        params.append("pageSize", "1000");
        params.append("page", "1");

        const response = await fetchWithAuth(
          `${WAM_URL}/api/public/vendor-pulse/mentions?${params.toString()}`,
        );
        if (response.ok) {
          const data = await response.json();
          const allMentions = (data.mentions || []).map((mention: any) => ({
            ...mention,
            conversationTime: mention.conversation_time || mention.conversationTime,
          }));

          // Aggregate counts by vendor
          const counts: Record<string, { total: number; positive: number; warning: number }> = {};
          allMentions.forEach((mention: VendorEntry) => {
            if (mention.vendorName) {
              const vendorName = mention.vendorName.toLowerCase();
              if (!counts[vendorName]) {
                counts[vendorName] = { total: 0, positive: 0, warning: 0 };
              }
              counts[vendorName].total++;
              if (mention.type === "positive") {
                counts[vendorName].positive++;
              } else if (mention.type === "warning") {
                counts[vendorName].warning++;
              }
            }
          });

          setVendorCounts(counts);
        }
      } catch (err) {
        console.error("Failed to fetch vendor counts:", err);
      }
    };

    fetchVendorCounts();
  }, [isAuthenticated, fetchWithAuth, searchQuery, selectedCategory]);

  // Load more mentions (for pro users)
  const loadMoreMentions = useCallback(async () => {
    if (!paginationInfo?.hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = paginationInfo.page + 1;
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedVendor) params.append("vendorName", selectedVendor);
      if (searchQuery) params.append("search", searchQuery);
      if (typeFilter !== "all" && typeFilter !== undefined) params.append("type", typeFilter);
      params.append("page", nextPage.toString());
      params.append("pageSize", (paginationInfo.pageSize || 20).toString());

      const response = await fetchWithAuth(
        `${WAM_URL}/api/public/vendor-pulse/mentions?${params.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        // Transform snake_case conversation_time to camelCase conversationTime
        const transformedMentions = (data.mentions || []).map((mention: any) => ({
          ...mention,
          conversationTime: mention.conversation_time || mention.conversationTime,
        }));
        // Append new mentions to existing ones
        setWamMentions((prev) => [...prev, ...transformedMentions]);
        // Update pagination info
        if (data.page !== undefined) {
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
        }
      }
    } catch (err) {
      console.error("Failed to load more mentions:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    fetchWithAuth,
    isLoadingMore,
    paginationInfo,
    searchQuery,
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

  // Clear selectedVendor when searchQuery is cleared or changed manually (but not when it matches)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSelectedVendor(null);
    } else if (
      selectedVendor &&
      searchQuery.trim().toLowerCase() !== selectedVendor.trim().toLowerCase()
    ) {
      // If searchQuery changed to something different from selectedVendor, clear it
      // This handles the case where user types in search box after selecting a vendor
      setSelectedVendor(null);
    }
  }, [searchQuery, selectedVendor]);

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
    setSidebarOpen(false);
  };

  // Handle vendor chip click - navigate to vendor profile page
  const handleVendorSelect = (vendorName: string) => {
    // Navigate to vendor profile page
    navigate(`/vendors/${encodeURIComponent(vendorName)}`);
  };

  // Get all unique vendor names for autocomplete
  const allVendorNames = useMemo(() => {
    const vendorSet = new Set<string>();
    // Add vendors from current category
    vendorsInCategory.forEach((v) => vendorSet.add(v.name));
    // Add vendors from mentions
    mentions.forEach((m) => {
      if (m.vendorName) vendorSet.add(m.vendorName);
    });
    return Array.from(vendorSet).sort();
  }, [vendorsInCategory, mentions]);

  // Filter vendors for autocomplete
  const autocompleteSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const query = searchQuery.toLowerCase().trim();
    return allVendorNames
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, 8); // Limit to 8 suggestions
  }, [searchQuery, allVendorNames]);

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
        const counts = vendorCounts[vendorNameLower];
        
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
  }, [searchQuery, allVendorNames, vendorCounts, mentions]);

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
              {/* Left: Logo + Mobile Menu */}
              <div className="flex items-center gap-3">
                {/* Mobile Menu Trigger */}
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="lg:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle>Categories</SheetTitle>
                    </SheetHeader>
                    <div className="p-4">
                      <VendorSidebar
                        selectedCategory={selectedCategory}
                        onCategorySelect={handleCategoryChange}
                        categoryCounts={categoryCounts}
                        vendorsInCategory={vendorsInCategory}
                        showMoreCategories={showMoreCategories}
                        onToggleMoreCategories={() =>
                          setShowMoreCategories(!showMoreCategories)
                        }
                        onVendorSelect={handleVendorSelect}
                        selectedVendor={selectedVendor || undefined}
                        className="w-full"
                      />
                    </div>
                  </SheetContent>
                </Sheet>

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

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="flex gap-8">
            {/* Desktop Sidebar */}
            <VendorSidebar
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategoryChange}
              categoryCounts={categoryCounts}
              vendorsInCategory={vendorsInCategory}
              showMoreCategories={showMoreCategories}
              onToggleMoreCategories={() =>
                setShowMoreCategories(!showMoreCategories)
              }
              onVendorSelect={handleVendorSelect}
              selectedVendor={selectedVendor || undefined}
              className="hidden lg:block"
            />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0">
              {/* Hero Banner - Clean, prominent heading */}
              <div className="mb-8">
                {/* Show category context when filtering */}
                {selectedCategory !== "all" && selectedCategoryData && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-3xl">
                      {selectedCategoryData.icon}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {selectedCategoryData.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({categoryCounts[selectedCategory] || 0} reviews)
                    </span>
                  </div>
                )}

                {/* Main Hero - Only on default "all" view with no search */}
                {selectedCategory === "all" &&
                  searchQuery.trim().length === 0 &&
                  selectedVendor === null && (
                    <div className="py-4 sm:py-6">
                      {/* Content */}
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/30 text-xs font-semibold text-yellow-800 mb-4">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                        </span>
                        Updated Daily
                      </div>

                      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground mb-4 leading-[1.1] tracking-tight">
                        Unfiltered Vendor Intel{" "}
                        <span className="text-yellow-600">
                          From Real Dealers
                        </span>
                      </h1>

                      <p className="text-lg sm:text-xl text-muted-foreground mb-6 max-w-xl leading-relaxed">
                        Real feedback from verified dealers. No paid placements,
                        just honest experiences.
                      </p>

                      {/* Value Props */}
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-2 sm:gap-y-2 text-sm sm:text-base text-foreground/80">
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>
                            <strong className="text-foreground">
                              {totalVerifiedCount}+
                            </strong>{" "}
                            recommendations
                          </span>
                        </div>
                        <span className="text-border hidden sm:inline">•</span>
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 font-bold">⚠️</span>
                          <span>
                            <strong className="text-foreground">
                              {totalWarningCountValue}+
                            </strong>{" "}
                            warnings to avoid
                          </span>
                        </div>
                        <span className="text-border hidden sm:inline">•</span>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500 font-bold">💰</span>
                          <span>
                            Save{" "}
                            <strong className="text-foreground">
                              thousands
                            </strong>{" "}
                            in bad contracts
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Search Bar - Below hero */}
                <div className="pt-2 pb-3 sm:pb-4">
                  <div className="relative">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search vendors..."
                      value={searchQuery}
                      onClick={handleSearchClick}
                      onFocus={(e) => {
                        handleSearchClick(e);
                        if (isProUserValue && searchQuery.trim().length >= 2) {
                          setShowAutocomplete(true);
                        }
                      }}
                      onBlur={() => {
                        // Delay hiding autocomplete to allow clicks
                        setTimeout(() => setShowAutocomplete(false), 200);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && autocompleteSuggestions.length > 0 && searchQuery.trim().length >= 2) {
                          // Navigate to first suggestion on Enter
                          e.preventDefault();
                          handleVendorSelect(autocompleteSuggestions[0]);
                        } else if (e.key === "Escape") {
                          setShowAutocomplete(false);
                          searchInputRef.current?.blur();
                        }
                      }}
                      onChange={(e) => {
                        // Prevent typing for non-pro users
                        if (!isProUserValue) {
                          setShowUpgradeModal(true);
                          return;
                        }
                        setSearchQuery(e.target.value);
                        setShowAutocomplete(e.target.value.trim().length >= 2);
                        if (
                          selectedVendor &&
                          e.target.value.trim().toLowerCase() !==
                          selectedVendor.trim().toLowerCase()
                        ) {
                          setSelectedVendor(null);
                        }
                      }}
                      className="pl-10 sm:pl-12 pr-10 sm:pr-12 h-12 sm:h-14 bg-white border-2 border-border/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary text-sm sm:text-base rounded-lg sm:rounded-xl shadow-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          clearSearch();
                          setSelectedVendor(null);
                          setShowAutocomplete(false);
                        }}
                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    )}
                    
                    {/* Autocomplete Dropdown */}
                    {isProUserValue && showAutocomplete && autocompleteSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                        {autocompleteSuggestions.map((vendorName) => (
                          <button
                            key={vendorName}
                            onClick={() => {
                              handleVendorSelect(vendorName);
                              setShowAutocomplete(false);
                            }}
                            className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0 text-sm sm:text-base"
                          >
                            <div className="flex items-center gap-2">
                              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{vendorName}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Results Summary - only when actively searching */}
                {searchQuery.trim().length > 0 && (
                  <div className="mt-2 sm:mt-3 mb-3 sm:mb-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span className="text-xs font-medium text-green-600">
                        Updated Daily
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground mb-1 break-words">
                      Results for "{searchQuery}"
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {totalCount} review
                      {totalCount !== 1 ? "s" : ""} found
                      {positiveCount > 0 && ` • ${positiveCount} recommended`}
                      {warningCount > 0 &&
                        ` • ${warningCount} warning${warningCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Insight Banner - Only show when actively searching/filtering */}
              {(searchQuery.trim().length > 0 ||
                selectedVendor !== null ||
                selectedCategory !== "all") && (
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

              {/* Filter Bar - Only show when searching */}
              {(searchQuery.trim().length > 0 || selectedVendor !== null) && (
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

              {/* Trending Vendor Chips - Show when NOT searching */}
              {searchQuery.trim().length === 0 && selectedVendor === null && (
                <TrendingVendorChips
                  onVendorSelect={handleVendorSelect}
                  getLogoUrl={(vendorName) => getVendorLogoUrl(vendorName)}
                  className="mb-6"
                />
              )}

              {/* Matching Vendors Section - Show when searching */}
              {searchQuery.trim().length >= 2 && matchingVendors.length > 0 && (
                <div className="mb-6 sm:mb-8">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">
                      Vendors ({matchingVendors.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {matchingVendors.map((vendor) => {
                      const vendorWebsiteUrl = getWebsiteForVendor(vendor.name);
                      const vendorLogoUrl = getVendorLogoUrl(vendor.name, vendorWebsiteUrl);
                      
                      return (
                        <button
                          key={vendor.name}
                          onClick={() => handleVendorSelect(vendor.name)}
                          className="text-left p-3 sm:p-4 bg-white rounded-lg border border-border/50 hover:border-primary/50 hover:shadow-md transition-all group"
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

              {/* Reviews Section Header - Show when searching */}
              {searchQuery.trim().length >= 2 && visibleEntries.length > 0 && (
                <div className="mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    Reviews ({totalCount})
                  </h2>
                </div>
              )}

              {/* Results Grid */}
              {visibleEntries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {visibleEntries.map((entry) => {
                    // Backend handles all redaction - just use what's provided
                    const isLocked = entry.isLocked === true;
                    // Show vendor name if it exists (backend redacts when needed)
                    const showVendorNames = !!entry.vendorName;

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
                        onUpgradeClick={() => setShowUpgradeModal(true)}
                      />
                    );
                  })}

                  {/* Teaser Card */}
                  {showTeaserCard && (
                    <UpgradeTeaser
                      remainingCount={remainingCount}
                      isAuthenticated={isAuthenticated}
                      onUpgradeClick={() => setShowUpgradeModal(true)}
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

              {/* Empty State */}
              {filteredData.length === 0 && !isWamLoading && (
                <div className="text-center py-16">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    No results found
                  </h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or category filter
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
            </main>
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
