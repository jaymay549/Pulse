import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearchMentions } from "@/hooks/useVendorQueue";
import { VENDOR_DIMENSIONS, SENTIMENT_COLORS } from "@/types/admin";

const SENTIMENTS = ["positive", "negative", "neutral", "mixed"];
const DIMENSIONS = Object.keys(VENDOR_DIMENSIONS);
const PAGE_SIZE = 25;

const MentionsSearchView = () => {
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("");
  const [sentiment, setSentiment] = useState<string>("all");
  const [dimension, setDimension] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data: results, isLoading } = useSearchMentions({
    query: query || undefined,
    vendor: vendor || undefined,
    sentiment: sentiment === "all" ? undefined : sentiment,
    dimension: dimension === "all" ? undefined : dimension,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const resetFilters = () => {
    setQuery("");
    setVendor("");
    setSentiment("all");
    setDimension("all");
    setPage(0);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search mentions..."
            className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
        <Input
          value={vendor}
          onChange={(e) => { setVendor(e.target.value); setPage(0); }}
          placeholder="Vendor name"
          className="h-8 w-36 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
        />
        <Select value={sentiment} onValueChange={(v) => { setSentiment(v); setPage(0); }}>
          <SelectTrigger className="w-28 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all" className="text-zinc-300 text-xs">All</SelectItem>
            {SENTIMENTS.map((s) => (
              <SelectItem key={s} value={s} className="text-zinc-300 text-xs capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dimension} onValueChange={(v) => { setDimension(v); setPage(0); }}>
          <SelectTrigger className="w-28 h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Dimension" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all" className="text-zinc-300 text-xs">All</SelectItem>
            {DIMENSIONS.map((d) => (
              <SelectItem key={d} value={d} className="text-zinc-300 text-xs">
                {VENDOR_DIMENSIONS[d].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-zinc-500"
          onClick={resetFilters}
        >
          Reset
        </Button>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : !results || results.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No mentions found.</p>
      ) : (
        <div className="space-y-2">
          {results.map((mention) => {
            const sentimentClass = SENTIMENT_COLORS[mention.sentiment] || SENTIMENT_COLORS.unknown;
            const dimensionInfo = VENDOR_DIMENSIONS[mention.dimension] || VENDOR_DIMENSIONS.other;
            return (
              <div
                key={mention.id}
                className="border border-zinc-800 rounded-lg p-3 space-y-1.5 bg-zinc-900/50"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100 text-sm">
                    {mention.vendor_name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${sentimentClass}`}
                  >
                    {mention.sentiment}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-zinc-400 border-zinc-700"
                  >
                    {dimensionInfo.label}
                  </Badge>
                  {mention.category && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700"
                    >
                      {mention.category}
                    </Badge>
                  )}
                  {mention.approved_at && (
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      {new Date(mention.approved_at).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
                {mention.headline && (
                  <p className="text-xs font-medium text-zinc-300">{mention.headline}</p>
                )}
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {mention.snippet_anon}
                </p>
              </div>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-zinc-400"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-zinc-500">Page {page + 1}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-zinc-400"
              disabled={results.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentionsSearchView;
