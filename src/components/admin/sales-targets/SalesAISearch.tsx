import { useState, useRef, useCallback } from "react";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import type { SalesOpportunityRow } from "@/types/sales-targets";

const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-ai-search`;

interface SalesAISearchProps {
  rows: SalesOpportunityRow[];
}

export function SalesAISearch({ rows }: SalesAISearchProps) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || loading) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      setAnswer("");

      try {
        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            question: query.trim(),
            vendors: rows.map((r) => ({
              vendor_name: r.vendor_name,
              category: r.category,
              total_mentions: r.total_mentions,
              mentions_30d: r.mentions_30d,
              mentions_90d: r.mentions_90d,
              positive_count: r.positive_count,
              negative_count: r.negative_count,
              health_score: r.health_score,
              trend_direction: r.trend_direction,
              feature_gap_count: r.feature_gap_count,
              pain_score: r.pain_score,
              buzz_score: r.buzz_score,
              gap_score: r.gap_score,
              known_dealers: r.known_dealers,
              has_profile: r.has_profile,
              nps_score: r.nps_score,
              negative_pct: r.negative_pct,
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const data = await response.json();
        setAnswer(data.answer || "No answer generated.");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to get answer"
        );
      } finally {
        setLoading(false);
      }
    },
    [query, rows, loading]
  );

  const handleClear = () => {
    abortRef.current?.abort();
    setQuery("");
    setAnswer("");
    setError("");
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about this data... e.g. &quot;Which vendors should we target first?&quot;"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600"
          />
          {(query || answer) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-zinc-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      {(answer || error) && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            error
              ? "bg-red-950/30 border-red-900/50 text-red-300"
              : "bg-zinc-900/50 border-zinc-800 text-zinc-300"
          }`}
        >
          {error ? (
            <p>{error}</p>
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_li]:my-0.5 [&_strong]:text-zinc-100 [&_h3]:text-sm [&_h3]:text-zinc-200 [&_h3]:mt-3 [&_h3]:mb-1"
              dangerouslySetInnerHTML={{
                __html: answer
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/^### (.*$)/gm, "<h3>$1</h3>")
                  .replace(/^- (.*$)/gm, "<li>$1</li>")
                  .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
                  .replace(/\n\n/g, "</p><p>")
                  .replace(/\n/g, "<br>"),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
