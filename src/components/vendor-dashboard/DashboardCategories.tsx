import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tags, Loader2, Check, AlertCircle } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useActiveProductLine } from "@/hooks/useActiveProductLine";
import { categories as allCategories } from "@/hooks/useVendorFilters";
import { cn } from "@/lib/utils";
import { AnimateOnScroll } from "./AnimateOnScroll";

const MAX_CATEGORIES = 5;

// Exclude the "all" meta-category
const selectableCategories = allCategories.filter((c) => c.id !== "all");

interface DashboardCategoriesProps {
  vendorName: string;
}

export function DashboardCategories({ vendorName }: DashboardCategoriesProps) {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const { activeProductLine } = useActiveProductLine();
  const productLineSlug = activeProductLine?.slug ?? null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: selected = [], isLoading } = useQuery<string[]>({
    queryKey: ["vendor-categories", vendorName, productLineSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profiles" as never)
        .select("categories" as never)
        .eq("vendor_name", vendorName as never)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.categories as string[]) ?? [];
    },
    enabled: !!vendorName,
  });

  async function handleToggle(categoryId: string) {
    setError(null);
    setSaved(false);

    const isSelected = selected.includes(categoryId);
    if (!isSelected && selected.length >= MAX_CATEGORIES) {
      setError(`You can select up to ${MAX_CATEGORIES} categories.`);
      return;
    }

    const updated = isSelected
      ? selected.filter((c) => c !== categoryId)
      : [...selected, categoryId];

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("vendor_profiles" as never)
        .update({ categories: updated } as never)
        .eq("vendor_name", vendorName as never);
      if (updateError) throw updateError;

      queryClient.setQueryData(["vendor-categories", vendorName, productLineSlug], updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AnimateOnScroll>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Tags className="h-5 w-5 text-slate-400" />
          Categories
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Select up to {MAX_CATEGORIES} categories that describe your product. These appear on your
          public profile and help dealers find you.
        </p>
      </div>
      </AnimateOnScroll>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AnimateOnScroll delay={0.1}>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {selectableCategories.map((cat) => {
              const isActive = selected.includes(cat.id);
              const atLimit = !isActive && selected.length >= MAX_CATEGORIES;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleToggle(cat.id)}
                  disabled={saving || atLimit}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : atLimit
                        ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-slate-900 cursor-pointer",
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            {saving && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1 text-green-600">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
            {!saving && !saved && (
              <span>
                {selected.length} / {MAX_CATEGORIES} selected
              </span>
            )}
          </div>
        </>
      )}
      </AnimateOnScroll>
    </div>
  );
}
