import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";

interface VendorProductSubscriptionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
}

const TIER_OPTIONS = [
  { value: "unverified", label: "Unverified", style: "text-zinc-400" },
  { value: "tier_1", label: "Tier 1", style: "text-green-400" },
  { value: "tier_2", label: "Tier 2", style: "text-purple-400" },
];

export function VendorProductSubscriptionsPanel({ open, onOpenChange, vendorName }: VendorProductSubscriptionsPanelProps) {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();
  const [addingSlug, setAddingSlug] = useState<string | null>(null);

  // Fetch current subscriptions via admin RPC
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-product-subscriptions", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_product_subscriptions" as never, {
        p_vendor_name: vendorName,
      } as never);
      if (error) throw error;
      return (data ?? []) as Array<{ product_line_slug: string; product_line_name: string; tier: string }>;
    },
    enabled: open && !!vendorName,
  });

  // Fetch entity + available product lines (to show "Add" options)
  const { data: entityId } = useQuery({
    queryKey: ["admin-vendor-entity", vendorName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_vendor_family" as never, {
        p_vendor_name: vendorName,
      } as never);
      if (error) throw error;
      const rows = data as Array<{ vendor_entity_id: string | null }>;
      return rows?.[0]?.vendor_entity_id ?? null;
    },
    enabled: open && !!vendorName,
  });

  const { data: allProductLines = [] } = useQuery({
    queryKey: ["admin-entity-product-lines", entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_product_lines")
        .select("id, name, slug")
        .eq("vendor_entity_id", entityId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; slug: string }>;
    },
    enabled: !!entityId,
  });

  const subscribedSlugs = new Set(subscriptions.map((s) => s.product_line_slug));
  const availableToAdd = allProductLines.filter((pl) => !subscribedSlugs.has(pl.slug));

  // Upsert mutation (for tier changes and adds)
  const upsertMutation = useMutation({
    mutationFn: async ({ slug, tier }: { slug: string; tier: string }) => {
      const { error } = await supabase.rpc("admin_upsert_product_subscription" as never, {
        p_vendor_name: vendorName,
        p_product_line_slug: slug,
        p_tier: tier,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product-subscriptions", vendorName] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-product-counts"] });
      setAddingSlug(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await supabase.rpc("admin_delete_product_subscription" as never, {
        p_vendor_name: vendorName,
        p_product_line_slug: slug,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product-subscriptions", vendorName] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-logins"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-product-counts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-zinc-950 border-zinc-800 w-[360px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-zinc-100 text-base">
            Product Subscriptions
            <span className="block text-xs text-zinc-500 font-normal mt-0.5">{vendorName}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : subscriptions.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">No product subscriptions yet.</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div
                  key={sub.product_line_slug}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900"
                >
                  <span className="text-sm text-zinc-200 truncate flex-1 min-w-0">{sub.product_line_name}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <Select
                      value={sub.tier}
                      onValueChange={(newTier) => upsertMutation.mutate({ slug: sub.product_line_slug, tier: newTier })}
                    >
                      <SelectTrigger className="h-7 text-xs w-[100px] bg-zinc-800 border-zinc-700 text-zinc-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIER_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            <span className={t.style}>{t.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => deleteMutation.mutate(sub.product_line_slug)}
                      disabled={deleteMutation.isPending}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new subscription */}
          {availableToAdd.length > 0 && (
            <div className="pt-2 border-t border-zinc-800">
              {addingSlug ? (
                <div className="flex items-center gap-2">
                  <Select value={addingSlug} onValueChange={setAddingSlug}>
                    <SelectTrigger className="h-8 text-xs flex-1 bg-zinc-900 border-zinc-700 text-zinc-300">
                      <SelectValue placeholder="Select product line" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map((pl) => (
                        <SelectItem key={pl.slug} value={pl.slug}>{pl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => upsertMutation.mutate({ slug: addingSlug, tier: "tier_1" })}
                    disabled={upsertMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8"
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddingSlug(null)}
                    className="text-xs h-8 text-zinc-500"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAddingSlug(availableToAdd[0]?.slug ?? null)}
                  className="w-full text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add product line
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
