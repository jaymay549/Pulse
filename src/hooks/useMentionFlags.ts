import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "./useClerkSupabase";
import { toast } from "sonner";

export interface MentionFlag {
  id: string;
  mention_id: number;
  reason: string;
  note: string | null;
  status: "pending" | "upheld" | "dismissed";
  created_at: string;
}

export function useVendorFlags(vendorProfileId?: string) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["vendor-flags", vendorProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mention_flags")
        .select("*")
        .eq("vendor_profile_id", vendorProfileId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MentionFlag[];
    },
    enabled: !!vendorProfileId,
  });
}

export function useFlagMention() {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      mention_id: number;
      vendor_profile_id: string;
      reason: string;
      note?: string;
    }) => {
      // Check rate limit
      const { data: count, error: rpcError } = await supabase.rpc(
        "get_vendor_flag_count_this_month",
        { p_vendor_profile_id: params.vendor_profile_id }
      );

      if (rpcError) throw rpcError;
      if ((count as number) >= 5) {
        throw new Error("You've reached your limit of 5 flags per month");
      }

      const { error } = await supabase.from("mention_flags").insert({
        mention_id: params.mention_id,
        vendor_profile_id: params.vendor_profile_id,
        reason: params.reason,
        note: params.note || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flag submitted for review");
      queryClient.invalidateQueries({ queryKey: ["vendor-flags"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
