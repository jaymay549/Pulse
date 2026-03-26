// src/hooks/useSalesOpportunities.ts

import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import type { SalesOpportunitySignal } from "@/types/sales-targets";

export function useSalesOpportunities(minMentions: number = 3) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["sales-opportunity-signals", minMentions],
    queryFn: async (): Promise<SalesOpportunitySignal[]> => {
      const { data, error } = await supabase.rpc(
        "get_sales_opportunity_signals" as never,
        { p_min_mentions: minMentions } as never
      );

      if (error) {
        console.error("[SalesTargets] RPC error:", error);
        throw error;
      }

      return (data as unknown as SalesOpportunitySignal[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
