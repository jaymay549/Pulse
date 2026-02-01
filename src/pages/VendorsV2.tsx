import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Search, X, Crown, User, LogOut, Share2, Menu, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import WamAuthModal from "@/components/WamAuthModal";
import QuoteCardModal from "@/components/wins/QuoteCardModal";
import VendorPricingTiers from "@/components/vendors/VendorPricingTiers";
import AuthPickerModal from "@/components/vendors/AuthPickerModal";
import ReviewMarquee from "@/components/vendors/ReviewMarquee";

// Hooks
import { useVendorFilters, categories } from "@/hooks/useVendorFilters";
import { useWamAuth } from "@/hooks/useWamAuth";
import { useVendorReviews, VendorEntry } from "@/hooks/useVendorReviews";
import { useVendorWebsites } from "@/hooks/useVendorWebsites";
import { useVerifiedVendor } from "@/hooks/useVerifiedVendor";
import { useVendorResponses } from "@/hooks/useVendorResponses";

// Config
import { WAM_URL } from "@/config/wam";

// Helper to determine access level based on tier
type UserTier = 'anonymous' | 'free' | 'community' | 'pro' | 'executive' | 'viewer' | 'verified_vendor';

function getAccessLevel(userTier: UserTier): {
  freeReviewCount: number;
  showVendorNames: boolean;
  unlimitedAccess: boolean;
} {
  switch (userTier) {
    case 'pro':
    case 'executive':
    case 'viewer':
    case 'verified_vendor':
      return {
        freeReviewCount: Infinity,
        showVendorNames: true,
        unlimitedAccess: true,
      };
    case 'free':
    case 'community':
      return {
        freeReviewCount: 3,
        showVendorNames: true,
        unlimitedAccess: false,
      };
    case 'anonymous':
    default:
      return {
        freeReviewCount: 3,
        showVendorNames: false,
        unlimitedAccess: false,
      };
  }
}

