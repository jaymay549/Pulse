import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "./useClerkSupabase";
import { useClerkAuth } from "./useClerkAuth";
import { toast } from "sonner";

type SupabaseLikeError = {
  code?: string;
  status?: number;
  message?: string;
};

function isSkippedCategoriesTableMissing(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  // PostgREST returns 404 / undefined_table style errors when relation is missing.
  return (
    error.status === 404 ||
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (typeof error.message === "string" &&
      error.message.toLowerCase().includes("user_tech_stack_skipped_categories"))
  );
}

export type StackCategory =
  | "CRM"
  | "DMS"
  | "Website"
  | "Appraisal"
  | "Fixed Ops"
  | "AI"
  | "Inventory"
  | "Other";

export interface TechStackEntry {
  id: string;
  user_id: string;
  vendor_name: string;
  category: StackCategory | null;
  is_current: boolean;
  sentiment_score: number | null;
  switching_intent: boolean;
  status: "stable" | "exploring" | "left";
  insight_text: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  exit_reasons: ExitReason[];
}

export interface ExitReason {
  id: string;
  tech_stack_id: string;
  reason_category: ReasonCategory;
  detail_text: string | null;
}

export type ReasonCategory =
  | "pricing"
  | "support"
  | "features"
  | "reliability"
  | "integration"
  | "other";

export const REASON_CATEGORIES: { value: ReasonCategory; label: string }[] = [
  { value: "pricing", label: "Pricing" },
  { value: "support", label: "Support" },
  { value: "features", label: "Features" },
  { value: "reliability", label: "Reliability" },
  { value: "integration", label: "Integration" },
  { value: "other", label: "Other" },
];

