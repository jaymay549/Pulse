import React, { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { WAM_URL } from "@/config/wam";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TrendingVendorChipsProps {
  onVendorSelect: (vendorName: string) => void;
  getLogoUrl?: (vendorName: string) => string | null;
  canAccess?: boolean;
  onUpgradeClick?: () => void;
  className?: string;
}

export const TrendingVendorChips: React.FC<TrendingVendorChipsProps> = ({
  onVendorSelect,
  getLogoUrl,
  canAccess = true,
  onUpgradeClick,
  className,
}) => {
  const [trendingVendors, setTrendingVendors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch(
          `${WAM_URL}/api/public/vendor-pulse/trending`
        );
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
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Trending
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {trendingVendors.map((name) => (
          <button
            key={name}
            onClick={() => {
              if (!canAccess) {
                onUpgradeClick?.();
                return;
              }
              onVendorSelect(name);
            }}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              "bg-muted/60 text-foreground border border-border/50",
              "hover:bg-primary/10 hover:border-primary/30 hover:text-primary",
              "transition-colors duration-150 shrink-0"
            )}
          >
            <Avatar className="h-6 w-6 border border-border/60 shrink-0">
              <AvatarImage
                src={getLogoUrl ? getLogoUrl(name) || undefined : undefined}
                alt={name}
              />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                {name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TrendingVendorChips;