const VendorsV2 = () => {
  // UI State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPulseModal, setShowPulseModal] = useState(false);
  const [showAuthPicker, setShowAuthPicker] = useState(false);
  const [selectedCard, setSelectedCard] = useState<VendorEntry | null>(null);
  const [selectedCardForShare, setSelectedCardForShare] = useState<VendorEntry | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  // WAM Pulse Auth
  const {
    isAuthenticated: isPulseAuthenticated,
    role: pulseRole,
    sessionId: pulseSessionId,
    isLoading: pulseAuthLoading,
    requestCode: requestPulseCode,
    verifyCode: verifyPulseCode,
    logout: logoutPulse
  } = useWamAuth();

  // Vendor data from WAM
  const [wamMentions, setWamMentions] = useState<VendorEntry[]>([]);
  const [isWamLoading, setIsWamLoading] = useState(false);

  // Fallback vendor data from backend table (keeps /vendors usable if WAM is flaky)
  const { reviews: dbReviews, isLoading: isDbLoading } = useVendorReviews();

  // Verified vendor hooks
  const { profile: vendorProfile, isVerified, canRespondTo } = useVerifiedVendor();
  const { getWebsiteForVendor, getLogoForVendor } = useVendorWebsites();

  const mentions = useMemo(() => {
    return wamMentions.length > 0 ? wamMentions : dbReviews;
  }, [wamMentions, dbReviews]);

  // Get review IDs for fetching responses
  const reviewIds = useMemo(() => mentions.map((m) => Number(m.id)), [mentions]);
  const { responses, addResponse, updateResponse, deleteResponse } = useVendorResponses(reviewIds);

  const isDataLoading = isWamLoading || (wamMentions.length === 0 && isDbLoading);

  // Fetch Vendor Pulse mentions from WAM
  useEffect(() => {
    const fetchWamMentions = async () => {
      setIsWamLoading(true);
      try {
        const headers: HeadersInit = {};
        if (pulseSessionId) {
          headers["x-pulse-session"] = pulseSessionId;
        }

        const response = await fetch(`${WAM_URL}/api/public/vendor-pulse/mentions`, {
          headers
        });
        if (response.ok) {
          const data = await response.json();
          setWamMentions(data.mentions || []);
        }
      } catch (err) {
        console.error("Failed to fetch WAM mentions:", err);
      } finally {
        setIsWamLoading(false);
      }
    };

    fetchWamMentions();
  }, [isPulseAuthenticated, pulseSessionId]);

  // Map WAM Pulse role to tier format
  const effectiveTier = useMemo(() => {
    if (isPulseAuthenticated && pulseRole) {
      switch (pulseRole) {
        case "Pro":
          return "pro";
        case "Community":
          return "community";
        case "Guest":
        default:
          return "anonymous";
      }
    }
    return "anonymous";
  }, [isPulseAuthenticated, pulseRole]);

  // Access level
  const accessLevel = getAccessLevel(effectiveTier);
  const isProUser = accessLevel.unlimitedAccess;

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
  } = useVendorFilters({ data: mentions, selectedVendor });

  // Clear selectedVendor when searchQuery is cleared or changed manually (but not when it matches)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSelectedVendor(null);
    } else if (selectedVendor && searchQuery.trim().toLowerCase() !== selectedVendor.trim().toLowerCase()) {
      // If searchQuery changed to something different from selectedVendor, clear it
      // This handles the case where user types in search box after selecting a vendor
      setSelectedVendor(null);
    }
  }, [searchQuery, selectedVendor]);

  // Sort categories by mention count (descending), keeping "All" at the top
  const sortedCategories = useMemo(() => {
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

  // Calculate visible entries based on access level
  // For anonymous users searching: show 1 fully unlocked positive (teaser) + 4 locked cards (2:1 ratio positive:warning)
  const visibleEntries = useMemo(() => {
    const isSearchActive = searchQuery.trim().length > 0 || selectedVendor !== null;

    if (accessLevel.unlimitedAccess) {
      return filteredData;
    }

    // Free users must search - show nothing by default
    if (!isSearchActive) {
      return [];
    }

    // When searching: show 1 unlocked positive (teaser), then warning as 2nd card, then remaining mix
    const positives = [...filteredData.filter(e => e.type === "positive")];
    const warnings = [...filteredData.filter(e => e.type === "warning")];
    
    const result: (VendorEntry & { isUnlockedTeaser?: boolean })[] = [];
    
    // First: add a positive as the UNLOCKED teaser (shows value without giving away warnings)
    if (positives.length > 0) {
      const randomIdx = Math.floor(Math.random() * positives.length);
      const teaserPositive = positives.splice(randomIdx, 1)[0];
      result.push({ ...teaserPositive, isUnlockedTeaser: true });
    }
    
    // Second: ALWAYS add a warning if one exists (compels dealers to subscribe)
    if (warnings.length > 0) {
      const randomWarnIdx = Math.floor(Math.random() * warnings.length);
      result.push(warnings.splice(randomWarnIdx, 1)[0]);
    }
    
    // Fill remaining slots (up to 5 total) with alternating pattern
    let usePositive = true;
    while (result.length < 5) {
      if (usePositive && positives.length > 0) {
        result.push(positives.shift()!);
      } else if (!usePositive && warnings.length > 0) {
        result.push(warnings.shift()!);
      } else if (positives.length > 0) {
        result.push(positives.shift()!);
      } else if (warnings.length > 0) {
        result.push(warnings.shift()!);
      } else {
        break;
      }
      usePositive = !usePositive;
    }
    
    return result;
  }, [filteredData, accessLevel.unlimitedAccess, searchQuery, selectedVendor]);

  const remainingCount = Math.max(0, filteredData.length - visibleEntries.length);
  const showTeaserCard = !accessLevel.unlimitedAccess && remainingCount > 0;

  // Total warning count for CTAs
  const totalWarningCount = mentions.filter(e => e.type === "warning").length;

  // Handle share
  const handleShare = async () => {
    const shareData = {
      title: 'Vendor Reviews from CDG Circles',
      text: 'Real vendor reviews from verified auto dealers.',
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
    setSelectedVendor(vendorName);
    setSearchQuery(vendorName);
  };

  // Handle type filter change
  const handleTypeFilterChange = (filter: "all" | "positive" | "warning") => {
    if (filter === "warning" && !accessLevel.unlimitedAccess) {
      // Scroll to tiers section instead of showing modal
      const tiersSection = document.getElementById('tiers-section');
      if (tiersSection) {
        const offset = 100;
        const elementPosition = tiersSection.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      }
      return;
    }
    setTypeFilter(filter);
  };

  return (
    <>
      <Helmet>
        <title>Vendor Pulse | CDG Circles - Real Dealer Insights</title>
        <meta name="description" content="Monitor what dealers are saying about your company. Real-time vendor intelligence from verified automotive dealers." />
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
                        onToggleMoreCategories={() => setShowMoreCategories(!showMoreCategories)}
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
                <Button variant="ghost" size="sm" onClick={handleShare} className="hidden lg:flex">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>

                {!isPulseAuthenticated && !pulseAuthLoading && (
                  <Button variant="outline" size="sm" onClick={() => setShowAuthPicker(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                )}

                {isPulseAuthenticated && !isProUser && (
                  <Button
                    variant="yellow"
                    size="sm"
                    onClick={() => window.open('https://billing.stripe.com/p/login/cN23dQ1g35Tsd3ibII', '_blank')}
                    className="hidden lg:flex font-bold"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                )}

                {isPulseAuthenticated && (
                  <>
                    <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="capitalize">{effectiveTier}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => logoutPulse()}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </>
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
              onToggleMoreCategories={() => setShowMoreCategories(!showMoreCategories)}
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
                    <span className="text-3xl">{selectedCategoryData.icon}</span>
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
                      <span className="text-xs font-medium text-green-600">Updated Daily</span>
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      Results for "{searchQuery}"
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {filteredData.length} review{filteredData.length !== 1 ? 's' : ''} found
                      {positiveCount > 0 && ` • ${positiveCount} recommended`}
                      {warningCount > 0 && ` • ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
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
                      <span className="text-yellow-600">From Real Dealers</span>
                    </h1>
                    
                    <p className="text-lg sm:text-xl text-muted-foreground mb-6 max-w-xl leading-relaxed">
                      Real feedback from verified dealers. No paid placements, just honest experiences.
                    </p>

                    {/* Value Props */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-2 sm:gap-y-2 text-sm sm:text-base text-foreground/80">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-bold">✓</span>
                        <span><strong className="text-foreground">{mentions.length}+</strong> verified reviews</span>
                      </div>
                      <span className="text-border hidden sm:inline">•</span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold">⚠️</span>
                        <span><strong className="text-foreground">{totalWarningCount}+</strong> warnings to avoid</span>
                      </div>
                      <span className="text-border hidden sm:inline">•</span>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500 font-bold">💰</span>
                        <span>Save <strong className="text-foreground">thousands</strong> in bad contracts</span>
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
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (selectedVendor && e.target.value.trim().toLowerCase() !== selectedVendor.trim().toLowerCase()) {
                          setSelectedVendor(null);
                        }
                        // Only show suggestions when user is actually typing
                        if (e.target.value.trim().length > 0 && !showSearchSuggestions) {
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
              {(searchQuery.trim().length > 0 || selectedVendor !== null || selectedCategory !== "all") && (
                <AIInsightBanner
                  data={wamMentions}
                  selectedCategory={selectedCategory}
                  searchQuery={searchQuery}
                  selectedVendor={selectedVendor}
                  isProUser={isProUser}
                  pulseSessionId={pulseSessionId}
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
                  data={wamMentions}
                  onVendorSelect={handleVendorSelect}
                  className="mb-6"
                />
              )}


              {/* Results Grid */}
              {visibleEntries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleEntries.map((entry) => {
                    // Check if this is the unlocked teaser card
                    const isUnlockedTeaser = (entry as VendorEntry & { isUnlockedTeaser?: boolean }).isUnlockedTeaser === true;
                    
                    // Use the isLocked flag from API, or fall back to checking if content is locked
                    // Unlocked teasers override the lock status
                    const isLocked = isUnlockedTeaser 
                      ? false 
                      : (entry.isLocked !== undefined 
                          ? entry.isLocked 
                          : (entry.quote === "[Content locked - Join Pro to view]" || 
                             entry.quote === "[Content locked - Upgrade to Pro to view]"));
                    
                    // Show vendor names if: vendorName exists AND (user has access OR unlocked teaser OR not locked)
                    // Backend doesn't serve vendorName when it should be hidden
                    const showVendorNames = entry.vendorName && 
                      (accessLevel.unlimitedAccess || isUnlockedTeaser || (!isLocked && accessLevel.showVendorNames));

                    // Get website and logo for this vendor (if verified vendor has set them)
                    const vendorWebsiteUrl = entry.vendorName ? getWebsiteForVendor(entry.vendorName) : null;
                    const vendorLogoUrl = entry.vendorName ? getLogoForVendor(entry.vendorName) : null;
                    const vendorResponse = responses[Number(entry.id)] || null;

                    return (
                      <VendorCard
                        key={entry.id}
                        entry={entry}
                        isLocked={isLocked}
                        showVendorNames={showVendorNames}
                        isFullAccess={accessLevel.unlimitedAccess}
                        isPulseAuthenticated={isPulseAuthenticated}
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
                      isPulseAuthenticated={isPulseAuthenticated}
                      onUpgradeClick={() => setShowUpgradeModal(true)}
                    />
                  )}
                </div>
              )}

              {/* Empty State */}
              {filteredData.length === 0 && !isWamLoading && (
                <div className="text-center py-16">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">No results found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or category filter</p>
                </div>
              )}

              {/* Loading State */}
              {isWamLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-48 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              )}

              {/* Upgrade Section for Non-Pro Users */}
              {!accessLevel.unlimitedAccess && !isPulseAuthenticated && (
                <VendorPricingTiers 
                  totalReviews={wamMentions.length}
                  totalWarnings={totalWarningCount}
                  onSignInClick={() => setShowAuthPicker(true)}
                />
              )}

              {/* Authenticated Non-Pro Upgrade Banner */}
              {!accessLevel.unlimitedAccess && isPulseAuthenticated && (
                <div className="mt-8">
                  <div className="p-6 rounded-xl bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border-2 border-yellow-400/30 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-yellow-500/20">
                        <Crown className="h-7 w-7 text-yellow-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Upgrade to See All Reviews</h3>
                        <p className="text-muted-foreground text-sm">
                          Unlock all {wamMentions.length} reviews including {totalWarningCount} warnings.
                        </p>
                      </div>
                    </div>
                    <Button variant="yellow" size="lg" className="font-bold whitespace-nowrap" onClick={() => setShowUpgradeModal(true)}>
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
                <img src={cdgPulseLogo} alt="CDG Pulse" className="h-6 opacity-70" />
              </Link>

              <p className="max-w-2xl text-center text-xs text-muted-foreground/70">
                <span className="font-medium">Disclaimer:</span> CDG Pulse does not endorse or recommend any vendor.
                All reviews are community-generated and reflect individual experiences.
              </p>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <a href="https://cardealershipguy.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  Terms
                </a>
                <a href="https://cardealershipguy.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
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
        vendorResponse={selectedCard ? responses[Number(selectedCard.id)] : null}
        canRespondAsVendor={selectedCard?.vendorName ? canRespondTo(selectedCard.vendorName) : false}
        onAddResponse={(text) => selectedCard ? addResponse(Number(selectedCard.id), text) : Promise.resolve(false)}
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

      <WamAuthModal
        isOpen={showPulseModal}
        onClose={() => setShowPulseModal(false)}
        onRequestCode={requestPulseCode}
        onVerifyCode={verifyPulseCode}
      />

      <AuthPickerModal
        isOpen={showAuthPicker}
        onClose={() => setShowAuthPicker(false)}
        onSelectPhone={() => setShowPulseModal(true)}
      />
    </>
  );
};

export default VendorsV2;
