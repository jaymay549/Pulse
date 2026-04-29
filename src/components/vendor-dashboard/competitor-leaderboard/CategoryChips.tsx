import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryChipsProps {
  availableCategories: string[];
  activeCategory: string | null;
  autoCategory: string | null;
  onChange: (category: string | null) => void;
}

export function CategoryChips({
  availableCategories,
  activeCategory,
  autoCategory,
  onChange,
}: CategoryChipsProps) {
  if (availableCategories.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label
        htmlFor="leaderboard-category-select"
        className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"
      >
        Compare against
      </label>
      <Select
        value={activeCategory ?? "__auto__"}
        onValueChange={(value) => onChange(value === "__auto__" ? null : value)}
      >
        <SelectTrigger
          id="leaderboard-category-select"
          aria-label="Choose comparison category"
          className="h-8 w-[220px] rounded-full border-slate-200 bg-white px-3 font-sans text-xs font-semibold text-slate-700 shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="__auto__">
            {autoCategory ? `Auto (${formatCategory(autoCategory)})` : "Auto"}
          </SelectItem>
          {availableCategories.map((category) => (
            <SelectItem key={category} value={category}>
              {formatCategory(category)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function formatCategory(category: string): string {
  return category.replace(/-/g, " ").toUpperCase();
}
