import { useState, useMemo } from "react";
import { Loader2, Target } from "lucide-react";
import { useSalesOpportunities } from "@/hooks/useSalesOpportunities";
import { useSalesSynopsis } from "@/hooks/useSalesSynopsis";
import { computeOpportunityRows } from "./scoring";
import { SalesTargetsTable } from "./SalesTargetsTable";
import { SalesAISearch } from "./SalesAISearch";

export function SalesTargetsTab() {
  const [minMentions, setMinMentions] = useState(3);
  const [showAll, setShowAll] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const effectiveMin = showAll ? 1 : minMentions;
  const { data: signals, isLoading, error } = useSalesOpportunities(effectiveMin);
  const synopsis = useSalesSynopsis();

  const categories = useMemo(() => {
    if (!signals) return [];
    const cats = [...new Set(signals.map((s) => s.category).filter(Boolean))] as string[];
    return cats.sort();
  }, [signals]);

  const rows = useMemo(() => {
    if (!signals) return [];
    const filtered =
      categoryFilter === "all"
        ? signals
        : signals.filter((s) => s.category === categoryFilter);
    return computeOpportunityRows(filtered);
  }, [signals, categoryFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-400">
        Failed to load sales opportunity data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {rows.length} vendors
        </span>
      </div>

      {/* AI Search */}
      <SalesAISearch rows={rows} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        {/* Category filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="all">All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Min mentions slider */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Min Mentions</label>
          <input
            type="range"
            min={1}
            max={50}
            value={minMentions}
            onChange={(e) => setMinMentions(Number(e.target.value))}
            disabled={showAll}
            className="w-24 accent-zinc-500"
          />
          <span className="text-xs text-zinc-400 w-6 text-right">
            {showAll ? 1 : minMentions}
          </span>
        </div>

        {/* Show all toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Show All</label>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`w-8 h-4 rounded-full transition-colors ${
              showAll ? "bg-green-600" : "bg-zinc-700"
            } relative`}
          >
            <div
              className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                showAll ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <SalesTargetsTable
          rows={rows}
          synopsisCache={synopsis.cache}
          synopsisLoading={synopsis.loading}
          synopsisErrors={synopsis.errors}
          onGenerateSynopsis={synopsis.generate}
          onRetrySynopsis={synopsis.retry}
        />
      </div>
    </div>
  );
}
