import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Category } from "@/hooks/useVendorFilters";

interface TopVendor {
  name: string;
  logoUrl: string | null;
}

interface CategoryGridProps {
  categories: Category[];
  categoryCounts: Record<string, number>;
  topVendorsByCategory: Record<string, TopVendor[]>;
  onCategorySelect: (categoryId: string) => void;
  className?: string;
}

export function CategoryGrid({
  categories,
  categoryCounts,
  topVendorsByCategory,
  onCategorySelect,
  className,
}: CategoryGridProps) {
  // Parent passes sortedCategories (already sorted by count) - just filter out "all"
  const gridCategories = categories.filter((cat) => cat.id !== "all");

  return (
    <div className={cn("", className)}>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Browse by Category
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {gridCategories.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          const topVendors = topVendorsByCategory[cat.id] || [];
          const displayVendors = topVendors.slice(0, 3);
          const overflowCount = topVendors.length - 3;

          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className="text-left p-4 bg-white rounded-xl border border-border/50 hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {count} review{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
              </div>

              {displayVendors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {displayVendors.map((vendor) => (
                    <Avatar key={vendor.name} className="h-6 w-6 border border-border/50">
                      <AvatarImage src={vendor.logoUrl || undefined} alt={vendor.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                        {vendor.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflowCount > 0 && (
                    <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                      +{overflowCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
