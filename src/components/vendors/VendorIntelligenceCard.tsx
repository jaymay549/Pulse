import { useQuery } from "@tanstack/react-query";
import { Sparkles, TrendingUp, TrendingDown, Loader2, Package, Users, Network } from "lucide-react";
import {
  fetchVendorIntelligence,
  fetchVendorBootstrapMetadata,
  fetchVendorCustomContent,
} from "@/hooks/useSupabaseVendorData";
import { cn } from "@/lib/utils";

interface VendorIntelligenceCardProps {
  vendorName: string;
  className?: string;
}

export function VendorIntelligenceCard({
  vendorName,
  className,
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
      <div className={cn("rounded-2xl border border-border/50 bg-white p-6", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
          <div className="h-3 bg-slate-100 rounded animate-pulse w-4/5" />
        </div>
      </div>
    );
  }

  const state = intelligence?.state || "empty";
  const stats = intelligence?.stats || { total: 0, positive: 0, warnings: 0, external_count: 0 };

  // ── STATE 1: RICH (5+ mentions) ──────────────────────────

  if (state === "rich" && intelligence) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            CDG Intelligence
          </h3>
        </div>

        <p className="text-[15px] leading-relaxed text-zinc-100 mb-4">
          {intelligence.sentiment === "positive" && (
            <TrendingUp className="inline h-4 w-4 text-emerald-400 mr-2 mb-0.5" />
          )}
          {intelligence.sentiment === "negative" && (
            <TrendingDown className="inline h-4 w-4 text-red-400 mr-2 mb-0.5" />
          )}
          {intelligence.summary_text}
        </p>

        <div className="flex items-center gap-4 text-[11px] font-semibold tracking-wide">
          <span className="text-zinc-400">
            <span className="text-zinc-200">{stats.total}</span> Total
          </span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            {stats.positive} Positive
          </span>
          <span className="text-red-400 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-red-400" />
            {stats.warnings} Concerns
          </span>
          {intelligence.top_dimension && (
            <span className="text-zinc-500">
              Top:{" "}
              <span className="text-zinc-300 capitalize">
                {intelligence.top_dimension.replace(/_/g, " ")}
              </span>
            </span>
          )}
        </div>

        <p className="mt-4 text-[9px] text-zinc-600">AI can make mistakes</p>
      </div>
    );
  }

  // ── STATE 2: THIN (1-4 mentions) ─────────────────────────

  if (state === "thin" && intelligence) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/50 bg-white p-5 sm:p-6",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Early Feedback
          </h3>
        </div>

        <p className="text-[14px] leading-relaxed text-slate-700 mb-3">
          {intelligence.summary_text}
        </p>

        <p className="text-xs text-slate-400">
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
      <div className={cn("rounded-2xl border border-border/50 bg-white p-5 sm:p-6 text-center", className)}>
        <p className="text-sm text-slate-400">
          Community insights will appear as dealer feedback grows.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border/50 bg-white p-5 sm:p-6", className)}>
      {/* About */}
      <div className="mb-5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3">
          About
        </h3>
        <p className="text-[14px] leading-relaxed text-slate-700">
          {customDescription ||
            intelligence?.summary_text ||
            autoSummary ||
            `${vendorName} is a vendor in the automotive dealership technology space.`}
        </p>
        {customDescription && (
          <p className="text-[11px] text-slate-400 mt-1">From the vendor</p>
        )}
      </div>

      {/* Products / Highlights */}
      {(highlights.length > 0 || autoProducts.length > 0) && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-slate-400" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {highlights.length > 0 ? "Product Highlights" : "Products"}
            </h4>
          </div>
          <ul className="space-y-1">
            {(highlights.length > 0 ? highlights : autoProducts).map((item, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">&bull;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer Segments */}
      {(customerSegments.length > 0 || autoSegments.length > 0) && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-slate-400" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Customer Segments
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {(customerSegments.length > 0 ? customerSegments : autoSegments).map(
              (segment, i) => (
                <span
                  key={i}
                  className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
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
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-4 w-4 text-slate-400" />
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Integrations
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {(integrationPartners.length > 0
              ? integrationPartners
              : autoIntegrations
            ).map((partner, i) => (
              <span
                key={i}
                className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
              >
                {partner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-slate-400 pt-3 border-t border-slate-100">
        Community insights will appear as dealer feedback grows
      </p>
    </div>
  );
}
