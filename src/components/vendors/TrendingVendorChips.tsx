import React, { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { WAM_URL } from "@/config/wam";

interface TrendingVendorChipsProps {
  onVendorSelect: (vendorName: string) => void;
  className?: string;
}

export const TrendingVendorChips: React.FC<TrendingVendorChipsProps> = ({
  onVendorSelect,
  className,
}) => {
  const [trendingVendors, setTrendingVendors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch(`${WAM_URL}/api/public/vendor-pulse/trending`);
        if (response.ok) {
          const data = await response.json();
          setTrendingVendors(data.trending || []);
        }
      } catch (err) {
        console.error("Failed to fetch trending vendors:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, []);

  if (isLoading || trendingVendors.length === 0) return null;

  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Trending
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {trendingVendors.map((name) => (
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
