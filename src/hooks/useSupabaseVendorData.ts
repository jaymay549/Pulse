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
  let insightKey: string;
  if (params.vendorName) {
    insightKey = `vendor:${params.vendorName}`;
  } else if (params.category) {
    insightKey = `category:${params.category}`;
  } else {
    return null;
  }

  const { data, error } = await supabase
    .from("vendor_pulse_insights")
    .select("insight_json, expires_at")
    .eq("insight_key", insightKey)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data.insight_json;
}
