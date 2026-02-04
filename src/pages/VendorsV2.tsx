import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Search, X, Crown, Share2, Menu, CreditCard } from "lucide-react";
import { SignIn, UserButton, useClerk } from "@clerk/clerk-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SearchSuggestions,
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
  // UI State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<VendorEntry | null>(null);
  const [selectedCardForShare, setSelectedCardForShare] =
    useState<VendorEntry | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

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

  // Fallback vendor data from backend table (keeps /vendors usable if WAM is flaky)
  const { reviews: dbReviews, isLoading: isDbLoading } = useVendorReviews();

  // Verified vendor hooks
  const { profile: vendorProfile, isVerified, canRespondTo } = useVerifiedVendor();
  const { getWebsiteForVendor, getLogoForVendor } = useVendorWebsites();

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

  // Load more mentions (for pro users)
  const loadMoreMentions = async () => {
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
  };

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
  }, [isProUserValue, paginationInfo?.hasMore, isLoadingMore]);

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

  // Handle vendor chip click
  const handleVendorSelect = (vendorName: string) => {
    // For non-pro users, show upgrade modal (same as search field click)
    if (!isProUserValue) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedVendor(vendorName);
    setSearchQuery(vendorName);
  };

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

                {/* Search Results Summary - only when actively searching */}
                {searchQuery.trim().length > 0 && (
                  <div className="mb-4 p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span className="text-xs font-medium text-green-600">
                        Updated Daily
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      Results for "{searchQuery}"
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {filteredData.length} review
                      {filteredData.length !== 1 ? "s" : ""} found
                      {positiveCount > 0 && ` • ${positiveCount} recommended`}
                      {warningCount > 0 &&
                        ` • ${warningCount} warning${warningCount !== 1 ? "s" : ""
                        }`}
                    </p>
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
                <div className="pt-2 pb-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Search vendors..."
                      value={searchQuery}
                      onClick={handleSearchClick}
                      onFocus={handleSearchClick}
                      onChange={(e) => {
                        // Prevent typing for non-pro users
                        if (!isProUserValue) {
                          setShowUpgradeModal(true);
                          return;
                        }
                        setSearchQuery(e.target.value);
                        if (
                          selectedVendor &&
                          e.target.value.trim().toLowerCase() !==
                          selectedVendor.trim().toLowerCase()
                        ) {
                          setSelectedVendor(null);
                        }
                        // Only show suggestions when user is actually typing
                        if (
                          e.target.value.trim().length > 0 &&
                          !showSearchSuggestions
                        ) {
                          setShowSearchSuggestions(true);
                        }
                        // Hide suggestions when input is cleared
                        if (e.target.value.trim().length === 0) {
                          setShowSearchSuggestions(false);
                        }
                      }}
                      className="pl-12 pr-12 h-14 bg-white border-2 border-border/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary text-base rounded-xl shadow-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          clearSearch();
                          setShowSearchSuggestions(false);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                    <SearchSuggestions
                      isOpen={showSearchSuggestions}
                      onClose={() => setShowSearchSuggestions(false)}
                      searchQuery={searchQuery}
                      data={wamMentions}
                      categoryCounts={categoryCounts}
                      selectedCategory={selectedCategory}
                      onVendorSelect={(vendorName) => {
                        handleVendorSelect(vendorName);
                        setShowSearchSuggestions(false);
                      }}
                      onCategorySelect={(categoryId) => {
                        handleCategoryChange(categoryId);
                        if (categoryId !== "all") {
                          setShowSearchSuggestions(false);
                        }
                      }}
                    />
                  </div>
                </div>
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
                  className="mb-6"
                />
              )}

              {/* Results Grid */}
              {visibleEntries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleEntries.map((entry) => {
                    // Backend handles all redaction - just use what's provided
                    const isLocked = entry.isLocked === true;
                    // Show vendor name if it exists (backend redacts when needed)
                    const showVendorNames = !!entry.vendorName;

                    // Get website and logo for this vendor (if verified vendor has set them)
                    const vendorWebsiteUrl = entry.vendorName
                      ? getWebsiteForVendor(entry.vendorName)
                      : null;
                    const vendorLogoUrl = entry.vendorName
                      ? getLogoForVendor(entry.vendorName)
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

      {selectedCardForShare && (
        <QuoteCardModal
          isOpen={!!selectedCardForShare}
          onClose={() => setSelectedCardForShare(null)}
          quote={selectedCardForShare.quote}
          title={selectedCardForShare.title}
          type={selectedCardForShare.type}
        />
      )}

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
