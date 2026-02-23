import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { Category } from "@/hooks/useVendorFilters";

interface CategoryPillsProps {
  categories: Category[];
  selectedCategory: string;
  categoryCounts: Record<string, number>;
  onCategorySelect: (categoryId: string) => void;
  className?: string;
}

export function CategoryPills({
  categories,
  selectedCategory,
  categoryCounts,
  onCategorySelect,
  className,
}: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] ?? 0;

          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-200 shrink-0 snap-start",
                isSelected
                  ? "bg-foreground text-white shadow-sm"
                  : "bg-white text-foreground/60 hover:text-foreground hover:bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
              )}
            >
              <span className="text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
              {cat.id !== "all" && count > 0 && (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    isSelected ? "text-white/50" : "text-foreground/30"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
