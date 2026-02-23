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
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] ?? 0;

          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-foreground/70 border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {cat.id !== "all" && count > 0 && (
                <span
                  className={cn(
                    "text-xs",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
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
