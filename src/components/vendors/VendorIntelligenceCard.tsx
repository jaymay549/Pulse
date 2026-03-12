import { useQuery } from "@tanstack/react-query";
import { Sparkles, TrendingUp, TrendingDown, Loader2, Package, Users, Network, Lock } from "lucide-react";
import {
  fetchVendorIntelligence,
  fetchVendorBootstrapMetadata,
  fetchVendorCustomContent,
} from "@/hooks/useSupabaseVendorData";
import { cn } from "@/lib/utils";

interface VendorIntelligenceCardProps {
  vendorName: string;
  className?: string;
  isAuthenticated?: boolean;
  onSignIn?: () => void;
}

export function VendorIntelligenceCard({
  vendorName,
  className,
  isAuthenticated = false,
  onSignIn,
}: VendorIntelligenceCardProps) {
  const { data: intelligence, isLoading: intelLoading } = useQuery({
    queryKey: ["vendor-intelligence", vendorName],
    queryFn: () => fetchVendorIntelligence(vendorName),
    enabled: !!vendorName,
    staleTime: 5 * 60 * 1000,
  });

  const { data: metadata } = useQuery({
    queryKey: ["vendor-bootstrap-metadata", vendorName],
    queryFn: () => fetchVendorBootstrapMetadata(vendorName),
    enabled: !!vendorName && (!intelligence || intelligence.state === "empty"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: customContent } = useQuery({
    queryKey: ["vendor-custom-content", vendorName],
    queryFn: () => fetchVendorCustomContent(vendorName),
    enabled: !!vendorName,
    staleTime: 10 * 60 * 1000,
  });

  // Loading
  if (intelLoading) {
    return (
      <div className={cn("rounded-xl border border-border/50 bg-white p-4", className)}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const state = intelligence?.state || "empty";
  const stats = intelligence?.stats || { total: 0, positive: 0, warnings: 0, external_count: 0 };

  // ── STATE 1: RICH (5+ mentions) ──────────────────────────

  if (state === "rich" && intelligence) {
    if (!isAuthenticated) {
      return (
        <div
          className={cn(
            "relative rounded-xl border border-border/50 bg-gradient-to-b from-slate-50/80 to-white p-4 overflow-hidden",
            className
          )}
        >
          {/* Blurred preview */}
          <div className="blur-[6px] select-none pointer-events-none">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                CDG Intelligence
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 mb-2.5">
              {intelligence.summary_text}
            </p>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold tracking-wide">
              <span className="text-slate-400">
                <span className="text-slate-600">{stats.total}</span> mentions
              </span>
              <span className="text-emerald-600 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                {stats.positive} positive
              </span>
              <span className="text-red-400 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-red-400" />
                {stats.warnings} concerns
              </span>
            </div>
          </div>
          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
            <Lock className="h-4 w-4 text-slate-400 mb-1.5" />
            <p className="text-[11px] font-semibold text-slate-600 mb-1">Member-only intelligence</p>
            <button
              onClick={onSignIn}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Sign in to unlock
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-gradient-to-b from-slate-50/80 to-white p-4",
          className
        )}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            CDG Intelligence
          </h3>
        </div>

        <p className="text-[13px] leading-relaxed text-slate-600 mb-2.5">
          {intelligence.sentiment === "positive" && (
            <TrendingUp className="inline h-3.5 w-3.5 text-emerald-500 mr-1.5 mb-0.5" />
          )}
          {intelligence.sentiment === "negative" && (
            <TrendingDown className="inline h-3.5 w-3.5 text-red-400 mr-1.5 mb-0.5" />
          )}
          {intelligence.summary_text}
        </p>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold tracking-wide">
          <span className="text-slate-400">
            <span className="text-slate-600">{stats.total}</span> mentions
          </span>
          <span className="text-emerald-600 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            {stats.positive} positive
          </span>
          <span className="text-red-400 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-red-400" />
            {stats.warnings} concerns
          </span>
          {intelligence.top_dimension && (
            <span className="text-slate-400">
              Top: <span className="text-slate-500 capitalize">{intelligence.top_dimension.replace(/_/g, " ")}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── STATE 2: THIN (1-4 mentions) ─────────────────────────

  if (state === "thin" && intelligence) {
    if (!isAuthenticated) {
      return (
        <div
          className={cn(
            "relative rounded-xl border border-border/50 bg-white p-4 overflow-hidden",
            className
          )}
        >
          <div className="blur-[6px] select-none pointer-events-none">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Early Feedback
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 mb-1.5">
              {intelligence.summary_text}
            </p>
            <p className="text-[10px] text-slate-400">
              Based on {stats.total} early mention{stats.total !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
            <Lock className="h-4 w-4 text-slate-400 mb-1.5" />
            <p className="text-[11px] font-semibold text-slate-600 mb-1">Member-only intelligence</p>
            <button
              onClick={onSignIn}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Sign in to unlock
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-white p-4",
          className
        )}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Early Feedback
          </h3>
        </div>

        <p className="text-[13px] leading-relaxed text-slate-600 mb-1.5">
          {intelligence.summary_text}
        </p>

        <p className="text-[10px] text-slate-400">
          Based on {stats.total} early mention{stats.total !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  // ── STATE 3: EMPTY (0 mentions) ──────────────────────────

  const autoSummary = metadata?.auto_summary;
  const autoProducts = metadata?.auto_products || [];
  const autoSegments = metadata?.auto_segments || [];
  const autoIntegrations = metadata?.auto_integrations || [];

  const highlights = customContent?.highlights || [];
  const customerSegments = customContent?.customer_segments || [];
  const integrationPartners = customContent?.integration_partners || [];
  const customDescription = customContent?.custom_description;

  // If absolutely nothing to show, render minimal placeholder
  const hasAnyContent =
    customDescription ||
    autoSummary ||
    intelligence?.summary_text ||
    highlights.length > 0 ||
    autoProducts.length > 0 ||
    customerSegments.length > 0 ||
    autoSegments.length > 0;

  if (!hasAnyContent) {
    return (
      <div className={cn("rounded-xl border border-border/50 bg-white p-4 text-center", className)}>
        <p className="text-[12px] text-slate-400">
          Community insights will appear as dealer feedback grows.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border/50 bg-white p-4", className)}>
      {/* About */}
      <div className="mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
          About
        </h3>
        <p className="text-[13px] leading-relaxed text-slate-600">
          {customDescription ||
            intelligence?.summary_text ||
            autoSummary ||
            `${vendorName} is a vendor in the automotive dealership technology space.`}
        </p>
        {customDescription && (
          <p className="text-[10px] text-slate-400 mt-0.5">From the vendor</p>
        )}
      </div>

      {/* Products / Highlights */}
      {(highlights.length > 0 || autoProducts.length > 0) && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="h-3.5 w-3.5 text-slate-400" />
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {highlights.length > 0 ? "Product Highlights" : "Products"}
            </h4>
          </div>
          <ul className="space-y-0.5">
            {(highlights.length > 0 ? highlights : autoProducts).map((item, i) => (
              <li key={i} className="text-[12px] text-slate-600 flex items-start gap-1.5">
                <span className="text-slate-300 mt-0.5">&bull;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer Segments */}
      {(customerSegments.length > 0 || autoSegments.length > 0) && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Customer Segments
            </h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(customerSegments.length > 0 ? customerSegments : autoSegments).map(
              (segment, i) => (
                <span
                  key={i}
                  className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {segment}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Integrations */}
      {(integrationPartners.length > 0 || autoIntegrations.length > 0) && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Network className="h-3.5 w-3.5 text-slate-400" />
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Integrations
            </h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(integrationPartners.length > 0
              ? integrationPartners
              : autoIntegrations
            ).map((partner, i) => (
              <span
                key={i}
                className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {partner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
        Community insights will appear as dealer feedback grows
      </p>
    </div>
  );
}
