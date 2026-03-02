import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "./useClerkSupabase";
import { useClerkAuth } from "./useClerkAuth";

export interface MarketIntelVendor {
  vendor_name: string;
  category: string | null;
  status: string;
  sentiment_score: number | null;
  switching_intent: boolean;
  health_score: number | null;
  category_median: number | null;
  percentile: number | null;
  exploring_reasons: string[];
  alternatives: MarketIntelAlternative[];
}

export interface MarketIntelAlternative {
  vendor_name: string;
  health_score: number;
  highlight_metric: string;
  highlight_score: number;
}

export interface MarketIntelFormerVendor {
  vendor_name: string;
  sentiment_score: number | null;
  exit_reasons: string[];
}

export interface MarketIntelReport {
  is_complete: boolean;
  current_vendors: MarketIntelVendor[];
  former_vendors: MarketIntelFormerVendor[];
  contribution_count: number;
}

export function useMarketIntelReport(enabled: boolean) {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated } = useClerkAuth();

  return useQuery({
    queryKey: ["market-intel-report", user?.id],
    queryFn: async (): Promise<MarketIntelReport> => {
      const { data, error } = await supabase.rpc(
        "get_tech_stack_market_report" as never,
        { p_user_id: user!.id } as never
      );

      if (error) throw error;
      return data as unknown as MarketIntelReport;
    },
    enabled: enabled && isAuthenticated && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
