import { cn } from "@/lib/utils";
import type { SortMetric } from "./types";

interface SortChipsProps {
  value: SortMetric;
  onChange: (metric: SortMetric) => void;
}

const OPTIONS: Array<{ key: SortMetric; label: string }> = [
  { key: "pulse",               label: "Pulse Score" },
  { key: "product_stability",   label: "Product Stability" },
  { key: "customer_experience", label: "Customer Experience" },
  { key: "value_perception",    label: "Value Perception" },
  { key: "volume",              label: "Volume" },
];

export function SortChips({ value, onChange }: SortChipsProps) {
  return (
    <div role="toolbar" aria-label="Sort leaderboard" className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-slate-500">Sort by</span>
      {OPTIONS.map((opt) => {
        const on = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              on
                ? "border-slate-900 bg-slate-900 text-yellow-400"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
