import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Topic, TopicStatus, TopicSentimentHistory, TopicVote } from "@/types/admin";

const wam = () => supabase.schema("wam" as any);

export function useTopics(filters?: { status?: TopicStatus; search?: string }) {
  return useQuery({
    queryKey: ["topics", filters],
    queryFn: async () => {
      let query = wam()
        .from("topics")
        .select("*")
        .order("trending_score", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Topic[];
    },
  });
}

export function useTopicDetail(id: string | null) {
  return useQuery({
    queryKey: ["topic-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await wam()
        .from("topics")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Topic;
    },
  });
}

export function useTopicSentimentHistory(topicId: string | null) {
  return useQuery({
    queryKey: ["topic-sentiment-history", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await wam()
        .from("topic_sentiment_history")
        .select("*")
        .eq("topic_id", topicId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data || []) as TopicSentimentHistory[];
    },
  });
}

export function useTopicVotes(topicId: string | null) {
  return useQuery({
    queryKey: ["topic-votes", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await wam()
        .from("topic_votes")
        .select("*")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TopicVote[];
    },
  });
}

export function useUpdateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      status?: string;
      is_pinned?: boolean;
      is_archived?: boolean;
    }) => {
      const { error } = await supabase.rpc("admin_update_topic", {
        p_id: params.id,
        p_status: params.status || null,
        p_is_pinned: params.is_pinned ?? null,
        p_is_archived: params.is_archived ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["topic-detail"] });
    },
  });
}
