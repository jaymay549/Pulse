import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SummaryPrompt, PromptTimeframe } from "@/types/admin";

const wam = () => supabase.schema("wam" as any);

export function usePromptsByTimeframe(timeframe: PromptTimeframe) {
  return useQuery({
    queryKey: ["prompts", timeframe],
    queryFn: async () => {
      const { data, error } = await wam()
        .from("default_summary_prompts")
        .select("*")
        .eq("timeframe", timeframe)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data || []) as SummaryPrompt[];
    },
  });
}

export function useActivePrompt(timeframe: PromptTimeframe) {
  return useQuery({
    queryKey: ["prompts", timeframe, "active"],
    queryFn: async () => {
      const { data, error } = await wam()
        .from("default_summary_prompts")
        .select("*")
        .eq("timeframe", timeframe)
        .eq("is_active", true)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return (data as SummaryPrompt) || null;
    },
  });
}

export function useAllTimeframes() {
  return useQuery({
    queryKey: ["prompt-timeframes"],
    queryFn: async () => {
      const { data, error } = await wam()
        .from("default_summary_prompts")
        .select("timeframe")
        .order("timeframe");
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.timeframe))];
      return unique as string[];
    },
  });
}

export function useSavePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ timeframe, prompt }: { timeframe: string; prompt: string }) => {
      const { data, error } = await supabase.rpc("admin_save_prompt", {
        p_timeframe: timeframe,
        p_prompt: prompt,
      });
      if (error) throw error;
      return data as { id: number; version: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}

export function useRestorePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("admin_restore_prompt", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("admin_delete_prompt", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}
