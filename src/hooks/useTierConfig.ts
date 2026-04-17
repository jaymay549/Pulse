import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  TierComponentConfig,
  VendorTier,
  ComponentVisibility,
} from "@/types/tier-config";

const QUERY_KEY = ["tier-component-config"];

/**
 * React Query hook for fetching and mutating tier-component visibility config.
 *
 * - Fetches all rows via `get_tier_component_config` RPC
 * - Mutates via `upsert_tier_component_config` RPC with optimistic updates
 */
export function useTierConfig() {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();

  const {
    data: configs = [],
    isLoading,
    error,
  } = useQuery<TierComponentConfig[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "get_tier_component_config",
      );
      if (error) throw error;
      return data as TierComponentConfig[];
    },
  });

  const updateVisibility = useMutation({
    mutationFn: async (vars: {
      p_tier: VendorTier;
      p_component_key: string;
      p_visibility: ComponentVisibility;
    }) => {
      const { data, error } = await (supabase.rpc as any)(
        "upsert_tier_component_config",
        vars,
      );
      if (error) throw error;
      return data;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<TierComponentConfig[]>(QUERY_KEY);

      queryClient.setQueryData<TierComponentConfig[]>(QUERY_KEY, (old = []) => {
        const idx = old.findIndex(
          (c) => c.tier === vars.p_tier && c.component_key === vars.p_component_key,
        );
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], visibility: vars.p_visibility };
          return updated;
        }
        // Row doesn't exist yet in cache -- append a placeholder
        return [
          ...old,
          {
            id: crypto.randomUUID(),
            tier: vars.p_tier,
            component_key: vars.p_component_key,
            visibility: vars.p_visibility,
            updated_at: new Date().toISOString(),
          },
        ];
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast.error("Failed to save visibility setting");
    },
    onSuccess: () => {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return { configs, isLoading, error, updateVisibility };
}

/**
 * Read-only tier config hook that uses the anon Supabase client.
 *
 * Use this in vendor-facing pages where Clerk auth is not available
 * (magic-link vendor sessions). The tier_component_config table has
 * no RLS so the anon client can read it without a Clerk JWT.
 */
export function useTierConfigReadonly() {
  const { data: configs = [], isLoading, error } = useQuery<TierComponentConfig[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_tier_component_config");
      if (error) throw error;
      return data as TierComponentConfig[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — config rarely changes
  });
  return { configs, isLoading, error };
}

/**
 * Look up the visibility for a specific tier + component key.
 * Returns `"full"` as default when no config row exists.
 */
export function getVisibility(
  configs: TierComponentConfig[],
  tier: VendorTier,
  componentKey: string,
): ComponentVisibility {
  const row = configs.find(
    (c) => c.tier === tier && c.component_key === componentKey,
  );
  return row?.visibility ?? "full";
}
