import React, { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchTrendingVendors } from "@/hooks/useSupabaseVendorData";
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
    const loadTrending = async () => {
      try {
        const trending = await fetchTrendingVendors();
        setTrendingVendors(trending);
      } catch (err) {
        console.error("Failed to fetch trending vendors:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrending();
  }, []);

  if (isLoading || trendingVendors.length === 0) return null;

  return (
    <div className={cn("", className)}>
      <div className="flex items-center gap-2 mb-2.5">
        <TrendingUp className="h-3.5 w-3.5 text-foreground/30" />
        <span className="text-[11px] font-semibold text-foreground/35 uppercase tracking-widest">
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
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-medium",
              "bg-white text-foreground/70",
              "shadow-[0_0_0_1px_rgba(0,0,0,0.04)]",
              "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.06)]",
              "hover:text-foreground",
              "transition-all duration-200 shrink-0"
            )}
          >
            <Avatar className="h-5 w-5 border border-black/[0.06] shrink-0">
              <AvatarImage
                src={getLogoUrl ? getLogoUrl(name) || undefined : undefined}
                alt={name}
              />
              <AvatarFallback className="bg-amber-50 text-amber-700 text-[9px] font-bold">
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
