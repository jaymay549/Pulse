import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClerkAuth } from "./useClerkAuth";

export interface FlaggedMention {
  flag_id: string;
  mention_id: number;
  vendor_name: string;
  headline: string | null;
  quote: string | null;
  mention_type: string;
  mention_source: string;
  flag_reason: string;
  flag_note: string | null;
  flag_status: string;
  flagged_by_vendor: string;
  flagged_at: string;
}

export function useAdminFlaggedMentions() {
  return useQuery({
    queryKey: ["admin-flagged-mentions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_flagged_mentions");
      if (error) throw error;
      return (data || []) as FlaggedMention[];
    },
  });
}

export function useUpholdFlag() {
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase.rpc("admin_uphold_flag", {
        p_flag_id: flagId,
        p_admin_user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flag upheld — mention hidden from public profile");
      queryClient.invalidateQueries({ queryKey: ["admin-flagged-mentions"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to uphold flag: ${err.message}`);
    },
  });
}

export function useDismissFlag() {
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase.rpc("admin_dismiss_flag", {
        p_flag_id: flagId,
        p_admin_user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flag dismissed — mention remains visible");
      queryClient.invalidateQueries({ queryKey: ["admin-flagged-mentions"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to dismiss flag: ${err.message}`);
    },
  });
}
