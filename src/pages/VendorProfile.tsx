import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Globe, TrendingUp, ThumbsUp, AlertTriangle, Loader2, Crown, Share2, CreditCard } from "lucide-react";
import { SignIn, UserButton, useClerk } from "@clerk/clerk-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VendorCard, VendorCardDetail, AIInsightBanner } from "@/components/vendors";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { fetchVendorProfile, fetchVendorPulseFeed } from "@/hooks/useSupabaseVendorData";
import { isProUser } from "@/utils/tierUtils";
import { cn } from "@/lib/utils";

interface VendorProfileData {
  vendorName: string;
  stats: {
    totalMentions: number;
    positiveCount: number;
    warningCount: number;
    positivePercent: number;
    warningPercent: number;
  };
  categories: string[];
  metadata: {
    website_url?: string;
    logo_url?: string;
    description?: string;
  } | null;
  insight: any;
  mentions: VendorEntry[];
}

const VendorProfile = () => {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  
  const {
    isAuthenticated,
    user,
    role,
    tier,
    isLoading: isAuthLoading,
  } = useClerkAuth();

  const [profileData, setProfileData] = useState<VendorProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<VendorEntry | null>(null);
  const [allMentions, setAllMentions] = useState<VendorEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const vendorName = vendorSlug ? decodeURIComponent(vendorSlug) : "";

  const isProUserValue = useMemo(() => isProUser(tier), [tier]);

  // Get logo URL from logo.dev or metadata
  const getLogoUrl = useCallback((name: string, websiteUrl?: string) => {
    // If metadata has logo_url, use it
    if (profileData?.metadata?.logo_url) {
      return profileData.metadata.logo_url;
    }
    
    // Otherwise, try to construct logo.dev URL from website or vendor name
    const logoDevToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
    if (logoDevToken) {
      // Try to extract domain from website URL
      let domain = websiteUrl;
      if (domain && !domain.startsWith("http")) {
        domain = `https://${domain}`;
      }
      if (domain) {
        try {
          const url = new URL(domain);
          domain = url.hostname.replace("www.", "");
        } catch {
          // If URL parsing fails, try to use vendor name as domain
          domain = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "") + ".com";
        }
      } else {
        // Fallback: try vendor name as domain
        domain = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "") + ".com";
      }
      
      return `https://img.logo.dev/${domain}?token=${logoDevToken}&size=128&format=png&fallback=monogram`;
    }
    
    return null;
  }, [profileData?.metadata?.logo_url]);

  // Fetch vendor profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!vendorName) {
        setError("Vendor name is required");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchVendorProfile(vendorName);
        console.log(`[VendorProfile] Received data:`, {
          vendorName: data.vendorName,
          totalMentions: data.stats?.totalMentions,
          mentionsCount: data.mentions?.length
        });

        setProfileData(data);
        setAllMentions(data.mentions || []);
        setHasMore((data.mentions || []).length >= 40);
        setIsLoading(false);
      } catch (err) {
        console.error("[VendorProfile] Failed to fetch vendor profile:", err);
        setError(`Failed to load vendor profile: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [vendorName]);

  // Load more mentions
  const loadMoreMentions = useCallback(async () => {
    if (!hasMore || isLoadingMore || !vendorName) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchVendorPulseFeed({
        vendorName,
        page: nextPage,
        pageSize: 40,
      });

      setAllMentions((prev) => [...prev, ...data.mentions]);
      setPage(nextPage);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error("Failed to load more mentions:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, vendorName, page]);

  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProUserValue || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMentions();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [isProUserValue, hasMore, isLoadingMore, loadMoreMentions]);

  const logoUrl = useMemo(() => {
    if (!profileData) return null;
    return getLogoUrl(profileData.vendorName, profileData.metadata?.website_url);
  }, [profileData, getLogoUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/vendors")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Vendor Not Found</h1>
            <p className="text-muted-foreground mb-4">{error || "The vendor you're looking for doesn't exist."}</p>
            <Button onClick={() => navigate("/vendors")}>
              Browse All Vendors
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{profileData.vendorName} - CDG Pulse</title>
        <meta name="description" content={`Reviews and insights about ${profileData.vendorName} from CDG Pulse`} />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--vendor-bg))]">
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Left: Back + Logo */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/vendors")}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Link to="/" className="flex items-center">
                  <img src={cdgPulseLogo} alt="CDG Pulse" className="h-7" />
                </Link>
              </div>

              {/* Spacer */}
              <div className="hidden md:flex flex-1" />

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const shareData = {
                      title: `${profileData.vendorName} - CDG Pulse`,
                      text: `Check out reviews for ${profileData.vendorName} on CDG Pulse`,
                      url: window.location.href,
                    };
                    if (navigator.share) {
                      try { await navigator.share(shareData); } catch {}
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                    }
                  }}
                  className="hidden lg:flex"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>

                {!isAuthenticated && (
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
                        ? `${import.meta.env.VITE_STRIPE_PORTAL_URL}?prefilled_email=${encodeURIComponent(email)}`
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">

          {/* Header Section */}
          <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-amber-50/50 via-white to-slate-50/60 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="absolute right-0 top-0 h-24 w-24 -translate-y-1/3 translate-x-1/3 rounded-full bg-amber-200/30 blur-2xl" />
            <div className="absolute left-0 bottom-0 h-24 w-24 -translate-x-1/3 translate-y-1/3 rounded-full bg-slate-200/40 blur-2xl" />

            <div className="relative flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border border-border bg-white">
                  <AvatarImage src={logoUrl || undefined} alt={profileData.vendorName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-base sm:text-lg font-bold">
                    {profileData.vendorName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight break-words">
                    {profileData.vendorName}
                  </h1>
                  {profileData.metadata?.website_url && (
                    <a
                      href={profileData.metadata.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span>Visit Website</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Description */}
              {profileData.metadata?.description && (
                <p className="text-sm sm:text-base text-muted-foreground lg:max-w-2xl">
                  {profileData.metadata.description}
                </p>
              )}
            </div>
          </section>

          {/* Stats Summary */}
          <section className="mb-4 sm:mb-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {profileData.stats.totalMentions} mentions
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
                {profileData.stats.positiveCount} positive ({profileData.stats.positivePercent}%)
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                {profileData.stats.warningCount} warnings ({profileData.stats.warningPercent}%)
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Sentiment:{" "}
                <span className="font-semibold text-foreground">
                  {profileData.stats.positivePercent >= 70
                    ? "Positive"
                    : profileData.stats.warningPercent >= 50
                      ? "Mixed"
                      : "Neutral"}
                </span>
              </span>
            </div>
          </section>

          {/* AI Insights */}
          {profileData.insight && (
            <div className="mb-6">
              <AIInsightBanner
                data={allMentions}
                selectedVendor={vendorName}
                isProUser={isProUserValue}
                onUpgradeClick={() => {
                  if (isAuthenticated) {
                    setShowUpgradeModal(true);
                  } else {
                    window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                  }
                }}
              />
            </div>
          )}

          {/* Mentions Feed */}
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Recent Reviews</h2>
            {allMentions.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-border/50 p-6 sm:p-8 text-center">
                <p className="text-sm sm:text-base text-muted-foreground">No reviews found for this vendor.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {allMentions.map((mention) => (
                  <VendorCard
                    key={mention.id}
                    entry={mention}
                    isLocked={mention.isLocked || !isProUserValue}
                    showVendorNames={true}
                    isFullAccess={isProUserValue}
                    isAuthenticated={isAuthenticated}
                    vendorLogo={logoUrl}
                    vendorWebsite={profileData.metadata?.website_url || null}
                    onCardClick={setSelectedCard}
                    onVendorClick={(name) => navigate(`/vendors/${encodeURIComponent(name)}`)}
                    onUpgradeClick={() => {
                      if (isAuthenticated) {
                        setShowUpgradeModal(true);
                      } else {
                        // Redirect to Stripe checkout for Viewer tier
                        window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {isProUserValue && hasMore && (
              <div ref={loadMoreRef} className="mt-6 text-center">
                {isLoadingMore && (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                )}
              </div>
            )}

            {!isProUserValue && allMentions.length > 0 && (
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    setShowUpgradeModal(true);
                  } else {
                    window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                  }
                }}
                className="mt-6 w-full bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center hover:bg-yellow-100 transition-colors cursor-pointer"
              >
                <Crown className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-yellow-800 font-medium mb-1">
                  Upgrade to Pro to see all reviews
                </p>
                <p className="text-xs text-yellow-700">
                  Pro members get unlimited access to all vendor reviews and insights
                </p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <VendorCardDetail
          entry={selectedCard}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          onVendorSelect={(name) => navigate(`/vendors/${encodeURIComponent(name)}`)}
          vendorLogo={logoUrl}
          vendorWebsite={profileData.metadata?.website_url || null}
        />
      )}

      {/* Upgrade Modal for authenticated users */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        targetTier="pro"
      />

      {/* Sign In Modal for non-authenticated users */}
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
              fallbackRedirectUrl={`/vendors/${encodeURIComponent(vendorName)}`}
              signUpFallbackRedirectUrl={`/vendors/${encodeURIComponent(vendorName)}`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VendorProfile;
