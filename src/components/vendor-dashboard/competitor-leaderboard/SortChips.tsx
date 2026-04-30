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
      <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Sort by
      </span>
      {OPTIONS.map((opt) => {
        const on = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              on
                ? "border-slate-900 bg-slate-900 text-white"
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
