import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VendorQueueItem, QueueItemAIResponse, QueueStatus } from "@/types/admin";

const wam = () => supabase.schema("wam" as any);

export function useQueueItems(statusFilter?: QueueStatus | "all") {
  return useQuery({
    queryKey: ["vendor-queue", statusFilter],
    queryFn: async () => {
      let query = wam()
        .from("vendor_processing_queue")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VendorQueueItem[];
    },
  });
}

export function useQueueStats() {
  return useQuery({
    queryKey: ["vendor-queue-stats"],
    queryFn: async () => {
      const { data, error } = await wam()
        .from("vendor_processing_queue")
        .select("status");
      if (error) throw error;

      const items = data || [];
      return {
        total: items.length,
        pending: items.filter((r: any) => r.status === "pending").length,
        processing: items.filter((r: any) => r.status === "processing").length,
        processed: items.filter((r: any) => r.status === "processed").length,
        failed: items.filter((r: any) => r.status === "failed").length,
      };
    },
  });
}

export function useApprovedMentions() {
  return useQuery({
    queryKey: ["approved-mentions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_mentions")
        .select("*")
        .order("approved_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function parseAIResponse(raw: string | null): QueueItemAIResponse | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseConversationChunk(raw: string): Array<{
  id: number;
  sender: string;
  content: string;
  timestamp: string;
}> {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function useApproveMention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      vendor_name: string;
      category: string;
      headline: string;
      dimension: string;
      sentiment: string;
      snippet_anon: string;
      message_ids: number[];
    }) => {
      const { data, error } = await supabase.rpc("admin_approve_mention", {
        p_vendor_name: params.vendor_name,
        p_category: params.category,
        p_headline: params.headline,
        p_dimension: params.dimension as any,
        p_sentiment: params.sentiment as any,
        p_snippet_anon: params.snippet_anon,
        p_message_ids: params.message_ids as any,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-queue"] });
      queryClient.invalidateQueries({ queryKey: ["approved-mentions"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-queue-stats"] });
    },
  });
}

export function useUndoApproveMention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mentionId: number) => {
      const { error } = await supabase.rpc("admin_undo_approve_mention", {
        p_id: mentionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-queue"] });
      queryClient.invalidateQueries({ queryKey: ["approved-mentions"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-queue-stats"] });
    },
  });
}

export function useSearchMentions(params: {
  query?: string;
  vendor?: string;
  sentiment?: string;
  dimension?: string;
  category?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["mention-search", params],
    enabled: params.enabled !== false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_mentions", {
        p_query: params.query || null,
        p_vendor: params.vendor || null,
        p_sentiment: params.sentiment || null,
        p_dimension: params.dimension || null,
        p_category: params.category || null,
        p_limit: params.limit || 25,
        p_offset: params.offset || 0,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: number;
        vendor_name: string;
        category: string;
        headline: string;
        dimension: string;
        sentiment: string;
        snippet_anon: string;
        approved_at: string;
      }>;
    },
  });
}
