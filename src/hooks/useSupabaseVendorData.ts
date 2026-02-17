import { supabase } from "@/integrations/supabase/client";

// Types matching existing VendorEntry interface
export interface VendorPulseMention {
  id: string;
  vendorName: string;
  title: string;
  quote: string;
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
  theme: string;
  mention_count: number;
  percentage: number;
  sample_quote: string;
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
}

/**
 * Fetch vendor pulse feed (replaces WAM /api/public/vendor-pulse/mentions)
 */
export async function fetchVendorPulseFeed(params: {
  category?: string | null;
  vendorName?: string | null;
  type?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<VendorPulseFeedResult> {
  const pageSize = params.pageSize || 40;
  const page = params.page || 1;
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc("get_vendor_pulse_feed", {
    p_category: params.category || null,
    p_vendor_name: params.vendorName || null,
    p_type: params.type || null,
    p_search: params.search || null,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    console.error("[Supabase] get_vendor_pulse_feed error:", error);
    throw error;
  }

  const result = data as any;
  return {
    mentions: (result.mentions || []).map((m: any) => ({
      id: m.id,
      vendorName: m.vendorName,
      title: m.title,
      quote: m.quote,
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
  const { data, error } = await supabase.rpc(
    "get_vendor_pulse_vendors_list"
  );

  if (error) {
    console.error("[Supabase] get_vendor_pulse_vendors_list error:", error);
    throw error;
  }

  return (data as any)?.vendors || [];
}

/**
 * Fetch vendor profile (replaces WAM /api/public/vendor-pulse/vendors/:name/profile)
 */
export async function fetchVendorProfile(
  vendorName: string
): Promise<VendorProfileResult> {
  const { data, error } = await supabase.rpc("get_vendor_profile", {
    p_vendor_name: vendorName,
  });

  if (error) {
    console.error("[Supabase] get_vendor_profile error:", error);
    throw error;
  }

  const result = data as any;
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
    metadata: result.metadata || null,
    insight: result.insight || null,
    mentions: (result.mentions || []).map((m: any) => ({
      id: m.id,
      vendorName: m.vendorName || m.vendor_name,
      title: m.title,
      quote: m.quote,
      explanation: m.explanation,
      type: m.type,
      category: m.category,
      conversationTime: m.conversationTime || m.conversation_time,
    })),
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
    .from("vendor_insights")
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
