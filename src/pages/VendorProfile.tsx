import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Globe, TrendingUp, TrendingDown, ThumbsUp, AlertTriangle, Loader2, Crown, Share2, CreditCard, MessageCircle, Linkedin, MapPin, CalendarCheck, MessagesSquare, ExternalLink, BotMessageSquare, Send, ArrowLeftIcon, Lock, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SignIn, UserButton, useClerk } from "@clerk/clerk-react";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import cdgPulseLogo from "@/assets/cdg-pulse-logo.png";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChatMarkdown } from "@/components/vendors/ChatMarkdown";
import { VendorCard, VendorCardDetail } from "@/components/vendors";
import { VendorEntry } from "@/hooks/useVendorReviews";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { fetchVendorProfile, fetchVendorPulseFeed, fetchVendorTrend, fetchVendorThemes, fetchComparedVendors, type VendorTrendResult, type VendorThemesResult, type ComparedVendor } from "@/hooks/useSupabaseVendorData";
import { isProUser } from "@/utils/tierUtils";
import { cn } from "@/lib/utils";
import { parseMarkdown } from "@/utils/markdown";
import { categories as vendorCategories } from "@/hooks/useVendorFilters";
import { useVendorOwnership } from "@/hooks/useVendorOwnership";
import { ClaimProfileModal } from "@/components/vendors/ClaimProfileModal";
import { RequestDemoModal } from "@/components/vendors/RequestDemoModal";
import { VendorIntelligenceCard } from "@/components/vendors/VendorIntelligenceCard";
import { DimensionalInsights } from "@/components/vendors/DimensionalInsights";
import { PricingIntelligence } from "@/components/vendors/PricingIntelligence";
import { SwitchingIntel } from "@/components/vendors/SwitchingIntel";
import { ProductScreenshots } from "@/components/vendors/ProductScreenshots";

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
    category?: string;
    linkedin_url?: string;
    banner_url?: string;
    tagline?: string;
    headquarters?: string;
  } | null;
  insight: any;
  mentions: VendorEntry[];
  productLines?: {
    id: string;
    name: string;
    slug: string;
    mentionCount: number;
  }[];
  selectedProductLine?: string | null;
}

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="mt-3.5 max-w-2xl">
      <p
        ref={ref}
        className={cn(
          "text-[15px] text-slate-500 leading-relaxed",
          !expanded && "line-clamp-3"
        )}
      >
        {text}
      </p>
      {clamped && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-[13px] font-medium text-primary hover:underline"
        >
          Show more
        </button>
      )}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-1 text-[13px] font-medium text-primary hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}

