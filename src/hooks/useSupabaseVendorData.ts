import { supabase } from "@/integrations/supabase/client";

// Types matching existing VendorEntry interface
export interface VendorPulseMention {
  id: string;
  vendorName: string;
  rawVendorName?: string;
  title: string;
  quote: string;
  rawQuote?: string;
  displayMode?: "raw" | "rewritten_negative";
  qualityScore?: number | null;
  evidenceLevel?: "none" | "weak" | "moderate" | "strong" | null;
  isOpinionHeavy?: boolean | null;
  rewriteConfidence?: number | null;
  explanation: string;
  type: "positive" | "warning";
  category: string;
  conversationTime: string;
}

export interface VendorPulseFeedResult {
  mentions: VendorPulseMention[];
  totalCount: number;
  totalPositiveCount: number;
  totalWarningCount: number;
  totalSystemCount: number;
  categoryCounts: Record<string, number>;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface VendorTheme {
  label: string;
  summary: string;
  mention_count: number;
}

export interface VendorThemesResult {
  positiveThemes: VendorTheme[];
  warningThemes: VendorTheme[];
}

export interface ComparedVendor {
  vendor_name: string;
  mention_count: number;
  positive_percent: number;
  co_occurrence_count: number | null;
}

export interface VendorTrendResult {
  currentPositivePct: number;
  previousPositivePct: number;
  direction: "up" | "down" | "stable";
  mentionVolumeChangePct: number;
}

export interface VendorProfileResult {
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
  mentions: VendorPulseMention[];
  productLines?: VendorProductLine[];
  selectedProductLine?: string | null;
}

export interface VendorProductLine {
  id: string;
  name: string;
  slug: string;
  mentionCount: number;
}

/**
 * Fetch vendor pulse feed (replaces WAM /api/public/vendor-pulse/mentions)
 */
export async function fetchVendorPulseFeed(params: {
  category?: string | null;
  vendorName?: string | null;
  type?: string | null;
  search?: string | null;
  productLineSlug?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<VendorPulseFeedResult> {
  const pageSize = params.pageSize || 40;
  const page = params.page || 1;
  const offset = (page - 1) * pageSize;

  // Prefer v2 family-aware RPC, but gracefully fall back to legacy RPC.
  let data: any = null;
  {
    const v3 = await supabase.rpc("get_vendor_pulse_feed_v3" as never, {
      p_category: params.category || null,
      p_vendor_name: params.vendorName || null,
      p_type: params.type || null,
      p_search: params.search || null,
      p_product_line_slug: params.productLineSlug || null,
      p_limit: pageSize,
      p_offset: offset,
    } as never);

    if (!v3.error) {
      data = v3.data;
    } else {
      const v2 = await supabase.rpc("get_vendor_pulse_feed_v2" as never, {
        p_category: params.category || null,
        p_vendor_name: params.vendorName || null,
        p_type: params.type || null,
        p_search: params.search || null,
        p_product_line_slug: params.productLineSlug || null,
        p_limit: pageSize,
        p_offset: offset,
      } as never);

      if (!v2.error) {
        data = v2.data;
      } else {
        const legacy = await supabase.rpc("get_vendor_pulse_feed" as never, {
          p_category: params.category || null,
          p_vendor_name: params.vendorName || null,
          p_type: params.type || null,
          p_search: params.search || null,
          p_limit: pageSize,
          p_offset: offset,
        } as never);

        if (legacy.error) {
          console.error("[Supabase] get_vendor_pulse_feed_v3/v2 + legacy fallback error:", legacy.error);
          throw legacy.error;
        }
        data = legacy.data;
      }
    }
  }

  const result = data as any;
  return {
    mentions: (result.mentions || []).map((m: any) => ({
      id: m.id,
      vendorName: m.vendorName,
      rawVendorName: m.rawVendorName || m.raw_vendor_name,
      title: m.title,
      quote: m.quote,
      rawQuote: m.rawQuote || m.raw_quote,
      displayMode: m.displayMode || m.display_mode,
      qualityScore: m.qualityScore ?? m.quality_score ?? null,
      evidenceLevel: m.evidenceLevel || m.evidence_level || null,
      isOpinionHeavy: m.isOpinionHeavy ?? m.is_opinion_heavy ?? null,
      rewriteConfidence: m.rewriteConfidence ?? m.rewrite_confidence ?? null,
      explanation: m.explanation,
      type: m.type,
      category: m.category,
      conversationTime: m.conversationTime,
    })),
    totalCount: result.totalCount || 0,
    totalPositiveCount: result.totalPositiveCount || 0,
    totalWarningCount: result.totalWarningCount || 0,
    totalSystemCount: result.totalSystemCount || 0,
    categoryCounts: result.categoryCounts || {},
    page: result.page || 1,
    pageSize: result.pageSize || pageSize,
    hasMore: result.hasMore || false,
  };
}

/**
 * Fetch trending vendors (replaces WAM /api/public/vendor-pulse/trending)
 */
export async function fetchTrendingVendors(
  count: number = 8
): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_trending_vendors", {
    p_count: count,
  });

