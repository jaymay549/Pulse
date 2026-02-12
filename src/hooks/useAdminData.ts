import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Member,
  TrendReport,
  PdfExport,
  ChatConversation,
} from "@/types/admin";

// ── Members ──

export function useMembers(days = 365) {
  return useQuery({
    queryKey: ["admin-members", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_get_members_with_activity" as any,
        { p_days: days, p_timezone_offset: new Date().getTimezoneOffset() }
      );
      if (error) throw error;
      return ((data as any)?.members || []) as Member[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Trends ──

export function useTrendReport(type: "daily" | "weekly") {
  return useQuery({
    queryKey: ["admin-trend-report", type],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_get_trend_report" as any,
        { p_type: type }
      );
      if (error) throw error;
      return (data as any) as TrendReport | null;
    },
  });
}

export function useTopicMessages(
  topic: string | null,
  startDate: string | null,
  endDate: string | null
) {
  return useQuery({
    queryKey: ["admin-topic-messages", topic, startDate, endDate],
    enabled: !!topic && !!startDate && !!endDate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_get_topic_messages" as any,
        { p_topic: topic!, p_start_date: startDate!, p_end_date: endDate! }
      );
      if (error) throw error;
      return ((data as any)?.messages || []) as any[];
    },
  });
}

// ── Scheduled Messages ──

export function useScheduledMessages() {
  return useQuery({
    queryKey: ["admin-scheduled-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_get_scheduled_messages" as any
      );
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });
}

// ── PDFs ──

export function usePdfExports() {
  return useQuery({
    queryKey: ["admin-pdf-exports"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_pdfs" as any);
      if (error) throw error;
      return (((data as any)?.exports || []) as PdfExport[]);
    },
  });
}

// ── Chat Conversations ──

export function useChatConversations(enabled = true) {
  return useQuery({
    queryKey: ["admin-chat-conversations"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_list_conversations" as any
      );
      if (error) throw error;
      return (((data as any)?.conversations || []) as ChatConversation[]);
    },
  });
}

export async function fetchConversation(id: number): Promise<ChatConversation> {
  const { data, error } = await supabase.rpc(
    "admin_get_conversation" as any,
    { p_id: id }
  );
  if (error) throw error;
  return (data as any)?.conversation as ChatConversation;
}

// ── Chat Status (polling) ──

export async function fetchChatStatus(
  requestId: number
): Promise<{ status: string; response?: string; error?: string }> {
  const { data, error } = await supabase.rpc(
    "admin_get_chat_status" as any,
    { p_request_id: requestId }
  );
  if (error) throw error;
  return data as any;
}

// ── Queue Item Thinking ──

export async function fetchQueueItemThinking(id: number): Promise<string> {
  const { data, error } = await supabase.rpc(
    "admin_get_queue_item_thinking" as any,
    { p_id: id }
  );
  if (error) throw error;
  return (data as any)?.thinking || "No thinking data available";
}

// ── Occurrence HTML ──

export async function fetchOccurrenceHtml(
  occurrenceId: number
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "admin_get_occurrence_html" as any,
    { p_occurrence_id: occurrenceId }
  );
  if (error) throw error;
  return (data as any)?.html || "";
}
