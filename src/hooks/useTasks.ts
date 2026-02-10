import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TaskDefinition, TaskOccurrence } from "@/types/admin";

const wam = () => supabase.schema("wam" as any);

export function useTaskDefinitions(includeArchived = false) {
  return useQuery({
    queryKey: ["task-definitions", includeArchived],
    queryFn: async () => {
      let query = wam()
        .from("task_definitions")
        .select("*, task_occurrences(*)")
        .order("created_at", { ascending: false });

      if (!includeArchived) {
        query = query.eq("is_archived", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TaskDefinition[];
    },
  });
}

export function useTaskOccurrences(definitionId: number | null) {
  return useQuery({
    queryKey: ["task-occurrences", definitionId],
    enabled: !!definitionId,
    queryFn: async () => {
      const { data, error } = await wam()
        .from("task_occurrences")
        .select("*")
        .eq("task_definition_id", definitionId)
        .order("generate_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TaskOccurrence[];
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const { error } = await wam()
        .from("task_definitions")
        .update({ is_archived: archived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-definitions"] });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<TaskDefinition, "id" | "created_at" | "task_occurrences">) => {
      const { data, error } = await wam()
        .from("task_definitions")
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      return data as TaskDefinition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-definitions"] });
    },
  });
}