  if (error) {
    console.error("[Supabase] get_trending_vendors error:", error);
    throw error;
  }

  return (data as any)?.trending || [];
}

/**
 * Fetch all vendor names for search autocomplete (replaces WAM /api/public/vendor-pulse/vendors-list)
 */
export async function fetchVendorsList(): Promise<
  { name: string; count: number }[]
> {
  const v2 = await supabase.rpc("get_vendor_pulse_vendors_list_v2" as never);
  if (!v2.error) {
    return (v2.data as any)?.vendors || [];
  }

  const legacy = await supabase.rpc("get_vendor_pulse_vendors_list" as never);
  if (legacy.error) {
    console.error("[Supabase] get_vendor_pulse_vendors_list_v2 + legacy fallback error:", legacy.error);
    throw legacy.error;
  }

  return (legacy.data as any)?.vendors || [];
}

/**
 * Fetch vendor profile (replaces WAM /api/public/vendor-pulse/vendors/:name/profile)
 */
export async function fetchVendorProfile(
  vendorName: string,
  productLineSlug?: string | null
): Promise<VendorProfileResult> {
  const profileSelect =
    "vendor_name, company_website, company_logo_url, company_description, linkedin_url, banner_url, tagline, headquarters";

  const pickBestProfileRow = (
    rows: Array<Record<string, any>> | null
  ): Record<string, any> | null => {
    if (!rows || rows.length === 0) return null;

    const score = (row: Record<string, any>) => {
      // Prefer richer approved profiles when duplicate vendor_name variants exist
      // (e.g. BKD.ai vs bkd.ai).
      const fields = [
        row.company_website,
        row.company_logo_url,
        row.company_description,
        row.linkedin_url,
        row.banner_url,
        row.tagline,
        row.headquarters,
      ];
      return fields.reduce(
        (acc, value) => acc + (value && String(value).trim() ? 1 : 0),
        0
      );
    };

    return [...rows].sort((a, b) => score(b) - score(a))[0] ?? null;
  };

  // Run RPC and vendor_profiles query in parallel.
  // The RPC may not return newer columns (banner_url, tagline, etc.),
  // so we supplement with a direct read from vendor_profiles (public for approved vendors).
  const [rpcResult, vpResult] = await Promise.all([
    supabase.rpc("get_vendor_profile_v3" as never, {
      p_vendor_name: vendorName,
      p_product_line_slug: productLineSlug || null,
    } as never),
    supabase
      .from("vendor_profiles" as never)
      .select(profileSelect as never)
      .ilike("vendor_name" as never, vendorName)
      .eq("is_approved" as never, true)
      .limit(10),
  ]);

  let result: any = null;
  if (!rpcResult.error) {
    result = rpcResult.data as any;
  } else {
    const v2 = await supabase.rpc("get_vendor_profile_v2" as never, {
      p_vendor_name: vendorName,
      p_product_line_slug: productLineSlug || null,
    } as never);

    if (!v2.error) {
      result = v2.data as any;
    } else {
      const legacy = await supabase.rpc("get_vendor_profile" as never, { p_vendor_name: vendorName } as never);
      if (legacy.error) {
        console.error("[Supabase] get_vendor_profile_v3/v2 + legacy fallback error:", legacy.error);
        throw legacy.error;
      }
      result = legacy.data as any;
    }
  }
  const vpRows = (vpResult.data as Array<Record<string, any>> | null) ?? null;
  const vp = pickBestProfileRow(vpRows);

  // Merge: RPC metadata first, then fill gaps from vendor_profiles
  const rpcMeta = result.metadata || {};
  // vendor_profiles is the source of truth for editable fields (tagline, description, etc.)
  // so prefer vp.* over rpcMeta.* for those fields.
  const mergedMetadata = vp
    ? {
        website_url: vp.company_website || rpcMeta.website_url || null,
        logo_url: vp.company_logo_url || rpcMeta.logo_url || null,
        description: vp.company_description || rpcMeta.description || null,
        category: rpcMeta.category || null,
        linkedin_url: vp.linkedin_url || rpcMeta.linkedin_url || null,
        banner_url: vp.banner_url || rpcMeta.banner_url || null,
        tagline: vp.tagline || rpcMeta.tagline || null,
        headquarters: vp.headquarters || rpcMeta.headquarters || null,
      }
    : rpcMeta;

  return {
    vendorName: result.vendorName,
    stats: result.stats || {
      totalMentions: 0,
      positiveCount: 0,
      warningCount: 0,
      positivePercent: 0,
      warningPercent: 0,
    },
    categories: result.categories || [],
    metadata: mergedMetadata,
    insight: result.insight || null,
    mentions: (result.mentions || []).map((m: any) => ({
      id: m.id,
      vendorName: m.vendorName || m.vendor_name,
      rawVendorName: m.rawVendorName || m.raw_vendor_name,
      title: m.title,
      quote: m.quote,
      rawQuote: m.rawQuote || m.raw_quote,
      displayMode: m.displayMode || m.display_mode,
      qualityScore: m.qualityScore ?? m.quality_score ?? null,
      evidenceLevel: m.evidenceLevel || m.evidence_level || null,
      isOpinionHeavy: m.isOpinionHeavy ?? m.is_opinion_heavy ?? null,
      rewriteConfidence: m.rewriteConfidence ?? m.rewrite_confidence ?? null,
      explanation: m.explanation,
      type: m.type,
      category: m.category,
      conversationTime: m.conversationTime || m.conversation_time,
    })),
    productLines: (result.productLines || []).map((pl: any) => ({
      id: pl.id,
      name: pl.name,
      slug: pl.slug,
      mentionCount: pl.mentionCount ?? pl.mention_count ?? 0,
    })),
    selectedProductLine: result.selectedProductLine || null,
  };
}

