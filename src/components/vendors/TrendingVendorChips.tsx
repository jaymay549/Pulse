import React from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { VendorEntry } from "@/hooks/useVendorReviews";

interface TrendingVendorChipsProps {
  data: VendorEntry[];
  onVendorSelect: (vendorName: string) => void;
  className?: string;
}

export const TrendingVendorChips: React.FC<TrendingVendorChipsProps> = ({
  data,
  onVendorSelect,
  className,
}) => {
  // Calculate top vendors by review count
  const topVendors = React.useMemo(() => {
    const vendorCounts: Record<string, number> = {};
    
    data.forEach((entry) => {
      if (entry.vendorName) {
        vendorCounts[entry.vendorName] = (vendorCounts[entry.vendorName] || 0) + 1;
      }
    });

    return Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [data]);

  if (topVendors.length === 0) return null;

  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Popular searches
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {topVendors.map((name) => (
          <button
            key={name}
            onClick={() => onVendorSelect(name)}
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
              "bg-muted/60 text-foreground border border-border/50",
              "hover:bg-primary/10 hover:border-primary/30 hover:text-primary",
              "transition-colors duration-150"
            )}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TrendingVendorChips;
