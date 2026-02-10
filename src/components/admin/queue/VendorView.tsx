import { useMemo, useState } from "react";
import { Loader2, Search, GitMerge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import VendorMergeDialog from "./VendorMergeDialog";
import { useApprovedMentions } from "@/hooks/useVendorQueue";
import { SENTIMENT_COLORS } from "@/types/admin";

interface VendorSummary {
  name: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  categories: Set<string>;
}

const VendorView = () => {
  const { data: mentions, isLoading } = useApprovedMentions();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);

  const vendors = useMemo(() => {
    if (!mentions) return [];
    const map = new Map<string, VendorSummary>();
    for (const m of mentions) {
      const key = m.vendor_name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: m.vendor_name,
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          mixed: 0,
          categories: new Set(),
        });
      }
      const v = map.get(key)!;
      v.total++;
      if (m.sentiment === "positive") v.positive++;
      else if (m.sentiment === "negative") v.negative++;
      else if (m.sentiment === "neutral") v.neutral++;
      else if (m.sentiment === "mixed") v.mixed++;
      if (m.category) v.categories.add(m.category);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [mentions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q));
  }, [vendors, search]);

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
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
      {/* Search + actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-300"
          />
        </div>
        {selected.size >= 2 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-zinc-700 text-zinc-300"
            onClick={() => setMergeOpen(true)}
          >
            <GitMerge className="h-3 w-3 mr-1" />
            Merge {selected.size} Vendors
          </Button>
        )}
        <span className="text-xs text-zinc-500">
          {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Vendor list */}
      <div className="space-y-1">
        {filtered.map((vendor) => (
          <div
            key={vendor.name}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/60 transition-colors group"
          >
            <Checkbox
              checked={selected.has(vendor.name)}
              onCheckedChange={() => toggleSelect(vendor.name)}
              className="border-zinc-700 data-[state=checked]:bg-zinc-600"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-100 truncate">
                  {vendor.name}
                </span>
                <span className="text-[10px] text-zinc-500">{vendor.total} mentions</span>
              </div>
              {vendor.categories.size > 0 && (
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {Array.from(vendor.categories)
                    .slice(0, 3)
                    .map((cat) => (
                      <Badge key={cat} variant="outline" className="text-[9px] px-1 py-0 text-zinc-600 border-zinc-800">
                        {cat}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {vendor.positive > 0 && (
                <span className={SENTIMENT_COLORS.positive}>{vendor.positive}</span>
              )}
              {vendor.negative > 0 && (
                <span className={SENTIMENT_COLORS.negative}>{vendor.negative}</span>
              )}
              {vendor.neutral > 0 && (
                <span className={SENTIMENT_COLORS.neutral}>{vendor.neutral}</span>
              )}
              {vendor.mixed > 0 && (
                <span className={SENTIMENT_COLORS.mixed}>{vendor.mixed}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">No vendors found.</p>
      )}

      {/* Merge dialog */}
      <VendorMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        vendorNames={Array.from(selected)}
        onMerged={() => setSelected(new Set())}
      />
    </div>
  );
};

export default VendorView;
