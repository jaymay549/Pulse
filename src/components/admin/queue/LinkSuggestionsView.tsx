import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkSuggestion {
  id: string;
  mention_id: string;
  vendor_name: string;
  suggested_entity_id: string;
  suggested_canonical: string;
  match_type: string;
  match_alias: string | null;
  created_at: string;
}

interface UnlinkedVendor {
  vendor_name: string;
  mention_count: number;
}

const LinkSuggestionsView = () => {
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<string | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState(false);

  // Fetch pending suggestions
  const { data: suggestions = [], isLoading } = useQuery<LinkSuggestion[]>({
    queryKey: ["link-suggestions"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "admin_get_link_suggestions",
        { p_limit: 100 }
      );
      if (error) throw error;
      return (data || []) as LinkSuggestion[];
    },
  });

  // Fetch unlinked vendors (no entity_id) for generating recommendations
  const { data: unlinked = [] } = useQuery<UnlinkedVendor[]>({
    queryKey: ["unlinked-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_mentions" as never)
        .select("vendor_name" as never)
        .is("vendor_entity_id" as never, null)
        .eq("is_hidden" as never, false);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const m of (data as any[]) || []) {
        const key = m.vendor_name;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([vendor_name, mention_count]) => ({ vendor_name, mention_count }))
        .sort((a, b) => b.mention_count - a.mention_count);
    },
  });

  const handleResolve = async (id: string, action: "approve" | "reject") => {
    setResolving(id);
    try {
      const { data, error } = await (supabase.rpc as any)(
        "admin_resolve_link_suggestion",
        { p_suggestion_id: id, p_action: action }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        action === "approve"
          ? `Linked "${data.vendor_name}" and registered alias`
          : `Rejected suggestion for "${data.vendor_name}"`
      );
      queryClient.invalidateQueries({ queryKey: ["link-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-vendors"] });
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} suggestion`);
    } finally {
      setResolving(null);
    }
  };

  const generateRecommendations = async () => {
    setGeneratingRecs(true);
    try {
      // Find potential matches: unlinked vendors whose name is similar to an existing entity
      const { data: entities, error } = await supabase
        .from("vendor_entities" as never)
        .select("id, canonical_name" as never);
      if (error) throw error;

      const entityList = (entities as any[]) || [];
      let created = 0;

      for (const uv of unlinked.slice(0, 200)) {
        const uvLower = uv.vendor_name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (uvLower.length < 3) continue;

        for (const entity of entityList) {
          const entLower = entity.canonical_name.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (entLower.length < 3) continue;
          if (uvLower === entLower) continue; // Already exact match

          // Check if one contains the other (e.g. "VinSolutions" and "Vin Solutions")
          const similar =
            (uvLower.includes(entLower) || entLower.includes(uvLower)) &&
            Math.abs(uvLower.length - entLower.length) <= 3;

          if (similar) {
            // Check if suggestion already exists
            const { data: existing } = await supabase
              .from("vendor_link_suggestions" as never)
              .select("id" as never)
              .eq("vendor_name" as never, uv.vendor_name)
              .eq("suggested_entity_id" as never, entity.id)
              .limit(1);

            if (!existing || existing.length === 0) {
              await supabase.from("vendor_link_suggestions" as never).insert({
                vendor_name: uv.vendor_name,
                suggested_entity_id: entity.id,
                suggested_canonical: entity.canonical_name,
                match_type: "name_similarity",
                match_alias: entity.canonical_name,
                mention_id: "bulk",
              } as never);
              created++;
            }
          }
        }
      }

      toast.success(`Generated ${created} new link suggestion${created !== 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["link-suggestions"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate recommendations");
    } finally {
      setGeneratingRecs(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-zinc-500" />
          <span className="text-sm text-zinc-300">
            {suggestions.length} pending suggestion{suggestions.length !== 1 ? "s" : ""}
          </span>
          {unlinked.length > 0 && (
            <span className="text-xs text-zinc-600">
              · {unlinked.length} unlinked vendor{unlinked.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-zinc-700 text-zinc-300"
          onClick={generateRecommendations}
          disabled={generatingRecs}
        >
          {generatingRecs ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Generate Recommendations
        </Button>
      </div>

      {/* Suggestions list */}
      {suggestions.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">
          No pending suggestions. Click "Generate Recommendations" to find potential vendor links.
        </p>
      ) : (
        <div className="space-y-1">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-zinc-100">
                    {s.vendor_name}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-sm text-zinc-300">
                    {s.suggested_canonical}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 text-zinc-600 border-zinc-800"
                  >
                    {s.match_type}
                  </Badge>
                </div>
                {s.match_alias && s.match_alias !== s.suggested_canonical && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    matched via alias: {s.match_alias}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => handleResolve(s.id, "approve")}
                  disabled={resolving === s.id}
                >
                  {resolving === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => handleResolve(s.id, "reject")}
                  disabled={resolving === s.id}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unlinked vendors */}
      {unlinked.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Unlinked Vendors ({unlinked.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {unlinked.slice(0, 50).map((v) => (
              <Badge
                key={v.vendor_name}
                variant="outline"
                className="text-[10px] px-2 py-0.5 text-zinc-400 border-zinc-800"
              >
                {v.vendor_name}
                <span className="ml-1 text-zinc-600">{v.mention_count}</span>
              </Badge>
            ))}
            {unlinked.length > 50 && (
              <span className="text-[10px] text-zinc-600 self-center">
                +{unlinked.length - 50} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkSuggestionsView;