const VendorProfile = () => {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  
  const {
    isAuthenticated,
    user,
    role,
    tier,
    isAdmin,
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
  const [trend, setTrend] = useState<VendorTrendResult | null>(null);
  const [themes, setThemes] = useState<VendorThemesResult | null>(null);
  const [comparedVendors, setComparedVendors] = useState<ComparedVendor[]>([]);
  const [mentionFilter, setMentionFilter] = useState<"all" | "positive" | "warning">("all");
  const [selectedProductLine, setSelectedProductLine] = useState<string | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Inline vendor chat state
  const [ctaChatOpen, setCtaChatOpen] = useState(false);
  const [ctaChatMessages, setCtaChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [ctaChatInput, setCtaChatInput] = useState("");
  const [ctaChatLoading, setCtaChatLoading] = useState(false);
  const ctaChatEndRef = useRef<HTMLDivElement>(null);
  const ctaChatInputRef = useRef<HTMLTextAreaElement>(null);

  const vendorName = vendorSlug ? decodeURIComponent(vendorSlug) : "";
  const requestedProductLine = urlSearchParams.get("productLine");

  useEffect(() => {
    setSelectedProductLine(requestedProductLine || null);
  }, [vendorName, requestedProductLine]);

  const handleProductLineSelect = useCallback(
    (slug: string | null) => {
      setSelectedProductLine(slug);
      const nextParams = new URLSearchParams(urlSearchParams);
      if (slug) nextParams.set("productLine", slug);
      else nextParams.delete("productLine");
      setUrlSearchParams(nextParams, { replace: true });
    },
    [urlSearchParams, setUrlSearchParams]
  );

  const isProUserValue = useMemo(() => isProUser(tier), [tier]);

  const { data: ownershipData } = useVendorOwnership(vendorName || undefined);
  const isVendorOwner = !!ownershipData;

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
        const data = await fetchVendorProfile(vendorName, selectedProductLine);
        const aggregatedMentions: VendorEntry[] = [
          ...((data.mentions || []) as unknown as VendorEntry[]),
        ];
        const seenMentionIds = new Set(aggregatedMentions.map((m) => String(m.id)));

        // Always load the complete mention set so profiles can display all mentions,
        // even when the profile RPC returns an initial capped window.
        if ((data.stats?.totalMentions || 0) > aggregatedMentions.length) {
          let nextPage = 2;
          let hasMorePages = true;

          while (hasMorePages) {
            const nextBatch = await fetchVendorPulseFeed({
              vendorName,
              productLineSlug: selectedProductLine,
              page: nextPage,
              pageSize: 200,
            });

            for (const mention of nextBatch.mentions || []) {
              const mentionId = String(mention.id);
              if (seenMentionIds.has(mentionId)) continue;
              seenMentionIds.add(mentionId);
              aggregatedMentions.push(mention as unknown as VendorEntry);
            }

            hasMorePages = !!nextBatch.hasMore;
            nextPage += 1;
            if ((nextBatch.mentions || []).length === 0) break;
          }
        }

        setProfileData(data);
        setAllMentions(aggregatedMentions);
        setPage(1);
        setHasMore(false);
        setIsLoading(false);
      } catch (err) {
        console.error("[VendorProfile] Failed to fetch vendor profile:", err);
        setError(`Failed to load vendor profile: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [vendorName, selectedProductLine]);

  // Load more mentions
  const loadMoreMentions = useCallback(async () => {
    if (!hasMore || isLoadingMore || !vendorName) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchVendorPulseFeed({
        vendorName,
        productLineSlug: selectedProductLine,
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
  }, [hasMore, isLoadingMore, vendorName, selectedProductLine, page]);

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

  useEffect(() => {
    if (!vendorName) return;
    fetchVendorTrend(vendorName).then(setTrend).catch(() => {});
    fetchVendorThemes(vendorName).then(setThemes).catch(() => {});
    fetchComparedVendors(vendorName).then(setComparedVendors).catch(() => {});
  }, [vendorName]);

  const filteredMentions = useMemo(() => {
    if (mentionFilter === "all") return allMentions;
    return allMentions.filter((m) => m.type === mentionFilter);
  }, [allMentions, mentionFilter]);

  // Fallback insight built from stats for vendors with no vendor_insights DB row
  const fallbackInsight = useMemo(() => {
    if (!profileData) return null;
    const { positivePercent, warningPercent, totalMentions, positiveCount, warningCount } = profileData.stats;
    const name = profileData.vendorName;
    let headline: string;
    let sentiment: "positive" | "negative" | "neutral";
    if (positivePercent >= 75) {
      headline = `${name} enjoys strong positive sentiment — ${positivePercent}% favorable across ${totalMentions} community discussions.`;
      sentiment = "positive";
    } else if (warningPercent >= 40) {
      headline = `${name} receives mixed reception — ${warningPercent}% of ${totalMentions} discussions flag concerns worth noting.`;
      sentiment = "negative";
    } else {
      headline = `${name} has a balanced community profile with ${totalMentions} discussions and ${positivePercent}% positive sentiment.`;
      sentiment = "neutral";
    }
    return { headline, sentiment, stats: { total: totalMentions, positive: positiveCount, warnings: warningCount } };
  }, [profileData]);

  // Auto-scroll chat messages (must be before early returns)
  useEffect(() => {
    if (ctaChatMessages.length > 0) {
      ctaChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ctaChatMessages]);

  useEffect(() => {
    if (ctaChatOpen) {
      setTimeout(() => ctaChatInputRef.current?.focus(), 300);
    }
  }, [ctaChatOpen]);

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

  // ── Inline vendor chat helpers ──
  const VENDOR_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendor-ai-chat`;

  const sendCtaChatMessage = async (text: string) => {
    if (!text.trim() || ctaChatLoading) return;
    const userMsg = { role: "user" as const, content: text.trim() };
    setCtaChatMessages((prev) => [...prev, userMsg]);
    setCtaChatInput("");
    setCtaChatLoading(true);

    // Build a compact context from the profile
    const vendorContext = [{
      name: profileData.vendorName,
      category: profileData.metadata?.category || "",
      positiveCount: profileData.stats.positiveCount,
      warningCount: profileData.stats.warningCount,
      mentions: profileData.mentions.slice(0, 30).map((m) => ({
        title: m.title,
        type: m.type,
        quote: m.quote || m.explanation || "",
      })),
    }];

    let assistantContent = "";
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setCtaChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const allMessages = [...ctaChatMessages, userMsg];
      const res = await fetch(VENDOR_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, vendorData: vendorContext }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) updateAssistant(c);
          } catch { break; }
        }
      }
    } catch (err) {
      console.error("Vendor chat error:", err);
      setCtaChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setCtaChatLoading(false);
    }
  };

  const neutralCount = profileData.stats.totalMentions - profileData.stats.positiveCount - profileData.stats.warningCount;
  const neutralPercent = 100 - profileData.stats.positivePercent - profileData.stats.warningPercent;

  // NPS tier counts from loaded mentions
  const promoterCount = allMentions.filter((m) => m.npsTier === "promoter").length;
  const passiveCount = allMentions.filter((m) => m.npsTier === "passive").length;
  const detractorCount = allMentions.filter((m) => m.npsTier === "detractor").length;
  const npsTotal = promoterCount + passiveCount + detractorCount;
  const npsScore = npsTotal > 0 ? Math.round(((promoterCount - detractorCount) / npsTotal) * 100) : null;

  return (
    <>
      <Helmet>
        <title>{profileData.vendorName} - CDG Pulse</title>
        <meta name="description" content={`Dealer conversation excerpts and insights about ${profileData.vendorName} from CDG Pulse`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap" rel="stylesheet" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--vendor-bg))] overflow-x-hidden">
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
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
              <div className="hidden md:flex flex-1" />
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
                  <Button variant="outline" size="sm" onClick={() => setShowSignIn(true)}>
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
                    appearance={{ elements: { avatarBox: "h-8 w-8" } }}
                    afterSignOutUrl="/vendors"
                    signInUrl="/auth?redirect=/vendors"
                  >
                    <UserButton.MenuItems>
                      <UserButton.Action label="Subscription" labelIcon={<CreditCard className="h-4 w-4" />} open="subscription" />
                    </UserButton.MenuItems>
                    <UserButton.UserProfilePage label="Subscription" labelIcon={<CreditCard className="h-4 w-4" />} url="subscription">
                      <SubscriptionManagement />
                    </UserButton.UserProfilePage>
                  </UserButton>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">

          {/* ══════════════════════════════════════════
              HERO SECTION — LinkedIn-style layout
              ══════════════════════════════════════════ */}
          <section className="relative overflow-hidden rounded-2xl border border-border/50 mb-6 bg-white">
            {/* Banner */}
            <div className="relative h-48 sm:h-56 lg:h-64 w-full overflow-hidden">
              {profileData.metadata?.banner_url ? (
                <img
                  src={profileData.metadata.banner_url}
                  alt={`${profileData.vendorName} banner`}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(251,243,219,0.6) 0%, rgba(255,255,255,0.95) 40%, rgba(241,245,249,0.6) 100%)",
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }}
                >
                  <div className="absolute right-0 top-0 h-40 w-40 -translate-y-1/4 translate-x-1/4 rounded-full bg-amber-200/30 blur-3xl" />
                  <div className="absolute left-1/3 bottom-0 h-32 w-32 translate-y-1/3 rounded-full bg-blue-200/20 blur-3xl" />
                </div>
              )}
              {/* Gradient overlay for readability */}
              {profileData.metadata?.banner_url && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              )}
            </div>

            {/* Profile info area */}
            <div className="relative px-6 sm:px-8 lg:px-10 pb-5 sm:pb-6">
              {/* Logo overlapping the banner */}
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 -mt-10 sm:-mt-12 ring-4 ring-white shadow-lg bg-white flex-shrink-0">
                <AvatarImage src={logoUrl || undefined} alt={profileData.vendorName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-bold">
                  {profileData.vendorName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Company info + CTA card */}
              <div className="relative mt-2 lg:min-h-[320px]">
                {/* Left — company details */}
                <div className="lg:pr-[300px]">
                  <h1
                    className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold leading-[1.1] break-words tracking-tight text-slate-900"
                    style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                  >
                    {profileData.vendorName}
                  </h1>

                  {isAuthenticated && isVendorOwner && (
                    <Link to="/vendor-dashboard">
                      <Button variant="outline" size="sm" className="mt-2">
                        Manage Profile
                      </Button>
                    </Link>
                  )}
                  {isAuthenticated && !isVendorOwner && isAdmin && (
                    <Link to={`/vendor-dashboard?vendor=${encodeURIComponent(vendorName)}`}>
                      <Button variant="outline" size="sm" className="mt-2">
                        Manage Profile
                      </Button>
                    </Link>
                  )}

                  {profileData.metadata?.tagline && (
                    <p className="text-[15px] text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
                      {profileData.metadata.tagline}
                    </p>
                  )}

                  {/* Metadata pills */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {profileData.metadata?.headquarters && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 bg-slate-900/[0.04]">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {profileData.metadata.headquarters}
                      </span>
                    )}
                    {profileData.categories && profileData.categories.length > 0
                      ? profileData.categories.map((catId) => {
                          const catDef = vendorCategories.find(c => c.id === catId);
                          const label = catDef?.label || catId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <Link
                              key={catId}
                              to={`/vendors?category=${encodeURIComponent(catId)}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide bg-slate-900/[0.04] text-slate-600 hover:bg-slate-900/[0.08] transition-colors"
                            >
                              {catDef?.icon && <span>{catDef.icon}</span>}
                              {label}
                            </Link>
                          );
                        })
                      : profileData.metadata?.category && (() => {
                          const catDef = vendorCategories.find(c => c.id === profileData.metadata!.category);
                          const label = catDef?.label || profileData.metadata!.category!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <Link
                              to={`/vendors?category=${encodeURIComponent(profileData.metadata!.category!)}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide bg-slate-900/[0.04] text-slate-600 hover:bg-slate-900/[0.08] transition-colors"
                            >
                              {catDef?.icon && <span>{catDef.icon}</span>}
                              {label}
                            </Link>
                          );
                        })()}
                    {profileData.metadata?.website_url && (
                      <a
                        href={profileData.metadata.website_url.startsWith("http") ? profileData.metadata.website_url : `https://${profileData.metadata.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                      </a>
                    )}
                    {profileData.metadata?.linkedin_url && (
                      <a
                        href={profileData.metadata.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-[#0A66C2] hover:bg-[#0A66C2]/5 transition-colors"
                      >
                        <Linkedin className="h-3 w-3" />
                        LinkedIn
                      </a>
                    )}
                  </div>

                  {profileData.metadata?.description && (
                    <ExpandableDescription text={profileData.metadata.description} />
                  )}

                  <ProductScreenshots vendorName={vendorName} />

                  {isAuthenticated && (
                  <div className="flex items-center gap-1.5 mt-3.5 text-[11px] text-slate-400">
                    <MessageCircle className="h-3 w-3" />
                    <span>Based on {profileData.stats.totalMentions} community discussions</span>
                  </div>
                  )}

                  {/* ── CDG Intelligence (consolidated) ── */}
                  <VendorIntelligenceCard
                    vendorName={vendorName}
                    className="mt-6"
                    isAuthenticated={isAuthenticated}
                    onSignIn={() => setShowSignIn(true)}
                  />
                </div>

                {/* Right — Vendor CTA / Chat card */}
                <div className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  ctaChatOpen
                    ? "fixed inset-0 z-50 bg-white lg:static lg:inset-auto lg:z-auto lg:mt-0 lg:absolute lg:top-0 lg:right-0 lg:w-[280px] lg:h-[320px] lg:rounded-xl lg:border lg:border-border/60 lg:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    : "mt-4 lg:mt-0 lg:absolute lg:top-0 lg:right-0 w-full lg:w-[280px] lg:h-[320px] rounded-xl border border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-gradient-to-b from-slate-50/80 to-white"
                )}>
                  {/* Both modes rendered; slide transition */}
                  <div className="relative h-full w-full">

                  {/* ── CTA mode ── */}
                  <div
                    className={cn(
                      "p-5 flex flex-col h-full transition-transform duration-300 ease-in-out",
                      ctaChatOpen ? "-translate-x-full" : "translate-x-0"
                    )}
                  >
                      <p className="text-[13px] font-semibold text-slate-800 leading-snug">
                        Interested in {profileData.vendorName}?
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Connect directly or see what dealers are saying.
                      </p>

                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          onClick={() => setShowDemoModal(true)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" />
                          Request a Demo
                        </button>

                        {isAuthenticated && (
                        <button
                          onClick={() => {
                            setCtaChatOpen(true);
                            setCtaChatMessages([]);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
                        >
                          <BotMessageSquare className="h-3.5 w-3.5" />
                          Chat with Vendor AI
                        </button>
                        )}

                        {isAuthenticated && (
                        <button
                          onClick={() => {
                            const mentionsSection = document.getElementById("vendor-mentions");
                            mentionsSection?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                        >
                          <MessagesSquare className="h-3.5 w-3.5 text-slate-400" />
                          See Dealer Feedback
                        </button>
                        )}
                      </div>

                      {isAuthenticated && (
                      <div className="mt-3.5 pt-3 border-t border-black/[0.04]">
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Data sourced from <span className="font-medium text-slate-500">{profileData.stats.totalMentions}</span> real dealer conversations across CDG communities.
                        </p>
                      </div>
                      )}
                    </div>

                  {/* ── Chat mode ── */}
                  <div
                    className={cn(
                      "absolute inset-0 flex flex-col h-full transition-transform duration-300 ease-in-out",
                      ctaChatOpen ? "translate-x-0" : "translate-x-full"
                    )}
                  >
                      {/* Chat header */}
                      <div className="flex items-center gap-2 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:pt-2.5 border-b border-border/40 bg-slate-50/50">
                        <button
                          onClick={() => setCtaChatOpen(false)}
                          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-slate-200/60 transition-colors text-slate-500"
                        >
                          <ArrowLeftIcon className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <BotMessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="text-[12px] font-semibold text-slate-700 truncate">
                            Ask about {profileData.vendorName}
                          </span>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                        {ctaChatMessages.length === 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-[11px] text-slate-400 text-center">
                              Ask anything about {profileData.vendorName}
                            </p>
                            {[
                              `What do dealers think about ${profileData.vendorName}?`,
                              `Is ${profileData.vendorName} worth the investment?`,
                              `Common issues with ${profileData.vendorName}?`,
                            ].map((q, i) => (
                              <button
                                key={i}
                                onClick={() => sendCtaChatMessage(q)}
                                className="w-full text-left text-[11px] px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors leading-relaxed"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}

                        {ctaChatMessages.map((msg, i) => (
                          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[88%] rounded-xl px-3 py-2 text-[12px] leading-relaxed",
                              msg.role === "user"
                                ? "bg-primary text-white rounded-br-sm"
                                : "bg-slate-100 text-slate-700 rounded-bl-sm"
                            )}>
                              {msg.role === "assistant" ? (
                                <div className="prose prose-xs max-w-none [&_p]:mb-1.5 [&_p]:last:mb-0 [&_ul]:mb-1.5 [&_li]:mb-0.5">
                                  <ChatMarkdown content={msg.content} knownVendors={[profileData.vendorName]} />
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              )}
                            </div>
                          </div>
                        ))}

                        {ctaChatLoading && ctaChatMessages[ctaChatMessages.length - 1]?.role === "user" && (
                          <div className="flex justify-start">
                            <div className="bg-slate-100 rounded-xl rounded-bl-sm px-3 py-2.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                            </div>
                          </div>
                        )}

                        <div ref={ctaChatEndRef} />
                      </div>

                      {/* Input */}
                      <form
                        onSubmit={(e) => { e.preventDefault(); sendCtaChatMessage(ctaChatInput); }}
                        className="px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:pb-2.5 border-t border-border/40 bg-white"
                      >
                        <div className="flex items-end gap-1.5">
                          <Textarea
                            ref={ctaChatInputRef}
                            value={ctaChatInput}
                            onChange={(e) => setCtaChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendCtaChatMessage(ctaChatInput);
                              }
                            }}
                            placeholder={`Ask about ${profileData.vendorName}...`}
                            disabled={ctaChatLoading}
                            className="min-h-[38px] max-h-24 resize-none text-[12px] py-2"
                            rows={1}
                          />
                          <button
                            type="submit"
                            disabled={!ctaChatInput.trim() || ctaChatLoading}
                            className="h-[38px] w-[38px] flex-shrink-0 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </form>
                  </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* ══════════════════════════════════════════
              PAYWALL — shown only to non-authenticated users
              ══════════════════════════════════════════ */}
          {!isAuthenticated && (
            <div className="mb-6 rounded-2xl border border-border/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-8 sm:px-10 sm:py-10 flex flex-col items-center text-center">
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <h2
                className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mb-1"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                Sign in for full access
              </h2>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                Members get complete intel on every vendor — from sentiment data to competitive positioning.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-left mb-7 text-sm text-slate-600">
                {[
                  "Sentiment breakdown & mention trends",
                  "Dimensional insights (pricing, support, onboarding)",
                  "Competitive movement & switching data",
                  "Alternatives & competitors",
                  "What dealers appreciate",
                  "Common concerns & red flags",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowSignIn(true)}
                className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Sign In
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════
              STATS ROW
              ══════════════════════════════════════════ */}
          {isAuthenticated && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sentiment Breakdown */}
            <div className="sm:col-span-2 lg:col-span-2 bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">
                Sentiment Breakdown
              </h3>

              {/* Distribution bar */}
              <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100/80 mb-4">
                {profileData.stats.positivePercent > 0 && (
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 ease-out"
                    style={{ width: `${profileData.stats.positivePercent}%` }}
                  />
                )}
                {neutralPercent > 0 && (
                  <div
                    className="bg-gradient-to-r from-slate-200 to-slate-300 transition-all duration-1000 ease-out"
                    style={{ width: `${neutralPercent}%` }}
                  />
                )}
                {profileData.stats.warningPercent > 0 && (
                  <div
                    className="bg-gradient-to-r from-red-300 to-red-400 transition-all duration-1000 ease-out"
                    style={{ width: `${profileData.stats.warningPercent}%` }}
                  />
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500">Positive</span>
                  <span className="text-xs font-bold text-slate-800">{profileData.stats.positivePercent}%</span>
                  <span className="text-[10px] text-slate-400">({profileData.stats.positiveCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500">Neutral</span>
                  <span className="text-xs font-bold text-slate-800">{neutralPercent}%</span>
                  <span className="text-[10px] text-slate-400">({neutralCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-xs text-slate-500">Concerns</span>
                  <span className="text-xs font-bold text-slate-800">{profileData.stats.warningPercent}%</span>
                  <span className="text-[10px] text-slate-400">({profileData.stats.warningCount})</span>
                </div>
              </div>
            </div>

            {/* Dealer NPS */}
            {npsTotal > 0 && (
            <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Dealer NPS
                </h3>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-slate-300 hover:text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                      <p className="font-semibold mb-1">How Dealer NPS works</p>
                      <p className="text-muted-foreground mb-2">
                        Score = % Promoters - % Detractors. Ranges from -100 to +100.
                      </p>
                      <div className="space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span><strong className="text-foreground">Promoters</strong> — strong positive mentions (enthusiastic, recommending)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          <span><strong className="text-foreground">Passive</strong> — mild opinions, factual mentions, mixed feelings</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          <span><strong className="text-foreground">Detractors</strong> — strong negative mentions (complaints, warnings)</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t text-muted-foreground">
                        <span className="text-emerald-600 font-medium">+30 or above</span> = strong &middot;{" "}
                        <span className="text-amber-500 font-medium">0 to +29</span> = moderate &middot;{" "}
                        <span className="text-red-500 font-medium">below 0</span> = needs work
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span
                className={`text-5xl sm:text-6xl font-extrabold leading-none tabular-nums ${
                  npsScore !== null && npsScore >= 30 ? "text-emerald-600" : npsScore !== null && npsScore >= 0 ? "text-amber-500" : "text-red-500"
                }`}
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                {npsScore !== null ? (npsScore > 0 ? `+${npsScore}` : npsScore) : "—"}
              </span>
              <div className="mt-3">
                {/* NPS distribution bar */}
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100/80 mb-2">
                  {promoterCount > 0 && (
                    <div
                      className="bg-emerald-500 transition-all duration-700"
                      style={{ width: `${(promoterCount / npsTotal) * 100}%` }}
                    />
                  )}
                  {passiveCount > 0 && (
                    <div
                      className="bg-slate-300 transition-all duration-700"
                      style={{ width: `${(passiveCount / npsTotal) * 100}%` }}
                    />
                  )}
                  {detractorCount > 0 && (
                    <div
                      className="bg-red-400 transition-all duration-700"
                      style={{ width: `${(detractorCount / npsTotal) * 100}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span className="text-emerald-600">{promoterCount} promoters</span>
                  <span>{passiveCount} passive</span>
                  <span className="text-red-500">{detractorCount} detractors</span>
                </div>
              </div>
            </div>
            )}

            {/* Total Mentions */}
            <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-3">
                Total Mentions
              </h3>
              <span
                className="text-5xl sm:text-6xl font-extrabold text-slate-900 leading-none tabular-nums"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                {profileData.stats.totalMentions}
              </span>
              <div className="mt-3 flex items-center gap-1.5">
                {trend ? (
                  <>
                    {trend.direction === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                    {trend.direction === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                    {trend.direction === "stable" && <TrendingUp className="h-3.5 w-3.5 text-slate-400" />}
                    <span className="text-xs text-slate-500">
                      Sentiment{" "}
                      <span className={cn(
                        "font-bold",
                        trend.direction === "up" ? "text-emerald-600" :
                        trend.direction === "down" ? "text-red-500" : "text-slate-500"
                      )}>
                        {trend.direction === "up" ? "trending up" :
                         trend.direction === "down" ? "declining" : "stable"}
                      </span>
                      {trend.direction !== "stable" && (
                        <span className="text-slate-400 ml-1">
                          ({trend.direction === "up" ? "+" : ""}{trend.currentPositivePct - trend.previousPositivePct}pp)
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400">Not enough historical data for trend</span>
                )}
              </div>
            </div>
          </section>
          )}

          {/* ══════════════════════════════════════════
              DIMENSIONAL INSIGHTS & INTEL
              ══════════════════════════════════════════ */}
          {isAuthenticated && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <DimensionalInsights
              vendorName={profileData.vendorName}
              mentionCount={profileData.stats.totalMentions}
            />
            <SwitchingIntel
              vendorName={profileData.vendorName}
              mentionCount={profileData.stats.totalMentions}
            />
          </div>
          )}

          {/* ══════════════════════════════════════════
              FREQUENTLY COMPARED WITH
              ══════════════════════════════════════════ */}
          {isAuthenticated && comparedVendors.length >= 2 && (
            <section className="mb-6">
              <div>
              <h2
                className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mb-1"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                Alternatives & Competitors
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">
                Vendors dealers evaluate alongside {profileData.vendorName}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {comparedVendors.map((v) => {
                  const logoDevToken = import.meta.env.VITE_LOGO_DEV_TOKEN;
                  const domain = v.vendor_name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "") + ".com";
                  const peerLogo = logoDevToken
                    ? `https://img.logo.dev/${domain}?token=${logoDevToken}&size=64&format=png&fallback=monogram`
                    : null;
                  return (
                    <button
                      key={v.vendor_name}
                      onClick={() => navigate(`/vendors/${encodeURIComponent(v.vendor_name)}`)}
                      className="bg-white rounded-xl border border-border/50 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-border transition-all text-left group"
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <Avatar className="h-8 w-8 bg-white border border-border/30">
                          <AvatarImage src={peerLogo || undefined} alt={v.vendor_name} />
                          <AvatarFallback className="text-[10px] font-bold bg-slate-50 text-slate-500">
                            {v.vendor_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors truncate">
                          {v.vendor_name}
                        </span>
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 mb-2">
                        <div
                          className="bg-emerald-400 transition-all"
                          style={{ width: `${v.positive_percent}%` }}
                        />
                        <div
                          className="bg-red-300 transition-all"
                          style={{ width: `${100 - v.positive_percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{v.mention_count} mentions</span>
                        <span className="text-[10px] font-medium text-emerald-600">{v.positive_percent}% positive</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {profileData.categories && profileData.categories.length > 0 && (
                <div className="mt-4 text-center">
                  <Link
                    to={`/vendors?category=${encodeURIComponent(profileData.categories[0])}`}
                    className="text-sm text-primary hover:underline"
                  >
                    See all {profileData.categories[0]} vendors →
                  </Link>
                </div>
              )}
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════
              WHAT DEALERS APPRECIATE & COMMON CONCERNS
              ══════════════════════════════════════════ */}
          {isAuthenticated && (
          <section className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* What dealers appreciate */}
              <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">What Dealers Appreciate</h3>
                </div>
                <div className="relative">
                  {!isProUserValue && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
                      <Lock className="h-5 w-5 text-slate-400 mb-2" />
                      <p className="text-xs font-semibold text-slate-600 mb-1">Member-only insights</p>
                      <button
                        onClick={() => {
                          if (isAuthenticated) setShowUpgradeModal(true);
                          else setShowSignIn(true);
                        }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {isAuthenticated ? "Upgrade to unlock" : "Sign in to unlock"}
                      </button>
                    </div>
                  )}
                  <div className={!isProUserValue ? "blur-[6px] select-none pointer-events-none" : ""}>
                    {themes?.positiveThemes && themes.positiveThemes.length > 0 ? (
                      <ul className="space-y-3">
                        {themes.positiveThemes.map((t, i) => (
                          <li key={i}>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[13px] font-semibold text-slate-700 leading-snug">{parseMarkdown(t.label)}</span>
                                  <span className="flex-shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    {t.mention_count}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{parseMarkdown(t.summary)}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">No positive themes recorded yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Common concerns */}
              <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Common Concerns</h3>
                </div>
                <div className="relative">
                  {!isProUserValue && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
                      <Lock className="h-5 w-5 text-slate-400 mb-2" />
                      <p className="text-xs font-semibold text-slate-600 mb-1">Member-only insights</p>
                      <button
                        onClick={() => {
                          if (isAuthenticated) setShowUpgradeModal(true);
                          else setShowSignIn(true);
                        }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {isAuthenticated ? "Upgrade to unlock" : "Sign in to unlock"}
                      </button>
                    </div>
                  )}
                  <div className={!isProUserValue ? "blur-[6px] select-none pointer-events-none" : ""}>
                    {themes?.warningThemes && themes.warningThemes.length > 0 ? (
                      <ul className="space-y-3">
                        {themes.warningThemes.map((t, i) => (
                          <li key={i}>
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[13px] font-semibold text-slate-700 leading-snug">{parseMarkdown(t.label)}</span>
                                  <span className="flex-shrink-0 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                    {t.mention_count}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{parseMarkdown(t.summary)}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">No concerns recorded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}

          {/* ══════════════════════════════════════════
              COMMUNITY MENTIONS
              ══════════════════════════════════════════ */}
          <section id="vendor-mentions" className="mb-6">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2
                  className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900"
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                >
                  Community Mentions
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Real discussions from the community</p>
              </div>
              <span className="text-[11px] font-medium text-slate-400 hidden sm:block tabular-nums">
                {filteredMentions.length} shown
              </span>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-4">
              {(["all", "positive", "warning"] as const).map((filter) => {
                const count = filter === "all"
                  ? allMentions.length
                  : allMentions.filter((m) => m.type === filter).length;
                const label = filter === "all" ? "All" : filter === "positive" ? "Positive" : "Concerns";
                return (
                  <button
                    key={filter}
                    onClick={() => setMentionFilter(filter)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      mentionFilter === filter
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {label}
                    <span className={cn(
                      "ml-1.5 tabular-nums",
                      mentionFilter === filter ? "text-white/70" : "text-slate-400"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Product-line filters (vendor family aware) */}
            {!!profileData.productLines?.length && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => handleProductLineSelect(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    selectedProductLine === null
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  All Products
                </button>
                {profileData.productLines.map((line) => (
                  <button
                    key={line.id}
                    onClick={() => handleProductLineSelect(line.slug)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      selectedProductLine === line.slug
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {line.name}
                    <span className={cn(
                      "ml-1.5 tabular-nums",
                      selectedProductLine === line.slug ? "text-white/70" : "text-slate-400"
                    )}>
                      {line.mentionCount}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {filteredMentions.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-border/50 p-6 sm:p-8 text-center">
                <p className="text-sm text-slate-500">No mentions found for this vendor.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {filteredMentions.map((mention) => (
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
                        window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Infinite scroll trigger */}
            {isProUserValue && hasMore && (
              <div ref={loadMoreRef} className="mt-6 text-center">
                {isLoadingMore && (
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
                )}
              </div>
            )}

            {/* Upgrade CTA */}
            {!isProUserValue && allMentions.length > 0 && (
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    setShowUpgradeModal(true);
                  } else {
                    window.open(import.meta.env.VITE_STRIPE_CHECKOUT_URL, "_blank");
                  }
                }}
                className="mt-6 w-full bg-amber-50/80 border border-amber-200/60 rounded-2xl p-5 text-center hover:bg-amber-100/60 transition-colors cursor-pointer group"
              >
                <Crown className="h-5 w-5 text-amber-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm text-amber-800 font-semibold mb-1">
                  Upgrade to Pro to see all mentions
                </p>
                <p className="text-[11px] text-amber-600/70">
                  Pro members get unlimited access to all vendor mentions and insights
                </p>
              </button>
            )}
          </section>
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        targetTier="pro"
      />

      {/* Demo Request Modal */}
      <RequestDemoModal
        open={showDemoModal}
        onOpenChange={setShowDemoModal}
        vendorName={profileData.vendorName}
      />

      {/* Claim Profile Modal */}
      <ClaimProfileModal
        open={claimModalOpen}
        onOpenChange={setClaimModalOpen}
        vendorName={vendorName}
      />

      {/* Sign In Modal */}
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