/**
 * Fetch vendor AI insight from cached insights table
 * (replaces WAM /api/public/vendor-pulse/insights)
 */
export async function fetchVendorInsight(params: {
  vendorName?: string | null;
  category?: string | null;
}): Promise<any | null> {
  if (!params.vendorName && !params.category) return null;

  const slug = (params.vendorName || params.category || "").replace(/ /g, "_");
  const prefix = params.vendorName ? "weekly_vendor_" : "weekly_category_";

  // Keys may or may not have a _v2 suffix — try both, prefer the newest
  const { data, error } = await supabase
    .from("vendor_pulse_insights")
    .select("insight_json, expires_at")
    .or(`insight_key.eq.${prefix}${slug}_v2,insight_key.eq.${prefix}${slug}`)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data.insight_json;
}

/**
 * Fetch vendor theme clusters (positive and warning)
 */
export async function fetchVendorThemes(
  vendorName: string
): Promise<VendorThemesResult> {
  const { data, error } = await supabase.rpc("get_vendor_themes", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_vendor_themes error:", error);
    throw error;
  }

  const result = data as any;
  return {
    positiveThemes: result?.positiveThemes || [],
    warningThemes: result?.warningThemes || [],
  };
}

/**
 * Fetch vendors frequently compared alongside this vendor
 */