export function useTechStackEntries() {
  const supabase = useClerkSupabase();
  const { user, isAuthenticated } = useClerkAuth();

  return useQuery({
    queryKey: ["tech-stack", user?.id],
    queryFn: async (): Promise<{ entries: TechStackEntry[]; skippedCategories: StackCategory[] }> => {
      // Parallel fetches for performance
      const [entriesRes, skippedRes] = await Promise.all([
        supabase
          .from("user_tech_stack" as never)
          .select("*" as never)
          .eq("user_id", user!.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_tech_stack_skipped_categories" as never)
          .select("category" as never)
          .eq("user_id", user!.id)
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (skippedRes.error && !isSkippedCategoriesTableMissing(skippedRes.error as SupabaseLikeError)) {
        throw skippedRes.error;
      }

      const entries = entriesRes.data as any[];
      const skippedCategories = skippedRes.error
        ? []
        : (skippedRes.data as any[]).map((s) => s.category as StackCategory);

      if (!entries || entries.length === 0) return { entries: [], skippedCategories };

      const ids = entries.map((e: any) => e.id);
      const { data: reasons, error: reasonsError } = await supabase
        .from("user_tech_stack_exit_reasons" as never)
        .select("*" as never)
        .in("tech_stack_id", ids);

      if (reasonsError) throw reasonsError;

      const reasonsByStackId = new Map<string, ExitReason[]>();
      for (const r of (reasons || []) as any[]) {
        const list = reasonsByStackId.get(r.tech_stack_id) || [];
        list.push(r as ExitReason);
        reasonsByStackId.set(r.tech_stack_id, list);
      }

      const techStackEntries = entries.map((e: any) => ({
        ...e,
        exit_reasons: reasonsByStackId.get(e.id) || [],
      })) as TechStackEntry[];

      return { entries: techStackEntries, skippedCategories };
    },
    enabled: isAuthenticated && !!user?.id,
  });
}

export interface SaveStepParams {
  vendors: {
    vendor_name: string;
    category: StackCategory;
    is_current: boolean;
    status: "stable" | "exploring" | "left";
    switching_intent: boolean;
    sentiment_score: number | null;
    insight_text: string | null;
    exit_reasons: ReasonCategory[];
  }[];
}

export function useSaveTechStackStep() {
  const supabase = useClerkSupabase();
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SaveStepParams & { silent?: boolean }) => {
      // If the vendor list is empty, we don't want to just return, 
      // as the user might have removed the last vendor.
      // The current implementation replaces reasons per vendor, but we need to handle 
      // actual row deletions if a vendor is removed from the local state.
      // However, for now, let's stick to the upsert logic and handle removals via a separate hook if needed,
      // or by passing the full list and reconciling.
      
      // For now, we'll assume the params.vendors is the source of truth for what should exist.
      // To properly handle removals in an auto-save world, we should ideally delete rows not in the list.
      
      for (const v of params.vendors) {
        // Upsert the tech stack entry
        const { data: upserted, error } = await supabase
          .from("user_tech_stack" as never)
          .upsert(
            {
              user_id: user!.id,
              vendor_name: v.vendor_name,
              category: v.category,
              is_current: v.is_current,
              status: v.status,
              switching_intent: v.switching_intent,
              sentiment_score: v.sentiment_score,
              insight_text: v.insight_text,
              confirmed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id,vendor_name,category" } as never
          )
          .select("id" as never)
          .single();

        if (error) throw error;

        const stackId = (upserted as any).id;

        // Replace exit reasons for this entry
        await supabase
          .from("user_tech_stack_exit_reasons" as never)
          .delete()
          .eq("tech_stack_id", stackId);

        if (v.exit_reasons.length > 0) {
          const { error: reasonsError } = await supabase
            .from("user_tech_stack_exit_reasons" as never)
            .insert(
              v.exit_reasons.map((r) => ({
                tech_stack_id: stackId,
                reason_category: r,
              })) as never
            );

          if (reasonsError) throw reasonsError;
        }
      }
    },
    onSuccess: (_, variables) => {
      if (!variables.silent) {
        toast.success("Progress saved");
        queryClient.invalidateQueries({ queryKey: ["tech-stack"] });
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });
}

export function useRemoveTechStackEntry() {
  const supabase = useClerkSupabase();
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { vendor_name: string; category: StackCategory }) => {
      const { error } = await supabase
        .from("user_tech_stack" as never)
        .delete()
        .eq("user_id", user!.id)
        .eq("vendor_name", params.vendor_name)
        .eq("category", params.category);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-stack"] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove: ${err.message}`);
    },
  });
}

export function useSubmitVendor() {
  const supabase = useClerkSupabase();
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      vendor_name: string;
      website_url?: string;
    }) => {
      const { error } = await supabase
        .from("user_submitted_vendors" as never)
        .insert({
          submitted_by: user!.id,
          vendor_name: params.vendor_name,
          website_url: params.website_url || null,
        } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor submitted for review");
      queryClient.invalidateQueries({ queryKey: ["submitted-vendors"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useConfirmTechStack() {
  const supabase = useClerkSupabase();
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_tech_stack" as never)
        .update({ confirmed_at: new Date().toISOString() } as never)
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tech stack confirmed as up to date");
      queryClient.invalidateQueries({ queryKey: ["tech-stack"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useToggleSkipCategory() {
  const supabase = useClerkSupabase();
  const { user } = useClerkAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { category: StackCategory; isSkipped: boolean }) => {
      if (params.isSkipped) {
        const { error } = await supabase
          .from("user_tech_stack_skipped_categories" as never)
          .upsert({ user_id: user!.id, category: params.category } as never, {
            onConflict: "user_id,category",
          } as never);
        if (error && !isSkippedCategoriesTableMissing(error as SupabaseLikeError)) throw error;
      } else {
        const { error } = await supabase
          .from("user_tech_stack_skipped_categories" as never)
          .delete()
          .eq("user_id", user!.id)
          .eq("category", params.category);
        if (error && !isSkippedCategoriesTableMissing(error as SupabaseLikeError)) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-stack"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
