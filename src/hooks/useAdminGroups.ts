import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WhatsAppGroup, GroupMessage } from "@/types/admin";

const wam = () => supabase.schema("wam" as any);

export function useAdminGroups() {
  return useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_groups_with_stats");
      if (error) throw error;
      return (data || []) as WhatsAppGroup[];
    },
  });
}

export function useGroupMessages(groupId: number | null, opts?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["group-messages", groupId, opts],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await wam()
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .order("timestamp", { ascending: false })
        .range(opts?.offset || 0, (opts?.offset || 0) + (opts?.limit || 50) - 1);
      if (error) throw error;
      return (data || []) as GroupMessage[];
    },
  });
}

export function useToggleGroupMonitoring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, monitored }: { id: number; monitored: boolean }) => {
      const { error } = await supabase.rpc("admin_toggle_group_monitoring", {
        p_id: id,
        p_monitored: monitored,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
  });
}

export function useToggleGroupFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, favorite }: { id: number; favorite: boolean }) => {
      const { error } = await supabase.rpc("admin_toggle_group_favorite", {
        p_id: id,
        p_favorite: favorite,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
  });
}

export function useGroupActivity(days = 30) {
  return useQuery({
    queryKey: ["group-activity", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_get_groups_members_activity" as any,
        { p_days: days }
      );
      if (error) throw error;
      return (data || []) as { groupId: number; dailyActivity: { date: string; count: number }[] }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGroupKpis(groups: WhatsAppGroup[] | undefined) {
  const { data: activity } = useGroupActivity(7);

  if (!groups || !activity) {
    return { totalMessages7d: 0, medianMessages7d: 0, activeSenders7d: 0, avgMessagesPerSender: 0 };
  }

  const messageCounts = activity.map((a) =>
    a.dailyActivity.reduce((sum, d) => sum + d.count, 0)
  );
  const totalMessages7d = messageCounts.reduce((sum, c) => sum + c, 0);
  const sorted = [...messageCounts].sort((a, b) => a - b);
  const medianMessages7d = sorted.length > 0
    ? sorted[Math.floor(sorted.length / 2)]
    : 0;
  const activeSenders7d = activity.filter((a) =>
    a.dailyActivity.some((d) => d.count > 0)
  ).length;
  const avgMessagesPerSender = activeSenders7d > 0
    ? Math.round(totalMessages7d / activeSenders7d)
    : 0;

  return { totalMessages7d, medianMessages7d, activeSenders7d, avgMessagesPerSender };
}