export async function fetchComparedVendors(
  vendorName: string
): Promise<ComparedVendor[]> {
  const { data, error } = await supabase.rpc("get_compared_vendors", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_compared_vendors error:", error);
    throw error;
  }

  return (data as any)?.vendors || [];
}

/**
 * Fetch vendor sentiment trend (last 30 days vs previous 30 days)
 */
export async function fetchVendorTrend(
  vendorName: string
): Promise<VendorTrendResult | null> {
  const { data, error } = await supabase.rpc("get_vendor_trend", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_vendor_trend error:", error);
    throw error;
  }

  return data as any;
}

export interface VendorDimension {
  dimension: string;
  mention_count: number;
  positive_count: number;
  negative_count: number;
  mixed_count: number;
  neutral_count: number;
  positive_percent: number;
}

/**
 * Fetch dimension-level sentiment breakdown for a vendor
 */
export async function fetchVendorDimensions(
  vendorName: string
): Promise<VendorDimension[]> {
  const { data, error } = await supabase.rpc("get_vendor_dimensions", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_vendor_dimensions error:", error);
    return [];
  }

  return (data || []) as VendorDimension[];
}

/**
 * Fetch AI-generated pulse summary for a vendor
 */
export async function fetchVendorPulseSummary(
  vendorName: string
): Promise<{ summary_text: string; category_context: string | null } | null> {
  const { data, error } = await supabase
    .from("vendor_pulse_summaries")
    .select("summary_text, category_context")
    .eq("vendor_name", vendorName)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchVendorPulseSummary error:", error);
    return null;
  }
  return data;
}

// ── Vendor Intelligence (replaces PulseSummary + AIInsightBanner on profile) ──

export interface VendorIntelligenceData {
  vendor_name: string;
  state: "rich" | "thin" | "empty";
  summary_text: string | null;
  sentiment: string | null;
  trend_direction: string | null;
  top_dimension: string | null;
  stats: {
    total: number;
    positive: number;
    warnings: number;
    external_count: number;
  } | null;
}

export async function fetchVendorIntelligence(
  vendorName: string
): Promise<VendorIntelligenceData | null> {
  const { data, error } = await supabase
    .from("vendor_intelligence_cache")
    .select("*")
    .eq("vendor_name", vendorName)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchVendorIntelligence error:", error);
    return null;
  }
  return data as VendorIntelligenceData | null;
}

export interface VendorBootstrapMetadata {
  auto_summary: string | null;
  auto_products: string[] | null;
  auto_segments: string[] | null;
  auto_integrations: string[] | null;
}

export async function fetchVendorBootstrapMetadata(
  vendorName: string
): Promise<VendorBootstrapMetadata | null> {
  const { data, error } = await supabase
    .from("vendor_metadata")
    .select("auto_summary, auto_products, auto_segments, auto_integrations")
    .eq("vendor_name", vendorName)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchVendorBootstrapMetadata error:", error);
    return null;
  }
  return data as VendorBootstrapMetadata | null;
}

export interface VendorCustomContent {
  highlights: string[] | null;
  customer_segments: string[] | null;
  integration_partners: string[] | null;
  custom_description: string | null;
}

export async function fetchVendorCustomContent(
  vendorName: string
): Promise<VendorCustomContent | null> {
  const { data, error } = await supabase
    .from("vendor_custom_content")
    .select("highlights, customer_segments, integration_partners, custom_description")
    .eq("vendor_name", vendorName)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchVendorCustomContent error:", error);
    return null;
  }
  return data as VendorCustomContent | null;
}
