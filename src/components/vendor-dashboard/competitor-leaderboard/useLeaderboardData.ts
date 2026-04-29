import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { LeaderboardPayload } from "./types";

interface Args {
  vendorName: string;
  productLineSlug?: string | null;
  categoryOverride?: string | null;
  limit?: number;
  /** Optional admin-curated competitor name list. */
  segmentOverride?: string[] | null;
}

export function useLeaderboardData({
  vendorName,
  productLineSlug = null,
  categoryOverride = null,
  limit = 8,
  segmentOverride = null,
}: Args) {
  const supabase = useClerkSupabase();

  return useQuery<LeaderboardPayload>({
    queryKey: ["competitor-leaderboard", vendorName, productLineSlug, categoryOverride, limit, segmentOverride],
    enabled: !!vendorName,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_compared_vendors" as never,
        {
          p_vendor_name: vendorName,
          p_limit: limit,
          p_segment_override: segmentOverride,
          p_product_line_slug: productLineSlug,
          p_category_override: categoryOverride,
        } as never,
      );
      if (error) {
        console.error("[CompetitorLeaderboard] get_compared_vendors error:", error);
        throw error;
      }
      return data as unknown as LeaderboardPayload;
    },
  });
}
