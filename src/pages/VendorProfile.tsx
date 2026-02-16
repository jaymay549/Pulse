import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Globe,
  TrendingUp,
  ThumbsUp,
  AlertTriangle,
  Loader2,
  Crown,
  Share2,
  CreditCard,
  ArrowRight,
  ArrowUpRight,
  Building2,
} from "lucide-react";
import { SignIn, UserButton } from "@clerk/clerk-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import ManageOrgModal from "@/components/vendors/ManageOrgModal";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VendorCardDetail, AIInsightBanner } from "@/components/vendors";
import ManageVendorButton from "@/components/vendors/ManageVendorButton";
import VendorReviewGrid from "@/components/vendors/VendorReviewGrid";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { useVendorResponses } from "@/hooks/useVendorResponses";
import { useVerifiedVendor } from "@/hooks/useVerifiedVendor";
import { categories } from "@/hooks/useVendorFilters";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { WAM_URL } from "@/config/wam";
import { resolveVendorAccess } from "@/utils/accessControl";
import { cn } from "@/lib/utils";
import {
  shadowCompare,
  buildVendorProfileQuery,
} from "@/lib/supabaseShadow";

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

  const { isAuthenticated, user, tier, fetchWithAuth } = useClerkAuth();
  const {
    isActive: isVendorActive,
    isPro: isVendorPro,
    vendorNames,
    organization,
    fetchWithVendorAuth,
  } = useVendorAuth();
  const fetchVendorPulse = useCallback(
    (url: string, options: RequestInit = {}) => {
      return organization?.id
        ? fetchWithVendorAuth(url, options)
        : fetchWithAuth(url, options);
    },
    [organization?.id, fetchWithVendorAuth, fetchWithAuth],
  );
  const isVendorOrganization = useMemo(() => {
    const metadata = organization?.publicMetadata as
      | { vendor?: Record<string, unknown> }
      | undefined;
    return Boolean(metadata?.vendor);
  }, [organization?.publicMetadata]);

  const [profileData, setProfileData] = useState<VendorProfileData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<VendorEntry | null>(null);
  const [allMentions, setAllMentions] = useState<VendorEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [manageOrgModalOpen, setManageOrgModalOpen] = useState(false);
  const [categoryMentions, setCategoryMentions] = useState<VendorEntry[]>([]);
  const [categoryVendorCounts, setCategoryVendorCounts] = useState<
    Record<string, { total: number; positive: number; warning: number }>
  >({});
  const [categoryVendorNames, setCategoryVendorNames] = useState<
    Record<string, string>
  >({});
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const { canRespondTo } = useVerifiedVendor();

  const vendorName = vendorSlug ? decodeURIComponent(vendorSlug) : "";

  const isProUserValue = useMemo(
    () =>
      resolveVendorAccess({
        tier,
        vendorOrg: { isActive: isVendorActive, isPro: isVendorPro },
      }).hasFullAccess,
    [tier, isVendorActive, isVendorPro],
  );
  const reviewIds = useMemo(
    () => [
      ...allMentions.map((m) => String(m.id)),
      ...categoryMentions.map((m) => String(m.id)),
    ],
    [allMentions, categoryMentions],
  );
  const { responses, addResponse, updateResponse, deleteResponse } =
    useVendorResponses(reviewIds);

  // Get logo URL from logo.dev or metadata
  const getLogoUrl = useCallback(
    (name: string, websiteUrl?: string) => {
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
            domain =
              name
                .toLowerCase()
                .replace(/\s+/g, "")
                .replace(/[^a-z0-9.-]/g, "") + ".com";
          }
        } else {
          // Fallback: try vendor name as domain
          domain =
            name
              .toLowerCase()
              .replace(/\s+/g, "")
              .replace(/[^a-z0-9.-]/g, "") + ".com";
        }

        return `https://img.logo.dev/${domain}?token=${logoDevToken}&size=128&format=png&fallback=monogram`;
      }

      return null;
    },
    [profileData?.metadata?.logo_url],
  );

  // Logo URL for other vendors (category section) - uses logo.dev from name only
  const getOtherVendorLogoUrl = useCallback((name: string) => {
    const logoDevToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
    if (!logoDevToken || !name) return null;
    const domain =
      name
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9.-]/g, "") + ".com";
    return `https://img.logo.dev/${domain}?token=${logoDevToken}&size=128&format=png&fallback=monogram`;
  }, []);

  // Fetch vendor profile (metadata, stats, insight) and mentions from same API as VendorsV2
  // Uses public mentions API so vendor responses use same ID scheme and display correctly
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
        // Fetch profile for stats, metadata, insight
        const profileUrl = `${WAM_URL}/api/public/vendor-pulse/vendors/${encodeURIComponent(vendorName)}/profile`;
        const profileRes = await fetchVendorPulse(profileUrl);

        if (!profileRes.ok) {
          const errorText = await profileRes.text();
          console.error(
            `[VendorProfile] Error response (${profileRes.status}):`,
            errorText,
          );
          if (profileRes.status === 404) {
            setError("Vendor not found");
          } else {
            setError(`Failed to load vendor profile (${profileRes.status})`);
          }
          setIsLoading(false);
          return;
        }

        const profileDataRes = await profileRes.json();
        setProfileData(profileDataRes);
        
        // Shadow compare with Supabase (fire-and-forget)
        shadowCompare(
          `/api/public/vendor-pulse/vendors/${vendorName}/profile`,
          profileDataRes,
          buildVendorProfileQuery(vendorName),
          { userTier: tier, requestPayload: { vendorName } },
        ).catch(() => {});

        // Fetch mentions from same API as VendorsV2 - ensures vendor responses display (same ID scheme)
        const mentionsParams = new URLSearchParams();
        mentionsParams.append("vendorName", vendorName);
        mentionsParams.append("page", "1");
        mentionsParams.append("pageSize", "40");

        const mentionsRes = await fetchVendorPulse(
          `${WAM_URL}/api/public/vendor-pulse/mentions?${mentionsParams.toString()}`,
        );

        if (mentionsRes.ok) {
          const mentionsData = await mentionsRes.json();
          const transformedMentions = (mentionsData.mentions || []).map(
            (mention: any) => ({
              ...mention,
              vendorName: mention.vendor_name || mention.vendorName,
              conversationTime:
                mention.conversation_time || mention.conversationTime,
              vendorResponse: mention.vendorResponse || null,
            }),
          );
          setAllMentions(transformedMentions);
          setHasMore(mentionsData.hasMore ?? transformedMentions.length >= 40);
          setPage(1);
        } else {
          setAllMentions([]);
          setHasMore(false);
        }

        setIsLoading(false);
      } catch (err) {
        console.error("[VendorProfile] Failed to fetch vendor profile:", err);
        setError(
          `Failed to load vendor profile: ${err instanceof Error ? err.message : String(err)}`,
        );
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [vendorName, fetchVendorPulse]);

  // Primary category for "More vendors" section - derive from vendor's mentions
  // (allMentions from public API) since profile API may use different data source
  const primaryCategory = useMemo(() => {
    const cats = allMentions.map((m) => m.category).filter(Boolean);
    if (cats.length === 0) return undefined;
    // Use most frequent category
    const freq: Record<string, number> = {};
    cats.forEach((c) => {
      freq[c] = (freq[c] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [allMentions]);

  // Fetch "More [category] vendors and reviews" when vendor has categories
  useEffect(() => {
    if (!primaryCategory || primaryCategory === "all" || !vendorName) {
      setCategoryMentions([]);
      setCategoryVendorCounts({});
      setCategoryVendorNames({});
      return;
    }

    let cancelled = false;
    const fetchCategoryData = async () => {
      setIsCategoryLoading(true);
      try {
        const counts: Record<
          string,
          { total: number; positive: number; warning: number }
        > = {};
        const names: Record<string, string> = {};
        const allMentionsList: VendorEntry[] = [];
        const currentVendorLower = vendorName.toLowerCase();

        let page = 1;
        const pageSize = 100;
        const maxPages = 5;

        while (page <= maxPages) {
          const params = new URLSearchParams();
          params.append("category", primaryCategory);
          params.append("page", page.toString());
          params.append("pageSize", pageSize.toString());

          const res = await fetchVendorPulse(
            `${WAM_URL}/api/public/vendor-pulse/mentions?${params.toString()}`,
          );
          if (!res.ok) break;

          const data = await res.json();
          const mentionsPage = (data.mentions || []).map((m: any) => ({
            ...m,
            vendorName: m.vendor_name || m.vendorName,
            conversationTime: m.conversation_time || m.conversationTime,
            vendorResponse: m.vendorResponse || null,
          }));

          for (const m of mentionsPage) {
            const v = m.vendorName;
            if (!v || v.toLowerCase() === currentVendorLower) continue;

            const key = v.toLowerCase();
            if (!counts[key])
              counts[key] = { total: 0, positive: 0, warning: 0 };
            if (!names[key]) names[key] = v;
            counts[key].total += 1;
            if (m.type === "positive") counts[key].positive += 1;
            else if (m.type === "warning") counts[key].warning += 1;

            allMentionsList.push(m);
          }

          if (!data.hasMore || mentionsPage.length < pageSize) break;
          page += 1;
          await new Promise((r) => setTimeout(r, 25));
        }

        if (!cancelled) {
          setCategoryVendorCounts(counts);
          setCategoryVendorNames(names);
          setCategoryMentions(allMentionsList);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to fetch category vendors:", err);
      } finally {
        if (!cancelled) setIsCategoryLoading(false);
      }
    };

    fetchCategoryData();
    return () => {
      cancelled = true;
    };
  }, [primaryCategory, vendorName, fetchVendorPulse]);

  // Load more mentions
  const loadMoreMentions = useCallback(async () => {
    if (!hasMore || isLoadingMore || !vendorName) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams();
      params.append("vendorName", vendorName);
      params.append("page", nextPage.toString());
      params.append("pageSize", "40");

      const response = await fetchVendorPulse(
        `${WAM_URL}/api/public/vendor-pulse/mentions?${params.toString()}`,
      );

      if (response.ok) {
        const data = await response.json();
        const transformedMentions = (data.mentions || []).map(
          (mention: any) => ({
            ...mention,
            vendorName: mention.vendor_name || mention.vendorName,
            conversationTime:
              mention.conversation_time || mention.conversationTime,
            vendorResponse: mention.vendorResponse || null,
          }),
        );

        setAllMentions((prev) => [...prev, ...transformedMentions]);
        setPage(nextPage);
        setHasMore(data.hasMore || false);
      }
    } catch (err) {
      console.error("Failed to load more mentions:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, vendorName, page, fetchVendorPulse]);

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
      { threshold: 0.1, rootMargin: "100px" },
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
    return getLogoUrl(
      profileData.vendorName,
      profileData.metadata?.website_url,
    );
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
            <p className="text-muted-foreground mb-4">
              {error || "The vendor you're looking for doesn't exist."}
            </p>
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
        <meta
          name="description"
          content={`Reviews and insights about ${profileData.vendorName} from CDG Pulse`}
        />
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
                {isAuthenticated &&
                  isVendorActive &&
                  vendorNames.length > 0 && (
                    <ManageVendorButton
                      vendorNames={vendorNames}
                      currentVendorName={profileData.vendorName}
                      onSelectVendor={(name) =>
                        navigate(`/vendors/${encodeURIComponent(name)}`)
                      }
                      getLogoUrl={(name) => getLogoUrl(name)}
                      showManagingLabel={vendorNames.some(
                        (name) =>
                          name.toLowerCase() ===
                          (profileData?.vendorName || "").toLowerCase(),
                      )}
                      className="hidden md:flex"
                    />
                  )}

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
                      try {
                        await navigator.share(shareData);
                      } catch {}
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
                      {isVendorOrganization ? (
                        <UserButton.Action
                          label="Manage Organization"
                          labelIcon={<Building2 className="h-4 w-4" />}
                          onClick={() => setManageOrgModalOpen(true)}
                        />
                      ) : (
                        <UserButton.Action
                          label="Subscription"
                          labelIcon={<CreditCard className="h-4 w-4" />}
                          open="subscription"
                        />
                      )}
                    </UserButton.MenuItems>
                    {!isVendorOrganization && (
                      <UserButton.UserProfilePage
                        label="Subscription"
                        labelIcon={<CreditCard className="h-4 w-4" />}
                        url="subscription"
                      >
                        <SubscriptionManagement />
                      </UserButton.UserProfilePage>
                    )}
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
                  <AvatarImage
                    src={logoUrl || undefined}
                    alt={profileData.vendorName}
                  />
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
                {profileData.stats.positiveCount} positive (
                {profileData.stats.positivePercent}%)
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                {profileData.stats.warningCount} warnings (
                {profileData.stats.warningPercent}%)
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
                fetchWithAuth={fetchVendorPulse}
                onUpgradeClick={() => {
                  if (isAuthenticated) {
                    setShowUpgradeModal(true);
                  } else {
                    window.open("https://cdgcircles.com/#pricing", "_blank");
                  }
                }}
              />
            </div>
          )}

          {/* Mentions Feed */}
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
              Recent Reviews
            </h2>
            {allMentions.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-border/50 p-6 sm:p-8 text-center">
                <p className="text-sm sm:text-base text-muted-foreground">
                  No reviews found for this vendor.
                </p>
              </div>
            ) : (
              <VendorReviewGrid
                entries={allMentions}
                isAuthenticated={isAuthenticated}
                isFullAccess={isProUserValue}
                responses={responses}
                isLocked={(entry) => entry.isLocked === true || !isProUserValue}
                showVendorNames={() => true}
                getVendorWebsite={() =>
                  profileData.metadata?.website_url || null
                }
                getVendorLogo={() => logoUrl}
                canRespondToVendor={(vendorName) =>
                  vendorName ? canRespondTo(vendorName) : false
                }
                onAddResponse={addResponse}
                onUpdateResponse={updateResponse}
                onDeleteResponse={deleteResponse}
                onCardClick={setSelectedCard}
                onVendorClick={(name) =>
                  navigate(`/vendors/${encodeURIComponent(name)}`)
                }
                onUpgradeClick={() => {
                  if (isAuthenticated) {
                    setShowUpgradeModal(true);
                  } else {
                    window.open("https://cdgcircles.com/#pricing", "_blank");
                  }
                }}
              />
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
                    window.open("https://cdgcircles.com/#pricing", "_blank");
                  }
                }}
                className="mt-6 w-full bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center hover:bg-yellow-100 transition-colors cursor-pointer"
              >
                <Crown className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm text-yellow-800 font-medium mb-1">
                  Upgrade to Pro to see all reviews
                </p>
                <p className="text-xs text-yellow-700">
                  Pro members get unlimited access to all vendor reviews and
                  insights
                </p>
              </button>
            )}
          </div>

          {/* More [category] vendors and reviews - limited preview */}
          {primaryCategory && primaryCategory !== "all" && (
            <section className="mt-10 sm:mt-12 pt-8 sm:pt-10 border-t border-border">
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl shrink-0">
                    {categories.find((c) => c.id === primaryCategory)?.icon ||
                      "📦"}
                  </span>
                  <Link
                    to={`/vendors?category=${encodeURIComponent(primaryCategory)}`}
                    title="View all"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
                  >
                    <h2 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      More{" "}
                      {categories.find((c) => c.id === primaryCategory)
                        ?.label || primaryCategory}{" "}
                      Vendors and Reviews
                    </h2>
                    <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  </Link>
                </div>
              </div>

              {isCategoryLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Vendor chips - limited preview */}
                  {(() => {
                    const categoryVendors = Object.entries(categoryVendorCounts)
                      .map(([key, c]) => ({
                        name: categoryVendorNames[key] ?? key,
                        ...c,
                      }))
                      .filter((v) => v.total > 0)
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 4);
                    if (categoryVendors.length === 0) return null;
                    return (
                      <div className="mb-6 sm:mb-8">
                        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                          {categoryVendors.map((vendor) => (
                            <button
                              key={vendor.name}
                              onClick={() =>
                                navigate(
                                  `/vendors/${encodeURIComponent(vendor.name)}`,
                                )
                              }
                              className="text-left p-3 sm:p-4 bg-white rounded-lg border border-border/50 hover:border-primary/50 hover:shadow-md transition-all group shrink-0 w-[280px] sm:w-[300px]"
                            >
                              <div className="flex items-start gap-2.5 sm:gap-3">
                                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border/50 shrink-0">
                                  <AvatarImage
                                    src={
                                      getOtherVendorLogoUrl(vendor.name) ||
                                      undefined
                                    }
                                    alt={vendor.name}
                                  />
                                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs sm:text-sm">
                                    {vendor.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 sm:gap-2">
                                    <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                      {vendor.name}
                                    </h3>
                                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 opacity-0 group-hover:opacity-100" />
                                  </div>
                                  <div className="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium">
                                      {vendor.total} review
                                      {vendor.total !== 1 ? "s" : ""}
                                    </span>
                                    {vendor.positive > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium text-xs">
                                        {vendor.positive} positive
                                      </span>
                                    )}
                                    {vendor.warning > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium text-xs">
                                        {vendor.warning} warning
                                        {vendor.warning !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Category reviews grid - limited preview */}
                  {categoryMentions.length > 0 && (
                    <>
                      <VendorReviewGrid
                        entries={categoryMentions.slice(0, 4)}
                        isAuthenticated={isAuthenticated}
                        isFullAccess={isProUserValue}
                        responses={responses}
                        isLocked={(entry) =>
                          entry.isLocked === true || !isProUserValue
                        }
                        showVendorNames={() => true}
                        getVendorWebsite={() => null}
                        getVendorLogo={(name) =>
                          name ? getOtherVendorLogoUrl(name) : null
                        }
                        canRespondToVendor={(name) =>
                          name ? canRespondTo(name) : false
                        }
                        onAddResponse={addResponse}
                        onUpdateResponse={updateResponse}
                        onDeleteResponse={deleteResponse}
                        onCardClick={setSelectedCard}
                        onVendorClick={(name) =>
                          navigate(`/vendors/${encodeURIComponent(name)}`)
                        }
                        onUpgradeClick={() => {
                          if (isAuthenticated) {
                            setShowUpgradeModal(true);
                          } else {
                            window.open(
                              "https://cdgcircles.com/#pricing",
                              "_blank",
                            );
                          }
                        }}
                      />
                      <Link
                        to={`/vendors?category=${encodeURIComponent(primaryCategory)}`}
                        className="mt-6 flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex py-2.5 px-4 rounded-lg border border-border bg-white hover:bg-muted/50 hover:border-primary/50 transition-colors text-sm font-medium text-foreground"
                      >
                        See all{" "}
                        {categories.find((c) => c.id === primaryCategory)
                          ?.label || primaryCategory}{" "}
                        vendors and reviews
                        <ArrowUpRight className="h-4 w-4 shrink-0" />
                      </Link>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard &&
        (() => {
          const apiResp = selectedCard.vendorResponse;
          const hookResponse = responses[String(selectedCard.id)] || null;
          const detailVendorResponse =
            hookResponse ||
            (apiResp
              ? {
                  id: "",
                  review_id: String(selectedCard.id),
                  vendor_profile_id: "",
                  response_text: apiResp.responseText,
                  created_at: apiResp.respondedAt,
                  updated_at: apiResp.respondedAt,
                }
              : null);
          return (
            <VendorCardDetail
              entry={selectedCard}
              isOpen={!!selectedCard}
              onClose={() => setSelectedCard(null)}
              onVendorSelect={(name) =>
                navigate(`/vendors/${encodeURIComponent(name)}`)
              }
              vendorLogo={logoUrl}
              vendorWebsite={profileData.metadata?.website_url || null}
              vendorResponse={detailVendorResponse}
              canRespondAsVendor={
                selectedCard.vendorName
                  ? canRespondTo(selectedCard.vendorName)
                  : false
              }
              onAddResponse={(text) =>
                addResponse(String(selectedCard.id), text)
              }
              onUpdateResponse={updateResponse}
              onDeleteResponse={deleteResponse}
            />
          );
        })()}

      {/* Upgrade Modal for authenticated users */}
      {isVendorOrganization && (
        <ManageOrgModal
          open={manageOrgModalOpen}
          onOpenChange={setManageOrgModalOpen}
        />
      )}
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
